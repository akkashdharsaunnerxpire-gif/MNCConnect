const express = require("express");
const router = express.Router();

const {
    showLoginPage,
    login,
    logout,
    dashboard,
    listMentors,
    mentorDetails,
    approveMentor,
    rejectMentor
} = require("../controllers/adminController");

const {
    requireAdminAuth
} = require("../middleware/adminMiddleware");

// ============================================================
// ADMIN LOGIN
// ============================================================

router.get("/login", showLoginPage);
router.post("/login", login);
router.get("/logout", logout);

// ============================================================
// ADMIN DASHBOARD
// ============================================================

router.get("/", requireAdminAuth, dashboard);
router.get("/dashboard", requireAdminAuth, dashboard);

// ============================================================
// MENTOR MANAGEMENT - FIXED ROUTES
// ============================================================

// IMPORTANT: Put specific routes BEFORE parameter routes
router.get("/mentors", requireAdminAuth, listMentors);
router.get("/mentors/:id", requireAdminAuth, mentorDetails);

// ✅ FIXED: These should work correctly
router.patch("/mentors/:id/approve", requireAdminAuth, approveMentor);
router.patch("/mentors/:id/reject", requireAdminAuth, rejectMentor);

// ============================================================
// FRESHERS
// ============================================================

router.get("/freshers", requireAdminAuth, (req, res) => {
    res.render("admin/freshers", {
        admin: req.session.admin,
        freshers: [],
        currentPage: 'freshers',
        pageTitle: 'Freshers',
        pageSubtitle: 'Manage fresher profiles'
    });
});

// ============================================================
// PAYMENTS
// ============================================================

router.get("/payments", requireAdminAuth, (req, res) => {
    res.render("admin/payments", {
        admin: req.session.admin,
        payments: [],
        currentPage: 'payments',
        pageTitle: 'Payments',
        pageSubtitle: 'Manage all payments'
    });
});

// ============================================================
// USERS
// ============================================================

router.get("/users", requireAdminAuth, (req, res) => {
    res.render("admin/users", {
        admin: req.session.admin,
        users: [],
        currentPage: 'users',
        pageTitle: 'Users',
        pageSubtitle: 'Manage all platform users'
    });
});

module.exports = router;