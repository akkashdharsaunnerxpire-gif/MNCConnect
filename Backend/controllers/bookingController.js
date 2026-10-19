// controllers/bookingController.js
// Fresher session requests: create -> broadcast to online employees -> first
// accept wins -> reminders -> meeting -> completion -> refunds / reviews.

const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const Notification = require("../models/Notification");

const { optionalAuth } = require("../middleware/panelAuth");
const { notify, emitToUser, serializeNotification } = require("../utils/realtime");
const { buildSessionFields, parseSessionStart } = require("../utils/sessionTime");
const { linkPaymentToRequest, assignMentorToRequest } = require("./paymentController");

/* ============================================================
   CONFIG
============================================================ */

const PRICE_PER_30_MIN = Number(process.env.PRICE_PER_30_MIN || 200); // 400 / hour
const MIN_MINUTES = 30;
const MAX_MINUTES = 240; // 4 hours
const MIN_LEAD_MS = 15 * 60 * 1000; // book at least 15 min ahead
const GAP_MS = 30 * 60 * 1000; // 30 min gap between a mentor's sessions
const OPEN_BEFORE_MS = 5 * 60 * 1000; // meeting opens 5 min early
const DEADLINE_GRACE_MS = 60 * 60 * 1000; // after endsAt + 1h the session is force-closed

// Set STRICT_MENTOR_MATCH=true in .env to ALSO force the requested role to match the mentor profile.
const STRICT_MATCH = process.env.STRICT_MENTOR_MATCH === "true";

const priceFor = (minutes) => (minutes / 30) * PRICE_PER_30_MIN;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ============================================================
   HELPERS
============================================================ */

let razorpay = null;
const getRazorpay = () => {
  if (razorpay) return razorpay;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("Razorpay keys are not configured");
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

// `spokenLanguages` is selected on purpose: the old `languages` field holds SKILLS (React / Java ...).
const MENTOR_FIELDS =
  "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";

// Returns "" when this mentor may receive the request, otherwise the reason (used for logs too).
// Hard rules use data every mentor really has: company + gender.
// Spoken language is checked only if the mentor profile has `spokenLanguages`.
const whyNot = (m, b) => {
  if (b.companyName && !loose(m.currentCompany, b.companyName)) {
    return `company is "${m.currentCompany}", request needs "${b.companyName}"`;
  }

  // exact compare: loose("male", "female") is TRUE because "female" contains "male"
  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender)) {
    return `gender is "${m.gender}", request needs "${b.gender}"`;
  }

  const spoken = arr(m.spokenLanguages).map(norm).filter(Boolean);
  if (!isAny(b.language) && spoken.length && !spoken.some((l) => loose(l, b.language))) {
    return `speaks [${spoken.join(", ")}], request needs "${b.language}"`;
  }

  if (STRICT_MATCH && !isAny(b.role)) {
    const target = norm(b.role) === "other" ? b.otherRole : b.role;
    const values = [m.designation, m.department, ...arr(m.skills), ...arr(m.expertise), ...arr(m.languages)];
    if (!isAny(target) && !values.some((v) => loose(v, target))) {
      return `role "${target}" not found in profile`;
    }
  }

  return "";
};

const mentorMatches = (m, b) => whyNot(m, b) === "";

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
    status: "accepted",
    requestGroupId: { $ne: excludeId || "" },
    startsAt: { $lt: new Date(endsAt.getTime() + GAP_MS) },
    endsAt: { $gt: new Date(startsAt.getTime() - GAP_MS) },
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
  mentor: mentorCard(b.mentor),
  reviewed: Boolean(b.reviewed),
  refundStatus: b.refundStatus || "",
  remainingMs: b.meeting?.remainingMs ?? null,
});

const POPULATE_MENTOR = "name email profilePic currentCompany designation";
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ============================================================
   REFUND
============================================================ */

