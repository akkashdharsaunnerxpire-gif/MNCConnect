const express = require("express");

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
  upload,
} = require("../middleware/uploadMiddleware");

const router = express.Router();


// =====================================================
// FRESHER / NORMAL USER
// =====================================================

// Register
// POST /api/auth/fresher/register
router.post(
  "/fresher/register",
  registerFresher
);


// Login
// POST /api/auth/fresher/login
router.post(
  "/fresher/login",
  loginFresher
);


// =====================================================
// MENTOR / MNC EMPLOYEE
// =====================================================

// Register
// POST /api/auth/mentor/register

router.post(
  "/mentor/register",

  upload.fields([
    {
      name: "offerLetter",
      maxCount: 1,
    },

    {
      name: "employeeIdProof",
      maxCount: 1,
    },

    {
      name: "additionalProof",
      maxCount: 1,
    },
  ]),

  registerMentor
);


// Login
// POST /api/auth/mentor/login

router.post(
  "/mentor/login",
  loginMentor
);


// =====================================================
// CURRENT USER
// =====================================================

// GET /api/auth/me

router.get(
  "/me",
  protect,
  getMe
);


// =====================================================
// ADMIN
// =====================================================

// PUT /api/auth/admin/mentors/:id/verification

router.put(
  "/admin/mentors/:id/verification",

  protect,

  authorize("admin"),

  updateMentorVerification
);


module.exports = router;