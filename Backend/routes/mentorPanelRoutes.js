// routes/mentorPanelRoutes.js
// Mount in server.js / app.js:   app.use("/api", require("./routes/mentorPanelRoutes"));

const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const panel = require("../controllers/mentorPanelController");
const payments = require("../controllers/paymentController");

const router = express.Router();

// ---------- wallet ----------
router.get("/wallet/me", requireAuth("mentor"), panel.getWallet);
router.post("/wallet/withdraw", requireAuth("mentor"), panel.requestWithdrawal);

// ---------- reviews ----------
router.get("/reviews/me", requireAuth("mentor"), panel.getMyReviews);
router.post("/reviews/:id/reply", requireAuth("mentor"), panel.replyToReview);
router.post("/reviews", requireAuth("fresher"), panel.createReview);

// ---------- notifications ----------
router.get("/notifications", requireAuth("mentor"), panel.getNotifications);
router.patch("/notifications/read-all", requireAuth("mentor"), panel.markAllNotificationsRead);
router.patch("/notifications/:id/read", requireAuth("mentor"), panel.markNotificationRead);
// routes/mentorPanelRoutes.js (add this line)
router.get("/mentor/stats", requireAuth("mentor"), panel.getMentorStats);

// ---------- payment <-> mentor link (optional HTTP version) ----------
router.post("/payments/assign-to-me", requireAuth("mentor"), payments.assignToMe);

module.exports = router;