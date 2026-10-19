// controllers/adminController.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Admin = require("../models/Admin");
const Mentor = require("../models/Mentor");
const { sendMail, approvalEmail, rejectionEmail } = require("../utils/mailer");

// ============================================================
// HELPERS
// ============================================================

const PAGE_SIZE = 10;
const STATUSES = ["pending", "approved", "rejected"];
const PAID_STATUSES = ["success", "paid", "captured", "completed", "successful"];
const FAILED_STATUSES = ["failed", "cancelled", "canceled", "error"];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Load an optional model without crashing if the file / name differs
const loadModel = (file, ...names) => {
  try { require(`../models/${file}`); } catch (_) { /* ignore */ }
  for (const n of names) if (mongoose.models[n]) return mongoose.models[n];
  return null;
};

const safe = async (fn, fallback = null) => {
  try { return await fn(); }
  catch (err) { console.error("Admin safe() error:", err.message); return fallback; }
};

const buildQuery = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") p.set(k, v);
  });
  return p.toString();
};

const getPage = (req, limit = PAGE_SIZE) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
};

const makePagination = (page, limit, total) => ({
  page, limit, total, pages: Math.max(Math.ceil(total / limit), 1),
});

const normalizeMentor = (m) => ({
  ...m,
  status: STATUSES.includes(m.verificationStatus)
    ? m.verificationStatus
    : m.isVerified ? "approved" : "pending",
});

const renderLogin = (res, code, error) =>
  res.status(code).render("admin/login", { error });

// ============================================================
// AUTH
// ============================================================

const showLoginPage = (req, res) => {
  if (req.session && req.session.admin) return res.redirect("/admin");
  return res.render("admin/login", { error: null });
};

const startSession = (req, res, adminData, method) => {
  // regenerate = protection against session fixation
  req.session.regenerate((err) => {
    if (err) {
      console.error("Session regenerate error:", err);
      return renderLogin(res, 500, "Unable to create login session.");
    }
    req.session.admin = adminData;
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Session save error:", saveErr);
        return renderLogin(res, 500, "Unable to create login session.");
      }
      console.log(`✅ Admin login success (${method}):`, adminData.email);
      return res.redirect("/admin");
    });
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return renderLogin(res, 400, "Email and password are required.");
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const envEmail = String(process.env.ADMIN_EMAIL || "admin@mncconnect.com").trim().toLowerCase();
    const envPassword = String(process.env.ADMIN_PASSWORD || "Admin@123");
    const envName = process.env.ADMIN_NAME || "Super Admin";

    if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === "production") {
      console.warn("⚠️  ADMIN_PASSWORD is not set - the default password is being used!");
    }

    // 1) .env admin
    if (safeEqual(normalizedEmail, envEmail) && safeEqual(password, envPassword)) {
      return startSession(
        req, res,
        { id: "env-admin", name: envName, email: envEmail, role: "superadmin" },
        ".env"
      );
    }

    // 2) Database admin
    const admin = await Admin.findOne({ email: normalizedEmail }).select("+password");

    if (!admin) return renderLogin(res, 401, "Invalid email or password.");
    if (!admin.isActive) return renderLogin(res, 403, "Your admin account is inactive.");

    const valid = typeof admin.comparePassword === "function"
      ? await admin.comparePassword(password)
      : await bcrypt.compare(password, admin.password);

    if (!valid) return renderLogin(res, 401, "Invalid email or password.");

    admin.lastLogin = new Date();
    await admin.save();

    return startSession(
      req, res,
      { id: admin._id.toString(), name: admin.name, email: admin.email, role: admin.role },
      "database"
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return renderLogin(res, 500, "Something went wrong. Please try again.");
  }
};

