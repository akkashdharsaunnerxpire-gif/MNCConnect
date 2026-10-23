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
const { linkPaymentToRequest, assignMentorToRequest } = require("./paymentController");

/* ============================ CONFIG ============================ */

const MIN_LEAD_MS = 15 * 60 * 1000;
const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const STRICT_MATCH = process.env.STRICT_MENTOR_MATCH === "true";

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
  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender)) return "gender mismatch";
  const spoken = arr(m.spokenLanguages).map(norm).filter(Boolean);
  if (!isAny(b.language) && spoken.length && !spoken.some((l) => loose(l, b.language))) return "language mismatch";
  if (STRICT_MATCH && !isAny(b.role)) {
    const target = norm(b.role) === "other" ? b.otherRole : b.role;
    const values = [m.designation, m.department, ...arr(m.skills), ...arr(m.expertise), ...arr(m.languages)];
    if (!isAny(target) && !values.some((v) => loose(v, target))) return "role mismatch";
  }
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
  mentor: mentorCard(b.mentor),
  direct: Boolean(b.preferredMentor),
  reviewed: Boolean(b.reviewed),
  refundStatus: b.refundStatus || "",
  remainingMs: remainingOf(b),
  timerRunning: isRunning(b),
});

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ============================ REFUNDS ============================ */

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

const refundPaymentToWallet = async (payment, fresherId, amount) => {
  if (!payment || payment.status === "refunded") return "refunded";
  try {
    await Fresher.findByIdAndUpdate(fresherId, { $inc: { walletBalance: Number(amount) || 0 } });
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: "refunded", sessionStatus: "cancelled", refundMethod: "wallet" } }
    );
    return "refunded";
  } catch (error) {
    console.error("WALLET REFUND FAILED:", error.message);
    return "failed";
  }
};

// pending request nobody accepted (or the chosen mentor declined) -> expire it and give the money back
const expireAndRefund = async (bookingId, reason) => {
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "pending" },
    { $set: { status: "expired" } },
    { returnDocument: "after" }
  );
  if (!locked) return null; // someone accepted it / already expired

  const payment = await Payment.findOne({ razorpayPaymentId: locked.razorpayPaymentId });
  const result = await refundPayment(payment, reason);
  await Booking.updateOne({ _id: locked._id }, { $set: { refundStatus: result } });

  const fresh = await Booking.findById(locked._id).populate("mentor", POPULATE_MENTOR);
  if (fresh?.fresher) {
    notify({
      user: fresh.fresher,
      role: "fresher",
      title: result === "refunded" ? "Request expired - refund started" : "Request expired",
      message:
        result === "refunded"
          ? `${reason} Your payment of ₹${fresh.amount} is being refunded.`
          : `${reason} Refund is processing, we will update you soon.`,
      type: "payment",
      link: "/Home",
    });
    emitToUser(fresh.fresher, "booking:updated", toClient(fresh));
  }
  return fresh;
};

const broadcastLoop = async (req, mentors, booking, payload, startsAt, endsAt, requestGroupId, notified) => {
  for (const m of mentors) {
    // direct request (book again): fresher chose this mentor, so skip company/gender/language filters
    const reason =
      (booking.preferredMentor ? "" : whyNot(m, booking)) ||
      (socketIdsOf(req.app, m._id).length === 0 ? "not online" : "") ||
      ((await hasConflict(m._id, startsAt, endsAt, requestGroupId)) ? "conflict" : "");
    if (reason) continue;
    notified.push(m._id);
    emitToMentorSockets(req.app, m._id, "session-request", payload);
    notify({
      user: m._id,
      role: "mentor",
      title: booking.preferredMentor ? "A fresher requested you again" : "New session request",
      message: `${booking.fresherName} wants a session.`,
      type: "session",
      link: "/mentor/home",
    });
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

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message);
      return fail(res, status, `${message}${result === "refunded" ? " Refunded." : ""}`);
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 240) return reject(400, "Invalid duration");

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt || startsAt.getTime() < Date.now() + MIN_LEAD_MS) return reject(400, "Invalid date/time");

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
    }

    const fresherId = req.user?.role === "fresher" ? req.user.id : payment.fresher ? String(payment.fresher) : null;
    const fresherDoc = fresherId ? await Fresher.findById(fresherId).select("name email").lean() : null;

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: fresherDoc?.name || body.requester?.fullName || "Fresher",
      fresherEmail: fresherDoc?.email || body.requester?.email || "",
      companyName: String(body.companyName || preferredMentor?.currentCompany || "").trim(),
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

    return res.status(201).json({ success: true, booking: toClient(booking), notifiedCount: notified.length });
  } catch (error) {
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
    const mentorId = req.user?.role === "mentor" ? req.user.id : req.body?.mentorId;

    if (!["accepted", "rejected"].includes(status)) return fail(res, 400, "Status must be accepted/rejected");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Request not found");

    // direct request: only the chosen mentor may answer it
    const isDirect = Boolean(booking.preferredMentor);
    if (isDirect && String(booking.preferredMentor) !== String(mentorId)) {
      return fail(res, 403, "This request is for another mentor");
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

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      { $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Already accepted");

    await assignMentorToRequest({ requestGroupId, mentorId }).catch(() => {});

    emitToUser(accepted.fresher, "booking:updated", toClient(accepted));
    return res.json({ success: true, status: "accepted", booking: toClient(accepted) });
  } catch (error) {
    return fail(res, 500, "Failed to update");
  }
};

exports.respondToRequest = exports.updateRequest;

/* ============================ READ ============================ */

exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.requestGroupId || "") }).populate("mentor", POPULATE_MENTOR);
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
    const list = await Booking.find({ fresher: req.user.id }).populate("mentor", POPULATE_MENTOR).sort({ startsAt: -1 });
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
    const b = await Booking.findOne({ requestGroupId: String(req.params.id) }).populate("mentor", POPULATE_MENTOR);
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
      notified: req.user.id,
      declinedBy: { $ne: req.user.id },
    }).sort({ createdAt: -1 });
    return res.json({ success: true, requests: list.map(toMentorPayload) });
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

