
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Fresher = require("../models/Fresher");
const {
  sendMail,
  resetPasswordEmail,
  passwordChangedEmail,
} = require("../utils/mailer");

const RESET_TTL_MS = 30 * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const GENERIC_MESSAGE =
  "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.";

exports.forgotPasswordFresher = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const fresher = await Fresher.findOne({ email });
    console.log("Fresher found:", Boolean(fresher));

    if (fresher) {
      const token = crypto.randomBytes(32).toString("hex");

      fresher.passwordResetToken = hashToken(token);
      fresher.passwordResetExpires = new Date(
        Date.now() + RESET_TTL_MS
      );

      await fresher.save({ validateBeforeSave: false });

      const base = String(
        process.env.CLIENT_URL || "http://localhost:5173"
      ).replace(/\/+$/, "");

      const resetUrl = `${base}/reset-password/${token}`;

      const content = resetPasswordEmail(fresher, resetUrl, 30);

      const result = await sendMail({
        to: fresher.email,
        toName: fresher.name,
        ...content,
      });

      if (!result.success) {
        fresher.passwordResetToken = undefined;
        fresher.passwordResetExpires = undefined;

        await fresher.save({ validateBeforeSave: false });

        console.error("Fresher reset email failed:", result.error);

        return res.status(500).json({
          success: false,
          message: "Unable to send reset email. Please try again.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error("Fresher forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process the request. Please try again.",
    });
  }
};

exports.resetPasswordFresher = async (req, res) => {
  try {
    const { token } = req.params;
    const password = req.body?.password;

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid. Please request a new one.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const fresher = await Fresher.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!fresher) {
      return res.status(400).json({
        success: false,
        message:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    fresher.password = await bcrypt.hash(password, 12);
    fresher.passwordResetToken = undefined;
    fresher.passwordResetExpires = undefined;

    await fresher.save({ validateBeforeSave: false });

    // Send this email only after a successful password reset.
    sendMail({
      to: fresher.email,
      toName: fresher.name,
      ...passwordChangedEmail(fresher),
    }).catch((error) => {
      console.error("Fresher password-change email failed:", error);
    });

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Fresher reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password. Please try again.",
    });
  }
};
