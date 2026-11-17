
const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");

const PRIVACY_VERSION = "1.0";

const getModel = (role) => {
  if (role === "fresher") return Fresher;
  if (role === "mentor") return Mentor;
  return null;
};

// GET /api/chat/privacy
exports.getPrivacyStatus = async (req, res) => {
  try {
    const Model = getModel(req.user.role);

    if (!Model) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const user = await Model.findById(req.user.id)
      .select("chatPrivacyAcceptedAt chatPrivacyVersion")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const accepted =
      user.chatPrivacyVersion === PRIVACY_VERSION &&
      Boolean(user.chatPrivacyAcceptedAt);

    return res.json({
      success: true,
      accepted,
      version: PRIVACY_VERSION,
      acceptedAt: user.chatPrivacyAcceptedAt || null,
    });
  } catch (error) {
    console.error("getPrivacyStatus:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load privacy status.",
    });
  }
};

// POST /api/chat/privacy/accept
exports.acceptPrivacy = async (req, res) => {
  try {
    const Model = getModel(req.user.role);

    if (!Model) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const user = await Model.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          chatPrivacyAcceptedAt: new Date(),
          chatPrivacyVersion: PRIVACY_VERSION,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("chatPrivacyAcceptedAt chatPrivacyVersion");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    return res.json({
      success: true,
      message: "Chat privacy policy accepted.",
      accepted: true,
      version: user.chatPrivacyVersion,
      acceptedAt: user.chatPrivacyAcceptedAt,
    });
  } catch (error) {
    console.error("acceptPrivacy:", error);

    return res.status(500).json({
      success: false,
      message: "Could not save privacy acceptance.",
    });
  }
};

exports.requirePrivacyAccepted = async (req, res, next) => {
  try {
    const Model = getModel(req.user.role);

    if (!Model) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const user = await Model.findById(req.user.id)
      .select("chatPrivacyAcceptedAt chatPrivacyVersion")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const accepted =
      user.chatPrivacyVersion === PRIVACY_VERSION &&
      Boolean(user.chatPrivacyAcceptedAt);

    if (!accepted) {
      return res.status(403).json({
        success: false,
        code: "CHAT_PRIVACY_REQUIRED",
        message: "Please accept the chat privacy policy before using chat.",
      });
    }

    next();
  } catch (error) {
    console.error("requirePrivacyAccepted:", error);

    return res.status(500).json({
      success: false,
      message: "Could not verify chat privacy.",
    });
  }
};


exports.PRIVACY_VERSION = PRIVACY_VERSION;
