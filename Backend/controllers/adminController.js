const Admin = require("../models/Admin");
const Mentor = require("../models/Mentor");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// ============================================================
// ADMIN LOGIN PAGE
// ============================================================

const showLoginPage = (req, res) => {
    if (req.session && req.session.admin) {
        return res.redirect("/admin");
    }

    res.render("admin/login", {
        error: null
    });
};

// ============================================================
// ADMIN LOGIN - WITH .env SUPPORT
// ============================================================

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("admin/login", {
                error: "Email and password are required."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const envAdminEmail = process.env.ADMIN_EMAIL || "admin@mncconnect.com";
        const envAdminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
        const envAdminName = process.env.ADMIN_NAME || "Super Admin";

        let admin = await Admin
            .findOne({ email: normalizedEmail })
            .select("+password");

        if (!admin) {
            if (normalizedEmail === envAdminEmail.toLowerCase().trim()) {
                if (password === envAdminPassword) {
                    req.session.admin = {
                        id: "env-admin",
                        name: envAdminName,
                        email: envAdminEmail,
                        role: "superadmin"
                    };
                    console.log("Admin logged in via .env credentials");
                    return res.redirect("/admin");
                } else {
                    return res.status(401).render("admin/login", {
                        error: "Invalid email or password."
                    });
                }
            }
            return res.status(401).render("admin/login", {
                error: "Invalid email or password."
            });
        }

        if (!admin.isActive) {
            return res.status(403).render("admin/login", {
                error: "Your admin account is inactive."
            });
        }

        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).render("admin/login", {
                error: "Invalid email or password."
            });
        }

        admin.lastLogin = new Date();
        await admin.save();

        req.session.admin = {
            id: admin._id.toString(),
            name: admin.name,
            email: admin.email,
            role: admin.role
        };

        console.log("Admin logged in from database");
        return res.redirect("/admin");

    } catch (error) {
        console.error("Admin login error:", error);
        return res.status(500).render("admin/login", {
            error: "Something went wrong. Please try again."
        });
    }
};

// ============================================================
// ADMIN LOGOUT
// ============================================================

const logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Admin logout error:", error);
            return res.status(500).send("Unable to logout. Please try again.");
        }
        res.clearCookie("connect.sid");
        return res.redirect("/admin/login");
    });
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================

const dashboard = async (req, res) => {
    try {
        const totalMentors = await Mentor.countDocuments();
        const pendingMentors = await Mentor.countDocuments({ verificationStatus: "pending" });
        const approvedMentors = await Mentor.countDocuments({ verificationStatus: "approved" });
        const rejectedMentors = await Mentor.countDocuments({ verificationStatus: "rejected" });

        res.render("admin/dashboard", {
            admin: req.session.admin,
            stats: {
                totalMentors,
                pendingMentors,
                approvedMentors,
                rejectedMentors
            },
            currentPage: 'dashboard',
            pageTitle: 'Dashboard',
            pageSubtitle: 'Overview of platform activities'
        });

    } catch (error) {
        console.error("Admin dashboard error:", error);
        return res.status(500).send("Unable to load admin dashboard.");
    }
};

// ============================================================
// MENTOR LIST
// ============================================================

const listMentors = async (req, res) => {
    try {
        const { search = "", status = "all" } = req.query;
        const filter = {};

        if (["pending", "approved", "rejected"].includes(status)) {
            filter.verificationStatus = status;
        }

        if (search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            filter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { mobile: searchRegex },
                { employeeId: searchRegex },
                { currentCompany: searchRegex },
                { designation: searchRegex },
                { department: searchRegex }
            ];
        }

        const mentors = await Mentor
            .find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        res.render("admin/mentors", {
            admin: req.session.admin,
            mentors,
            search,
            status,
            currentPage: 'mentors',
            pageTitle: 'Mentors',
            pageSubtitle: 'Manage all mentor profiles'
        });

    } catch (error) {
        console.error("List mentors error:", error);
        return res.status(500).send("Unable to load mentors.");
    }
};

// ============================================================
// MENTOR DETAILS
// ============================================================

const mentorDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send("Invalid mentor ID format.");
        }

        const mentor = await Mentor
            .findById(id)
            .select("-password")
            .lean();

        if (!mentor) {
            return res.status(404).send("Mentor not found.");
        }

        res.render("admin/mentorDetails", {
            admin: req.session.admin,
            mentor,
            currentPage: 'mentors',
            pageTitle: 'Mentor Details',
            pageSubtitle: 'View and manage mentor profile'
        });

    } catch (error) {
        console.error("Mentor details error:", error);
        return res.status(500).send("Unable to load mentor details.");
    }
};

// ============================================================
// APPROVE MENTOR - FIXED
// ============================================================

