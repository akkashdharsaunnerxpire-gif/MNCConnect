// routes/fresherBookingRoutes.js
// app.js:  app.use("/api", require("./routes/fresherBookingRoutes"));
//
// ORDER MATTERS: fixed paths (/me, /needs-review, /invite/:code, /join, /mentor/pending)
// must come BEFORE "/bookings/:id".
//
// NOTE: if your real file already has the confirm / counterpart / join / livekit lines,
// keep your paths. Only the AUTH rules matter.
const express = require("express");
const { requireAuth, requireActiveMentor } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// ---------- fresher ----------
router.post("/bookings", requireAuth("fresher"), b.createRequest);
router.get("/bookings/me", requireAuth("fresher"), b.myBookings);
router.get("/bookings/needs-review", requireAuth("fresher"), b.needsReview);
router.get("/bookings/invite/:code", requireAuth("fresher"), b.joinPreview);
router.post("/bookings/join", requireAuth("fresher"), b.joinGroup);

// ---------- mentor ----------
router.get("/bookings/mentor/pending", requireAuth("mentor"), b.mentorPending);

// ---------- both sides ----------
router.get("/bookings/:id/counterpart", requireAuth("fresher", "mentor"), b.getCounterpart);
router.post("/bookings/:id/livekit-token", requireAuth("fresher", "mentor"), b.livekitToken);
router.post("/bookings/:requestGroupId/confirm", requireAuth("fresher"), b.confirmCompletion);
router.get("/bookings/:id", requireAuth("fresher", "mentor"), b.getBooking);

// ---------- mentor accept / reject + status (app.js comment: this router owns these) ----------
router.patch(
  "/session/session-requests/:requestGroupId",
  requireAuth("mentor"),
  requireActiveMentor,
  b.updateRequest,
);
router.get("/session/session-requests/:requestGroupId", requireAuth("fresher", "mentor"), b.getRequestStatus);
router.get("/session/accepted-bookings", requireAuth("fresher"), b.getAcceptedBookings);

// ---------- fresher notifications ----------
router.get("/fresher/notifications", requireAuth("fresher"), b.getFresherNotifications);
router.patch("/fresher/notifications/read-all", requireAuth("fresher"), b.markAllFresherNotificationsRead);
router.patch("/fresher/notifications/:id/read", requireAuth("fresher"), b.markFresherNotificationRead);

module.exports = router;