// fresher said YES -> money released to mentor, session "completed"
const settleCompleted = async (booking) => {
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["awaiting_confirmation", "in_progress", "accepted"] } },
    { $set: { status: "completed", completedAt: now, "meeting.remainingMs": 0, "meeting.endedAt": now } },
    { returnDocument: "after" }
  ).populate("mentor", POPULATE_MENTOR);
  if (!updated) return null;

  const amount = Number(updated.amount || 0);
  const mentorShare = amount * 0.75;
  const platformShare = amount * 0.25;

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
      message: `Fresher confirmed the session. ₹${mentorShare} added to your wallet.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(updated.mentor._id, "wallet:updated", { requestGroupId: updated.requestGroupId });
    emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
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

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      { $set: { status: "disputed", completedAt: new Date() } },
      { returnDocument: "after" }
    ).populate("mentor", POPULATE_MENTOR);

    const payment = await Payment.findOne({ razorpayPaymentId: booking.razorpayPaymentId });
    await refundPaymentToWallet(payment, booking.fresher, booking.amount);

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

exports.startSchedulers = (app) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const now = new Date();

      // nobody accepted before the start time -> expire + refund
      const stale = await Booking.find({ status: "pending", expiresAt: { $lte: now } }).select("_id");
      for (const b of stale) {
        await expireAndRefund(b._id, "No employee accepted your request in time.");
      }

      // retry refunds that failed earlier (expired + refundStatus failed)
      const failedRefunds = await Booking.find({
        status: "expired",
        refundStatus: "failed",
        razorpayPaymentId: { $ne: "" },
      }).limit(10);
      for (const b of failedRefunds) {
        const payment = await Payment.findOne({ razorpayPaymentId: b.razorpayPaymentId });
        const result = await refundPayment(payment, "Retry: request expired");
        if (result === "refunded") {
          await Booking.updateOne({ _id: b._id }, { $set: { refundStatus: "refunded" } });
          if (b.fresher) emitToUser(b.fresher, "booking:updated", { requestGroupId: b.requestGroupId, refundStatus: "refunded" });
        }
      }

      // safety net: a running timer that is overdue gets finished
      const overdue = await Booking.find({
        status: "in_progress",
        "meeting.timerEndsAt": { $lte: now },
      }).select("requestGroupId");
      for (const b of overdue) await completeBooking(b.requestGroupId);

      const soon = await Booking.find({
        status: "accepted",
        reminderSent: false,
        startsAt: { $lte: new Date(now.getTime() + 5 * 60000) },
      });
      for (const b of soon) await Booking.updateOne({ _id: b._id }, { $set: { reminderSent: true } });
    } catch (e) {
      console.error(e);
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
      const reason =
        (b.preferredMentor ? "" : whyNot(mentor, b)) ||
        ((await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId)) ? "has another session within 30 minutes" : "");
      if (reason) continue;

      await Booking.updateOne({ _id: b._id }, { $addToSet: { notified: mentor._id } });
      emitToMentorSockets(app, mentor._id, "session-request", toMentorPayload(b));
    }
  } catch (error) {
    console.error("pushPendingToMentor error:", error.message);
  }
};

exports.whyNot = whyNot;