const refundPayment = async (payment, reason = "") => {
  if (!payment || !payment.razorpayPaymentId) return "failed";
  if (payment.status === "refunded") return "refunded";
  try {
    await getRazorpay().payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(Number(payment.amount) * 100),
      speed: "normal",
      notes: { reason: String(reason).slice(0, 100) },
    });
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "refunded", sessionStatus: "cancelled" } });
    return "refunded";
  } catch (error) {
    console.error("REFUND FAILED:", payment.razorpayPaymentId, error?.error?.description || error.message);
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { sessionStatus: "cancelled", failureReason: "REFUND_FAILED - refund manually" } }
    );
    return "failed";
  }
};

/* ============================================================
   BROADCAST  (used by createRequest)
   Logs EXACTLY why each approved mentor did or did not get the request.
============================================================ */

const broadcastLoop = async (req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified) => {
  const report = [];

  for (const m of mentors) {
    const reason =
      whyNot(m, booking) ||
      (socketIdsOf(req.app, m._id).length === 0 ? "not online right now" : "") ||
      ((await hasConflict(m._id, startsAt, endsAt, requestGroupId)) ? "has another session within 30 minutes" : "");

    report.push(`${m.name || m._id}: ${reason || "SENT"}`);
    if (reason) continue;

    notified.push(m._id);
    emitToMentorSockets(req.app, m._id, "session-request", payload);
    notify({
      user: m._id,
      role: "mentor",
      title: "New session request",
      message: `${booking.fresherName} wants a ${booking.durationMinutes}-minute session on ${booking.date} at ${booking.time}.`,
      type: "session",
      link: "/mentor/home",
    });
  }

  console.log(`[request ${requestGroupId}] ${mentors.length} approved mentor(s):\n  ${report.join("\n  ") || "none"}`);
};

/* ============================================================
   1. CREATE REQUEST   POST /api/bookings   (also /api/session/session-requests)
============================================================ */

