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
const { buildSessionFields, parseSessionStart } = require("../utils/sessionTime");
const { linkPaymentToRequest, assignMentorToRequest } = require("./paymentController");
const { sendMail } = require("../utils/mailer");

/* ============================================================
   CONFIG
============================================================ */

const PRICE_PER_30_MIN = Number(process.env.PRICE_PER_30_MIN || 200);
const MIN_MINUTES = 30;
const MAX_MINUTES = 240;
const MIN_LEAD_MS = 15 * 60 * 1000;
const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const DEADLINE_GRACE_MS = 60 * 60 * 1000;

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

const MENTOR_FIELDS = "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";

// Returns "" when this mentor may receive the request, else the reason.
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
});

const mentorCard = (m) =>
  m && typeof m === "object" && m.name
    ? { id: String(m._id), name: m.name, designation: m.designation || "", company: m.currentCompany || "", image: m.profilePic || "", email: m.email || "" }
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
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

/* ============================================================
   REFUND & BROADCAST
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
    console.error("REFUND FAILED:", error?.error?.description || error.message);
    return "failed";
  }
};

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
   CREATE REQUEST
============================================================ */

exports.createRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const body = req.body || {};
    const sd = body.sessionDetails || {};
    const requestGroupId = String(body.requestGroupId || "").trim();
    const paymentId = String(body.razorpayPaymentId || "").trim();

    if (!requestGroupId || !paymentId) return fail(res, 400, "requestGroupId and paymentId required");

    const existing = await Booking.findOne({ requestGroupId }).populate("mentor", POPULATE_MENTOR);
    if (existing) return res.json({ success: true, booking: toClient(existing), notifiedCount: (existing.notified || []).length });

    const payment = await Payment.findOne({ razorpayPaymentId: paymentId, status: "paid" });
    if (!payment) return fail(res, 402, "Payment not verified");

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message);
      return fail(res, status, `${message}${result === "refunded" ? " Refunded." : ""}`);
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return reject(400, "Invalid duration");

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt || startsAt.getTime() < Date.now() + MIN_LEAD_MS) return reject(400, "Invalid date/time");

    const fresherId = req.user?.role === "fresher" ? req.user.id : (payment.fresher ? String(payment.fresher) : null);
    const fresherDoc = fresherId ? await Fresher.findById(fresherId).select("name email").lean() : null;

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: fresherDoc?.name || body.requester?.fullName || "Fresher",
      fresherEmail: fresherDoc?.email || body.requester?.email || "",
      companyName: String(body.companyName || "").trim(),
      sessionType: String(sd.sessionType || "").slice(0, 60),
      reason: String(sd.reason || "").slice(0, 1000),
      role: String(sd.role || ""),
      language: String(sd.language || ""),
      durationMinutes: minutes,
      amount: Number(payment.amount),
      date: String(sd.date),
      time: String(sd.time),
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60000),
      expiresAt: startsAt,
      razorpayPaymentId: paymentId,
    });

    await linkPaymentToRequest({ razorpayPaymentId: paymentId, requestGroupId, topic: booking.sessionType || booking.companyName, date: booking.date, time: booking.time, duration: minutes });

    const mentors = await Mentor.find({ verificationStatus: "approved", accountStatus: "active" }).select(MENTOR_FIELDS).lean();
    const notified = [];
    await broadcastLoop(req, mentors, booking, toMentorPayload(booking), startsAt, booking.endsAt, requestGroupId, notified);

    if (notified.length) await Booking.updateOne({ _id: booking._id }, { $set: { notified } });

    return res.status(201).json({ success: true, booking: toClient(booking), notifiedCount: notified.length });
  } catch (error) {
    console.error("createRequest error:", error);
    return fail(res, 500, "Failed to create request");
  }
};

/* ============================================================
   ACCEPT / REJECT
============================================================ */

