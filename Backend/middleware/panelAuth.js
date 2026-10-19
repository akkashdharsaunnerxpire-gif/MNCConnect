// middleware/panelAuth.js
// Verifies the same JWT that authController.generateToken() creates
// ({ id, role }). Use:  requireAuth("mentor")  /  requireAuth("fresher")

const jwt = require("jsonwebtoken");

const readToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

const decode = (req) => {
  const token = readToken(req);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && payload.id ? { id: String(payload.id), role: payload.role } : null;
  } catch (_) {
    return null;
  }
};

const requireAuth = (...roles) => (req, res, next) => {
  const user = decode(req);

  if (!user) {
    return res.status(401).json({ success: false, message: "Please log in to continue." });
  }
  if (roles.length && !roles.includes(user.role)) {
    return res.status(403).json({ success: false, message: "You do not have access to this." });
  }

  req.user = user;
  next();
};

// Same as above but never blocks; req.user stays undefined when not logged in
const optionalAuth = (req, res, next) => {
  const user = decode(req);
  if (user) req.user = user;
  next();
};

module.exports = { requireAuth, optionalAuth };