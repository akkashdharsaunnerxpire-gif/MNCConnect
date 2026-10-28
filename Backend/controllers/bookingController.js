// controllers/bookingController.js
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const Notification = require("../models/Notification");

const { optionalAuth } = require("../middleware/panelAuth");
const { notify, emitToUser, serializeNotification } = require("../utils/realtime");
const { parseSessionStart } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");
const { linkPaymentToRequest, assignMentorToRequest } = require("./paymentController");

/* ============================ CONFIG ============================ */

const MIN_LEAD_MS = 15 * 60 * 1000;
const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const STRICT_MATCH = process.env.STRICT_MENTOR_MATCH === "true";
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 25);

// accepted session, but the timer never started this long after startsAt -> "missed" + refund
const NO_SHOW_GRACE_MS = (Number(process.env.NO_SHOW_GRACE_MIN) || 15) * 60 * 1000;

// session happened (timer ended) but the fresher never answered "did it go well?"
const CONFIRM_WAIT_MS = (Number(process.env.CONFIRM_WAIT_HOURS) || 24) * 60 * 60 * 1000;
// "release" = pay the mentor (session really happened)   |   "refund" = give the fresher the money back
const UNCONFIRMED_ACTION = process.env.UNCONFIRMED_ACTION === "refund" ? "refund" : "release";

// Must match priceFor() in the frontend (fresherApi.js): ₹400 per hour.
// If your priceFor() uses a different formula, change expectedPrice() below.
const RATE_PER_HOUR = Number(process.env.SESSION_RATE_PER_HOUR) || 400;
const expectedPrice = (minutes) => Math.round((RATE_PER_HOUR * minutes) / 60);

/* ============================ HELPERS ============================ */

let razorpay = null;
const getRazorpay = () => {
  if (razorpay) return razorpay;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("Razorpay keys not set");
  razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return razorpay;
};

const arr = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []);
const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const isAny = (v) => ["", "any", "all", "no preference", "none"].includes(norm(v));
const loose = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

const MENTOR_FIELDS =
  "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";
const POPULATE_MENTOR = "name email profilePic currentCompany designation";

const whyNot = (m, b) => {
  if (b.companyName && !loose(m.currentCompany, b.companyName)) return "company mismatch";

  // fresher gender -> same gender mentor only
  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender)) return "gender mismatch";

  // department chosen by the fresher -> mentors of that department only
  if (!isAny(b.role) && norm(m.department) !== norm(b.role)) return "department mismatch";

  // Mentor schema field is `languages` (spokenLanguages does not exist, so the filter never ran before)
  const spoken = [...arr(m.languages), ...arr(m.spokenLanguages)].map(norm).filter(Boolean);
  if (!isAny(b.language) && spoken.length && !spoken.some((l) => loose(l, b.language))) return "language mismatch";

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

// true when the mentor already has an ACCEPTED / RUNNING session that overlaps
// [startsAt, endsAt] (including the 30 minute gap on both sides)
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
  requester: { fullName: b.fresherName, email: b.fresherEmail, image: b.fresherImage },
  role: norm(b.role) === "other" && b.otherRole ? b.otherRole : b.role || "Fresher",
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
  expiresAt: b.expiresAt,
  status: "pending",
  direct: Boolean(b.preferredMentor), // fresher picked THIS mentor (book again)
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

// Timer values come from timerEndsAt, so cards and the meeting room show the same value
const isRunning = (b) =>
  b.status === "in_progress" && Boolean(b.meeting?.timerEndsAt) && !b.meeting?.endedAt;

const remainingOf = (b) =>
  isRunning(b)
    ? Math.max(0, new Date(b.meeting.timerEndsAt).getTime() - Date.now())
    : b.meeting?.remainingMs ?? null;

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
  // accepted mentor, or (while a direct request is still pending) the mentor the fresher chose
  // (preferredMentor is only a card when it was populated; a bare ObjectId gives null)
  mentor: mentorCard(b.mentor) || (b.status === "pending" ? mentorCard(b.preferredMentor) : null),
  direct: Boolean(b.preferredMentor),
  reviewed: Boolean(b.reviewed),
  refundStatus: b.refundStatus || "",
  remainingMs: remainingOf(b),
  timerRunning: isRunning(b),
});

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ============================ REFUNDS ============================ */

