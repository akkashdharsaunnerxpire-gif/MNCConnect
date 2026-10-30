
// routes/fresherBookingRoutes.js

const express = require("express");
const { requireAuth } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// Check controller exports
const need = (name) => {
  if (typeof b[name] !== "function") {
    throw new Error(
      `bookingController.${name} is not exported - add it before starting the server`
    );
  }
  return b[name];
};

// ---------- Mentor accepts / rejects request ----------
const respond = b.updateRequest || b.respondToRequest;

if (typeof respond === "function") {
  router.patch(
    "/session/session-requests/:requestGroupId",
    requireAuth("mentor"),
    respond
  );
} else {
  console.warn(
    "[fresherBookingRoutes] bookingController.updateRequest is missing"
  );
}

// ---------- Fresher bookings ----------
router.post(
  "/bookings",
  requireAuth("fresher"),
  need("createRequest")
);

router.patch(
  "/bookings/:requestGroupId/confirm",
  requireAuth("fresher"),
  need("confirmCompletion")
);

router.get(
  "/bookings/me",
  requireAuth("fresher"),
  need("myBookings")
);

router.get(
  "/bookings/needs-review",
  requireAuth("fresher"),
  need("needsReview")
);

router.get(
  "/bookings/mentor/pending",
  requireAuth("mentor"),
  need("mentorPending")
);

// ---------- Mentor / Fresher counterpart details ----------
router.get(
  "/bookings/:id/counterpart",
  requireAuth("fresher", "mentor"),
  need("getCounterpart")
);

// ---------- Single booking details ----------
router.get(
  "/bookings/:id",
  requireAuth("fresher", "mentor"),
  need("getBooking")
);

// ---------- Fresher notifications ----------
router.get(
  "/fresher/notifications",
  requireAuth("fresher"),
  need("getFresherNotifications")
);

router.patch(
  "/fresher/notifications/read-all",
  requireAuth("fresher"),
  need("markAllFresherNotificationsRead")
);

router.patch(
  "/fresher/notifications/:id/read",
  requireAuth("fresher"),
  need("markFresherNotificationRead")
);

module.exports = router;
