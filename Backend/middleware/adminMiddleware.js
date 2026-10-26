// middleware/adminAuth.js
// Single auth guard for every protected /admin route.
//  - Pages (GET)        -> redirect to the login page
//  - API calls (PATCH / POST / ...) -> 401 JSON, so admin.js can show
//    "Session expired" instead of crashing on an HTML login page.

const requireAdminAuth = (req, res, next) => {
  try {
    const admin = req.session && req.session.admin;

    // session must exist and the admin must be properly authenticated
    if (admin && admin.id) return next();

    if (req.method !== "GET") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }
    return res.redirect("/admin/login");
  } catch (error) {
    console.error("Admin middleware error:", error);

    if (req.method !== "GET") {
      return res.status(401).json({
        success: false,
        message: "Session error. Please log in again.",
      });
    }
    return res.redirect("/admin/login");
  }
};

module.exports = { requireAdminAuth };