exports.updateRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const requestGroupId = String(req.params.requestGroupId || req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    const mentorId = req.user?.role === "mentor" ? req.user.id : req.body?.mentorId;

    if (!["accepted", "rejected"].includes(status)) return fail(res, 400, "Status must be accepted/rejected");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Request not found");

    if (status === "rejected") {
      await Booking.updateOne({ _id: booking._id }, { $addToSet: { declinedBy: mentorId } });
      return res.json({ success: true, status: "rejected" });
    }

    if (booking.status !== "pending" || booking.expiresAt <= new Date()) return fail(res, 409, "Request unavailable");

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      { $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Already accepted");

    await assignMentorToRequest({ requestGroupId, mentorId }).catch(() => {});

    // Reminder emails
    try {
      const mentor = await Mentor.findById(mentorId).lean();
      const fresher = await Fresher.findById(accepted.fresher).lean();
      if (mentor?.email && fresher?.email) {
        const openTime = new Date(new Date(accepted.startsAt).getTime() - OPEN_BEFORE_MS).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
        sendMail({
          to: [mentor.email, fresher.email],
          subject: `Session starts soon: ${accepted.companyName}`,
          text: `Your session starts at ${accepted.time}. The room will open at ${openTime}. Please be on time.`,
          html: `<p>Your session starts at <b>${accepted.time}</b>. The room will open at <b>${openTime}</b>. Please be on time.</p>`,
        });
      }
    } catch (e) { console.log("Mail error:", e.message); }

    emitToUser(accepted.fresher, "booking:updated", toClient(accepted));
    return res.json({ success: true, status: "accepted", booking: toClient(accepted) });
  } catch (error) {
    console.error("updateRequest error:", error);
    return fail(res, 500, "Failed to update");
  }
};

// alias so older route files that use respondToRequest keep working
exports.respondToRequest = exports.updateRequest;

/* ============================================================
   COMPLETION & FRESHER CONFIRMATION
============================================================ */

const completeBooking = async (requestGroupId) => {
  const now = new Date();

  // Timer over -> awaiting_confirmation
  const b = await Booking.findOneAndUpdate(
    { requestGroupId, status: { $in: ["accepted", "in_progress"] } },
    { $set: { status: "awaiting_confirmation", "meeting.remainingMs": 0, "meeting.endedAt": now } },
    { returnDocument: "after" }
  ).populate("mentor", POPULATE_MENTOR);

  if (!b) return null;

  notify({
    user: b.fresher, role: "fresher", title: "Session ended",
    message: "Did the session go well? Please confirm.", type: "session", link: `/Home/meeting/${b.requestGroupId}`,
  });

  emitToUser(b.fresher, "booking:updated", toClient(b));
  if (b.mentor) emitToUser(b.mentor._id, "booking:updated", toClient(b));

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
    if (booking.status !== "awaiting_confirmation") return fail(res, 400, "Not awaiting confirmation");

    if (accepted) {
      const updated = await Booking.findOneAndUpdate(
        { _id: booking._id, status: "awaiting_confirmation" },
        { $set: { status: "completed", completedAt: new Date(), reviewed: false } },
        { returnDocument: "after" }
      ).populate("mentor", POPULATE_MENTOR);

      if (!updated) return fail(res, 409, "Already confirmed");

      await Payment.updateOne({ requestGroupId, status: "paid" }, { $set: { sessionStatus: "completed" } });
      if (updated.mentor) {
        await Mentor.updateOne({ _id: updated.mentor._id }, { $inc: { totalSessions: 1 } });
        notify({ user: updated.mentor._id, role: "mentor", title: "Session confirmed", message: "Earnings released.", type: "payment", link: "/mentor/earnings" });
      }
      emitToUser(updated.fresher, "booking:updated", toClient(updated));
      return res.json({ success: true, status: "completed", booking: toClient(updated) });
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      { $set: { status: "disputed", completedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    if (!updated) return fail(res, 409, "Already confirmed");

    const payment = await Payment.findOne({ razorpayPaymentId: booking.razorpayPaymentId });
    await refundPayment(payment, "Fresher reported issue");

    emitToUser(updated.fresher, "booking:updated", toClient(updated));
    return res.json({ success: true, status: "disputed", booking: toClient(updated) });
  } catch (error) {
    console.error("confirmCompletion error:", error);
    return fail(res, 500, "Unable to confirm session");
  }
};

/* ============================================================
   GET ENDPOINTS
============================================================ */

exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.requestGroupId || "") }).populate("mentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    return res.json({ success: true, request: toClient(b), booking: toClient(b) });
  } catch (error) {
    return fail(res, 500, "Failed to load request");
  }
};

