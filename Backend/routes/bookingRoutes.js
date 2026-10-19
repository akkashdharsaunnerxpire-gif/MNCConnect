// routes/bookingRoutes.js
// Mount in app.js:   app.use("/api", require("./routes/bookingRoutes"));

const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// ---------- fresher bookings ----------
router.post("/bookings", requireAuth("fresher"), b.createRequest);
router.get("/bookings/me", requireAuth("fresher"), b.myBookings);
router.get("/bookings/needs-review", requireAuth("fresher"), b.needsReview);
router.get("/bookings/mentor/pending", requireAuth("mentor"), b.mentorPending);
router.get("/bookings/:id", requireAuth("fresher", "mentor"), b.getBooking);

// ---------- fresher notifications ----------
router.get("/fresher/notifications", requireAuth("fresher"), b.getFresherNotifications);
router.patch("/fresher/notifications/read-all", requireAuth("fresher"), b.markAllFresherNotificationsRead);
router.patch("/fresher/notifications/:id/read", requireAuth("fresher"), b.markFresherNotificationRead);

module.exports = router;