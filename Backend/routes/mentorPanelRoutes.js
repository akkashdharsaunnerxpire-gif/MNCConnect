// routes/mentorPanelRoutes.js
const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const panel = require("../controllers/mentorPanelController");
const payments = require("../controllers/paymentController");

const router = express.Router();

// ---------- wallet ----------
router.get("/wallet/me", requireAuth("mentor"), panel.getWallet);
router.post("/wallet/withdraw", requireAuth("mentor"), panel.requestWithdrawal);

// admin marks a withdrawal paid / rejected -> mentor sees it live
// NOTE: make sure requireAuth supports the "admin" role in middleware/panelAuth.js
router.patch("/wallet/withdrawals/:id", requireAuth("admin"), panel.updateWithdrawalStatus);

// ---------- mentor profile stats ----------
router.get("/mentor/profile/stats", requireAuth("mentor"), panel.getProfileStats);

// ---------- reviews ----------
router.get("/reviews/me", requireAuth("mentor"), panel.getMyReviews);
router.post("/reviews/:id/reply", requireAuth("mentor"), panel.replyToReview);
router.post("/reviews", requireAuth("fresher"), panel.createReview);

// ---------- notifications ----------
router.get("/notifications", requireAuth("mentor"), panel.getNotifications);
router.patch("/notifications/read-all", requireAuth("mentor"), panel.markAllNotificationsRead);
router.patch("/notifications/:id/read", requireAuth("mentor"), panel.markNotificationRead);

// ---------- dashboard stats ----------
router.get("/mentor/stats", requireAuth("mentor"), panel.getMentorStats);

// ---------- payment <-> mentor link ----------
router.post("/payments/assign-to-me", requireAuth("mentor"), payments.assignToMe);

module.exports = router;