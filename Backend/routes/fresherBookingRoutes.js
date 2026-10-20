// routes/fresherBookingRoutes.js
// Mounted in app.js BEFORE the /api/session router:
//   app.use("/api", require("./routes/fresherBookingRoutes"));

const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// Fail loudly at startup (with the function NAME) instead of a vague Express crash.
const need = (name) => {
  if (typeof b[name] !== "function") {
    throw new Error(`bookingController.${name} is not exported - add it before starting the server`);
  }
  return b[name];
};

// ---------- mentor accepts / rejects a live request ----------
// PATCH /api/session/session-requests/:requestGroupId
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
router.post("/bookings", requireAuth("fresher"), need("createRequest"));
router.patch("/bookings/:requestGroupId/confirm", requireAuth("fresher"), need("confirmCompletion"));
router.get("/bookings/me", requireAuth("fresher"), need("myBookings"));
router.get("/bookings/needs-review", requireAuth("fresher"), need("needsReview"));
router.get("/bookings/mentor/pending", requireAuth("mentor"), need("mentorPending"));
// keep the dynamic :id route LAST so it never swallows the fixed paths above
router.get("/bookings/:id", requireAuth("fresher", "mentor"), need("getBooking"));

// ---------- fresher notifications ----------
router.get("/fresher/notifications", requireAuth("fresher"), need("getFresherNotifications"));
router.patch("/fresher/notifications/read-all", requireAuth("fresher"), need("markAllFresherNotificationsRead"));
router.patch("/fresher/notifications/:id/read", requireAuth("fresher"), need("markFresherNotificationRead"));

module.exports = router;