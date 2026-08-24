const express = require("express");
const router = express.Router();

const {
  registerFresher,
  loginFresher,
  registerMentor,
  loginMentor,
  getMe,
  updateMentorVerification,
} = require("../controllers/authController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  uploadMentorFiles,
  handleMulterError,
} = require("../middleware/uploadMiddleware");


// ============================================================
// FRESHER / NORMAL USER
// ============================================================

// Register - POST /api/auth/fresher/register
router.post("/fresher/register", registerFresher);

// Login - POST /api/auth/fresher/login
router.post("/fresher/login", loginFresher);

// ============================================================
// MENTOR / MNC EMPLOYEE
// ============================================================

// Register - POST /api/auth/mentor/register
// Uses Cloudinary upload middleware with proper error handling
router.post(
  "/mentor/register",
  uploadMentorFiles,        // Upload files to memory buffer
  handleMulterError,        // Handle multer errors
  registerMentor            // Process registration with Cloudinary upload
);

// Login - POST /api/auth/mentor/login
router.post("/mentor/login", loginMentor);

// ============================================================
// CURRENT USER
// ============================================================

// GET /api/auth/me - Get current user profile
router.get(
  "/me",
  protect,
  getMe
);


// ============================================================
// ADMIN - MENTOR VERIFICATION
// ============================================================

// PUT /api/auth/admin/mentors/:id/verification
// Admin approves or rejects mentor verification
router.put(
  "/admin/mentors/:id/verification",
  protect,
  authorize("admin"),
  updateMentorVerification
);

// ============================================================
// EXPORTS
// ============================================================

module.exports = router;