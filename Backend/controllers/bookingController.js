// controllers/bookingController.js
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const Notification = require("../models/Notification");

const { optionalAuth } = require("../middleware/panelAuth");
const {
  notify,
  emitToUser,
  serializeNotification,
} = require("../utils/realtime");
const { parseSessionStart } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");
const {
  linkPaymentToRequest,
  assignMentorToRequest,
} = require("./paymentController");

/* ============================ CONFIG ============================ */
const MENTOR_PUBLIC_FIELDS =
  "name email profilePic currentCompany designation department officeLocation yearsOfExperience languages skills bio linkedinProfile gender rating totalReviews totalSessions isVerified";
const MIN_LEAD_MS = 15 * 60 * 1000;
const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 25);

const MAX_REFUND_ATTEMPTS = 5;
const REFUND_RETRY_GAP_MS = 30 * 60 * 1000;

const NO_SHOW_GRACE_MS =
  (Number(process.env.NO_SHOW_GRACE_MIN) || 15) * 60 * 1000;

const CONFIRM_WAIT_MS =
  (Number(process.env.CONFIRM_WAIT_HOURS) || 24) * 60 * 60 * 1000;
const UNCONFIRMED_ACTION =
  process.env.UNCONFIRMED_ACTION === "refund" ? "refund" : "release";

const RATE_PER_HOUR = Number(process.env.SESSION_RATE_PER_HOUR) || 400;
const expectedPrice = (minutes) => Math.round((RATE_PER_HOUR * minutes) / 60);

/* ============================ HELPERS ============================ */

let razorpay = null;
const getRazorpay = () => {
  if (razorpay) return razorpay;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)
    throw new Error("Razorpay keys not set");
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  return razorpay;
};

const arr = (v) =>
  Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const isAny = (v) =>
  ["", "any", "all", "no preference", "none"].includes(norm(v));
const loose = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

const MENTOR_FIELDS =
  "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";
const POPULATE_MENTOR = "name email profilePic currentCompany designation";

// Real spoken languages. A mentor's `languages` field may also contain skills
// (React, Java...). Only values from this list count as spoken languages.
const SPOKEN_LANGS = new Set([
  "english",
  "tamil",
  "hindi",
  "malayalam",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "urdu",
  "punjabi",
  "odia",
  "assamese",
]);

// Returns "" when the mentor may receive the request, else the reason (with values, for the log).
const whyNot = (m, b) => {
  if (b.companyName && !loose(m.currentCompany, b.companyName))
    return `company mismatch (mentor "${m.currentCompany}" vs "${b.companyName}")`;

  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender))
    return `gender mismatch (mentor "${m.gender}" vs "${b.gender}")`;

  if (
    !isAny(b.role) &&
    norm(m.department) !== norm(b.role) &&
    norm(m.designation) !== norm(b.role)
  )
    return `role mismatch (mentor department "${m.department}" / designation "${m.designation}" vs "${b.role}")`;
  const spoken = [...arr(m.languages), ...arr(m.spokenLanguages)]
    .map(norm)
    .filter((l) => SPOKEN_LANGS.has(l));
  if (
    !isAny(b.language) &&
    spoken.length &&
    !spoken.some((l) => loose(l, b.language))
  )
    return `language mismatch (mentor [${spoken.join(", ")}] vs "${b.language}")`;

  return "";
};

const socketIdsOf = (app, mentorId) => {
  const map = app.get("onlineMentors");
  const entry = map && map.get(String(mentorId));
  if (!entry) return [];
  return Array.from(entry instanceof Set ? entry : [].concat(entry));
};

const emitToMentorSockets = (app, mentorId, event, payload) => {
  const io = app.get("io");
  if (!io) return;
  socketIdsOf(app, mentorId).forEach((sid) => io.to(sid).emit(event, payload));
};

const hasConflict = (mentorId, startsAt, endsAt, excludeId) =>
  Booking.exists({
    mentor: mentorId,
    status: { $in: ["accepted", "in_progress"] },
    requestGroupId: { $ne: excludeId || "" },
    startsAt: { $lt: new Date(new Date(endsAt).getTime() + GAP_MS) },
    endsAt: { $gt: new Date(new Date(startsAt).getTime() - GAP_MS) },
  });

const toMentorPayload = (b) => ({
  id: b.requestGroupId,
  requestGroupId: b.requestGroupId,
  name: b.fresherName || "Fresher",
  avatar: b.fresherImage || "",
  requester: {
    fullName: b.fresherName,
    email: b.fresherEmail,
    image: b.fresherImage,
  },
  role:
    norm(b.role) === "other" && b.otherRole ? b.otherRole : b.role || "Fresher",
  company: b.companyName,
  companyName: b.companyName,
  topic: b.sessionType || "Session",
  date: b.date,
  time: b.time,
  duration: b.durationMinutes,
  amount: b.amount,
  message: b.reason,
  type: "Video Call",
  gender: b.gender,
  language: b.language,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  expiresAt: b.expiresAt,
  status: "pending",
  direct: Boolean(b.preferredMentor),
});