exports.getBooking = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.id) }).populate("mentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    const mine = String(b.fresher) === req.user.id || String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "Access denied");
    return res.json({ success: true, booking: toClient(b) });
  } catch (error) {
    return fail(res, 500, "Failed to load booking");
  }
};

exports.myBookings = async (req, res) => {
  try {
    const list = await Booking.find({ fresher: req.user.id }).populate("mentor", POPULATE_MENTOR).sort({ startsAt: -1 });
    return res.json({ success: true, bookings: list.map(toClient) });
  } catch (error) {
    return fail(res, 500, "Failed to load bookings");
  }
};

/* ---------- fresher: completed sessions that still need a review ---------- */
exports.needsReview = async (req, res) => {
  try {
    const list = await Booking.find({
      fresher: req.user.id,
      status: "completed",
      reviewed: { $ne: true },
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ completedAt: -1 })
      .limit(10);

    const bookings = list.map(toClient);
    return res.json({ success: true, bookings, booking: bookings[0] || null, count: bookings.length });
  } catch (error) {
    console.error("needsReview error:", error);
    return fail(res, 500, "Failed to load reviews");
  }
};

/* ---------- mentor: pending requests that match this mentor ---------- */
exports.mentorPending = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.user.id).select(MENTOR_FIELDS).lean();
    if (!mentor) return fail(res, 404, "Mentor not found");

    const pending = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: req.user.id },
    })
      .sort({ startsAt: 1 })
      .limit(50);

    const out = [];
    for (const b of pending) {
      if (!mentorMatches(mentor, b)) continue;
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId)) continue;
      out.push(toMentorPayload(b));
    }

    return res.json({ success: true, requests: out, bookings: out, count: out.length });
  } catch (error) {
    console.error("mentorPending error:", error);
    return fail(res, 500, "Failed to load requests");
  }
};

/* ============================================================
   FRESHER NOTIFICATIONS
   (assumes Notification has: user, role, read:Boolean, createdAt)
============================================================ */

exports.getFresherNotifications = async (req, res) => {
  try {
    const filter = { user: req.user.id, role: "fresher" };
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    const unreadCount = await Notification.countDocuments({ ...filter, read: { $ne: true } });

    return res.json({
      success: true,
      notifications: list.map((n) => serializeNotification(n)),
      unreadCount,
    });
  } catch (error) {
    console.error("getFresherNotifications error:", error);
    return fail(res, 500, "Failed to load notifications");
  }
};

exports.markAllFresherNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, role: "fresher", read: { $ne: true } },
      { $set: { read: true } },
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("markAllFresherNotificationsRead error:", error);
    return fail(res, 500, "Failed to update notifications");
  }
};

exports.markFresherNotificationRead = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, user: req.user.id, role: "fresher" },
      { $set: { read: true } },
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("markFresherNotificationRead error:", error);
    return fail(res, 500, "Failed to update notification");
  }
};

/* ============================================================
   SCHEDULERS
============================================================ */

exports.startSchedulers = (app) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const now = new Date();
      // Expire old pending requests
      await Booking.updateMany({ status: "pending", expiresAt: { $lte: now } }, { $set: { status: "expired" } });

      // Fallback reminder flag (emails are sent in updateRequest)
      await Booking.updateMany(
        { status: "accepted", reminderSent: false, startsAt: { $lte: new Date(now.getTime() + 5 * 60000) } },
        { $set: { reminderSent: true } },
      );
    } catch (e) { console.error(e); }
  }, 30000);
};