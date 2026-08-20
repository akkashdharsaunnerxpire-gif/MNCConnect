const jwt = require("jsonwebtoken");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");

const protect = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (
      !decoded.id ||
      !decoded.role
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    let user = null;

    // Fresher
    if (decoded.role === "fresher") {
      user =
        await Fresher.findById(
          decoded.id
        );
    }

    // Mentor
    if (decoded.role === "mentor") {
      user =
        await Mentor.findById(
          decoded.id
        );
    }

    // Admin
    // Keep your existing admin logic here
    if (decoded.role === "admin") {
      // Your existing admin lookup
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "User account not found.",
      });
    }

    req.user = user;
    req.user.role = decoded.role;
    req.user.id = decoded.id;

    next();
  } catch (error) {
    console.error(
      "Auth middleware error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token.",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (
      !req.user ||
      !roles.includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to access this resource.",
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};