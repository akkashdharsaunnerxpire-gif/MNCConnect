const express = require("express");
const router = express.Router();
const Mentor = require("../models/Mentor");

// Import controller functions
const {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
} = require("../controllers/mentorController");


// ✅ These routes should work if the controller functions exist
router.get("/companies", getMentorsByCompany);
router.get("/:mentoremail", getMentorProfile);
router.put("/:mentoremail", UpdateMentorProfile);

module.exports = router;