exports.createRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});

    const body = req.body || {};
    const sd = body.sessionDetails || {};
    const requestGroupId = String(body.requestGroupId || "").trim();
    const paymentId = String(body.razorpayPaymentId || "").trim();

    if (!requestGroupId) return fail(res, 400, "requestGroupId is required");
    if (!paymentId) return fail(res, 402, "Payment is required before sending a request");

    // idempotent: the same request sent twice returns the first one
    const existing = await Booking.findOne({ requestGroupId }).populate("mentor", POPULATE_MENTOR);
    if (existing) return res.json({ success: true, booking: toClient(existing), notifiedCount: existing.notified.length });

    const payment = await Payment.findOne({ razorpayPaymentId: paymentId, status: "paid" });
    if (!payment) return fail(res, 402, "Payment not verified yet. Please try again in a moment.");
    if (payment.requestGroupId && payment.requestGroupId !== requestGroupId) {
      return fail(res, 409, "This payment is already used for another request");
    }

    // every failure after this point refunds the fresher automatically
    const reject = async (status, message, extra) => {
      const result = await refundPayment(payment, message);
      return fail(res, status, `${message}${result === "refunded" ? " Your payment has been refunded." : ""}`, extra);
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES || minutes % 30 !== 0) {
      return reject(400, "Duration must be between 30 minutes and 4 hours.");
    }
    if (Number(payment.amount) !== priceFor(minutes)) {
      return reject(400, "Paid amount does not match the selected duration.");
    }

    const companyName = String(body.companyName || "").trim();
    const reason = String(sd.reason || "").trim();
    const language = String(sd.language || "").trim();
    if (!companyName) return reject(400, "Company is required.");
    if (reason.length < 10) return reject(400, "Please describe why you want to attend (at least 10 characters).");
    if (!language) return reject(400, "Please select a language.");

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt) return reject(400, "Invalid session date or time.");
    if (startsAt.getTime() < Date.now() + MIN_LEAD_MS) {
      return reject(400, "Please choose a time at least 15 minutes from now.");
    }
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    const fresherId = req.user?.role === "fresher" ? req.user.id : payment.fresher ? String(payment.fresher) : null;

    if (fresherId) {
      const pendingReview = await Booking.exists({ fresher: fresherId, status: "completed", reviewed: false });
      if (pendingReview) {
        return reject(403, "Please review your previous session first.", { code: "REVIEW_REQUIRED" });
      }
    }

    const fresherDoc = fresherId ? await Fresher.findById(fresherId).select("name email").lean() : null;
    const requester = body.requester || {};
    const image = String(requester.image || "");

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: fresherDoc?.name || requester.fullName || payment.fresherName || "Fresher",
      fresherEmail: fresherDoc?.email || requester.email || payment.fresherEmail || "",
      fresherImage: image.startsWith("http") || image.startsWith("/") ? image : "",
      companyName,
      sessionType: String(sd.sessionType || "").slice(0, 60),
      reason: reason.slice(0, 1000),
      role: String(sd.role || ""),
      otherRole: String(sd.otherRole || ""),
      gender: String(sd.gender || ""),
      language,
      durationMinutes: minutes,
      amount: Number(payment.amount),
      date: String(sd.date),
      time: String(sd.time),
      startsAt,
      endsAt,
      expiresAt: startsAt, // nobody accepted before the start time -> refund
      razorpayPaymentId: paymentId,
    });

    await linkPaymentToRequest({
      razorpayPaymentId: paymentId,
      requestGroupId,
      topic: booking.sessionType || booking.companyName,
      date: booking.date,
      time: booking.time,
      duration: minutes,
    });
    if (fresherId && !payment.fresher) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { fresher: fresherId, fresherName: booking.fresherName, fresherEmail: booking.fresherEmail } }
      );
    }

    // ---- broadcast to every eligible employee who is online right now ----
    const mentors = await Mentor.find({ verificationStatus: "approved", accountStatus: "active" })
      .select(MENTOR_FIELDS)
      .lean();

    const payload = toMentorPayload(booking);
    const notified = [];

    await broadcastLoop(req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified);

    if (notified.length) await Booking.updateOne({ _id: booking._id }, { $set: { notified } });

    notify({
      user: fresherId,
      role: "fresher",
      title: "Request sent",
      message: notified.length
        ? `Your request was sent to ${notified.length} online ${booking.companyName} employee${notified.length > 1 ? "s" : ""}.`
        : `No ${booking.companyName} employee is online right now. We'll offer it to anyone who comes online before ${booking.time}.`,
      type: "session",
      link: "/Home/my-bookings",
    });

    return res.status(201).json({ success: true, booking: toClient(booking), notifiedCount: notified.length });
  } catch (error) {
    console.error("createRequest error:", error);
    return fail(res, 500, "Failed to create session request");
  }
};

/* ============================================================
   2. ACCEPT / REJECT   PATCH /api/session/session-requests/:requestGroupId
============================================================ */

const expireBooking = async (app, bookingId, reason) => {
  const b = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "pending" },
    { $set: { status: "expired" } },
    { returnDocument: "after" }
  );
  if (!b) return null;

  const payment = await Payment.findOne({ razorpayPaymentId: b.razorpayPaymentId });
  const result = await refundPayment(payment, reason);
  b.refundStatus = result === "refunded" ? "refunded" : "failed";
  await b.save();

  notify({
    user: b.fresher,
    role: "fresher",
    title: "Request expired",
    message:
      result === "refunded"
        ? `No ${b.companyName} employee accepted your request. ${rupees(b.amount)} has been refunded.`
        : `No employee accepted your request. Your refund of ${rupees(b.amount)} is being processed.`,
    type: "payment",
    link: "/Home/my-bookings",
  });
  emitToUser(b.fresher, "booking:updated", toClient(b));

  (b.notified || []).forEach((id) => emitToMentorSockets(app, id, "session-request-taken", { id: b.requestGroupId }));
  return b;
};