const logout = (req, res) => {
  if (!req.session) return res.redirect("/admin/login");
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
// DASHBOARD
// ============================================================

const dashboard = async (req, res) => {
  try {
    const User = loadModel("User", "User");
    const Payment = loadModel("Payment", "Payment", "Transaction");

    // Last 6 months buckets
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({
        y: d.getFullYear(),
        m: d.getMonth() + 1,
        label: d.toLocaleString("en-US", { month: "short" }),
        count: 0,
      });
    }
    const since = new Date(months[0].y, months[0].m - 1, 1);

    const [
      totalMentors, pendingMentors, approvedMentors, rejectedMentors,
      monthlyRaw, topCompaniesRaw, recentRaw, pendingRaw,
      totalUsers, totalFreshers, totalPayments, revenueAgg,
    ] = await Promise.all([
      Mentor.countDocuments(),
      Mentor.countDocuments({ verificationStatus: "pending" }),
      Mentor.countDocuments({ verificationStatus: "approved" }),
      Mentor.countDocuments({ verificationStatus: "rejected" }),
      Mentor.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      Mentor.aggregate([
        { $match: { currentCompany: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: "$currentCompany", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Mentor.find().sort({ createdAt: -1 }).limit(5)
        .select("name email designation currentCompany verificationStatus isVerified createdAt profilePic").lean(),
      Mentor.find({ verificationStatus: "pending" }).sort({ createdAt: 1 }).limit(5)
        .select("name email currentCompany createdAt").lean(),
      User ? safe(() => User.countDocuments()) : null,
      User ? safe(() => User.countDocuments({ role: { $nin: ["admin", "mentor"] } })) : null,
      Payment ? safe(() => Payment.countDocuments()) : null,
      Payment
        ? safe(() => Payment.aggregate([
            { $match: { status: { $in: PAID_STATUSES } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]), [])
        : null,
    ]);

    monthlyRaw.forEach((r) => {
      const slot = months.find((x) => x.y === r._id.y && x.m === r._id.m);
      if (slot) slot.count = r.count;
    });

    const approvalRate = totalMentors ? Math.round((approvedMentors / totalMentors) * 100) : 0;

    return res.render("admin/dashboard", {
      admin: req.session.admin,
      currentPage: "dashboard",
      pageTitle: "Dashboard",
      pageSubtitle: `Welcome back, ${req.session.admin ? req.session.admin.name : "Admin"}`,
      stats: {
        totalMentors, pendingMentors, approvedMentors, rejectedMentors,
        totalUsers, totalFreshers, totalPayments,
        revenue: revenueAgg ? (revenueAgg[0] ? revenueAgg[0].total : 0) : null,
      },
      approvalRate,
      monthly: months,
      topCompanies: topCompaniesRaw.map((c) => ({ name: c._id, count: c.count })),
      recentMentors: recentRaw.map(normalizeMentor),
      pendingQueue: pendingRaw,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).send("Unable to load admin dashboard.");
  }
};

// ============================================================
// MENTORS
// ============================================================

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  experience: { yearsOfExperience: -1 },
};

const mentorFilter = ({ search = "", status = "all" }) => {
  const filter = {};
  if (STATUSES.includes(status)) filter.verificationStatus = status;

  const s = String(search).trim();
  if (s) {
    const re = new RegExp(escapeRegex(s), "i");
    filter.$or = ["name", "email", "mobile", "employeeId", "currentCompany", "designation", "department"]
      .map((k) => ({ [k]: re }));
  }
  return filter;
};

const listMentors = async (req, res) => {
  try {
    const search = String(req.query.search || "");
    const status = STATUSES.includes(req.query.status) ? req.query.status : "all";
    const sort = SORTS[req.query.sort] ? req.query.sort : "newest";

    const { page, limit, skip } = getPage(req);
    const filter = mentorFilter({ search, status });

    const [mentorsRaw, total, countRows] = await Promise.all([
      Mentor.find(filter).select("-password").sort(SORTS[sort]).skip(skip).limit(limit).lean(),
      Mentor.countDocuments(filter),
      // Tab counts follow the search text but ignore the status filter
      Mentor.aggregate([
        { $match: mentorFilter({ search }) },
        { $group: { _id: "$verificationStatus", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    countRows.forEach((r) => {
      const key = STATUSES.includes(r._id) ? r._id : "pending";
      counts[key] += r.count;
      counts.all += r.count;
    });

    return res.render("admin/mentors", {
      admin: req.session.admin,
      currentPage: "mentors",
      pageTitle: "Mentors",
      pageSubtitle: "Manage all mentor profiles",
      mentors: mentorsRaw.map(normalizeMentor),
      counts, search, status, sort,
      pagination: makePagination(page, limit, total),
      baseQuery: buildQuery({ search, status, sort }),
    });
  } catch (error) {
    console.error("List mentors error:", error);
    return res.status(500).send("Unable to load mentors.");
  }
};

const csvCell = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  // prevent CSV/Excel formula injection
  const guarded = /^[=+\-@]/.test(s) ? "'" + s : s;
  return `"${guarded.replace(/"/g, '""')}"`;
};

const exportMentors = async (req, res) => {
  try {
    const filter = mentorFilter({
      search: req.query.search,
      status: STATUSES.includes(req.query.status) ? req.query.status : "all",
    });

    const mentors = await Mentor.find(filter).select("-password").sort({ createdAt: -1 }).limit(5000).lean();

    const header = ["Name", "Email", "Mobile", "Company", "Designation", "Department", "Experience (yrs)", "Hourly Rate", "Status", "Joined"];
    const rows = mentors.map((m) => {
      const n = normalizeMentor(m);
      return [
        n.name, n.email, [n.countryCode, n.mobile].filter(Boolean).join(" "),
        n.currentCompany, n.designation, n.department, n.yearsOfExperience, n.hourlyRate,
        n.status, n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : "",
      ].map(csvCell).join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mentors-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send("\uFEFF" + [header.map(csvCell).join(","), ...rows].join("\r\n"));
  } catch (error) {
    console.error("Export mentors error:", error);
    return res.status(500).send("Unable to export mentors.");
  }
};

const mentorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).send("Invalid mentor ID format.");

    const mentor = await Mentor.findById(id).select("-password").lean();
    if (!mentor) return res.status(404).send("Mentor not found.");

    return res.render("admin/mentorDetails", {
      admin: req.session.admin,
      currentPage: "mentors",
      pageTitle: "Mentor Details",
      pageSubtitle: "Profile and verification documents",
      mentor: normalizeMentor(mentor),
    });
  } catch (error) {
    console.error("Mentor details error:", error);
    return res.status(500).send("Unable to load mentor details.");
  }
};

// ---------- Approve / Reject / Reset ----------

// Returns an error string, or null when the mentor was updated
const applyMentorAction = (mentor, action, reason) => {
  if (action === "approve") {
    if (mentor.verificationStatus === "approved") return "Mentor is already approved.";
    mentor.verificationStatus = "approved";
    mentor.isVerified = true;
    mentor.accountStatus = "active";
    if (!mentor.verificationMethod || mentor.verificationMethod === "pending") {
      mentor.verificationMethod = "document";
    }
    mentor.rejectionReason = undefined;
    return null;
  }

  if (action === "reject") {
    if (mentor.verificationStatus === "rejected") return "Mentor is already rejected.";
    mentor.verificationStatus = "rejected";
    mentor.isVerified = false;
    mentor.accountStatus = "rejected";
    mentor.rejectionReason = reason || "Mentor verification rejected by admin.";
    return null;
  }

  if (action === "pending") {
    if (mentor.verificationStatus === "pending") return "Mentor is already pending.";
    mentor.verificationStatus = "pending";
    mentor.isVerified = false;
    mentor.accountStatus = "pending";
    mentor.rejectionReason = undefined;
    return null;
  }

  return "Invalid action.";
};

const PAST = { approve: "approved", reject: "rejected", pending: "moved to pending" };

// ---------- Email notification ----------

// Actions that trigger an email. Add "reject" to also notify on rejection.
const EMAIL_ACTIONS = ["approve"];

// arundharsaun@gmail.com -> ar***@gmail.com
const maskEmail = (e) => String(e || "").replace(/^(.{2}).*(@.*)$/, "$1***$2");

// Never throws. Returns { sent, to, reason } or null when no email is needed.
const notifyMentor = async (mentor, action) => {
  if (!EMAIL_ACTIONS.includes(action)) return null;

  if (!mentor.email) return { sent: false, reason: "mentor has no email address" };

  const content =
    action === "approve" ? approvalEmail(mentor)
    : action === "reject" ? rejectionEmail(mentor)
    : null;
  if (!content) return null;

  const result = await sendMail({ to: mentor.email, toName: mentor.name, ...content });
  return { sent: result.success, to: maskEmail(mentor.email), reason: result.error };
};

const changeMentorStatus = (action) => async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid mentor ID format." });
    }

    const mentor = await Mentor.findById(id);
    if (!mentor) return res.status(404).json({ success: false, message: "Mentor not found." });

    const reason = (req.body && req.body.reason) || "";
    const problem = applyMentorAction(mentor, action, reason);
    if (problem) return res.status(400).json({ success: false, message: problem });

    await mentor.save();
    console.log(`Mentor ${PAST[action]}:`, mentor.email, "by", req.session.admin && req.session.admin.email);

    // An email failure must never undo the approval, so it is only reported
    const mail = await notifyMentor(mentor, action);
    const mailNote = !mail ? "" : mail.sent ? ` Email sent to ${mail.to}.` : ` (Email not sent: ${mail.reason})`;

    return res.json({
      success: true,
      message: `Mentor ${PAST[action]} successfully.${mailNote}`,
      mail,
      mentor: {
        id: mentor._id,
        verificationStatus: mentor.verificationStatus,
        isVerified: mentor.isVerified,
        accountStatus: mentor.accountStatus,
        rejectionReason: mentor.rejectionReason,
      },
    });
  } catch (error) {
    console.error(`${action} mentor error:`, error);
    return res.status(500).json({ success: false, message: "Unable to update mentor. " + error.message });
  }
};

const approveMentor = changeMentorStatus("approve");
const rejectMentor = changeMentorStatus("reject");
const resetMentor = changeMentorStatus("pending");

const bulkMentorAction = async (req, res) => {
  try {
    const { ids, action, reason } = req.body || {};

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: "No mentors selected." });
    }
    if (!["approve", "reject", "pending"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action." });
    }
    if (ids.length > 100) {
      return res.status(400).json({ success: false, message: "Select at most 100 mentors at once." });
    }

    const validIds = ids.filter((i) => mongoose.Types.ObjectId.isValid(i));
    const mentors = await Mentor.find({ _id: { $in: validIds } });

    let done = 0;
    let failed = 0;

    for (const mentor of mentors) {
      const problem = applyMentorAction(mentor, action, reason);
      if (problem) { failed++; continue; }
      try {
        await mentor.save();
        done++;
        notifyMentor(mentor, action).catch(() => {}); // fire and forget
      }
      catch (err) { console.error("Bulk save error:", err.message); failed++; }
    }

    return res.json({
      success: true,
      failed,
      message: `${done} mentor(s) ${PAST[action]}${failed ? `, ${failed} skipped` : ""}.`,
    });
  } catch (error) {
    console.error("Bulk mentor action error:", error);
    return res.status(500).json({ success: false, message: "Bulk action failed." });
  }
};

// ============================================================
// USERS / FRESHERS
// ============================================================

const listUsers = (mode) => async (req, res) => {
  try {
    const User = loadModel("User", "User");
    const isFreshers = mode === "freshers";

    const search = String(req.query.search || "");
    const role = ["admin", "mentor", "fresher", "user"].includes(req.query.role) ? req.query.role : "all";
    const status = ["active", "inactive"].includes(req.query.status) ? req.query.status : "all";
    const { page, limit, skip } = getPage(req);

    const base = {
      admin: req.session.admin,
      currentPage: isFreshers ? "freshers" : "users",
      pageTitle: isFreshers ? "Freshers" : "All Users",
      pageSubtitle: isFreshers ? "Manage fresher accounts" : "Manage all platform users",
      mode: isFreshers ? "freshers" : "users",
      search, role, status,
    };

    if (!User) {
      return res.render("admin/users", {
        ...base, users: [], modelMissing: true,
        pagination: makePagination(1, limit, 0), baseQuery: "",
      });
    }

    const filter = {};
    if (isFreshers) filter.role = { $nin: ["admin", "mentor"] };
    else if (role !== "all") filter.role = role;

    if (status === "active") filter.isActive = { $ne: false };
    if (status === "inactive") filter.isActive = false;

    if (search.trim()) {
      const re = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: re }, { email: re }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return res.render("admin/users", {
      ...base, users, modelMissing: false,
      pagination: makePagination(page, limit, total),
      baseQuery: buildQuery({ search, role, status }),
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).send("Unable to load users.");
  }
};

const toggleUser = async (req, res) => {
  try {
    const User = loadModel("User", "User");
    if (!User) return res.status(500).json({ success: false, message: "User model not found." });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Admin accounts cannot be deactivated here." });
    }

    user.isActive = user.isActive === false ? true : false;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      isActive: user.isActive,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`,
    });
  } catch (error) {
    console.error("Toggle user error:", error);
    return res.status(500).json({ success: false, message: "Unable to update user." });
  }
};

// ============================================================
// PAYMENTS
// ============================================================

const listPayments = async (req, res) => {
  try {
    const Payment = loadModel("Payment", "Payment", "Transaction");
    const status = ["success", "pending", "failed"].includes(req.query.status) ? req.query.status : "all";
    const { page, limit, skip } = getPage(req);

    const base = {
      admin: req.session.admin,
      currentPage: "payments",
      pageTitle: "Payments",
      pageSubtitle: "Track transactions and revenue",
      status,
    };

    if (!Payment) {
      return res.render("admin/payments", {
        ...base, payments: [], modelMissing: true,
        summary: { count: 0, revenue: 0, failed: 0 },
        pagination: makePagination(1, limit, 0), baseQuery: "",
      });
    }

    const filter = {};
    if (status === "success") filter.status = { $in: PAID_STATUSES };
    else if (status === "failed") filter.status = { $in: FAILED_STATUSES };
    else if (status === "pending") filter.status = { $nin: [...PAID_STATUSES, ...FAILED_STATUSES, "refunded"] };

    const [payments, total, count, revenueAgg, failed] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
      Payment.countDocuments(),
      Payment.aggregate([
        { $match: { status: { $in: PAID_STATUSES } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ status: { $in: FAILED_STATUSES } }),
    ]);

    return res.render("admin/payments", {
      ...base, payments, modelMissing: false,
      summary: { count, revenue: revenueAgg[0] ? revenueAgg[0].total : 0, failed },
      pagination: makePagination(page, limit, total),
      baseQuery: buildQuery({ status }),
    });
  } catch (error) {
    console.error("List payments error:", error);
    return res.status(500).send("Unable to load payments.");
  }
};

// ============================================================
// SEED ADMIN FROM .ENV
// ============================================================

const seedAdminFromEnv = async () => {
  try {
    const email = String(process.env.ADMIN_EMAIL || "admin@mncconnect.com").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "Admin@123";
    const name = process.env.ADMIN_NAME || "Super Admin";

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log("Admin already exists in database:", email);
      return;
    }

    await new Admin({ name, email, password, role: "superadmin", isActive: true }).save();
    console.log("✅ Admin created from .env successfully:", email);
  } catch (error) {
    console.error("❌ Error seeding admin from .env:", error);
  }
};

module.exports = {
  showLoginPage,
  login,
  logout,
  dashboard,
  listMentors,
  exportMentors,
  mentorDetails,
  approveMentor,
  rejectMentor,
  resetMentor,
  bulkMentorAction,
  listUsers,
  toggleUser,
  listPayments,
  seedAdminFromEnv,
};