// wallet payments (paymentController.payWithWallet) have a fake "wallet_pay_..." id,
// Razorpay knows nothing about them -> they must be refunded to the wallet.
const isWalletPayment = (p) =>
  Boolean(p) && (p.method === "wallet" || String(p.razorpayPaymentId || "").startsWith("wallet_pay_"));

/**
 * ONE refund function for everything.
 *   - wallet payment            -> money goes back to the fresher's wallet (+ totalRefunds)
 *   - Razorpay payment          -> Razorpay refund to the original payment method
 *   - options.to === "wallet"   -> force wallet (used when the fresher disputes a session)
 *
 * The payment is locked FIRST (paid -> refunded, atomic), so two parallel calls
 * can never refund the same payment twice. If the refund itself fails the lock
 * is released again (back to "paid") so the scheduler can retry later.
 *
 * Returns "refunded" | "failed".
 */
const refundPayment = async (payment, reason = "", options = {}) => {
  if (!payment) return "failed";
  if (payment.status === "refunded") return "refunded";

  const toWallet = options.to === "wallet" || isWalletPayment(payment);

  // atomic lock: only ONE caller gets the "before" document
  const before = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        sessionStatus: "cancelled",
        ...(toWallet ? { refundMethod: "wallet" } : {}),
      },
    },
    { returnDocument: "before" }
  );

  if (!before) {
    // someone else already refunded it, or it was never paid
    const cur = await Payment.findById(payment._id).select("status").lean();
    return cur?.status === "refunded" ? "refunded" : "failed";
  }

  const unlock = async () => {
    const back = { status: "paid" };
    if (before.sessionStatus) back.sessionStatus = before.sessionStatus;
    await Payment.updateOne({ _id: before._id, status: "refunded" }, { $set: back }).catch(() => {});
  };

  const amount = Number(before.amount) || 0;

  try {
    if (toWallet) {
      if (!before.fresher) {
        await unlock();
        return "failed";
      }
      await Fresher.updateOne(
        { _id: before.fresher },
        { $inc: { walletBalance: amount, totalRefunds: amount } }
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
    const desc = error?.error?.description || error.message || "";
    // Razorpay says it is already refunded -> keep our record as refunded
    if (!toWallet && /already.*refund|fully refunded/i.test(desc)) return "refunded";

    console.error("REFUND FAILED:", desc);
    await unlock();
    return "failed";
  }
};

/**
 * Close a booking that is in one of the `from` statuses, set it to `to`,
 * and give the fresher the money back. Atomic on the booking status, so only
 * one caller (accept / scheduler / mentor decline) can win.
 *
 *   pending               -> expired    (nobody accepted / mentor declined)
 *   accepted              -> missed     (session never started)
 *   awaiting_confirmation -> cancelled  (UNCONFIRMED_ACTION = "refund")
 */
const closeAndRefund = async (bookingId, { from, to, reason, title, mentorNote }) => {
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: from } },
    { $set: { status: to } },
    { returnDocument: "after" }
  );
  if (!locked) return null; // someone else already moved it

  const payment = locked.razorpayPaymentId
    ? await Payment.findOne({ razorpayPaymentId: locked.razorpayPaymentId })
    : null;
  const result = await refundPayment(payment, reason);
  await Booking.updateOne({ _id: locked._id }, { $set: { refundStatus: result } });

  const fresh = await Booking.findById(locked._id).populate("mentor", POPULATE_MENTOR);
  if (!fresh) return null;

  if (fresh.fresher) {
    const wallet = isWalletPayment(payment);
    const refundedText = wallet
      ? `Your payment of ₹${fresh.amount} was added back to your wallet.`
      : `Your payment of ₹${fresh.amount} is being refunded.`;

    notify({
      user: fresh.fresher,
      role: "fresher",
      title: result === "refunded" ? `${title || "Request closed"} - refund started` : title || "Request closed",
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

// pending request nobody accepted (or the chosen mentor declined) -> expire it and give the money back
const expireAndRefund = (bookingId, reason) =>
  closeAndRefund(bookingId, {
    from: ["pending"],
    to: "expired",
    reason,
    title: "Request expired",
  });

/* ============================ BROADCAST ============================ */

const broadcastLoop = async (req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified) => {
  const direct = Boolean(booking.preferredMentor);

  for (const m of mentors) {
    // busy mentors (already accepted a session around this time) NEVER get the request,
    // direct or normal, online or offline. Check this FIRST.
    if (await hasConflict(m._id, startsAt, endsAt, requestGroupId)) continue;

    const online = socketIdsOf(req.app, m._id).length > 0;

    // direct request (book again) and the mentor is offline:
    // still leave a notification, and pushPendingToMentor delivers the request when they connect
    if (direct && !online) {
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

    // direct request: fresher chose this mentor, so skip company/gender/language filters
    const reason = (direct ? "" : whyNot(m, booking)) || (!online ? "not online" : "");
    if (reason) continue;

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
};

// a mentor just accepted `accepted`.
// 1) every OTHER pending request that overlaps this slot is taken away from this mentor
// 2) a direct request addressed only to him is expired + refunded (nobody else can take it)
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
      const isMine = b.preferredMentor && String(b.preferredMentor) === String(mentorId);

      if (isMine) {
        await expireAndRefund(b._id, "The mentor you selected has another session at that time.");
      } else {
        await Booking.updateOne({ _id: b._id }, { $pull: { notified: mentorId } });
      }

      // remove the card from this mentor's screen
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
    const preferredMentorId = mongoose.Types.ObjectId.isValid(body.preferredMentorId)
      ? String(body.preferredMentorId)
      : null;

    if (!requestGroupId || !paymentId) return fail(res, 400, "requestGroupId and paymentId required");

    const existing = await Booking.findOne({ requestGroupId }).populate("mentor", POPULATE_MENTOR);
    if (existing) return res.json({ success: true, booking: toClient(existing), notifiedCount: existing.notified.length });

    const payment = await Payment.findOne({ razorpayPaymentId: paymentId, status: "paid" });
    if (!payment) return fail(res, 402, "Payment not verified");

    // one payment = one booking (do NOT refund here: that payment already belongs to another booking)
    if (await Booking.exists({ razorpayPaymentId: paymentId })) {
      return fail(res, 409, "This payment is already used for another booking");
    }

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message);
      return fail(res, status, `${message}${result === "refunded" ? " Refunded." : ""}`);
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 240) return reject(400, "Invalid duration");

    // amount paid must match the price of the chosen duration
    if (Number(payment.amount) !== expectedPrice(minutes)) {
      return reject(400, "Payment amount does not match the session price.");
    }

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt || startsAt.getTime() < Date.now() + MIN_LEAD_MS) return reject(400, "Invalid date/time");
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    // book again: the chosen mentor must still be approved + active (checked BEFORE the booking is created)
    let preferredMentor = null;
    if (preferredMentorId) {
      preferredMentor = await Mentor.findOne({
        _id: preferredMentorId,
        verificationStatus: "approved",
        accountStatus: "active",
      })
        .select(MENTOR_FIELDS)
        .lean();
      if (!preferredMentor) return reject(400, "Selected mentor is not available.");

      // chosen mentor already has a session around this time -> fail now instead of making the fresher wait
      if (await hasConflict(preferredMentor._id, startsAt, endsAt, requestGroupId)) {
        return reject(409, "This mentor has another session around that time. Please pick another time.");
      }
    }

    const fresherId = req.user?.role === "fresher" ? req.user.id : payment.fresher ? String(payment.fresher) : null;
    const fresherDoc = fresherId
      ? await Fresher.findById(fresherId).select("name email gender").lean()
      : null;

    // The fresher's OWN gender decides which mentors get the request.
    // Saved profile gender wins, the form value is the fallback.
    const fresherGender =
      [fresherDoc?.gender, sd.gender].map(norm).find((g) => g === "male" || g === "female") || "";

    // department chosen by the fresher (stored in `role`)
    const department = String(sd.role || "").trim().replace(/\s+/g, " ");

    // normal (non direct) requests need a gender and a department
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
      // direct booking: the mentor's own company wins, so company can never mismatch the mentor
      companyName: String(preferredMentor?.currentCompany || body.companyName || "").trim(),
      sessionType: String(sd.sessionType || "").slice(0, 60),
      reason: String(sd.reason || "").slice(0, 1000),
      role: department, // = department of the mentor
      otherRole: "",
      gender: fresherGender, // = the fresher's own gender
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
      : await Mentor.find({ verificationStatus: "approved", accountStatus: "active" }).select(MENTOR_FIELDS).lean();

    const notified = [];
    await broadcastLoop(req, mentors, booking, toMentorPayload(booking), startsAt, booking.endsAt, requestGroupId, notified);
    if (notified.length) await Booking.updateOne({ _id: booking._id }, { $set: { notified } });

    // return the chosen mentor's card too, so a pending direct request shows the mentor name
    const out = await Booking.findById(booking._id)
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);

    return res.status(201).json({ success: true, booking: toClient(out || booking), notifiedCount: notified.length });
  } catch (error) {
    // duplicate payment id (unique index) = two requests raced with the same payment
    if (error?.code === 11000) return fail(res, 409, "This payment is already used for another booking");
    console.error("createRequest error:", error);
    return fail(res, 500, "Failed to create request");
  }
};