const mentorCard = (m) =>
  m && typeof m === "object" && m.name
    ? {
        id: String(m._id),
        name: m.name,
        designation: m.designation || "",
        company: m.currentCompany || "",
        image: m.profilePic || "",
        email: m.email || "",
      }
    : null;

const isRunning = (b) =>
  b.status === "in_progress" &&
  Boolean(b.meeting?.timerEndsAt) &&
  !b.meeting?.endedAt;

const remainingOf = (b) =>
  isRunning(b)
    ? Math.max(0, new Date(b.meeting.timerEndsAt).getTime() - Date.now())
    : (b.meeting?.remainingMs ?? null);

const toClient = (b) => ({
  id: b.requestGroupId,
  requestGroupId: b.requestGroupId,
  status: b.status,
  companyName: b.companyName,
  sessionType: b.sessionType,
  reason: b.reason,
  language: b.language,
  role: b.role,
  otherRole: b.otherRole,
  durationMinutes: b.durationMinutes,
  amount: b.amount,
  date: b.date,
  time: b.time,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  expiresAt: b.expiresAt,
  opensAt: new Date(new Date(b.startsAt).getTime() - OPEN_BEFORE_MS),
  mentor:
    mentorCard(b.mentor) ||
    (b.status === "pending" ? mentorCard(b.preferredMentor) : null),
  direct: Boolean(b.preferredMentor),
  reviewed: Boolean(b.reviewed),
  refundStatus: b.refundStatus || "",
  remainingMs: remainingOf(b),
  timerRunning: isRunning(b),
});

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ============================ REFUNDS ============================ */

const isWalletPayment = (p) =>
  Boolean(p) &&
  (p.method === "wallet" ||
    String(p.razorpayPaymentId || "").startsWith("wallet_pay_"));

/**
 * ONE refund function for everything. Returns "refunded" | "failed".
 * Payment is locked first (paid -> refunded, atomic) so it can never be refunded twice.
 * If the refund fails the lock is released so the scheduler can retry.
 */
const refundPayment = async (payment, reason = "", options = {}) => {
  if (!payment) return "failed";
  if (payment.status === "refunded") return "refunded";

  const toWallet = options.to === "wallet" || isWalletPayment(payment);

  const before = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        sessionStatus: "cancelled",
        ...(toWallet ? { refundMethod: "wallet" } : {}),
      },
    },
    { returnDocument: "before" },
  );

  if (!before) {
    const cur = await Payment.findById(payment._id).select("status").lean();
    return cur?.status === "refunded" ? "refunded" : "failed";
  }

  const unlock = async () => {
    const back = { status: "paid" };
    if (before.sessionStatus) back.sessionStatus = before.sessionStatus;
    await Payment.updateOne(
      { _id: before._id, status: "refunded" },
      { $set: back },
    ).catch(() => {});
  };

  const amount = Number(before.amount) || 0;

  try {
    // wallet refund: Razorpay knows nothing about this payment, so do NOT call it
    if (toWallet) {
      if (!before.fresher) {
        await unlock();
        return "failed";
      }
      await Fresher.updateOne(
        { _id: before.fresher },
        { $inc: { walletBalance: amount, totalRefunds: amount } },
      );
      emitToUser(String(before.fresher), "wallet:updated", { amount });
      return "refunded";
    }

    if (!before.razorpayPaymentId) {
      await unlock();
      return "failed";
    }

    await getRazorpay().payments.refund(before.razorpayPaymentId, {
      amount: Math.round(amount * 100),
      speed: "normal",
      notes: { reason: String(reason).slice(0, 100) },
    });
    return "refunded";
  } catch (error) {
    const rz = error?.error || {};
    const desc = rz.description || error.message || "";

    if (!toWallet && /already.*refund|fully refunded/i.test(desc))
      return "refunded";

    console.error("REFUND FAILED:", {
      payment: before.razorpayPaymentId,
      amount,
      statusCode: error?.statusCode,
      code: rz.code,
      field: rz.field,
      reason: rz.reason,
      description: desc,
    });

    await Payment.updateOne(
      { _id: before._id },
      {
        $set: {
          refundError: String(desc).slice(0, 300),
          refundFailedAt: new Date(),
        },
      },
    ).catch(() => {});

    await unlock();
    return "failed";
  }
};

/**
 * Close a booking in one of the `from` statuses, set it to `to`, refund the fresher.
 * Atomic on the booking status, so only one caller can win.
 */
