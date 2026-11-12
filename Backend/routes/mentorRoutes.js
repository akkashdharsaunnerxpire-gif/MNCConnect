const express = require("express");

const router = express.Router();

const {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  searchCompanyMentors,
  getCompanyDepartments,
} = require("../controllers/mentorController");

router.get("/companies", getMentorsByCompany);

router.get("/company-departments/:companyName", getCompanyDepartments);
router.get("/company-search/:companyName", searchCompanyMentors);
router.get("/:mentoremail", getMentorProfile);

router.put("/:mentoremail", UpdateMentorProfile);

module.exports = router;
