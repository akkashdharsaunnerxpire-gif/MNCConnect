// routes/fresherBookingRoutes.js
// app.js:  app.use("/api", require("./routes/fresherBookingRoutes"));
//
// ORDER MATTERS: fixed paths must come BEFORE "/bookings/:id".
const express = require("express");
const { requireAuth, requireActiveMentor } = require("../middleware/panelAuth");
const b = require("../controllers/bookingController");

const router = express.Router();

// ---------- LiveKit webhook (NO login: protected by LiveKit's signed header) ----------
// LiveKit sends content-type "application/webhook+json". express.raw keeps the body
// as a Buffer, which the signature check needs. Dashboard URL:
//   https://<your-backend>/api/bookings/livekit-webhook
router.post(
  "/bookings/livekit-webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  b.livekitWebhook,
);

// ---------- admin: disputes ----------
router.get("/bookings/admin/disputes", requireAuth("admin"), b.listDisputes);
router.post(
  "/bookings/admin/disputes/:requestGroupId/resolve",
  requireAuth("admin"),
  b.resolveDispute,
);

// ---------- fresher ----------
// ---------- fresher ----------
router.post("/bookings/join", requireAuth("fresher"), b.joinGroup);
router.post("/bookings", requireAuth("fresher"), b.createRequest);
router.get("/bookings/me", requireAuth("fresher"), b.myBookings);
router.get("/bookings/needs-review", requireAuth("fresher"), b.needsReview);
router.get("/bookings/prices", requireAuth("fresher"), b.getPrices);   // <-- moved here
router.get("/bookings/invite/:code", requireAuth("fresher"), b.joinPreview);

// ---------- mentor ----------
router.get("/bookings/mentor/pending", requireAuth("mentor"), b.mentorPending);

// ---------- both sides ----------
router.get("/bookings/:id/counterpart", requireAuth("fresher", "mentor"), b.getCounterpart);
router.post("/bookings/:id/livekit-token", requireAuth("fresher", "mentor"), b.livekitToken);
router.post("/bookings/:requestGroupId/confirm", requireAuth("fresher"), b.confirmCompletion);
router.get("/bookings/:id", requireAuth("fresher", "mentor"), b.getBooking);

// ---------- mentor accept / reject + status ----------
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