const closeAndRefund = async (
  bookingId,
  { from, to, reason, title, mentorNote },
) => {
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: from } },
    { $set: { status: to } },
    { returnDocument: "after" },
  );
  if (!locked) return null;

  const payment = locked.razorpayPaymentId
    ? await Payment.findOne({ razorpayPaymentId: locked.razorpayPaymentId })
    : null;
  const result = await refundPayment(payment, reason);
  await Booking.updateOne(
    { _id: locked._id },
    { $set: { refundStatus: result } },
  );

  const fresh = await Booking.findById(locked._id).populate(
    "mentor",
    POPULATE_MENTOR,
  );
  if (!fresh) return null;

  if (fresh.fresher) {
    const wallet = isWalletPayment(payment);
    const refundedText = wallet
      ? `Your payment of ₹${fresh.amount} was added back to your wallet.`
      : `Your payment of ₹${fresh.amount} is being refunded.`;

    notify({
      user: fresh.fresher,
      role: "fresher",
      title:
        result === "refunded"
          ? `${title || "Request closed"} - refund started`
          : title || "Request closed",
      message:
        result === "refunded"
          ? `${reason} ${refundedText}`
          : `${reason} Refund is processing, we will update you soon.`,
      type: "payment",
      link: "/Home",
    });
    emitToUser(fresh.fresher, "booking:updated", toClient(fresh));
  }

  if (mentorNote && fresh.mentor) {
    notify({
      user: fresh.mentor._id,
      role: "mentor",
      title: "Session missed",
      message: mentorNote,
      type: "session",
      link: "/mentor/sessions",
    });
    emitToUser(fresh.mentor._id, "booking:updated", toClient(fresh));
  }

  return fresh;
};

const expireAndRefund = (bookingId, reason) =>
  closeAndRefund(bookingId, {
    from: ["pending"],
    to: "expired",
    reason,
    title: "Request expired",
  });

/* ============================ BROADCAST ============================ */

const broadcastLoop = async (
  req,
  mentors,
  booking,
  payload,
  startsAt,
  endsAt,
  requestGroupId,
  notified,
) => {
  const direct = Boolean(booking.preferredMentor);
  const report = [];

  for (const m of mentors) {
    const label = `${m.name || m._id} (${m.currentCompany || "-"}/${m.department || "-"}/${m.gender || "-"})`;

    if (await hasConflict(m._id, startsAt, endsAt, requestGroupId)) {
      report.push(`${label}: SKIP busy (another session within 30 min)`);
      continue;
    }

    const online = socketIdsOf(req.app, m._id).length > 0;

    // direct + offline: leave a notification; pushPendingToMentor delivers when they connect
    if (direct && !online) {
      report.push(`${label}: direct, offline -> notification only`);
      notify({
        user: m._id,
        role: "mentor",
        title: "A fresher requested you again",
        message: `${booking.fresherName} wants a session.`,
        type: "session",
        link: "/mentor/home",
      });
      continue;
    }

    const reason =
      (direct ? "" : whyNot(m, booking)) ||
      (!online ? "not online (no socket in onlineMentors map)" : "");
    if (reason) {
      report.push(`${label}: SKIP ${reason}`);
      continue;
    }

    report.push(`${label}: SENT`);
    notified.push(m._id);
    emitToMentorSockets(req.app, m._id, "session-request", payload);
    notify({
      user: m._id,
      role: "mentor",
      title: direct ? "A fresher requested you again" : "New session request",
      message: `${booking.fresherName} wants a session.`,
      type: "session",
      link: "/mentor/home",
    });
  }

  console.log(
    `[request ${requestGroupId}] needs company="${booking.companyName}" dept="${booking.role}" gender="${booking.gender}" lang="${booking.language}"\n  ${
      report.join("\n  ") || "no approved+active mentors found"
    }`,
  );
};

const withdrawOverlapping = async (app, mentorId, accepted) => {
  try {
    const overlapping = await Booking.find({
      _id: { $ne: accepted._id },
      status: "pending",
      startsAt: { $lt: new Date(new Date(accepted.endsAt).getTime() + GAP_MS) },
      endsAt: { $gt: new Date(new Date(accepted.startsAt).getTime() - GAP_MS) },
      $or: [{ notified: mentorId }, { preferredMentor: mentorId }],
    });

    for (const b of overlapping) {
      const isMine =
        b.preferredMentor && String(b.preferredMentor) === String(mentorId);

      if (isMine) {
        await expireAndRefund(
          b._id,
          "The mentor you selected has another session at that time.",
        );
      } else {
        await Booking.updateOne(
          { _id: b._id },
          { $pull: { notified: mentorId } },
        );
      }

      emitToMentorSockets(app, mentorId, "session-request-taken", {
        id: b.requestGroupId,
        requestGroupId: b.requestGroupId,
      });
    }
  } catch (error) {
    console.error("withdrawOverlapping error:", error.message);
  }
};

/* ============================ CREATE ============================ */

