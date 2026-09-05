const express = require("express");

const router = express.Router();

const {
  createSessionRequest,
  getSessionRequestStatus,
  updateSessionRequest,
    getAcceptedBookings,
} = require("../controllers/sessionRequestController");

router.post("/session-requests", createSessionRequest);

router.get(
  "/session-requests/:requestGroupId",
  getSessionRequestStatus
);

router.patch(
  "/session-requests/:requestGroupId",
  updateSessionRequest
);

router.get(
  "/accepted-bookings",
  getAcceptedBookings
);


module.exports = router;