/* ============================ ACCEPT / REJECT ============================ */

exports.updateRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const requestGroupId = String(req.params.requestGroupId || req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();

    // only a logged-in mentor can answer; never trust mentorId from the body
    if (req.user?.role !== "mentor") return fail(res, 401, "Mentor login required");
    const mentorId = req.user.id;

    if (!["accepted", "rejected"].includes(status)) return fail(res, 400, "Status must be accepted/rejected");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Request not found");

    // direct request: only the chosen mentor may answer it
    const isDirect = Boolean(booking.preferredMentor);
    if (isDirect && String(booking.preferredMentor) !== String(mentorId)) {
      return fail(res, 403, "This request is for another mentor");
    }

    // normal request: only a mentor who was actually sent this request may answer it
    if (!isDirect && !(booking.notified || []).map(String).includes(String(mentorId))) {
      return fail(res, 403, "This request was not sent to you");
    }

    if (status === "rejected") {
      await Booking.updateOne({ _id: booking._id }, { $addToSet: { declinedBy: mentorId } });
      // the only mentor who could take it said no -> expire now and refund (don't make the fresher wait)
      if (isDirect && booking.status === "pending") {
        await expireAndRefund(booking._id, "The mentor you selected is not available for this slot.");
      }
      return res.json({ success: true, status: "rejected" });
    }

    if (booking.status !== "pending" || booking.expiresAt <= new Date()) return fail(res, 409, "Request unavailable");

    if (await hasConflict(mentorId, booking.startsAt, booking.endsAt, requestGroupId)) {
      return fail(res, 409, "You have another session near this time");
    }

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      { $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Already accepted");

    await assignMentorToRequest({ requestGroupId, mentorId }).catch(() => {});

    emitToUser(accepted.fresher, "booking:updated", toClient(accepted));

    // tell every other mentor who got this request that it is gone
    (accepted.notified || [])
      .filter((id) => String(id) !== String(mentorId))
      .forEach((id) =>
        emitToMentorSockets(req.app, id, "session-request-taken", {
          id: accepted.requestGroupId,
          requestGroupId: accepted.requestGroupId,
        })
      );

    // this mentor is now busy -> pull his other overlapping pending requests
    await withdrawOverlapping(req.app, mentorId, accepted);

    return res.json({ success: true, status: "accepted", booking: toClient(accepted) });
  } catch (error) {
    console.error("updateRequest error:", error);
    return fail(res, 500, "Failed to update");
  }
};

