const express = require("express");

const router = express.Router();

const {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  createSessionRequest,
  getSessionRequestStatus,
} = require("../controllers/mentorController");

router.get("/companies", getMentorsByCompany);

router.post(
  "/session-requests",
  createSessionRequest
);

router.get(
  "/session-requests/:requestGroupId",
  getSessionRequestStatus
);

router.get(
  "/:mentoremail",
  getMentorProfile
);

router.put(
  "/:mentoremail",
  UpdateMentorProfile
);

module.exports = router;