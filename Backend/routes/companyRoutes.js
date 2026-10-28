
const express = require("express");
const uploadCompany = require("../utils/uploadCompany");
const ctrl = require("../controllers/companyController");
const { sameOriginOnly } = require("../middleware/adminSecurity");

const adminRouter = express.Router();

// Reuse the existing admin session authentication.
const requireAdmin = (req, res, next) => {
  const admin = req.session?.admin;

  if (
    admin &&
    (!admin.role || ["admin", "superadmin"].includes(admin.role))
  ) {
    return next();
  }

  if (req.method !== "GET") {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please log in again.",
    });
  }

  return res.redirect("/admin/login");
};

adminRouter.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
  });
  next();
});

adminRouter.use(sameOriginOnly, requireAdmin);

adminRouter.get("/", ctrl.adminPage);

adminRouter.post("/", (req, res, next) => {
  uploadCompany(req, res, (err) => {
    if (err) {
      return res.redirect(
        `/admin/companies?err=${encodeURIComponent(err.message)}`
      );
    }
    next();
  });
}, ctrl.saveCompany);

adminRouter.post("/:id/delete", ctrl.deleteCompany);

const publicRouter = express.Router();
publicRouter.get("/public", ctrl.publicList);

module.exports = { adminRouter, publicRouter };
