const Admin = require("../models/Admin");
const Mentor = require("../models/Mentor");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");


// ============================================================
// ADMIN LOGIN PAGE
// ============================================================

const showLoginPage = (req, res) => {
    try {

        // Already logged in
        if (
            req.session &&
            req.session.admin
        ) {
            return res.redirect("/admin");
        }

        return res.render("admin/login", {
            error: null
        });

    } catch (error) {

        console.error(
            "Admin login page error:",
            error
        );

        return res.status(500).send(
            "Unable to load admin login page."
        );
    }
};


// ============================================================
// ADMIN LOGIN
// ============================================================

const login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // ========================================================
        // VALIDATE INPUT
        // ========================================================

        if (!email || !password) {

            return res.status(400).render(
                "admin/login",
                {
                    error:
                        "Email and password are required."
                }
            );
        }


        // ========================================================
        // NORMALIZE EMAIL
        // ========================================================

        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();


        // ========================================================
        // ENV ADMIN CREDENTIALS
        // ========================================================

        const envAdminEmail =
            String(
                process.env.ADMIN_EMAIL ||
                "admin@mncconnect.com"
            )
                .trim()
                .toLowerCase();


        const envAdminPassword =
            String(
                process.env.ADMIN_PASSWORD ||
                "Admin@123"
            );


        const envAdminName =
            process.env.ADMIN_NAME ||
            "Super Admin";


        // ========================================================
        // FIRST CHECK .ENV ADMIN
        // ========================================================

        /*
          IMPORTANT:

          .env credentials are checked FIRST.

          So even if the same admin already exists
          in MongoDB with an old password, the .env
          credentials will still work.
        */

        if (
            normalizedEmail === envAdminEmail &&
            String(password) === envAdminPassword
        ) {

            req.session.admin = {

                id: "env-admin",

                name: envAdminName,

                email: envAdminEmail,

                role: "superadmin"
            };


            console.log(
                "========================================"
            );

            console.log(
                "✅ ADMIN LOGIN SUCCESS"
            );

            console.log(
                "Login method: .env"
            );

            console.log(
                "Admin email:",
                envAdminEmail
            );

            console.log(
                "Session:",
                req.session.admin
            );

            console.log(
                "========================================"
            );


            // ====================================================
            // SAVE SESSION BEFORE REDIRECT
            // ====================================================

            return req.session.save(
                (error) => {

                    if (error) {

                        console.error(
                            "❌ Session save error:",
                            error
                        );

                        return res
                            .status(500)
                            .render(
                                "admin/login",
                                {
                                    error:
                                        "Unable to create login session."
                                }
                            );
                    }


                    console.log(
                        "✅ Admin session saved successfully"
                    );


                    return res.redirect(
                        "/admin"
                    );
                }
            );
        }


        // ========================================================
        // DATABASE ADMIN LOGIN
        // ========================================================

        const admin =
            await Admin
                .findOne({
                    email: normalizedEmail
                })
                .select("+password");


        // ========================================================
        // ADMIN NOT FOUND
        // ========================================================

        if (!admin) {

            console.log(
                "❌ Admin not found:",
                normalizedEmail
            );

            return res.status(401).render(
                "admin/login",
                {
                    error:
                        "Invalid email or password."
                }
            );
        }


        // ========================================================
        // CHECK ADMIN ACTIVE
        // ========================================================

        if (!admin.isActive) {

            console.log(
                "❌ Admin account is inactive:",
                normalizedEmail
            );

            return res.status(403).render(
                "admin/login",
                {
                    error:
                        "Your admin account is inactive."
                }
            );
        }


        // ========================================================
        // CHECK DATABASE PASSWORD
        // ========================================================

        let isPasswordValid = false;


        /*
          If Admin model has comparePassword(),
          use it.

          Otherwise use bcrypt.compare().
        */

        if (
            typeof admin.comparePassword ===
            "function"
        ) {

            isPasswordValid =
                await admin.comparePassword(
                    password
                );

        } else {

            isPasswordValid =
                await bcrypt.compare(
                    password,
                    admin.password
                );
        }


        // ========================================================
        // INVALID PASSWORD
        // ========================================================

        if (!isPasswordValid) {

            console.log(
                "❌ Invalid database admin password:",
                normalizedEmail
            );

            return res.status(401).render(
                "admin/login",
                {
                    error:
                        "Invalid email or password."
                }
            );
        }


        // ========================================================
        // UPDATE LAST LOGIN
        // ========================================================

        admin.lastLogin =
            new Date();

        await admin.save();


        // ========================================================
        // CREATE DATABASE ADMIN SESSION
        // ========================================================

        req.session.admin = {

            id:
                admin._id.toString(),

            name:
                admin.name,

            email:
                admin.email,

            role:
                admin.role
        };


        console.log(
            "========================================"
        );

        console.log(
            "✅ ADMIN LOGIN SUCCESS"
        );

        console.log(
            "Login method: Database"
        );

        console.log(
            "Admin email:",
            admin.email
        );

        console.log(
            "Session:",
            req.session.admin
        );

        console.log(
            "========================================"
        );


        // ========================================================
        // SAVE SESSION BEFORE REDIRECT
        // ========================================================

        return req.session.save(
            (error) => {

                if (error) {

                    console.error(
                        "❌ Session save error:",
                        error
                    );

                    return res
                        .status(500)
                        .render(
                            "admin/login",
                            {
                                error:
                                    "Unable to create login session."
                            }
                        );
                }


                console.log(
                    "✅ Database admin session saved"
                );


                return res.redirect(
                    "/admin"
                );
            }
        );


    } catch (error) {

        console.error(
            "❌ Admin login error:",
            error
        );

        return res.status(500).render(
            "admin/login",
            {
                error:
                    "Something went wrong. Please try again."
            }
        );
    }
};