const approveMentor = async (req, res) => {
    try {
        console.log("=================================");
        console.log("APPROVE MENTOR ROUTE HIT");
        console.log("MENTOR ID:", req.params.id);
        console.log("ADMIN SESSION:", req.session.admin);
        console.log("=================================");

        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log("Invalid ObjectId format:", id);
            return res.status(400).json({
                success: false,
                message: "Invalid mentor ID format."
            });
        }

        const mentor = await Mentor.findById(id);

        if (!mentor) {
            console.log("Mentor not found with ID:", id);
            return res.status(404).json({
                success: false,
                message: "Mentor not found."
            });
        }

        console.log("Current mentor status:", {
            verificationStatus: mentor.verificationStatus,
            isVerified: mentor.isVerified,
            accountStatus: mentor.accountStatus
        });

        if (mentor.verificationStatus === "approved") {
            return res.status(400).json({
                success: false,
                message: "Mentor is already approved."
            });
        }

        // UPDATE ALL FIELDS
        mentor.verificationStatus = "approved";
        mentor.isVerified = true;
        mentor.accountStatus = "active";
        
        if (!mentor.verificationMethod || mentor.verificationMethod === "pending") {
            mentor.verificationMethod = "document";
        }

        // Remove rejection reason if any
        mentor.rejectionReason = undefined;

        await mentor.save();

        console.log("Mentor approved successfully:", {
            id: mentor._id,
            email: mentor.email,
            verificationStatus: mentor.verificationStatus,
            isVerified: mentor.isVerified,
            accountStatus: mentor.accountStatus
        });

        return res.json({
            success: true,
            message: "Mentor approved successfully.",
            mentor: {
                id: mentor._id,
                verificationStatus: mentor.verificationStatus,
                isVerified: mentor.isVerified,
                accountStatus: mentor.accountStatus
            }
        });

    } catch (error) {
        console.error("Approve mentor error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to approve mentor. Error: " + error.message
        });
    }
};

// ============================================================
// REJECT MENTOR - FIXED
// ============================================================

const rejectMentor = async (req, res) => {
    try {
        console.log("=================================");
        console.log("REJECT MENTOR ROUTE HIT");
        console.log("MENTOR ID:", req.params.id);
        console.log("ADMIN SESSION:", req.session.admin);
        console.log("=================================");

        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log("Invalid ObjectId format:", id);
            return res.status(400).json({
                success: false,
                message: "Invalid mentor ID format."
            });
        }

        const mentor = await Mentor.findById(id);

        if (!mentor) {
            console.log("Mentor not found with ID:", id);
            return res.status(404).json({
                success: false,
                message: "Mentor not found."
            });
        }

        console.log("Current mentor status:", {
            verificationStatus: mentor.verificationStatus,
            isVerified: mentor.isVerified,
            accountStatus: mentor.accountStatus
        });

        if (mentor.verificationStatus === "rejected") {
            return res.status(400).json({
                success: false,
                message: "Mentor is already rejected."
            });
        }

        const reason = req.body?.reason || "Mentor verification rejected by admin.";

        // UPDATE ALL FIELDS
        mentor.verificationStatus = "rejected";
        mentor.isVerified = false;
        mentor.accountStatus = "rejected";
        mentor.rejectionReason = reason;

        await mentor.save();

        console.log("Mentor rejected successfully:", {
            id: mentor._id,
            email: mentor.email,
            verificationStatus: mentor.verificationStatus,
            isVerified: mentor.isVerified,
            accountStatus: mentor.accountStatus,
            rejectionReason: mentor.rejectionReason
        });

        return res.json({
            success: true,
            message: "Mentor rejected successfully.",
            mentor: {
                id: mentor._id,
                verificationStatus: mentor.verificationStatus,
                isVerified: mentor.isVerified,
                accountStatus: mentor.accountStatus,
                rejectionReason: mentor.rejectionReason
            }
        });

    } catch (error) {
        console.error("Reject mentor error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to reject mentor. Error: " + error.message
        });
    }
};

// ============================================================
// SEED ADMIN FROM .env
// ============================================================

const seedAdminFromEnv = async () => {
    try {
        const envAdminEmail = process.env.ADMIN_EMAIL || "admin@mncconnect.com";
        const envAdminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
        const envAdminName = process.env.ADMIN_NAME || "Super Admin";

        const existingAdmin = await Admin.findOne({ email: envAdminEmail });

        if (existingAdmin) {
            console.log("Admin already exists in database:", envAdminEmail);
            return;
        }

        const admin = new Admin({
            name: envAdminName,
            email: envAdminEmail,
            password: envAdminPassword,
            role: "superadmin",
            isActive: true
        });

        await admin.save();

        console.log("Admin created from .env successfully!");
        console.log("Email:", envAdminEmail);

    } catch (error) {
        console.error("Error seeding admin from .env:", error);
    }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    showLoginPage,
    login,
    logout,
    dashboard,
    listMentors,
    mentorDetails,
    approveMentor,
    rejectMentor,
    seedAdminFromEnv
};