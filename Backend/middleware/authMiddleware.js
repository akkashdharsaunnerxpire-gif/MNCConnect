const jwt = require("jsonwebtoken");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");

const AUTH_COOKIE_NAME = "mnc_token";

const protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        message: "Authentication service is not configured.",
      });
    }

    // Read JWT from the HttpOnly cookie

    const token =
      req.cookies?.[AUTH_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      !decoded?.id ||
      !["fresher", "mentor", "admin"].includes(decoded.role)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    let user = null;

    if (decoded.role === "fresher") {
      user = await Fresher.findById(decoded.id);
    } else if (decoded.role === "mentor") {
      user = await Mentor.findById(decoded.id);
    } else if (decoded.role === "admin") {
      // IMPORTANT:
      // Add your actual admin lookup here.
      // Do not allow admin access without validating the admin account.
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found or not authorized.",
      });
    }

    req.user = user;
    req.user.role = decoded.role;
    req.user.id = String(decoded.id);

    return next();
  } catch (error) {
    if (
      error.name !== "JsonWebTokenError" &&
      error.name !== "TokenExpiredError"
    ) {
      console.error("Auth middleware error:", error);
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired session.",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource.",
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  authorize,
};