exports.createRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const body = req.body || {};
    const sd = body.sessionDetails || {};
    const requestGroupId = String(body.requestGroupId || "").trim();
    const paymentId = String(body.razorpayPaymentId || "").trim();
    const preferredMentorId = mongoose.Types.ObjectId.isValid(
      body.preferredMentorId,
    )
      ? String(body.preferredMentorId)
      : null;

    if (!requestGroupId || !paymentId)
      return fail(res, 400, "requestGroupId and paymentId required");

    const existing = await Booking.findOne({ requestGroupId }).populate(
      "mentor",
      POPULATE_MENTOR,
    );
    if (existing)
      return res.json({
        success: true,
        booking: toClient(existing),
        notifiedCount: existing.notified.length,
      });

    const payment = await Payment.findOne({
      razorpayPaymentId: paymentId,
      status: "paid",
    });
    if (!payment) return fail(res, 402, "Payment not verified");

    if (await Booking.exists({ razorpayPaymentId: paymentId })) {
      return fail(res, 409, "This payment is already used for another booking");
    }

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message);
      return fail(
        res,
        status,
        `${message}${result === "refunded" ? " Refunded." : ""}`,
      );
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 240)
      return reject(400, "Invalid duration");

    if (Number(payment.amount) !== expectedPrice(minutes)) {
      return reject(400, "Payment amount does not match the session price.");
    }

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt || startsAt.getTime() < Date.now() + MIN_LEAD_MS)
      return reject(400, "Invalid date/time");
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    let preferredMentor = null;
    if (preferredMentorId) {
      preferredMentor = await Mentor.findOne({
        _id: preferredMentorId,
        verificationStatus: "approved",
        accountStatus: "active",
      })
        .select(MENTOR_FIELDS)
        .lean();
      if (!preferredMentor)
        return reject(400, "Selected mentor is not available.");

      if (
        await hasConflict(preferredMentor._id, startsAt, endsAt, requestGroupId)
      ) {
        return reject(
          409,
          "This mentor has another session around that time. Please pick another time.",
        );
      }
    }

    const fresherId =
      req.user?.role === "fresher"
        ? req.user.id
        : payment.fresher
          ? String(payment.fresher)
          : null;
    const fresherDoc = fresherId
      ? await Fresher.findById(fresherId).select("name email gender").lean()
      : null;

    const fresherGender =
      [fresherDoc?.gender, sd.gender]
        .map(norm)
        .find((g) => g === "male" || g === "female") || "";

    const department = String(sd.role || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!preferredMentor) {
      if (!fresherGender) return reject(400, "Please select your gender.");
      if (!department) return reject(400, "Please select a department.");
    }

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: fresherDoc?.name || body.requester?.fullName || "Fresher",
      fresherEmail: fresherDoc?.email || body.requester?.email || "",
      fresherImage: String(body.requester?.image || ""),
      companyName: String(
        preferredMentor?.currentCompany || body.companyName || "",
      ).trim(),
      sessionType: String(sd.sessionType || "").slice(0, 60),
      reason: String(sd.reason || "").slice(0, 1000),
      role: department,
      otherRole: "",
      gender: fresherGender,
      language: String(sd.language || ""),
      durationMinutes: minutes,
      amount: Number(payment.amount),
      date: String(sd.date),
      time: String(sd.time),
      startsAt,
      endsAt,
      expiresAt: startsAt,
      razorpayPaymentId: paymentId,
      preferredMentor: preferredMentor ? preferredMentor._id : null,
    });

    await linkPaymentToRequest({
      razorpayPaymentId: paymentId,
      requestGroupId,
      topic: booking.sessionType || booking.companyName,
      date: booking.date,
      time: booking.time,
      duration: minutes,
    });

    const mentors = preferredMentor
      ? [preferredMentor]
      : await Mentor.find({
          verificationStatus: "approved",
          accountStatus: "active",
        })
          .select(MENTOR_FIELDS)
          .lean();

    const notified = [];
    await broadcastLoop(
      req,
      mentors,
      booking,
      toMentorPayload(booking),
      startsAt,
      booking.endsAt,
      requestGroupId,
      notified,
    );
    if (notified.length)
      await Booking.updateOne({ _id: booking._id }, { $set: { notified } });

    const out = await Booking.findById(booking._id)
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);

    return res.status(201).json({
      success: true,
      booking: toClient(out || booking),
      notifiedCount: notified.length,
    });
  } catch (error) {
    if (error?.code === 11000)
      return fail(res, 409, "This payment is already used for another booking");
    console.error("createRequest error:", error);
    return fail(res, 500, "Failed to create request");
  }
};

/* ============================ ACCEPT / REJECT ============================ */

