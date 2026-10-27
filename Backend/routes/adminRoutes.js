// routes/adminRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const ctrl = require("../controllers/adminController");
const Mentor = require("../models/Mentor");
const { loginLimiter, sameOriginOnly } = require("../middleware/adminSecurity");

// ============================================================
// SECURITY HELPERS
// ============================================================

// 1. Admin pages must never be cached (back button after logout shows nothing)
//    and must never be indexed by search engines.
const privateHeaders = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY", // clickjacking protection
  });
  next();
};

// 2. Only logged-in admins. Pages redirect to login, API-style calls get 401 JSON.
const requireAdmin = (req, res, next) => {
  const a = req.session && req.session.admin;
  // If your admin object has a role field, it must be an admin role.
  const roleOk = a && (!a.role || ["admin", "superadmin"].includes(a.role));
  if (roleOk) return next();

  if (req.method !== "GET") {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please log in again.",
    });
  }
  return res.redirect("/admin/login");
};

// 3. Makes `admin` and the pending badge count available in every view
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

// 4. Throttle every state-changing call (approve / reject / review / bulk).
//    Stops a stolen session or a buggy script from mass-changing mentors.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many actions. Please wait a minute." },
});

// 5. Reject malformed ids before they reach the controller / MongoDB
router.param("id", (req, res, next, id) => {
  if (mongoose.isValidObjectId(id)) return next();
  if (req.method === "GET") return res.redirect("/admin/mentors");
  return res.status(400).json({ success: false, message: "Invalid mentor id." });
});

// ============================================================
// GLOBAL ADMIN MIDDLEWARE
// ============================================================

router.use(privateHeaders);

// CSRF protection: blocks POST / PATCH / PUT / DELETE coming from another site.
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

// Throttle all writes (GET requests are not counted)
router.use((req, res, next) => (req.method === "GET" ? next() : writeLimiter(req, res, next)));

router.get("/", ctrl.dashboard);

// Mentors (static paths MUST come before "/mentors/:id")
router.get("/mentors", ctrl.listMentors);
router.get("/mentors/export", ctrl.exportMentors);
router.post("/mentors/bulk", ctrl.bulkMentorAction);
router.get("/mentors/:id", ctrl.mentorDetails);
router.post("/mentors/:id/review", ctrl.saveReview); // manual verification checklist
router.patch("/mentors/:id/approve", ctrl.approveMentor);
router.patch("/mentors/:id/reject", ctrl.rejectMentor);
router.patch("/mentors/:id/pending", ctrl.resetMentor);

// Payments
router.get("/payments", ctrl.listPayments);

// Users / freshers: enable ONLY after these controller functions exist
// router.get("/users", ctrl.listUsers);
// router.get("/freshers", ctrl.listFreshers);

module.exports = router;