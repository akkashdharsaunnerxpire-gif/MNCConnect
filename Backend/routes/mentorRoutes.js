const express = require("express");
const router = express.Router();

const { requireAuth, optionalAuth } = require("../middleware/panelAuth");
const {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  searchCompanyMentors,
  getCompanyDepartments,
} = require("../controllers/mentorController");

// /:mentoremail must only catch real e-mails. Words like "stats" fall through to mentorPanelRoutes.
router.param("mentoremail", (req, res, next, value) => {
  if (!String(value).includes("@")) return next("route");
  next();
});

router.get("/companies", getMentorsByCompany);
router.get("/company-departments/:companyName", requireAuth("fresher"), getCompanyDepartments);
router.get("/company-search/:companyName", requireAuth("fresher"), searchCompanyMentors);

// owner -> full profile, anybody else (even not logged in) -> public fields only
router.get("/:mentoremail", optionalAuth, getMentorProfile);
router.put("/:mentoremail", requireAuth("mentor"), UpdateMentorProfile);

module.exports = router;