exports.updateRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});

    // route may be declared as :requestGroupId or :id
    const requestGroupId = String(req.params.requestGroupId || req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    const mentorId = req.user?.role === "mentor" ? req.user.id : req.body?.mentorId;

    if (!["accepted", "rejected"].includes(status)) return fail(res, 400, "Status must be accepted or rejected");
    if (!mongoose.Types.ObjectId.isValid(mentorId)) return fail(res, 400, "A valid mentor is required");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Session request not found");

    // ---------- reject = this employee declines (others can still accept) ----------
    if (status === "rejected") {
      await Booking.updateOne({ _id: booking._id }, { $addToSet: { declinedBy: mentorId } });
      const fresh = await Booking.findById(booking._id);
      if (
        fresh.status === "pending" &&
        fresh.notified.length > 0 &&
        fresh.notified.every((id) => fresh.declinedBy.some((d) => String(d) === String(id)))
      ) {
        await expireBooking(req.app, fresh._id, "All employees declined");
      }
      return res.json({ success: true, status: "rejected" });
    }

    // ---------- accept: first employee wins ----------
    if (booking.status !== "pending" || booking.expiresAt <= new Date()) {
      return fail(res, 409, "This request is no longer available");
    }
    if (booking.notified.length && !booking.notified.some((id) => String(id) === String(mentorId))) {
      return fail(res, 403, "This request was not sent to you");
    }
    if (await hasConflict(mentorId, booking.startsAt, booking.endsAt, requestGroupId)) {
      return fail(res, 400, "You already have a session within 30 minutes of this time.");
    }

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      { $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Another employee accepted this request first");

    // the wallet is linked here, so the frontend must NOT call ENDPOINTS.assignPayment again
    const assign = await assignMentorToRequest({ requestGroupId, mentorId }).catch(() => ({ assigned: false }));
    if (!assign?.assigned) console.warn("Wallet not linked for", requestGroupId, assign?.reason);

    // remove the request from every other employee's screen
    accepted.notified
      .filter((id) => String(id) !== String(mentorId))
      .forEach((id) => emitToMentorSockets(req.app, id, "session-request-taken", { id: requestGroupId }));

    const mentor = mentorCard(accepted.mentor);
    notify({
      user: accepted.fresher,
      role: "fresher",
      title: "Session confirmed",
      message: `${mentor?.name || "An employee"} from ${accepted.companyName} accepted your session on ${accepted.date} at ${accepted.time}.`,
      type: "session",
      link: "/Home/my-bookings",
    });
    emitToUser(accepted.fresher, "booking:updated", toClient(accepted));

    return res.json({ success: true, status: "accepted", booking: toClient(accepted) });
  } catch (error) {
    console.error("updateRequest error:", error);
    return fail(res, 500, "Failed to update session request");
  }
};

// alias, so routes can use either name
exports.respondToRequest = exports.updateRequest;

/* ============================================================
   3. READ ENDPOINTS
============================================================ */

// GET /api/session/session-requests/:requestGroupId   (old shape kept)
exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.requestGroupId || "") }).populate(
      "mentor",
      POPULATE_MENTOR
    );
    if (!b) return fail(res, 404, "Session request not found");
    return res.json({ success: true, request: toClient(b), booking: toClient(b), status: b.status, assigned: Boolean(b.mentor) });
  } catch (error) {
    return fail(res, 500, "Failed to fetch session request");
  }
};

// GET /api/session/accepted-bookings?email=   (old route kept)
exports.getAcceptedBookings = async (req, res) => {
  try {
    const email = norm(req.query.email);
    if (!email) return fail(res, 400, "Email is required");
    const list = await Booking.find({ fresherEmail: email, status: { $in: ["accepted", "completed"] } })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ startsAt: -1 });
    const bookings = list.map((b) => ({ ...toClient(b), bookingId: b.requestGroupId, mentorName: b.mentor?.name || "Mentor" }));
    return res.json({ success: true, bookings, count: bookings.length });
  } catch (error) {
    return fail(res, 500, "Failed to fetch bookings");
  }
};

