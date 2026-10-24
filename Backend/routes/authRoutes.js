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
} = require("../controllers/authController");

const {
  forgotPasswordMentor,
  resetPasswordMentor,
} = require("../controllers/Passwordresetcontroller");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  forgotPasswordFresher,
  resetPasswordFresher,
} = require("../controllers/fresherPasswordResetController");

const {
  uploadMentorFiles,
  handleMulterError,
} = require("../middleware/uploadMiddleware");

// ---------- fresher ----------
router.post("/fresher/register", registerFresher);
router.post("/fresher/send-otp", sendFresherOtp);
router.post("/fresher/verify-otp", verifyFresherOtp);
router.post("/fresher/login", loginFresher);
router.post("/fresher/forgot-password", forgotPasswordFresher);
router.post("/fresher/reset-password/:token", resetPasswordFresher);

// ---------- mentor ----------
router.post(
  "/mentor/register",
  uploadMentorFiles,
  handleMulterError,
  registerMentor
);
router.post("/mentor/login", loginMentor);
router.post("/mentor/forgot-password", forgotPasswordMentor);
router.post("/mentor/reset-password/:token", resetPasswordMentor);

// ---------- logged-in user ----------
router.get("/me", protect, getMe);
router.post("/apply-referral", protect, applyReferral); // already vera edathula irundha idha remove pannunga
router.patch("/welcome-bonus-seen", protect, markWelcomeBonusSeen);

// ---------- admin ----------
router.put(
  "/admin/mentors/:id/verification",
  protect,
  authorize("admin"),
  updateMentorVerification
);

module.exports = router;