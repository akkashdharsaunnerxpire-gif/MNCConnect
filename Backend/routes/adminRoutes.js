// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/adminController");
const Mentor = require("../models/Mentor");
const { loginLimiter, sameOriginOnly } = require("../middleware/adminSecurity");

// ============================================================
// MIDDLEWARE
// ============================================================

// Redirect pages to login, return 401 JSON for API-style calls
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.admin) return next();

  if (req.method !== "GET") {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please log in again.",
    });
  }
  return res.redirect("/admin/login");
};

// Makes `admin` and the pending badge count available in every view
const attachLocals = async (req, res, next) => {
  res.locals.admin = req.session.admin;
  res.locals.pendingCount = 0;

  if (req.method === "GET") {
    try {
      res.locals.pendingCount = await Mentor.countDocuments({ verificationStatus: "pending" });
    } catch (_) { /* badge is optional */ }
  }
  next();
};

// ============================================================
// SECURITY (applies to every admin route)
// ============================================================

// CSRF protection: blocks POST / PATCH / PUT / DELETE coming from another site.
// No change is needed in admin.js (browsers send the Origin header automatically).
router.use(sameOriginOnly);

// ============================================================
// PUBLIC ROUTES
// ============================================================

router.get("/login", ctrl.showLoginPage);
// Counts only FAILED logins (5 per 15 min per IP + email), resets on success
router.post("/login", loginLimiter, ctrl.login);
router.get("/logout", ctrl.logout);

// ============================================================
// PROTECTED ROUTES
// ============================================================

router.use(requireAdmin, attachLocals);

router.get("/", ctrl.dashboard);

// Mentors (static paths MUST come before "/mentors/:id")
router.get("/mentors", ctrl.listMentors);
router.get("/mentors/export", ctrl.exportMentors);
router.post("/mentors/bulk", ctrl.bulkMentorAction);
router.get("/mentors/:id", ctrl.mentorDetails);
router.post("/mentors/:id/review", ctrl.saveReview); // NEW: manual verification checklist
router.patch("/mentors/:id/approve", ctrl.approveMentor);
router.patch("/mentors/:id/reject", ctrl.rejectMentor);
router.patch("/mentors/:id/pending", ctrl.resetMentor);



// Payments
router.get("/payments", ctrl.listPayments);

module.exports = router;