// GET /api/bookings/me   (fresher)
exports.myBookings = async (req, res) => {
  try {
    const list = await Booking.find({ fresher: req.user.id }).populate("mentor", POPULATE_MENTOR).sort({ startsAt: -1 }).limit(100);
    return res.json({ success: true, bookings: list.map(toClient) });
  } catch (error) {
    console.error("myBookings error:", error.message);
    return fail(res, 500, "Failed to load bookings");
  }
};

// GET /api/bookings/needs-review   (fresher)
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

// GET /api/bookings/:id   (fresher or mentor who owns it)
exports.getBooking = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.id) }).populate("mentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Booking not found");
    const mine = String(b.fresher) === req.user.id || String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "You do not have access to this booking");

    const data = toClient(b);
    if (req.user.role === "mentor") data.fresherName = b.fresherName;
    return res.json({ success: true, booking: data });
  } catch (error) {
    return fail(res, 500, "Failed to load booking");
  }
};

// GET /api/bookings/mentor/pending   (mentor: open requests sent to me)
exports.mentorPending = async (req, res) => {
  try {
    const list = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      notified: req.user.id,
      declinedBy: { $ne: req.user.id },
    }).sort({ createdAt: -1 });
    return res.json({ success: true, requests: list.map(toMentorPayload) });
  } catch (error) {
    return fail(res, 500, "Failed to load requests");
  }
};

/* ============================================================
   4. FRESHER NOTIFICATIONS
============================================================ */

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

/* ============================================================
   5. COMPLETION (called by the meeting timer and the sweeper)
============================================================ */

