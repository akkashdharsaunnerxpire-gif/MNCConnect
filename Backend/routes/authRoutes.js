const express = require("express");
const router = express.Router();

const {
  registerFresher,
  loginFresher,
  registerMentor,
  loginMentor,
  getMe,
  updateMentorVerification,
  verifyFresherOtp,
  sendFresherOtp,
  applyReferral,
  markWelcomeBonusSeen,
  logout,
  uploadProfileAvatar,
  removeProfileAvatar,
    updateFresherProfile,
} = require("../controllers/authController");

const {
  forgotPasswordMentor,
  resetPasswordMentor,
} = require("../controllers/Passwordresetcontroller");

const {
  forgotPasswordFresher,
  resetPasswordFresher,
} = require("../controllers/fresherPasswordResetController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  uploadMentorFiles,
  uploadAvatar,
  handleMulterError,
} = require("../middleware/uploadMiddleware");

// ---------- common (fresher + mentor) ----------
// Same "mnc_token" cookie for both roles, so ONE logout route works for both.
router.post("/logout", logout);

// ---------- fresher ----------
router.post("/fresher/register", registerFresher);
router.post("/fresher/send-otp", sendFresherOtp);
router.post("/fresher/verify-otp", verifyFresherOtp);
router.post("/fresher/login", loginFresher);
router.post("/fresher/forgot-password", forgotPasswordFresher);
router.post("/fresher/reset-password/:token", resetPasswordFresher);
router.patch(
  "/update",
  protect,
  updateFresherProfile
);

// ---------- mentor ----------
router.post(
  "/mentor/register",
  uploadMentorFiles,
  handleMulterError,
  registerMentor,
);
router.post("/mentor/login", loginMentor);
router.post("/mentor/forgot-password", forgotPasswordMentor);
router.post("/mentor/reset-password/:token",resetPasswordMentor );
// ---------- logged-in user ----------
router.get("/me", protect, getMe);
router.post(
  "/avatar",
  protect,
  uploadAvatar,
  handleMulterError,
  uploadProfileAvatar
);

router.delete(
  "/avatar",
  protect,
  removeProfileAvatar
);
router.post("/apply-referral", protect, applyReferral);
router.patch("/welcome-bonus-seen", protect, markWelcomeBonusSeen);

// ---------- admin ----------
router.put(
  "/admin/mentors/:id/verification",
  protect,
  authorize("admin"),
  updateMentorVerification,
);

module.exports = router;