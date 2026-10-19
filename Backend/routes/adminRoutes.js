// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/adminController");
const Mentor = require("../models/Mentor");

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

// Simple in-memory brute-force protection: 10 attempts / 15 minutes / IP
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const loginLimiter = (req, res, next) => {
  const now = Date.now();
  const rec = attempts.get(req.ip) || { count: 0, start: now };

  if (now - rec.start > WINDOW_MS) { rec.count = 0; rec.start = now; }
  rec.count += 1;
  attempts.set(req.ip, rec);

  if (rec.count > MAX_ATTEMPTS) {
    return res.status(429).render("admin/login", {
      error: "Too many login attempts. Please try again in 15 minutes.",
    });
  }
  next();
};

// ============================================================
// PUBLIC ROUTES
// ============================================================

router.get("/login", ctrl.showLoginPage);
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
router.patch("/mentors/:id/approve", ctrl.approveMentor);
router.patch("/mentors/:id/reject", ctrl.rejectMentor);
router.patch("/mentors/:id/pending", ctrl.resetMentor);

// Users & freshers
router.get("/users", ctrl.listUsers("users"));
router.get("/freshers", ctrl.listUsers("freshers"));
router.patch("/users/:id/toggle", ctrl.toggleUser);

// Payments
router.get("/payments", ctrl.listPayments);

module.exports = router;