// ============================================================
// ADMIN LOGOUT
// ============================================================

const logout = (req, res) => {

    if (!req.session) {
        return res.redirect("/admin/login");
    }

    req.session.destroy(
        (error) => {

            if (error) {

                console.error(
                    "Admin logout error:",
                    error
                );

                return res
                    .status(500)
                    .send(
                        "Unable to logout. Please try again."
                    );
            }


            res.clearCookie(
                "connect.sid"
            );


            return res.redirect(
                "/admin/login"
            );
        }
    );
};


// ============================================================
// ADMIN DASHBOARD
// ============================================================

const dashboard = async (req, res) => {

    try {

        const totalMentors =
            await Mentor.countDocuments();

        const pendingMentors =
            await Mentor.countDocuments({
                verificationStatus: "pending"
            });

        const approvedMentors =
            await Mentor.countDocuments({
                verificationStatus: "approved"
            });

        const rejectedMentors =
            await Mentor.countDocuments({
                verificationStatus: "rejected"
            });


        return res.render(
            "admin/dashboard",
            {

                admin:
                    req.session.admin,

                stats: {

                    totalMentors,

                    pendingMentors,

                    approvedMentors,

                    rejectedMentors
                },

                currentPage:
                    "dashboard",

                pageTitle:
                    "Dashboard",

                pageSubtitle:
                    "Overview of platform activities"
            }
        );


    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );

        return res
            .status(500)
            .send(
                "Unable to load admin dashboard."
            );
    }
};


// ============================================================
// MENTOR LIST
// ============================================================

const listMentors = async (req, res) => {

    try {

        const {
            search = "",
            status = "all"
        } = req.query;

        const filter = {};


        // ========================================================
        // STATUS FILTER
        // ========================================================

        if (
            [
                "pending",
                "approved",
                "rejected"
            ].includes(status)
        ) {

            filter.verificationStatus =
                status;
        }


        // ========================================================
        // SEARCH
        // ========================================================

        if (search.trim()) {

            const searchRegex =
                new RegExp(
                    search.trim(),
                    "i"
                );


            filter.$or = [

                {
                    name:
                        searchRegex
                },

                {
                    email:
                        searchRegex
                },

                {
                    mobile:
                        searchRegex
                },

                {
                    employeeId:
                        searchRegex
                },

                {
                    currentCompany:
                        searchRegex
                },

                {
                    designation:
                        searchRegex
                },

                {
                    department:
                        searchRegex
                }
            ];
        }


        // ========================================================
        // GET MENTORS
        // ========================================================

        const mentors =
            await Mentor
                .find(filter)
                .select("-password")
                .sort({
                    createdAt: -1
                })
                .lean();


        return res.render(
            "admin/mentors",
            {

                admin:
                    req.session.admin,

                mentors,

                search,

                status,

                currentPage:
                    "mentors",

                pageTitle:
                    "Mentors",

                pageSubtitle:
                    "Manage all mentor profiles"
            }
        );


    } catch (error) {

        console.error(
            "List mentors error:",
            error
        );

        return res
            .status(500)
            .send(
                "Unable to load mentors."
            );
    }
};


// ============================================================
// MENTOR DETAILS
// ============================================================

const mentorDetails = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // ========================================================
        // VALIDATE OBJECT ID
        // ========================================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res
                .status(400)
                .send(
                    "Invalid mentor ID format."
                );
        }


        // ========================================================
        // GET MENTOR
        // ========================================================

        const mentor =
            await Mentor
                .findById(id)
                .select("-password")
                .lean();


        if (!mentor) {

            return res
                .status(404)
                .send(
                    "Mentor not found."
                );
        }


        return res.render(
            "admin/mentorDetails",
            {

                admin:
                    req.session.admin,

                mentor,

                currentPage:
                    "mentors",

                pageTitle:
                    "Mentor Details",

                pageSubtitle:
                    "View and manage mentor profile"
            }
        );


    } catch (error) {

        console.error(
            "Mentor details error:",
            error
        );

        return res
            .status(500)
            .send(
                "Unable to load mentor details."
            );
    }
};


// ============================================================
// APPROVE MENTOR
// ============================================================