exports.respondToRequest = exports.updateRequest;

/* ============================ READ ============================ */

exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.requestGroupId || "") })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    return res.json({ success: true, request: toClient(b), booking: toClient(b) });
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
    const b = await Booking.findOne({ fresher: req.user.id, status: "completed", reviewed: false })
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
    const mine = String(b.fresher) === req.user.id || String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "Access denied");
    return res.json({ success: true, booking: toClient(b) });
  } catch (error) {
    return fail(res, 500, "Failed to load booking");
  }
};

exports.mentorPending = async (req, res) => {
  try {
    const list = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: req.user.id },
      // normal requests this mentor was sent + direct (book again) requests addressed to them
      $or: [{ notified: req.user.id }, { preferredMentor: req.user.id }],
    }).sort({ createdAt: -1 });

    // hide requests that clash with a session this mentor already accepted
    const free = [];
    for (const b of list) {
      if (await hasConflict(req.user.id, b.startsAt, b.endsAt, b.requestGroupId)) continue;
      free.push(b);
    }

    return res.json({ success: true, requests: free.map(toMentorPayload) });
  } catch (error) {
    return fail(res, 500, "Failed to load requests");
  }
};

/* ============================ COMPLETION ============================ */

const pushTimerOff = (b) => {
  const payload = { requestGroupId: b.requestGroupId, running: false, remainingMs: 0 };
  emitToUser(b.fresher, "meeting:timer", payload);
  if (b.mentor) emitToUser(b.mentor._id || b.mentor, "meeting:timer", payload);
};

