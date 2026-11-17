const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/panelAuth");
const {
  createSessionRequest,
  getSessionRequestStatus,
  updateSessionRequest,
  getAcceptedBookings,
} = require("../controllers/sessionRequestController");

// The booking router (mounted first) owns PATCH/GET session-requests/:id and accepted-bookings.
// This legacy file is only a fallback. If the old flow is unused, DELETE this file and its
// app.use("/api/session", ...) line. createSessionRequest must never create a request WITHOUT a verified payment.
router.post("/session-requests", requireAuth("fresher"), createSessionRequest);
router.get("/session-requests/:requestGroupId", requireAuth("fresher", "mentor"), getSessionRequestStatus);
router.patch("/session-requests/:requestGroupId", requireAuth("mentor"), updateSessionRequest);
router.get("/accepted-bookings", requireAuth("fresher"), getAcceptedBookings);

module.exports = router;