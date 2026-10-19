// routes/fresherBookingRoutes.js
// Mounted in app.js BEFORE the /api/session router:
//   app.use("/api", require("./routes/fresherBookingRoutes"));

const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// ---------- mentor accepts / rejects a live request ----------
// PATCH /api/session/session-requests/:requestGroupId
// bookingController exports `updateRequest` (alias: respondToRequest).
const respond = b.updateRequest || b.respondToRequest;

if (typeof respond === "function") {
  router.patch("/session/session-requests/:requestGroupId", requireAuth("mentor"), respond);
} else {
  console.warn(
    "[fresherBookingRoutes] bookingController.updateRequest is missing - " +
      "PATCH /api/session/session-requests/:requestGroupId will use the OLD session controller."
  );
}

// ---------- fresher bookings ----------
router.post("/bookings", requireAuth("fresher"), b.createRequest);
router.get("/bookings/me", requireAuth("fresher"), b.myBookings);
router.get("/bookings/needs-review", requireAuth("fresher"), b.needsReview);
router.get("/bookings/mentor/pending", requireAuth("mentor"), b.mentorPending);
// keep the dynamic :id route LAST so it never swallows the fixed paths above
router.get("/bookings/:id", requireAuth("fresher", "mentor"), b.getBooking);

// ---------- fresher notifications ----------
router.get("/fresher/notifications", requireAuth("fresher"), b.getFresherNotifications);
router.patch("/fresher/notifications/read-all", requireAuth("fresher"), b.markAllFresherNotificationsRead);
router.patch("/fresher/notifications/:id/read", requireAuth("fresher"), b.markFresherNotificationRead);

module.exports = router;