exports.updateRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const requestGroupId = String(
      req.params.requestGroupId || req.params.id || "",
    ).trim();
    const status = String(req.body?.status || "")
      .trim()
      .toLowerCase();

    if (req.user?.role !== "mentor")
      return fail(res, 401, "Mentor login required");
    const mentorId = req.user.id;

    if (!["accepted", "rejected"].includes(status))
      return fail(res, 400, "Status must be accepted/rejected");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Request not found");

    const isDirect = Boolean(booking.preferredMentor);
    if (isDirect && String(booking.preferredMentor) !== String(mentorId)) {
      return fail(res, 403, "This request is for another mentor");
    }

    // normal request: the mentor was sent it, OR matches the request rules
    // (covers a mentor who connected after the request was created)
    if (
      !isDirect &&
      !(booking.notified || []).map(String).includes(String(mentorId))
    ) {
      const mentor = await Mentor.findById(mentorId)
        .select(MENTOR_FIELDS)
        .lean();
      if (!mentor || whyNot(mentor, booking))
        return fail(res, 403, "This request was not sent to you");
    }

    if (status === "rejected") {
      await Booking.updateOne(
        { _id: booking._id },
        { $addToSet: { declinedBy: mentorId } },
      );
      if (isDirect && booking.status === "pending") {
        await expireAndRefund(
          booking._id,
          "The mentor you selected is not available for this slot.",
        );
      }
      return res.json({ success: true, status: "rejected" });
    }

    if (booking.status !== "pending" || booking.expiresAt <= new Date())
      return fail(res, 409, "Request unavailable");

    if (
      await hasConflict(
        mentorId,
        booking.startsAt,
        booking.endsAt,
        requestGroupId,
      )
    ) {
      return fail(res, 409, "You have another session near this time");
    }

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      {
        $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() },
      },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Already accepted");

    await assignMentorToRequest({ requestGroupId, mentorId }).catch(() => {});

    emitToUser(accepted.fresher, "booking:updated", toClient(accepted));

    (accepted.notified || [])
      .filter((id) => String(id) !== String(mentorId))
      .forEach((id) =>
        emitToMentorSockets(req.app, id, "session-request-taken", {
          id: accepted.requestGroupId,
          requestGroupId: accepted.requestGroupId,
        }),
      );

    await withdrawOverlapping(req.app, mentorId, accepted);

    return res.json({
      success: true,
      status: "accepted",
      booking: toClient(accepted),
    });
  } catch (error) {
    console.error("updateRequest error:", error);
    return fail(res, 500, "Failed to update");
  }
};

exports.respondToRequest = exports.updateRequest;

/* ============================ READ ============================ */

exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({
      requestGroupId: String(req.params.requestGroupId || ""),
    })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    return res.json({
      success: true,
      request: toClient(b),
      booking: toClient(b),
    });
  } catch (error) {
    return fail(res, 500, "Failed to load request");
  }
};

exports.getAcceptedBookings = async (req, res) => {
  try {
    const email = norm(req.query.email);
    if (!email) return fail(res, 400, "Email is required");
    const list = await Booking.find({
      fresherEmail: email,
      status: { $in: ["accepted", "in_progress", "completed"] },
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ startsAt: -1 });
    const bookings = list.map((b) => ({
      ...toClient(b),
      bookingId: b.requestGroupId,
      mentorName: b.mentor?.name || "Mentor",
    }));
    return res.json({ success: true, bookings, count: bookings.length });
  } catch (error) {
    return fail(res, 500, "Failed to fetch bookings");
  }
};

exports.myBookings = async (req, res) => {
  try {
    const list = await Booking.find({ fresher: req.user.id })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR)
      .sort({ startsAt: -1 });
    return res.json({ success: true, bookings: list.map(toClient) });
  } catch (error) {
    return fail(res, 500, "Failed to load bookings");
  }
};

exports.needsReview = async (req, res) => {
  try {
    const b = await Booking.findOne({
      fresher: req.user.id,
      status: "completed",
      reviewed: false,
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ completedAt: 1 });
    return res.json({ success: true, booking: b ? toClient(b) : null });
  } catch (error) {
    return fail(res, 500, "Failed to check reviews");
  }
};

exports.getBooking = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.id) })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    const mine =
      String(b.fresher) === req.user.id ||
      String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "Access denied");
    return res.json({ success: true, booking: toClient(b) });
  } catch (error) {
    return fail(res, 500, "Failed to load booking");
  }
};

