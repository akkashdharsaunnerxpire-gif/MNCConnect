// controllers/mentorPanelController.js
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const Booking = require("../models/Booking");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");

const { computeWallet, round2, PLATFORM_FEE_PERCENT } = require("../utils/wallet");
const { notify, emitToUser, serializeNotification } = require("../utils/realtime");

const MIN_WITHDRAWAL = 500;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const PRIVATE_PAYMENT_FIELDS =
  "-payerEmail -payerContact -fresherEmail -method -razorpayOrderId -razorpayPaymentId -walletBreakdown";

const loadWallet = async (mentorId) => {
  const payments = await Payment.find({ mentor: mentorId, status: "paid" })
    .select(PRIVATE_PAYMENT_FIELDS)
    .sort({ paidAt: -1 })
    .lean();

  const active = payments.filter((p) => p.sessionStatus !== "cancelled");

  const withdrawals = await Withdrawal.find({ mentor: mentorId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  // requested + paid are locked; rejected goes back to available automatically
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

  // refunded rows (missed / cancelled sessions) are shown in the "Cancelled" tab with earning 0.
  // The wallet balance is NOT affected (it uses only "paid" payments).
  const refundedRows = await Payment.find({ mentor: mentorId, status: "refunded" })
    .select(PRIVATE_PAYMENT_FIELDS)
    .sort({ paidAt: -1 })
    .limit(100)
    .lean();

  const allRows = [...payments, ...refundedRows];
  const requestIds = [...new Set(allRows.map((p) => p.requestGroupId).filter(Boolean))];
  const bookings = requestIds.length
    ? await Booking.find({ requestGroupId: { $in: requestIds } })
      .select("requestGroupId status")
      .lean()
    : [];
  const bookingById = new Map(bookings.map((b) => [b.requestGroupId, b]));

  const sessionPayments = allRows
    .filter((p) => p.requestGroupId && bookingById.has(p.requestGroupId))
    .map((p) => ({
      ...p,
      bookingStatus: bookingById.get(p.requestGroupId).status,
      ...(p.status === "refunded" ? { mentorEarning: 0 } : {}),
    }));

  return {
    payments,
    sessionPayments,
    withdrawals,
    wallet: computeWallet(active, reserved),
  };
};

// GET /api/wallet/me
exports.getWallet = async (req, res) => {
  try {
    const { payments, sessionPayments, withdrawals, wallet } = await loadWallet(req.user.id);
    return res.json({
      success: true,
      wallet,
      payments,
      sessionPayments,
      withdrawals,
      mentorSharePercent: 100 - PLATFORM_FEE_PERCENT,
    });
  } catch (error) {
    console.error("getWallet error:", error.message);
    return fail(res, 500, "Unable to load wallet.");
  }
};

// POST /api/wallet/withdraw  { amount, upiId }   (mentor)
exports.requestWithdrawal = async (req, res) => {
  try {
    const amount = round2(req.body?.amount);
    const upiId = String(req.body?.upiId || "").trim().toLowerCase();

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return fail(res, 400, `Minimum withdrawal is ${rupees(MIN_WITHDRAWAL)}.`);
    }
    if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId)) {
      return fail(res, 400, "Enter a valid UPI ID.");
    }

    const mentor = await Mentor.findById(req.user.id)
      .select("accountStatus verificationStatus")
      .lean();
    if (!mentor || mentor.accountStatus !== "active" || mentor.verificationStatus !== "approved") {
      return fail(res, 403, "Your account is not active for withdrawals.");
    }

    const pending = await Withdrawal.exists({ mentor: req.user.id, status: "requested" });
    if (pending) {
      return fail(res, 409, "You already have a withdrawal request being processed.");
    }

    const { wallet } = await loadWallet(req.user.id);
    if (amount > wallet.available) {
      return fail(res, 400, "Amount is more than your available balance.");
    }

    let withdrawal;
    try {
      // the unique partial index in Withdrawal.js is the final guard against double requests
      withdrawal = await Withdrawal.create({ mentor: req.user.id, amount, upiId });
    } catch (e) {
      if (e.code === 11000) {
        return fail(res, 409, "You already have a withdrawal request being processed.");
      }
      throw e;
    }

    notify({
      user: req.user.id,
      role: "mentor",
      title: "Withdrawal requested",
      message: `Your request for ${rupees(withdrawal.amount)} to ${upiId} is being processed.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(String(req.user.id), "wallet:updated", {
      withdrawalId: withdrawal._id,
      status: "requested",
    });

    return res.status(201).json({ success: true, withdrawal });
  } catch (error) {
    console.error("requestWithdrawal error:", error.message);
    return fail(res, 500, "Unable to request withdrawal.");
  }
};


// controllers/mentorPanelController.js
// Replace ALL the old `exports.getMyReviews` blocks (there are 3 copies in the file)
// with this single one.

// GET /api/reviews/me (mentor)


exports.replyToReview = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 1000);
    if (!text) return fail(res, 400, "Reply cannot be empty.");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid review id.");

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, mentor: req.user.id },
      { $set: { reply: { text, repliedAt: new Date() } } },
      { returnDocument: "after" },
    );
    if (!review) return fail(res, 404, "Review not found.");

    emitToUser(req.user.id, "review:updated", { reviewId: review._id });
    return res.json({ success: true, review });
  } catch (error) {
    console.error("replyToReview error:", error.message);
    return fail(res, 500, "Unable to send reply.");
  }
};

// POST /api/reviews   { requestGroupId, rating, comment }   (fresher: host OR group friend)
exports.createReview = async (req, res) => {
  try {
    const requestGroupId = String(req.body?.requestGroupId || "").trim();
    const comment = String(req.body?.comment || "").trim().slice(0, 1000);
    const rating = Number(req.body?.rating);

    if (!requestGroupId) return fail(res, 400, "requestGroupId is required.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail(res, 400, "Rating must be between 1 and 5.");
    }
    if (comment.length < 3) return fail(res, 400, "Please write your feedback.");

    // FIX: host OR a friend who paid and joined the group
    const booking = await Booking.findOne({
      requestGroupId,
      $or: [{ fresher: req.user.id }, { "participants.fresher": req.user.id }],
    });
    if (!booking || !booking.mentor) return fail(res, 404, "Session not found.");
    if (!["in_progress", "awaiting_confirmation", "completed"].includes(booking.status)) {
      return fail(res, 400, "You can review once the session has started.");
    }

    const mentorId = booking.mentor;
    const fresher = await Fresher.findById(req.user.id).select("name").lean();

    let review;
    let created = true;
    try {
           review = await Review.create({
        mentor: mentorId,
        fresher: req.user.id,
        fresherName: fresher?.name || booking.fresherName || "Fresher",
        sessionKey: requestGroupId,
        session: booking.sessionType || booking.companyName || "Mentoring session",
        sessionStartsAt: booking.startsAt || null,
        sessionEndsAt: booking.endsAt || null,
        sessionDate: booking.date || "",
        sessionTime: booking.time || "",
        rating,
        comment,
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
      created = false; // already reviewed -> treat as success
      review = await Review.findOne({
        mentor: mentorId,
        fresher: req.user.id,
        sessionKey: requestGroupId,
      });
    }

    if (String(booking.fresher) === String(req.user.id)) {
      await Booking.updateOne({ _id: booking._id }, { $set: { reviewed: true } });
    }

    if (created) {
      const agg = await Review.aggregate([
        { $match: { mentor: new mongoose.Types.ObjectId(String(mentorId)) } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]);
      if (agg[0]) {
        await Mentor.updateOne(
          { _id: mentorId },
          { $set: { rating: Math.round(agg[0].avg * 10) / 10, totalReviews: agg[0].count } },
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
    }

    return res.status(created ? 201 : 200).json({ success: true, review, already: !created });
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
      { $set: { read: true, readAt: new Date() } },
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
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notifications.");
  }
};

// ============================================================
// MENTOR STATS (dashboard counters)
// ============================================================

// FIX: used to count status "accepted" only, so the total DROPPED when a session completed.
const COUNTED = ["accepted", "in_progress", "awaiting_confirmation", "completed"];

exports.getMentorStats = async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const base = { mentor: req.user.id, status: { $in: COUNTED } };

    const [total, week, month, completed] = await Promise.all([
      Booking.countDocuments(base),
      Booking.countDocuments({ ...base, startsAt: { $gte: weekAgo } }),
      Booking.countDocuments({ ...base, startsAt: { $gte: monthAgo } }),
      Booking.countDocuments({ mentor: req.user.id, status: "completed" }),
    ]);

    return res.json({ success: true, stats: { total, week, month, completed } });
  } catch (error) {
    console.error("getMentorStats error:", error.message);
    return fail(res, 500, "Unable to load stats.");
  }
};

// GET /api/mentor/profile/stats
exports.getProfileStats = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.user.id)
      .select("rating totalReviews totalSessions")
      .lean();
    if (!mentor) return fail(res, 404, "Mentor not found.");

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

// controllers/mentorPanelController.js
// Replace ALL the old `exports.getMyReviews` blocks (there are 3 copies in the file)
// with this single one.

// GET /api/reviews/me (mentor)

// GET /api/reviews/me (mentor)
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ mentor: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const sessionKeys = [
      ...new Set(reviews.map((r) => r.sessionKey).filter(Boolean)),
    ];
    const fresherIds = [
      ...new Set(reviews.map((r) => String(r.fresher)).filter(Boolean)),
    ];

    const [bookings, freshers] = await Promise.all([
      sessionKeys.length
        ? Booking.find({ requestGroupId: { $in: sessionKeys } }) // no mentor filter
            .select("requestGroupId mentor startsAt endsAt date time")
            .lean()
        : [],
      fresherIds.length
        ? Fresher.find({ _id: { $in: fresherIds } })
            .select("name avatar profileImage profilePicture photo image")
            .lean()
        : [],
    ]);

    // one booking per session; prefer the one that belongs to THIS mentor
    const bookingByKey = new Map();
    bookings.forEach((b) => {
      const key = String(b.requestGroupId);
      const mine = String(b.mentor) === String(req.user.id);
      const cur = bookingByKey.get(key);
      if (!cur || (mine && String(cur.mentor) !== String(req.user.id))) {
        bookingByKey.set(key, b);
      }
    });

    const fresherById = new Map(freshers.map((f) => [String(f._id), f]));

    const result = reviews.map((review) => {
      const likedBy = review.likedBy || [];
      const booking = bookingByKey.get(String(review.sessionKey));
      const fresher = fresherById.get(String(review.fresher));

      // live booking first, review snapshot as fallback
      const startsAt = booking?.startsAt || review.sessionStartsAt || null;
      const endsAt = booking?.endsAt || review.sessionEndsAt || null;

      return {
        ...review,
        likesCount: likedBy.length,
        isLiked: likedBy.some(
          (item) =>
            String(item.user) === String(req.user.id) &&
            item.role === req.user.role
        ),

        attendedAt: startsAt ? new Date(startsAt).toISOString() : null,
        sessionStartsAt: startsAt,
        sessionEndsAt: endsAt,
        sessionDate: booking?.date || review.sessionDate || "",
        sessionTime: booking?.time || review.sessionTime || "",

        fresherAvatar:
          fresher?.avatar ||
          fresher?.profileImage ||
          fresher?.profilePicture ||
          fresher?.photo ||
          fresher?.image ||
          "",
      };
    });

    return res.json({ success: true, reviews: result });
  } catch (error) {
    console.error("getMyReviews error:", error);
    return fail(res, 500, "Unable to load reviews.");
  }
};


exports.toggleReviewLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "Invalid review id.");
    }

    const review = await Review.findById(id).select(
      "_id fresher fresherName likedBy"
    );

    if (!review) {
      return fail(res, 404, "Review not found.");
    }

    if (
      role === "fresher" &&
      String(review.fresher) === String(userId)
    ) {
      return fail(res, 403, "You cannot like your own review.");
    }

    const alreadyLiked = (review.likedBy || []).some(
      (item) =>
        String(item.user) === String(userId) &&
        item.role === role
    );

    let liked;

    if (alreadyLiked) {
      await Review.updateOne(
        { _id: id },
        {
          $pull: {
            likedBy: {
              user: new mongoose.Types.ObjectId(userId),
              role,
            },
          },
        }
      );

      liked = false;
    } else {
      await Review.updateOne(
        { _id: id },
        {
          $addToSet: {
            likedBy: {
              user: new mongoose.Types.ObjectId(userId),
              role,
            },
          },
        }
      );

      liked = true;

      // Fetch the person who liked the review.
      const likerModel = role === "mentor" ? Mentor : Fresher;

      const liker = await likerModel
        .findById(userId)
        .select("name fullName")
        .lean();

      const likerName =
        liker?.fullName ||
        liker?.name ||
        (role === "mentor" ? "A mentor" : "A fresher");

      console.log("LIKER ROLE:", role);
      console.log("LIKER NAME:", likerName);

      // Notify the fresher who wrote this review.
      notify({
        user: review.fresher,
        role: "fresher",
        title: "Someone liked your review",
        message: `${likerName} liked your review.`,
        type: "review",
        link: "/fresher/reviews",
      });
    }

    const updatedReview = await Review.findById(id)
      .select("likedBy")
      .lean();

    const likesCount = updatedReview?.likedBy?.length || 0;

    return res.json({
      success: true,
      liked,
      likesCount,
    });
  } catch (error) {
    console.error("toggleReviewLike FULL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update review like.",
    });
  }
};


// REMOVED: assignToMe. The server already assigns the mentor to every payment
// when he accepts (bookingController.updateRequest -> assignMentorToAll).
// The old endpoint let ANY mentor take another mentor's payments.