// controllers/passwordResetController.js
//
// POST /api/auth/mentor/forgot-password        { email }
// POST /api/auth/mentor/reset-password/:token  { password }
//
// Security notes:
//  - The raw token is only ever sent by email. Only its SHA-256 hash is stored.
//  - The response never reveals whether an email is registered.
//  - Token expires in 30 minutes and works only once.
//  - A 60 second cooldown stops people from spamming reset emails.

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const Mentor = require("../models/Mentor");
const { sendMail, resetPasswordEmail, passwordChangedEmail } = require("../utils/mailer");

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const COOLDOWN_MS = 60 * 1000; // 1 minute between emails

const GENERIC_MESSAGE =
  "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// ============================================================
// FORGOT PASSWORD
// ============================================================

exports.forgotPasswordMentor = async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const mentor = await Mentor.findOne({ email }).select("+passwordResetExpires");

    if (mentor) {
      // Cooldown: a link was issued less than 60 seconds ago
      const issuedAgo = mentor.passwordResetExpires
        ? RESET_TTL_MS - (mentor.passwordResetExpires.getTime() - Date.now())
        : Infinity;

      if (issuedAgo < COOLDOWN_MS) {
        return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
      }

      const token = crypto.randomBytes(32).toString("hex");
      mentor.passwordResetToken = hashToken(token);
      mentor.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
      await mentor.save({ validateBeforeSave: false });

      // CLIENT_URL = your frontend (http://localhost:5173 locally, the Render frontend URL in production)
     const base = String(
  process.env.CLIENT_URL || "http://localhost:5173"
).replace(/\/+$/, "");
      const resetUrl = `${base}/mentor/reset-password/${token}`;

      const content = resetPasswordEmail(mentor, resetUrl, RESET_TTL_MS / 60000);
      const result = await sendMail({ to: mentor.email, toName: mentor.name, ...content });

      if (!result.success) {
        console.error("Reset email not sent:", result.error);
        // The link is useless if it never reached the mentor
        mentor.passwordResetToken = undefined;
        mentor.passwordResetExpires = undefined;
        await mentor.save({ validateBeforeSave: false });
      }
    }

    // Same answer whether or not the account exists
    return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process the request. Please try again.",
    });
  }
};

// ============================================================
// RESET PASSWORD
// ============================================================

exports.resetPasswordMentor = async (req, res) => {
  try {
    const { token } = req.params;
    const password = req.body && req.body.password;

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid. Please request a new one.",
      });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const mentor = await Mentor.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!mentor) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    mentor.password = await bcrypt.hash(password, 12);
    mentor.passwordResetToken = undefined;
    mentor.passwordResetExpires = undefined;
    await mentor.save({ validateBeforeSave: false });

    // Security notification (failure here must not affect the reset)
    sendMail({ to: mentor.email, toName: mentor.name, ...passwordChangedEmail(mentor) }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password. Please try again.",
    });
  }
};