// money released to mentor, session "completed"
//   - fresher said YES                      -> auto = false
//   - fresher never answered (scheduler)    -> auto = true
const settleCompleted = async (booking, { auto = false } = {}) => {
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["awaiting_confirmation", "in_progress", "accepted"] } },
    { $set: { status: "completed", completedAt: now, "meeting.remainingMs": 0, "meeting.endedAt": now } },
    { returnDocument: "after" }
  ).populate("mentor", POPULATE_MENTOR);
  if (!updated) return null;

  const amount = Number(updated.amount || 0);
  const { fee: platformShare, earning: mentorShare } = splitAmount(amount, PLATFORM_FEE_PERCENT);

  await Payment.updateOne(
    { requestGroupId: updated.requestGroupId, status: "paid" },
    { $set: { sessionStatus: "completed", mentorEarning: mentorShare, platformFee: platformShare } }
  );

  if (updated.mentor) {
    await Mentor.updateOne({ _id: updated.mentor._id }, { $inc: { totalSessions: 1 } });
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
    emitToUser(updated.mentor._id, "wallet:updated", { requestGroupId: updated.requestGroupId });
    emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
  }

  if (auto && updated.fresher) {
    notify({
      user: updated.fresher,
      role: "fresher",
      title: "Session auto-confirmed",
      message: "You did not confirm the session in time, so it was marked as completed.",
      type: "session",
      link: "/Home/my-bookings",
    });
  }

  emitToUser(updated.fresher, "booking:updated", toClient(updated));
  pushTimerOff(updated);
  return updated;
};

// called when the timer reaches zero
const completeBooking = async (requestGroupId) => {
  const pre = await Booking.findOne({
    requestGroupId,
    status: { $in: ["accepted", "in_progress"] },
  });
  if (!pre) return null;

  // fresher already said YES during the meeting -> finish completely
  if (pre.meeting?.fresherConfirmed) return settleCompleted(pre);

  const b = await Booking.findOneAndUpdate(
    { requestGroupId, status: { $in: ["accepted", "in_progress"] } },
    { $set: { status: "awaiting_confirmation", "meeting.remainingMs": 0, "meeting.endedAt": new Date() } },
    { returnDocument: "after" }
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

    const booking = await Booking.findOne({ requestGroupId }).populate("mentor", POPULATE_MENTOR);
    if (!booking) return fail(res, 404, "Session not found");
    if (String(booking.fresher) !== req.user.id) return fail(res, 403, "Access denied");

    if (booking.status === "completed") return res.json({ success: true, status: "completed", booking: toClient(booking) });
    if (booking.status === "disputed") return res.json({ success: true, status: "disputed", booking: toClient(booking) });
    if (booking.status !== "awaiting_confirmation") return fail(res, 400, "This session is not awaiting confirmation.");

    if (accepted) {
      const updated = await settleCompleted(booking);
      if (!updated) return fail(res, 409, "Session already updated");
      return res.json({ success: true, status: "completed", booking: toClient(updated) });
    }

    // fresher said NO -> disputed, money goes back to the fresher's WALLET
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      { $set: { status: "disputed", completedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);
    if (!updated) return fail(res, 409, "Session already updated");

    const payment = await Payment.findOne({ razorpayPaymentId: booking.razorpayPaymentId });
    const result = await refundPayment(payment, "Fresher marked the session as not complete", { to: "wallet" });
    await Booking.updateOne({ _id: updated._id }, { $set: { refundStatus: result } });
    updated.refundStatus = result;

    notify({
      user: updated.fresher,
      role: "fresher",
      title: result === "refunded" ? "Refund added to wallet" : "Refund is processing",
      message:
        result === "refunded"
          ? `₹${updated.amount} was added back to your wallet.`
          : "We could not add the refund yet. We will retry automatically.",
      type: "payment",
      link: "/Home/wallet",
    });

    emitToUser(updated.fresher, "booking:updated", toClient(updated));
    emitToUser(updated.fresher, "wallet:updated", { amount: booking.amount });
    if (updated.mentor) emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
    return res.json({ success: true, status: "disputed", booking: toClient(updated) });
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
    return res.json({ success: true, notifications: items.map(serializeNotification), unreadCount });
  } catch (error) {
    return fail(res, 500, "Unable to load notifications.");
  }
};

exports.markFresherNotificationRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid id.");
    await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { $set: { read: true, readAt: new Date() } });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notification.");
  }
};

