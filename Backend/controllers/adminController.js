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

        if (
            !email ||
            !password
        ) {

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
                .toLowerCase()
                .trim();


        // ========================================================
        // GET ENV ADMIN DETAILS
        // ========================================================

        const envAdminEmail =
            String(
                process.env.ADMIN_EMAIL ||
                "admin@mncconnect.com"
            )
                .toLowerCase()
                .trim();


        const envAdminPassword =
            String(
                process.env.ADMIN_PASSWORD ||
                "Admin@123"
            );


        const envAdminName =
            process.env.ADMIN_NAME ||
            "Super Admin";


        // ========================================================
        // CHECK .ENV ADMIN FIRST
        // ========================================================

        if (
            normalizedEmail ===
                envAdminEmail &&
            String(password) ===
                envAdminPassword
        ) {

            // Create admin session
            req.session.admin = {

                id: "env-admin",

                name: envAdminName,

                email: envAdminEmail,

                role: "superadmin"
            };


            console.log(
                "================================="
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
                "================================="
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
                "❌ Admin account inactive:",
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


        // If model has comparePassword()
        if (
            typeof admin.comparePassword ===
            "function"
        ) {

            isPasswordValid =
                await admin.comparePassword(
                    password
                );

        } else {

            // Fallback bcrypt comparison
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
                "❌ Invalid admin password:",
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
            "================================="
        );

        console.log(
            "✅ ADMIN LOGIN SUCCESS"
        );

        console.log(
            "Login method: Database"
        );

        console.log(
            "Admin:",
            admin.email
        );

        console.log(
            "Session:",
            req.session.admin
        );

        console.log(
            "================================="
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
            "Admin email:",
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

    // Keep your existing mentor functions
    // below if they are already in this file.

    seedAdminFromEnv
};