const completeBooking = async (requestGroupId) => {
  const now = new Date();
  const b = await Booking.findOneAndUpdate(
    { requestGroupId, status: "accepted" },
    { $set: { status: "completed", completedAt: now, "meeting.remainingMs": 0, "meeting.endedAt": now } },
    { returnDocument: "after" }
  ).populate("mentor", POPULATE_MENTOR);
  if (!b) return null;

  // the mentor's share is released as soon as the session really ends
  await Payment.updateOne(
    { requestGroupId, status: "paid" },
    { $set: { sessionEndsAt: now, sessionStatus: "upcoming" } }
  );

  notify({
    user: b.fresher,
    role: "fresher",
    title: "Session completed",
    message: "Please rate your session. A review is required before your next booking.",
    type: "review",
    link: "/Home/my-bookings",
  });
  if (b.mentor) {
    notify({
      user: b.mentor._id,
      role: "mentor",
      title: "Session completed",
      message: "Your earnings for this session are now available.",
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(b.mentor._id, "wallet:updated", { requestGroupId });
  }
  emitToUser(b.fresher, "booking:updated", toClient(b));
  return b;
};

exports.completeBooking = completeBooking;

/* ============================================================
   6. SCHEDULERS + LATE-ONLINE MENTORS
============================================================ */

const sweep = async (app) => {
  const now = new Date();

  // a) nobody accepted before the start time -> refund
  const stale = await Booking.find({ status: "pending", expiresAt: { $lte: now } }).select("_id");
  for (const s of stale) await expireBooking(app, s._id, "No employee accepted in time");

  // b) 5-minute reminders for both people
  const soon = await Booking.find({
    status: "accepted",
    reminderSent: false,
    startsAt: { $lte: new Date(now.getTime() + OPEN_BEFORE_MS) },
    endsAt: { $gt: now },
  }).populate("mentor", POPULATE_MENTOR);

  for (const b of soon) {
    const claimed = await Booking.findOneAndUpdate({ _id: b._id, reminderSent: false }, { $set: { reminderSent: true } });
    if (!claimed) continue;

    notify({
      user: b.fresher,
      role: "fresher",
      title: "Session starts in 5 minutes",
      message: `Your session with ${b.mentor?.name || "your mentor"} is about to start. The meeting room is open now.`,
      type: "session",
      link: `/Home/meeting/${b.requestGroupId}`,
    });
    notify({
      user: b.mentor?._id,
      role: "mentor",
      title: "Session starts in 5 minutes",
      message: `Your session with ${b.fresherName} is about to start. The meeting room is open now.`,
      type: "session",
      link: `/mentor/meeting/${b.requestGroupId}`,
    });
    const reminder = { requestGroupId: b.requestGroupId, startsAt: b.startsAt };
    emitToUser(b.fresher, "booking:reminder", reminder);
    emitToUser(b.mentor?._id, "booking:reminder", reminder);
  }

  // c) force-close sessions that are long over
  const overdue = await Booking.find({
    status: "accepted",
    endsAt: { $lte: new Date(now.getTime() - DEADLINE_GRACE_MS) },
  });
  for (const b of overdue) {
    if (b.meeting?.startedAt) {
      await completeBooking(b.requestGroupId);
      continue;
    }
    // the meeting never started (someone never joined) -> refund the fresher
    const updated = await Booking.findOneAndUpdate(
      { _id: b._id, status: "accepted" },
      { $set: { status: "missed" } },
      { returnDocument: "after" }
    );
    if (!updated) continue;
    const payment = await Payment.findOne({ razorpayPaymentId: b.razorpayPaymentId });
    const result = await refundPayment(payment, "Session was not held");
    await Booking.updateOne({ _id: b._id }, { $set: { refundStatus: result === "refunded" ? "refunded" : "failed" } });
    notify({
      user: b.fresher,
      role: "fresher",
      title: "Session was not held",
      message: `The meeting did not take place. ${rupees(b.amount)} is being refunded.`,
      type: "payment",
      link: "/Home/my-bookings",
    });
    emitToUser(b.fresher, "booking:updated", { requestGroupId: b.requestGroupId, status: "missed" });
  }
};

exports.startSchedulers = (app) => {
  const run = async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      await sweep(app);
    } catch (error) {
      console.error("Booking sweep error:", error.message);
    }
  };
  setInterval(run, 30 * 1000);
  run();
  console.log("Booking schedulers started");
};

// Call when a mentor comes online: hand them any still-open matching requests.
// Every skip is logged with its reason, so "why did my request not show up" is answered in the terminal.
exports.pushPendingToMentor = async (app, mentorId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      console.log(`[push] invalid mentor id "${mentorId}"`);
      return;
    }

    const mentor = await Mentor.findById(mentorId)
      .select(`${MENTOR_FIELDS} verificationStatus accountStatus`)
      .lean();

    if (!mentor) {
      console.log(`[push] mentor ${mentorId} not found in DB`);
      return;
    }
    if (mentor.verificationStatus !== "approved" || mentor.accountStatus !== "active") {
      console.log(
        `[push] ${mentor.name}: verification="${mentor.verificationStatus}", account="${mentor.accountStatus}" ` +
          `-> must be approved + active to receive requests`
      );
      return;
    }

    const open = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
    });

    const report = [];

    for (const b of open) {
      const reason =
        whyNot(mentor, b) ||
        ((await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId))
          ? "has another session within 30 minutes"
          : "");

      report.push(`${b.requestGroupId}: ${reason || "SENT"}`);
      if (reason) continue;

      await Booking.updateOne({ _id: b._id }, { $addToSet: { notified: mentor._id } });
      emitToMentorSockets(app, mentor._id, "session-request", toMentorPayload(b));
    }

    console.log(`[push] ${mentor.name} came online, ${open.length} open request(s):\n  ${report.join("\n  ") || "none"}`);
  } catch (error) {
    console.error("pushPendingToMentor error:", error.message);
  }
};

exports.whyNot = whyNot;
exports.mentorMatches = mentorMatches;