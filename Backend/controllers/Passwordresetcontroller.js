// controllers/Passwordresetcontroller.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Mentor = require("../models/Mentor");
const {
  sendMail,
  resetPasswordEmail,
  passwordChangedEmail,
} = require("../utils/mailer");

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const validatePassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128;

const RESET_EXPIRY_MIN = 30;
const CLIENT_URL = (
  process.env.CLIENT_URL ||
  process.env.SITE_URL ||
  "http://localhost:5173"
).replace(/\/$/, "");

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

// POST /api/auth/mentor/forgot-password
exports.forgotPasswordMentor = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const mentor = await Mentor.findOne({ email });
    console.log(
      "[forgot-mentor] email:",
      email,
      "| found:",
      Boolean(mentor),
      "| status:",
      mentor?.accountStatus,
    );

    // 1) Email not registered -> clear error
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "This email is not registered. Please check your email or register first.",
      });
    }

    // 2) Suspended account -> cannot reset
    if (mentor.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "This account is suspended. Please contact MNCConnect support.",
      });
    }

    // 3) Create token + save hashed version
    const rawToken = crypto.randomBytes(32).toString("hex");

    await Mentor.updateOne(
      { _id: mentor._id },
      {
        $set: {
          passwordResetToken: hashToken(rawToken),
          passwordResetExpires: new Date(
            Date.now() + RESET_EXPIRY_MIN * 60 * 1000,
          ),
        },
      },
    );

    // 4) Send mail
    const resetUrl = `${CLIENT_URL}/mentor/reset-password/${rawToken}`;
    const content = resetPasswordEmail(mentor, resetUrl, RESET_EXPIRY_MIN);
    const result = await sendMail({
      to: mentor.email,
      toName: mentor.name,
      ...content,
    });
    console.log("[forgot-mentor] sendMail result:", result);

    // 5) Mail failed -> tell the user (and remove the unused token)
    if (!result.success) {
      console.error("Reset mail failed:", result.error);
      await Mentor.updateOne(
        { _id: mentor._id },
        { $unset: { passwordResetToken: "", passwordResetExpires: "" } },
      );
      return res.status(500).json({
        success: false,
        message: "Unable to send the reset email right now. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Mentor forgot password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to process the request." });
  }
};

// POST /api/auth/mentor/reset-password/:token
exports.resetPasswordMentor = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Reset token is missing." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const mentor = await Mentor.findOne({
      passwordResetToken: hashToken(String(token)),
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!mentor) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    const hashed = await bcrypt.hash(password, 12);

    await Mentor.updateOne(
      { _id: mentor._id },
      {
        $set: { password: hashed },
        $unset: { passwordResetToken: "", passwordResetExpires: "" },
      },
    );

    const content = passwordChangedEmail(mentor);
    sendMail({ to: mentor.email, toName: mentor.name, ...content });

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Mentor reset password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to reset password." });
  }
};