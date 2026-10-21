// controllers/mentorPanelController.js
// Wallet, withdrawals, reviews and notifications for the mentor panel.
// Every mentor endpoint reads the mentor id from the JWT (req.user.id).

const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const Booking = require("../models/Booking");

const { computeWallet } = require("../utils/wallet");
const { notify, emitToUser, serializeNotification } = require("../utils/realtime");

const MIN_WITHDRAWAL = 500;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fail = (res, status, message) => res.status(status).json({ success: false, message });

/* ============================================================
   WALLET
============================================================ */

const loadWallet = async (mentorId) => {
  const payments = await Payment.find({ mentor: mentorId, status: "paid" })
    .select("-payerEmail -payerContact -fresherEmail -method -razorpayOrderId -razorpayPaymentId")
    .sort({ paidAt: -1 })
    .lean();

  const active = payments.filter((p) => p.sessionStatus !== "cancelled");

  const agg = await Withdrawal.aggregate([
    {
      $match: {
        mentor: new mongoose.Types.ObjectId(String(mentorId)),
        status: { $in: ["requested", "paid"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const reserved = agg[0]?.total || 0;
  return { payments, wallet: computeWallet(active, reserved) };
};

// GET /api/wallet/me
exports.getWallet = async (req, res) => {
  try {
    const { payments, wallet } = await loadWallet(req.user.id);
    return res.json({ success: true, wallet, payments });
  } catch (error) {
    console.error("getWallet error:", error.message);
    return fail(res, 500, "Unable to load wallet.");
  }
};

// POST /api/wallet/withdraw  { amount, upiId }
exports.requestWithdrawal = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const upiId = String(req.body?.upiId || "").trim();

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return fail(res, 400, `Minimum withdrawal is ${rupees(MIN_WITHDRAWAL)}.`);
    }
    if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId)) {
      return fail(res, 400, "Enter a valid UPI ID.");
    }

    const { wallet } = await loadWallet(req.user.id);
    if (amount > wallet.available) {
      return fail(res, 400, "Amount is more than your available balance.");
    }

    const withdrawal = await Withdrawal.create({
      mentor: req.user.id,
      amount: Math.round(amount),
      upiId,
    });

    notify({
      user: req.user.id,
      role: "mentor",
      title: "Withdrawal requested",
      message: `Your request for ${rupees(withdrawal.amount)} to ${upiId} is being processed.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(req.user.id, "wallet:updated", { withdrawalId: withdrawal._id });

    return res.status(201).json({ success: true, withdrawal });
  } catch (error) {
    console.error("requestWithdrawal error:", error.message);
    return fail(res, 500, "Unable to request withdrawal.");
  }
};

/* ============================================================
   REVIEWS
============================================================ */

// GET /api/reviews/me   (mentor)
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ mentor: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, reviews });
  } catch (error) {
    console.error("getMyReviews error:", error.message);
    return fail(res, 500, "Unable to load reviews.");
  }
};

// POST /api/reviews/:id/reply  { text }   (mentor)
exports.replyToReview = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 1000);
    if (!text) return fail(res, 400, "Reply cannot be empty.");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid review id.");

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, mentor: req.user.id },
      { $set: { reply: { text, repliedAt: new Date() } } },
      { new: true }
    );
    if (!review) return fail(res, 404, "Review not found.");

    emitToUser(req.user.id, "review:updated", { reviewId: review._id });
    return res.json({ success: true, review });
  } catch (error) {
    console.error("replyToReview error:", error.message);
    return fail(res, 500, "Unable to send reply.");
  }
};

// POST /api/reviews   { mentorId, requestGroupId, rating, comment }   (fresher)
exports.createReview = async (req, res) => {
  try {
    const { mentorId, requestGroupId, comment } = req.body || {};
    const rating = Number(req.body?.rating);

    if (!mongoose.Types.ObjectId.isValid(mentorId) || !requestGroupId) {
      return fail(res, 400, "mentorId and requestGroupId are required.");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail(res, 400, "Rating must be between 1 and 5.");
    }

    // only a fresher who paid for a finished session with this mentor can review
    const payment = await Payment.findOne({
      fresher: req.user.id,
      mentor: mentorId,
      requestGroupId: String(requestGroupId),
      status: "paid",
    }).lean();

    if (!payment) return fail(res, 404, "No paid session found for this mentor.");
    if (!payment.sessionEndsAt || new Date(payment.sessionEndsAt) > new Date()) {
      return fail(res, 400, "You can review once the session has ended.");
    }

    const fresher = await Fresher.findById(req.user.id).select("name").lean();

    let review;
    try {
      review = await Review.create({
        mentor: mentorId,
        fresher: req.user.id,
        fresherName: fresher?.name || payment.fresherName || "Fresher",
        sessionKey: String(requestGroupId),
        session: payment.topic || "Mentoring session",
        rating,
        comment: String(comment || "").trim().slice(0, 1000),
      });
    } catch (e) {
      if (e.code === 11000) return fail(res, 409, "You already reviewed this session.");
      throw e;
    }

    // keep the mentor's profile numbers in sync
    const agg = await Review.aggregate([
      { $match: { mentor: new mongoose.Types.ObjectId(String(mentorId)) } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (agg[0]) {
      await Mentor.updateOne(
        { _id: mentorId },
        { $set: { rating: Math.round(agg[0].avg * 10) / 10, totalReviews: agg[0].count } }
      );
    }

    notify({
      user: mentorId,
      role: "mentor",
      title: "New review",
      message: `${review.fresherName} rated your session ${rating}/5.`,
      type: "review",
      link: "/mentor/reviews",
    });
    emitToUser(mentorId, "review:new", { reviewId: review._id });

    return res.status(201).json({ success: true, review });
  } catch (error) {
    console.error("createReview error:", error.message);
    return fail(res, 500, "Unable to save review.");
  }
};

/* ============================================================
   NOTIFICATIONS
============================================================ */

// GET /api/notifications?limit=50
exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const filter = { user: req.user.id, role: "mentor" };

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
    console.error("getNotifications error:", error.message);
    return fail(res, 500, "Unable to load notifications.");
  }
};

// PATCH /api/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid id.");
    await Notification.updateOne(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notification.");
  }
};

// PATCH /api/notifications/read-all
exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, role: "mentor", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notifications.");
  }
};

// mentorPanelController.js — add to getWallet or new endpoint
// ============================================================
// MENTOR STATS (dashboard counters)
// ============================================================

exports.getMentorStats = async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [total, week, month, completed] = await Promise.all([
      Booking.countDocuments({ mentor: req.user.id, status: "accepted" }),
      Booking.countDocuments({
        mentor: req.user.id,
        status: "accepted",
        startsAt: { $gte: weekAgo },
      }),
      Booking.countDocuments({
        mentor: req.user.id,
        status: "accepted",
        startsAt: { $gte: monthAgo },
      }),
      Booking.countDocuments({ mentor: req.user.id, status: "completed" }),
    ]);

    return res.json({
      success: true,
      stats: { total, week, month, completed },
    });
  } catch (error) {
    console.error("getMentorStats error:", error.message);
    return fail(res, 500, "Unable to load stats.");
  }
};
// ============================================================
// GET /api/mentor/profile/stats (Real-time Stats for Profile)
// ============================================================

exports.getProfileStats = async (req, res) => {
  try {
    const mentorId = req.user.id;

    // Fetch mentor document
    const mentor = await Mentor.findById(mentorId).select("rating totalReviews totalSessions").lean();
    
    if (!mentor) {
      return fail(res, 404, "Mentor not found.");
    }

    return res.json({
      success: true,
      averageRating: mentor.rating || 0,
      totalReviews: mentor.totalReviews || 0,
      totalSessions: mentor.totalSessions || 0,
    });
  } catch (error) {
    console.error("getProfileStats error:", error.message);
    return fail(res, 500, "Unable to load stats.");
  }
};