const approveMentor = async (req, res) => {

    try {

        console.log(
            "================================="
        );

        console.log(
            "APPROVE MENTOR ROUTE HIT"
        );

        console.log(
            "MENTOR ID:",
            req.params.id
        );

        console.log(
            "ADMIN SESSION:",
            req.session.admin
        );

        console.log(
            "================================="
        );


        const {
            id
        } = req.params;


        // ========================================================
        // VALIDATE OBJECT ID
        // ========================================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid mentor ID format."
            });
        }


        // ========================================================
        // FIND MENTOR
        // ========================================================

        const mentor =
            await Mentor.findById(id);


        if (!mentor) {

            return res.status(404).json({
                success: false,
                message:
                    "Mentor not found."
            });
        }


        // ========================================================
        // CURRENT STATUS
        // ========================================================

        console.log(
            "Current mentor status:",
            {
                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus
            }
        );


        // ========================================================
        // ALREADY APPROVED
        // ========================================================

        if (
            mentor.verificationStatus ===
            "approved"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Mentor is already approved."
            });
        }


        // ========================================================
        // UPDATE MENTOR
        // ========================================================

        mentor.verificationStatus =
            "approved";

        mentor.isVerified =
            true;

        mentor.accountStatus =
            "active";


        if (
            !mentor.verificationMethod ||
            mentor.verificationMethod ===
            "pending"
        ) {

            mentor.verificationMethod =
                "document";
        }


        // Remove rejection reason
        mentor.rejectionReason =
            undefined;


        await mentor.save();


        console.log(
            "Mentor approved successfully:",
            {
                id:
                    mentor._id,

                email:
                    mentor.email,

                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus
            }
        );


        return res.json({

            success: true,

            message:
                "Mentor approved successfully.",

            mentor: {

                id:
                    mentor._id,

                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus
            }
        });


    } catch (error) {

        console.error(
            "Approve mentor error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to approve mentor. Error: " +
                error.message
        });
    }
};


// ============================================================
// REJECT MENTOR
// ============================================================

const rejectMentor = async (req, res) => {

    try {

        console.log(
            "================================="
        );

        console.log(
            "REJECT MENTOR ROUTE HIT"
        );

        console.log(
            "MENTOR ID:",
            req.params.id
        );

        console.log(
            "ADMIN SESSION:",
            req.session.admin
        );

        console.log(
            "================================="
        );


        const {
            id
        } = req.params;


        // ========================================================
        // VALIDATE OBJECT ID
        // ========================================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid mentor ID format."
            });
        }


        // ========================================================
        // FIND MENTOR
        // ========================================================

        const mentor =
            await Mentor.findById(id);


        if (!mentor) {

            return res.status(404).json({
                success: false,
                message:
                    "Mentor not found."
            });
        }


        // ========================================================
        // CURRENT STATUS
        // ========================================================

        console.log(
            "Current mentor status:",
            {
                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus
            }
        );


        // ========================================================
        // ALREADY REJECTED
        // ========================================================

        if (
            mentor.verificationStatus ===
            "rejected"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Mentor is already rejected."
            });
        }


        // ========================================================
        // REJECTION REASON
        // ========================================================

        const reason =
            req.body?.reason ||
            "Mentor verification rejected by admin.";


        // ========================================================
        // UPDATE MENTOR
        // ========================================================

        mentor.verificationStatus =
            "rejected";

        mentor.isVerified =
            false;

        mentor.accountStatus =
            "rejected";

        mentor.rejectionReason =
            reason;


        await mentor.save();


        console.log(
            "Mentor rejected successfully:",
            {
                id:
                    mentor._id,

                email:
                    mentor.email,

                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus,

                rejectionReason:
                    mentor.rejectionReason
            }
        );


        return res.json({

            success: true,

            message:
                "Mentor rejected successfully.",

            mentor: {

                id:
                    mentor._id,

                verificationStatus:
                    mentor.verificationStatus,

                isVerified:
                    mentor.isVerified,

                accountStatus:
                    mentor.accountStatus,

                rejectionReason:
                    mentor.rejectionReason
            }
        });


    } catch (error) {

        console.error(
            "Reject mentor error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to reject mentor. Error: " +
                error.message
        });
    }
};


// ============================================================
// SEED ADMIN FROM .ENV
// ============================================================

const seedAdminFromEnv = async () => {

    try {

        const envAdminEmail =
            process.env.ADMIN_EMAIL ||
            "admin@mncconnect.com";


        const envAdminPassword =
            process.env.ADMIN_PASSWORD ||
            "Admin@123";


        const envAdminName =
            process.env.ADMIN_NAME ||
            "Super Admin";


        // ========================================================
        // CHECK EXISTING ADMIN
        // ========================================================

        const existingAdmin =
            await Admin.findOne({
                email: envAdminEmail
            });


        if (existingAdmin) {

            console.log(
                "Admin already exists in database:",
                envAdminEmail
            );

            return;
        }


        // ========================================================
        // CREATE ADMIN
        // ========================================================

        const admin =
            new Admin({

                name:
                    envAdminName,

                email:
                    envAdminEmail,

                password:
                    envAdminPassword,

                role:
                    "superadmin",

                isActive:
                    true
            });


        await admin.save();


        console.log(
            "✅ Admin created from .env successfully!"
        );

        console.log(
            "Email:",
            envAdminEmail
        );


    } catch (error) {

        console.error(
            "❌ Error seeding admin from .env:",
            error
        );
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