exports.markAllFresherNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, role: "fresher", read: false },
      { $set: { read: true, readAt: new Date() } }
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
    if (schedulerBusy) return; // previous run still going, do not overlap
    schedulerBusy = true;

    try {
      const now = new Date();

      // 1) nobody accepted before the start time -> expire + refund
      const stale = await Booking.find({ status: "pending", expiresAt: { $lte: now } }).select("_id");
      for (const b of stale) {
        await expireAndRefund(b._id, "No employee accepted your request in time.");
      }

      // 2) NO-SHOW: accepted, but the session never started (timer never ran)
      //    startsAt + grace is over -> missed + refund
      const noShows = await Booking.find({
        status: "accepted",
        startsAt: { $lte: new Date(now.getTime() - NO_SHOW_GRACE_MS) },
        "meeting.timerEndsAt": null, // timer never started (matches missing or null)
      }).select("_id");
      for (const b of noShows) {
        await closeAndRefund(b._id, {
          from: ["accepted"],
          to: "missed",
          title: "Session missed",
          reason: "The session did not start because both of you did not join in time.",
          mentorNote: "The session did not start in time, so it was marked as missed and the fresher was refunded.",
        });
      }

      // 3) timer ended, fresher never answered "did it go well?"
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

      // 4) retry refunds that failed earlier
      const failedRefunds = await Booking.find({
        status: { $in: ["expired", "missed", "cancelled", "disputed"] },
        refundStatus: "failed",
        razorpayPaymentId: { $ne: "" },
      }).limit(10);
      for (const b of failedRefunds) {
        const payment = await Payment.findOne({ razorpayPaymentId: b.razorpayPaymentId });
        const result = await refundPayment(payment, "Retry: session refund", {
          to: b.status === "disputed" ? "wallet" : "auto",
        });
        if (result === "refunded") {
          await Booking.updateOne({ _id: b._id }, { $set: { refundStatus: "refunded" } });
          if (b.fresher) {
            notify({
              user: b.fresher,
              role: "fresher",
              title: "Refund completed",
              message: `Your refund of ₹${b.amount} has been processed.`,
              type: "payment",
              link: "/Home",
            });
            emitToUser(b.fresher, "booking:updated", { requestGroupId: b.requestGroupId, refundStatus: "refunded" });
          }
        }
      }

      // 5) safety net: a running timer that is overdue gets finished
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
      for (const b of soon) await Booking.updateOne({ _id: b._id }, { $set: { reminderSent: true } });
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

    const mentor = await Mentor.findById(mentorId).select(`${MENTOR_FIELDS} verificationStatus accountStatus`).lean();
    if (!mentor || mentor.verificationStatus !== "approved" || mentor.accountStatus !== "active") return;

    // open requests: normal ones + direct ones addressed to THIS mentor only
    const open = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
      $or: [{ preferredMentor: null }, { preferredMentor: { $exists: false } }, { preferredMentor: mentor._id }],
    });

    for (const b of open) {
      // conflict is checked for every request (direct or normal) before anything else
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId)) continue;

      const reason = b.preferredMentor ? "" : whyNot(mentor, b);
      if (reason) continue;

      await Booking.updateOne({ _id: b._id }, { $addToSet: { notified: mentor._id } });
      emitToMentorSockets(app, mentor._id, "session-request", toMentorPayload(b));
    }
  } catch (error) {
    console.error("pushPendingToMentor error:", error.message);
  }
};

exports.whyNot = whyNot;