exports.getCounterpart = async (req, res) => {
  try {
    const b = await Booking.findOne({
      requestGroupId: String(req.params.id || "").trim(),
    }).lean();
    if (!b) return fail(res, 404, "Booking not found");
 
    const me = String(req.user?.id || "");
    const isFresher = Boolean(b.fresher) && String(b.fresher) === me;
    const isMentor = Boolean(b.mentor) && String(b.mentor) === me;
    if (!isFresher && !isMentor) return fail(res, 403, "Access denied");
 
    const session = {
      sessionType: b.sessionType || "",
      reason: b.reason || "",
      date: b.date || "",
      time: b.time || "",
      durationMinutes: b.durationMinutes,
      language: b.language || "",
      role: b.role || "",
      companyName: b.companyName || "",
    };
 
    // ---- fresher is asking -> show the mentor ----
    if (isFresher) {
      if (!b.mentor)
        return fail(res, 404, "No employee has accepted this booking yet.");
 
      const m = await Mentor.findById(b.mentor)
        .select(MENTOR_PUBLIC_FIELDS)
        .lean();
      if (!m) return fail(res, 404, "Employee not found");
 
      return res.json({
        success: true,
        kind: "mentor",
        person: {
          id: String(m._id),
          name: m.name || "",
          email: m.email || "",
          image: m.profilePic || "",
          gender: m.gender || "",
          company: m.currentCompany || "",
          designation: m.designation || "",
          department: m.department || "",
          officeLocation: m.officeLocation || "",
          yearsOfExperience: m.yearsOfExperience || 0,
          languages: m.languages || [],
          skills: m.skills || [],
          bio: m.bio || "",
          linkedinProfile: m.linkedinProfile || "",
          rating: m.rating || 0,
          totalReviews: m.totalReviews || 0,
          totalSessions: m.totalSessions || 0,
          isVerified: Boolean(m.isVerified),
        },
        session,
      });
    }
 
    // ---- mentor is asking -> show the fresher ----
    const f = b.fresher
      ? await Fresher.findById(b.fresher)
          .select("name email gender profilePic")
          .lean()
      : null;
 
    return res.json({
      success: true,
      kind: "fresher",
      person: {
        id: b.fresher ? String(b.fresher) : "",
        name: f?.name || b.fresherName || "Fresher",
        email: f?.email || b.fresherEmail || "",
        image: f?.profilePic || b.fresherImage || "",
        gender: f?.gender || b.gender || "",
      },
      session,
    });
  } catch (error) {
    console.error("getCounterpart error:", error);
    return fail(res, 500, "Failed to load details");
  }
};
// Pending requests for THIS mentor: direct ones addressed to him + normal ones that match
// his profile (company / gender / department / language). Does not depend on `notified`,
// so a mentor who opens the page later still sees every request.
exports.mentorPending = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.user.id)
      .select(`${MENTOR_FIELDS} verificationStatus accountStatus`)
      .lean();
    if (
      !mentor ||
      mentor.verificationStatus !== "approved" ||
      mentor.accountStatus !== "active"
    )
      return res.json({ success: true, requests: [] });

    const list = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
      $or: [
        { preferredMentor: null },
        { preferredMentor: { $exists: false } },
        { preferredMentor: mentor._id },
      ],
    }).sort({ createdAt: -1 });

    const free = [];
    for (const b of list) {
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId))
        continue;
      const reason = b.preferredMentor ? "" : whyNot(mentor, b);
      if (reason) {
        console.log(
          `[mentorPending] ${mentor.name} skip ${b.requestGroupId}: ${reason}`,
        );
        continue;
      }
      if (!(b.notified || []).map(String).includes(String(mentor._id)))
        await Booking.updateOne(
          { _id: b._id },
          { $addToSet: { notified: mentor._id } },
        );
      free.push(b);
    }

    return res.json({ success: true, requests: free.map(toMentorPayload) });
  } catch (error) {
    console.error("mentorPending error:", error);
    return fail(res, 500, "Failed to load requests");
  }
};

/* ============================ COMPLETION ============================ */

const pushTimerOff = (b) => {
  const payload = {
    requestGroupId: b.requestGroupId,
    running: false,
    remainingMs: 0,
  };
  emitToUser(b.fresher, "meeting:timer", payload);
  if (b.mentor) emitToUser(b.mentor._id || b.mentor, "meeting:timer", payload);
};

const settleCompleted = async (booking, { auto = false } = {}) => {
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: { $in: ["awaiting_confirmation", "in_progress", "accepted"] },
    },
    {
      $set: {
        status: "completed",
        completedAt: now,
        "meeting.remainingMs": 0,
        "meeting.endedAt": now,
      },
    },
    { returnDocument: "after" },
  ).populate("mentor", POPULATE_MENTOR);
  if (!updated) return null;

  const paymentFilter = {
    status: "paid",
    $or: [
      { requestGroupId: updated.requestGroupId },
      ...(updated.razorpayPaymentId
        ? [{ razorpayPaymentId: updated.razorpayPaymentId }]
        : []),
    ],
  };

  const settledPayment = await Payment.findOneAndUpdate(
    paymentFilter,
    {
      $set: {
        sessionStatus: "completed",
        releasedAt: now,
        ...(updated.mentor ? { mentor: updated.mentor._id } : {}),
      },
    },
    { returnDocument: "after" },
  );

  const mentorShare = settledPayment
    ? settledPayment.mentorEarning
    : splitAmount(Number(updated.amount || 0), PLATFORM_FEE_PERCENT).earning;

  if (updated.mentor) {
    await Mentor.updateOne(
      { _id: updated.mentor._id },
      { $inc: { totalSessions: 1 } },
    );
    notify({
      user: updated.mentor._id,
      role: "mentor",
      title: "Session confirmed & Paid",
      message: auto
        ? `The session was auto-confirmed. ₹${mentorShare} added to your wallet.`
        : `Fresher confirmed the session. ₹${mentorShare} added to your wallet.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(updated.mentor._id, "wallet:updated", {
      requestGroupId: updated.requestGroupId,
    });
    emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
  }

  if (auto && updated.fresher) {
    notify({
      user: updated.fresher,
      role: "fresher",
      title: "Session auto-confirmed",
      message:
        "You did not confirm the session in time, so it was marked as completed.",
      type: "session",
      link: "/Home/my-bookings",
    });
  }

  emitToUser(updated.fresher, "booking:updated", toClient(updated));
  pushTimerOff(updated);
  return updated;
};

const completeBooking = async (requestGroupId) => {
  const pre = await Booking.findOne({
    requestGroupId,
    status: { $in: ["accepted", "in_progress"] },
  });
  if (!pre) return null;

  if (pre.meeting?.fresherConfirmed) return settleCompleted(pre);

  const b = await Booking.findOneAndUpdate(
    { requestGroupId, status: { $in: ["accepted", "in_progress"] } },
    {
      $set: {
        status: "awaiting_confirmation",
        "meeting.remainingMs": 0,
        "meeting.endedAt": new Date(),
      },
    },
    { returnDocument: "after" },
  ).populate("mentor", POPULATE_MENTOR);
  if (!b) return null;

  notify({
    user: b.fresher,
    role: "fresher",
    title: "Session ended",
    message: "Did the session go well? Please confirm to release payment.",
    type: "session",
    link: `/Home/meeting/${b.requestGroupId}`,
  });

  emitToUser(b.fresher, "booking:updated", toClient(b));
  if (b.mentor) emitToUser(b.mentor._id, "booking:updated", toClient(b));
  pushTimerOff(b);
  return b;
};

exports.completeBooking = completeBooking;

exports.confirmCompletion = async (req, res) => {
  try {
    const requestGroupId = String(req.params.requestGroupId || "").trim();
    const accepted = Boolean(req.body?.accepted);

    const booking = await Booking.findOne({ requestGroupId }).populate(
      "mentor",
      POPULATE_MENTOR,
    );
    if (!booking) return fail(res, 404, "Session not found");
    if (String(booking.fresher) !== req.user.id)
      return fail(res, 403, "Access denied");

    if (booking.status === "completed")
      return res.json({
        success: true,
        status: "completed",
        booking: toClient(booking),
      });
    if (booking.status === "disputed")
      return res.json({
        success: true,
        status: "disputed",
        booking: toClient(booking),
      });
    if (booking.status !== "awaiting_confirmation")
      return fail(res, 400, "This session is not awaiting confirmation.");

    if (accepted) {
      const updated = await settleCompleted(booking);
      if (!updated) return fail(res, 409, "Session already updated");
      return res.json({
        success: true,
        status: "completed",
        booking: toClient(updated),
      });
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      { $set: { status: "disputed", completedAt: new Date() } },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);
    if (!updated) return fail(res, 409, "Session already updated");

    const payment = await Payment.findOne({
      razorpayPaymentId: booking.razorpayPaymentId,
    });
    const result = await refundPayment(
      payment,
      "Fresher marked the session as not complete",
      { to: "wallet" },
    );
    await Booking.updateOne(
      { _id: updated._id },
      { $set: { refundStatus: result } },
    );
    updated.refundStatus = result;

    notify({
      user: updated.fresher,
      role: "fresher",
      title:
        result === "refunded"
          ? "Refund added to wallet"
          : "Refund is processing",
      message:
        result === "refunded"
          ? `₹${updated.amount} was added back to your wallet.`
          : "We could not add the refund yet. We will retry automatically.",
      type: "payment",
      link: "/Home/wallet",
    });

    emitToUser(updated.fresher, "booking:updated", toClient(updated));
    emitToUser(updated.fresher, "wallet:updated", { amount: booking.amount });
    if (updated.mentor)
      emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
    return res.json({
      success: true,
      status: "disputed",
      booking: toClient(updated),
    });
  } catch (error) {
    console.error("confirmCompletion error:", error);
    return fail(res, 500, "Unable to confirm session");
  }
};

/* ============================ FRESHER NOTIFICATIONS ============================ */

exports.getFresherNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const filter = { user: req.user.id, role: "fresher" };
    const [items, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    return res.json({
      success: true,
      notifications: items.map(serializeNotification),
      unreadCount,
    });
  } catch (error) {
    return fail(res, 500, "Unable to load notifications.");
  }
};

exports.markFresherNotificationRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return fail(res, 400, "Invalid id.");
    await Notification.updateOne(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notification.");
  }
};

exports.markAllFresherNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, role: "fresher", read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notifications.");
  }
};

/* ============================ SCHEDULERS ============================ */

let schedulerBusy = false;

exports.startSchedulers = (app) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    if (schedulerBusy) return;
    schedulerBusy = true;

    try {
      const now = new Date();

      // 1) nobody accepted before the start time -> expire + refund
      const stale = await Booking.find({
        status: "pending",
        expiresAt: { $lte: now },
      }).select("_id");
      for (const b of stale) {
        await expireAndRefund(
          b._id,
          "No employee accepted your request in time.",
        );
      }

      // 2) NO-SHOW
      const noShows = await Booking.find({
        status: "accepted",
        startsAt: { $lte: new Date(now.getTime() - NO_SHOW_GRACE_MS) },
        "meeting.timerEndsAt": null,
      }).select("_id");
      for (const b of noShows) {
        await closeAndRefund(b._id, {
          from: ["accepted"],
          to: "missed",
          title: "Session missed",
          reason:
            "The session did not start because both of you did not join in time.",
          mentorNote:
            "The session did not start in time, so it was marked as missed and the fresher was refunded.",
        });
      }

      // 3) fresher never answered "did it go well?"
      const unconfirmed = await Booking.find({
        status: "awaiting_confirmation",
        "meeting.endedAt": { $lte: new Date(now.getTime() - CONFIRM_WAIT_MS) },
      }).select("_id");
      for (const b of unconfirmed) {
        if (UNCONFIRMED_ACTION === "refund") {
          await closeAndRefund(b._id, {
            from: ["awaiting_confirmation"],
            to: "cancelled",
            title: "Session not confirmed",
            reason: "The session was not confirmed in time.",
          });
        } else {
          const full = await Booking.findById(b._id);
          if (full) await settleCompleted(full, { auto: true });
        }
      }

      // 4) retry failed refunds
      const failedRefunds = await Booking.find({
        status: { $in: ["expired", "missed", "cancelled", "disputed"] },
        refundStatus: "failed",
        razorpayPaymentId: { $ne: "" },
        refundAttempts: { $not: { $gte: MAX_REFUND_ATTEMPTS } },
        $or: [
          { lastRefundAttemptAt: null },
          {
            lastRefundAttemptAt: {
              $lte: new Date(now.getTime() - REFUND_RETRY_GAP_MS),
            },
          },
        ],
      }).limit(10);

      for (const b of failedRefunds) {
        await Booking.updateOne(
          { _id: b._id },
          {
            $inc: { refundAttempts: 1 },
            $set: { lastRefundAttemptAt: new Date() },
          },
        );

        const payment = await Payment.findOne({
          razorpayPaymentId: b.razorpayPaymentId,
        });
        const result = await refundPayment(payment, "Retry: session refund", {
          to: b.status === "disputed" ? "wallet" : "auto",
        });

        if (result === "refunded") {
          await Booking.updateOne(
            { _id: b._id },
            { $set: { refundStatus: "refunded" } },
          );
          if (b.fresher) {
            notify({
              user: b.fresher,
              role: "fresher",
              title: "Refund completed",
              message: `Your refund of ₹${b.amount} has been processed.`,
              type: "payment",
              link: "/Home",
            });
            emitToUser(b.fresher, "booking:updated", {
              requestGroupId: b.requestGroupId,
              refundStatus: "refunded",
            });
          }
        }
      }

      // 5) overdue running timers
      const overdue = await Booking.find({
        status: "in_progress",
        "meeting.timerEndsAt": { $lte: now },
      }).select("requestGroupId");
      for (const b of overdue) await completeBooking(b.requestGroupId);

      // 6) reminders
      const soon = await Booking.find({
        status: "accepted",
        reminderSent: false,
        startsAt: { $lte: new Date(now.getTime() + 5 * 60000) },
      });
      for (const b of soon)
        await Booking.updateOne(
          { _id: b._id },
          { $set: { reminderSent: true } },
        );
    } catch (e) {
      console.error("scheduler error:", e);
    } finally {
      schedulerBusy = false;
    }
  }, 30000);
};

exports.pushPendingToMentor = async (app, mentorId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(mentorId)) return;

    const mentor = await Mentor.findById(mentorId)
      .select(`${MENTOR_FIELDS} verificationStatus accountStatus`)
      .lean();
    if (
      !mentor ||
      mentor.verificationStatus !== "approved" ||
      mentor.accountStatus !== "active"
    )
      return;

    const open = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
      $or: [
        { preferredMentor: null },
        { preferredMentor: { $exists: false } },
        { preferredMentor: mentor._id },
      ],
    });

    for (const b of open) {
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId))
        continue;

      const reason = b.preferredMentor ? "" : whyNot(mentor, b);
      if (reason) {
        console.log(
          `[pushPending] ${mentor.name} skip ${b.requestGroupId}: ${reason}`,
        );
        continue;
      }

      await Booking.updateOne(
        { _id: b._id },
        { $addToSet: { notified: mentor._id } },
      );
      emitToMentorSockets(
        app,
        mentor._id,
        "session-request",
        toMentorPayload(b),
      );
    }
  } catch (error) {
    console.error("pushPendingToMentor error:", error.message);
  }
};

exports.whyNot = whyNot;
