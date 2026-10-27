// controllers/adminController.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Admin = require("../models/Admin");
const Mentor = require("../models/Mentor");
const MentorReview = require("../models/MentorReview");
const AdminAuditLog = require("../models/AdminAuditLog");
const { sendMail, approvalEmail, rejectionEmail } = require("../utils/mailer");

const { REVIEW_CHECKS, isComplete } = MentorReview;

// ============================================================
// HELPERS
// ============================================================

const PAGE_SIZE = 10;
const STATUSES = ["pending", "approved", "rejected"];
const PAID_STATUSES = [
  "success",
  "paid",
  "captured",
  "completed",
  "successful",
];
const FAILED_STATUSES = ["failed", "cancelled", "canceled", "error"];
const MIN_REJECT_REASON = 10;

const FREE_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "aol.com",
  "zoho.in",
  "mail.com",
  "gmx.com",
  "yandex.com",
  "tempmail.com",
  "mailinator.com",
];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Load an optional model without crashing if the file / name differs
const loadModel = (file, ...names) => {
  try {
    require(`../models/${file}`);
  } catch (_) {
    /* ignore */
  }
  for (const n of names) if (mongoose.models[n]) return mongoose.models[n];
  return null;
};

const safe = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (err) {
    console.error("Admin safe() error:", err.message);
    return fallback;
  }
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
  page,
  limit,
  total,
  pages: Math.max(Math.ceil(total / limit), 1),
});

const normalizeMentor = (m) => ({
  ...m,
  status: STATUSES.includes(m.verificationStatus)
    ? m.verificationStatus
    : m.isVerified
      ? "approved"
      : "pending",
});

const renderLogin = (res, code, error) =>
  res.status(code).render("admin/login", { error });

const actorOf = (req) => {
  const a = (req.session && req.session.admin) || {};
  return { name: a.name || "Admin", email: a.email || "unknown" };
};

// ---------- Audit log (never throws) ----------
const audit = async (req, action, extra = {}) => {
  try {
    const actor = actorOf(req);
    await AdminAuditLog.create({
      action,
      adminEmail: actor.email,
      adminName: actor.name,
      ip: req.ip,
      userAgent: String(req.get("user-agent") || "").slice(0, 200),
      ...extra,
    });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
};

// Sidebar badge: number of pending mentors (use as middleware on all admin pages)
const injectPendingCount = async (req, res, next) => {
  try {
    res.locals.pendingCount = await Mentor.countDocuments({
      verificationStatus: "pending",
    });
  } catch (_) {
    res.locals.pendingCount = 0;
  }
  next();
};

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
    req.session.save(async (saveErr) => {
      if (saveErr) {
        console.error("Session save error:", saveErr);
        return renderLogin(res, 500, "Unable to create login session.");
      }
      await audit(req, "login_success", { meta: { method } });
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
    const isProd = process.env.NODE_ENV === "production";

    // 1) .env admin  (in production a real ADMIN_PASSWORD is REQUIRED)
    const envEmail = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const envPassword = process.env.ADMIN_PASSWORD || "";
    const envName = process.env.ADMIN_NAME || "Super Admin";
    const envEnabled =
      Boolean(envEmail && envPassword) &&
      !(isProd && envPassword === "Admin@123");

    if (
      envEnabled &&
      safeEqual(normalizedEmail, envEmail) &&
      safeEqual(password, envPassword)
    ) {
      return startSession(
        req,
        res,
        { id: "env-admin", name: envName, email: envEmail, role: "superadmin" },
        ".env",
      );
    }

    // 2) Database admin
    const admin = await Admin.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!admin) {
      await audit(req, "login_failed", {
        meta: { email: normalizedEmail, why: "no such admin" },
      });
      return renderLogin(res, 401, "Invalid email or password.");
    }
    if (!admin.isActive) {
      await audit(req, "login_failed", {
        meta: { email: normalizedEmail, why: "inactive" },
      });
      return renderLogin(res, 403, "Your admin account is inactive.");
    }

    const valid =
      typeof admin.comparePassword === "function"
        ? await admin.comparePassword(password)
        : await bcrypt.compare(password, admin.password);

    if (!valid) {
      await audit(req, "login_failed", {
        meta: { email: normalizedEmail, why: "bad password" },
      });
      return renderLogin(res, 401, "Invalid email or password.");
    }

    admin.lastLogin = new Date();
    await admin.save();

    return startSession(
      req,
      res,
      {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      "database",
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return renderLogin(res, 500, "Something went wrong. Please try again.");
  }
};

const logout = async (req, res) => {
  if (!req.session) return res.redirect("/admin/login");
  await audit(req, "logout");
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
      totalPayments, revenueAgg,
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
        totalUsers: null, totalFreshers: null, totalPayments,
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
// MENTORS - list / export
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
    filter.$or = [
      "name",
      "email",
      "mobile",
      "employeeId",
      "currentCompany",
      "designation",
      "department",
    ].map((k) => ({ [k]: re }));
  }
  return filter;
};

const listMentors = async (req, res) => {
  try {
    const search = String(req.query.search || "");
    const status = STATUSES.includes(req.query.status)
      ? req.query.status
      : "all";
    const sort = SORTS[req.query.sort] ? req.query.sort : "newest";

    const { page, limit, skip } = getPage(req);
    const filter = mentorFilter({ search, status });

    const [mentorsRaw, total, countRows] = await Promise.all([
      Mentor.find(filter)
        .select("-password")
        .sort(SORTS[sort])
        .skip(skip)
        .limit(limit)
        .lean(),
      Mentor.countDocuments(filter),
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
      counts,
      search,
      status,
      sort,
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
  const guarded = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return `"${guarded.replace(/"/g, '""')}"`;
};

const exportMentors = async (req, res) => {
  try {
    const filter = mentorFilter({
      search: req.query.search,
      status: STATUSES.includes(req.query.status) ? req.query.status : "all",
    });

    const mentors = await Mentor.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    await audit(req, "export_mentors", {
      meta: { rows: mentors.length, filter: req.query },
    });

    const header = [
      "Name",
      "Email",
      "Mobile",
      "Company",
      "Designation",
      "Department",
      "Experience (yrs)",
      "Status",
      "Joined",
    ];
    const rows = mentors.map((m) => {
      const n = normalizeMentor(m);
      return [
        n.name,
        n.email,
        [n.countryCode, n.mobile].filter(Boolean).join(" "),
        n.currentCompany,
        n.designation,
        n.department,
        n.yearsOfExperience,
        n.status,
        n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mentors-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(
      "\uFEFF" + [header.map(csvCell).join(","), ...rows].join("\r\n"),
    );
  } catch (error) {
    console.error("Export mentors error:", error);
    return res.status(500).send("Unable to export mentors.");
  }
};

// ============================================================
// MENTOR DETAILS (with automatic signals)
// ============================================================

// Looks at the work-email domain and tells the admin how trustworthy it looks.
// NOTE: this is a HINT only. The admin still decides.
const analyzeWorkEmail = async (mentor) => {
  const email = String(mentor.workEmail || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) {
    return {
      state: "missing",
      tone: "bad",
      domain: "",
      text: "No work email provided.",
    };
  }
  const domain = email.split("@").pop();

  if (FREE_DOMAINS.includes(domain)) {
    return {
      state: "free",
      tone: "bad",
      domain,
      text: `@${domain} is a free / personal email provider, not a company domain.`,
    };
  }

  // Optional allowlist: models/CompanyDomain.js  { name: "Zoho", domains: ["zohocorp.com"] }
  const CompanyDomain = loadModel("CompanyDomain", "CompanyDomain");
  if (CompanyDomain && mentor.currentCompany) {
    const entry = await safe(() =>
      CompanyDomain.findOne({
        name: new RegExp(`^${escapeRegex(mentor.currentCompany)}$`, "i"),
      }).lean(),
    );
    if (entry && Array.isArray(entry.domains) && entry.domains.length) {
      const list = entry.domains.map((d) => String(d).toLowerCase());
      return list.includes(domain)
        ? {
            state: "allowlisted",
            tone: "ok",
            domain,
            text: `@${domain} is on the allowlist for ${mentor.currentCompany}.`,
          }
        : {
            state: "mismatch",
            tone: "bad",
            domain,
            text: `@${domain} is NOT one of the known ${mentor.currentCompany} domains (${list.join(", ")}). Possible look-alike.`,
          };
    }
  }

  // Heuristic: does the domain contain a word from the company name?
  const tokens = String(mentor.currentCompany || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const looksRelated = tokens.some((t) => domain.includes(t));

  return looksRelated
    ? {
        state: "plausible",
        tone: "warn",
        domain,
        text: `@${domain} looks related to "${mentor.currentCompany}", but this is not confirmed. Verify the exact domain and watch for look-alikes.`,
      }
    : {
        state: "unverified",
        tone: "warn",
        domain,
        text: `@${domain} does not obviously match "${mentor.currentCompany || "the company"}". Verify manually.`,
      };
};

const findDuplicates = async (mentor) => {
  const or = [];
  if (mentor.employeeId) or.push({ employeeId: mentor.employeeId });
  if (mentor.workEmail)
    or.push({
      workEmail: new RegExp(`^${escapeRegex(mentor.workEmail)}$`, "i"),
    });
  if (mentor.mobile) or.push({ mobile: mentor.mobile });
  if (mentor.linkedinProfile)
    or.push({ linkedinProfile: mentor.linkedinProfile });
  if (!or.length) return [];

  const rows = await Mentor.find({ _id: { $ne: mentor._id }, $or: or })
    .select(
      "name email employeeId workEmail mobile linkedinProfile verificationStatus isVerified",
    )
    .limit(5)
    .lean();

  return rows.map((r) => {
    const why = [];
    if (mentor.employeeId && r.employeeId === mentor.employeeId)
      why.push("same Employee ID");
    if (
      mentor.workEmail &&
      String(r.workEmail || "").toLowerCase() ===
        String(mentor.workEmail).toLowerCase()
    )
      why.push("same work email");
    if (mentor.mobile && r.mobile === mentor.mobile) why.push("same mobile");
    if (mentor.linkedinProfile && r.linkedinProfile === mentor.linkedinProfile)
      why.push("same LinkedIn");
    return { ...normalizeMentor(r), why };
  });
};

const mentorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).send("Invalid mentor ID format.");

    const mentor = await Mentor.findById(id).select("-password").lean();
    if (!mentor) return res.status(404).send("Mentor not found.");

    const [review, auditRows, duplicates, emailInfo] = await Promise.all([
      MentorReview.findOne({ mentor: id }).lean(),
      AdminAuditLog.find({ mentor: id })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      findDuplicates(mentor),
      analyzeWorkEmail(mentor),
    ]);

    const checks = (review && review.checks) || {};
    const reviewState = {
      checks,
      notes: (review && review.notes) || "",
      reviewedBy: review && review.reviewedBy,
      reviewedAt: review && review.reviewedAt,
      complete: isComplete(checks),
    };

    return res.render("admin/mentorDetails", {
      admin: req.session.admin,
      currentPage: "mentors",
      pageTitle: "Mentor Details",
      pageSubtitle: "Profile, documents and manual verification",
      mentor: normalizeMentor(mentor),
      review: reviewState,
      reviewChecks: REVIEW_CHECKS,
      auditRows,
      duplicates,
      emailInfo,
    });
  } catch (error) {
    console.error("Mentor details error:", error);
    return res.status(500).send("Unable to load mentor details.");
  }
};

// ---------- Save the admin's manual checklist ----------
const saveReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mentor ID." });
    }

    const mentor = await Mentor.findById(id)
      .select("name verificationStatus")
      .lean();
    if (!mentor)
      return res
        .status(404)
        .json({ success: false, message: "Mentor not found." });

    // Whitelist: only known keys, only booleans
    const incoming = (req.body && req.body.checks) || {};
    const checks = {};
    REVIEW_CHECKS.forEach((c) => {
      checks[c.key] = incoming[c.key] === true;
    });

    const notes = String((req.body && req.body.notes) || "")
      .trim()
      .slice(0, 1000);
    const actor = actorOf(req);

    const doc = await MentorReview.findOneAndUpdate(
      { mentor: id },
      {
        $set: { checks, notes, reviewedBy: actor, reviewedAt: new Date() },
        $push: {
          history: {
            $each: [{ at: new Date(), by: actor.email, checks, notes }],
            $slice: -50,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const complete = isComplete(doc.checks);
    await audit(req, "review_saved", {
      mentor: id,
      mentorName: mentor.name,
      meta: { complete, checks },
    });

    return res.json({
      success: true,
      complete,
      reviewedBy: actor.name,
      reviewedAt: doc.reviewedAt,
      message: complete
        ? "Review saved. All required checks are done. You can approve now."
        : "Review saved. Some required checks are still pending.",
    });
  } catch (error) {
    console.error("Save review error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to save review." });
  }
};

// ============================================================
// APPROVE / REJECT / RESET  (server-side guards)
// ============================================================

// Returns an error string, or null when the mentor was updated
const applyMentorAction = (mentor, action, reason) => {
  if (action === "approve") {
    if (mentor.verificationStatus === "approved")
      return "Mentor is already approved.";
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
    if (mentor.verificationStatus === "rejected")
      return "Mentor is already rejected.";
    mentor.verificationStatus = "rejected";
    mentor.isVerified = false;
    mentor.accountStatus = "rejected";
    mentor.rejectionReason = reason;
    return null;
  }

  if (action === "pending") {
    if (mentor.verificationStatus === "pending")
      return "Mentor is already pending.";
    mentor.verificationStatus = "pending";
    mentor.isVerified = false;
    mentor.accountStatus = "pending";
    mentor.rejectionReason = undefined;
    return null;
  }

  return "Invalid action.";
};

const PAST = {
  approve: "approved",
  reject: "rejected",
  pending: "moved to pending",
};

// Approve is only allowed when documents exist AND the admin finished the manual checklist
const approvalBlocker = async (mentor) => {
  if (!mentor.offerLetter) return "Offer letter is missing.";
  if (!mentor.employeeIdProof) return "Employee ID proof is missing.";

  const review = await MentorReview.findOne({ mentor: mentor._id }).lean();
  if (!review || !isComplete(review.checks)) {
    return "Complete and save the manual verification checklist before approving.";
  }
  return null;
};

// ---------- Email notification ----------
const EMAIL_ACTIONS = ["approve", "reject"];

const maskEmail = (e) => String(e || "").replace(/^(.{2}).*(@.*)$/, "$1***$2");

// Never throws. Returns { sent, to, reason } or null when no email is needed.
const notifyMentor = async (mentor, action) => {
  if (!EMAIL_ACTIONS.includes(action)) return null;
  if (!mentor.email)
    return { sent: false, reason: "mentor has no email address" };

  const content =
    action === "approve"
      ? approvalEmail(mentor)
      : action === "reject"
        ? rejectionEmail(mentor)
        : null;
  if (!content) return null;

  const result = await sendMail({
    to: mentor.email,
    toName: mentor.name,
    ...content,
  });
  return {
    sent: result.success,
    to: maskEmail(mentor.email),
    reason: result.error,
  };
};

const changeMentorStatus = (action) => async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mentor ID format." });
    }

    const mentor = await Mentor.findById(id);
    if (!mentor)
      return res
        .status(404)
        .json({ success: false, message: "Mentor not found." });

    const reason = String((req.body && req.body.reason) || "")
      .trim()
      .slice(0, 500);

    // ---- guards ----
    if (action === "reject" && reason.length < MIN_REJECT_REASON) {
      return res.status(400).json({
        success: false,
        message: `Please give a rejection reason (at least ${MIN_REJECT_REASON} characters). The mentor will see it.`,
      });
    }
    if (action === "approve") {
      const blocker = await approvalBlocker(mentor);
      if (blocker)
        return res.status(400).json({ success: false, message: blocker });
    }

    const previous = mentor.verificationStatus;
    const problem = applyMentorAction(mentor, action, reason);
    if (problem)
      return res.status(400).json({ success: false, message: problem });

    await mentor.save();

    await audit(req, `mentor_${action}`, {
      mentor: mentor._id,
      mentorName: mentor.name,
      reason,
      meta: { from: previous, to: mentor.verificationStatus },
    });

    // An email failure must never undo the decision, so it is only reported
    const mail = await notifyMentor(mentor, action);
    const mailNote = !mail
      ? ""
      : mail.sent
        ? ` Email sent to ${mail.to}.`
        : ` (Email not sent: ${mail.reason})`;

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
    return res
      .status(500)
      .json({ success: false, message: "Unable to update mentor." });
  }
};

const approveMentor = changeMentorStatus("approve");
const rejectMentor = changeMentorStatus("reject");
const resetMentor = changeMentorStatus("pending");

// Bulk: approving in bulk is NOT allowed (every approval needs an individual review)
const bulkMentorAction = async (req, res) => {
  try {
    const { ids, action } = req.body || {};
    const reason = String((req.body && req.body.reason) || "")
      .trim()
      .slice(0, 500);

    if (!Array.isArray(ids) || !ids.length) {
      return res
        .status(400)
        .json({ success: false, message: "No mentors selected." });
    }
    if (!["reject", "pending"].includes(action)) {
      return res.status(400).json({
        success: false,
        message:
          "Bulk approve is disabled. Review and approve each mentor individually.",
      });
    }
    if (action === "reject" && reason.length < MIN_REJECT_REASON) {
      return res
        .status(400)
        .json({
          success: false,
          message: `A rejection reason (min ${MIN_REJECT_REASON} chars) is required.`,
        });
    }
    if (ids.length > 100) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Select at most 100 mentors at once.",
        });
    }

    const validIds = ids.filter((i) => mongoose.Types.ObjectId.isValid(i));
    const mentors = await Mentor.find({ _id: { $in: validIds } });

    let done = 0;
    let failed = 0;

    for (const mentor of mentors) {
      const problem = applyMentorAction(mentor, action, reason);
      if (problem) {
        failed++;
        continue;
      }
      try {
        await mentor.save();
        done++;
        await audit(req, `bulk_${action}`, {
          mentor: mentor._id,
          mentorName: mentor.name,
          reason,
        });
        notifyMentor(mentor, action).catch(() => {});
      } catch (err) {
        console.error("Bulk save error:", err.message);
        failed++;
      }
    }

    return res.json({
      success: true,
      failed,
      message: `${done} mentor(s) ${PAST[action]}${failed ? `, ${failed} skipped` : ""}.`,
    });
  } catch (error) {
    console.error("Bulk mentor action error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Bulk action failed." });
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
    const role = ["admin", "mentor", "fresher", "user"].includes(req.query.role)
      ? req.query.role
      : "all";
    const status = ["active", "inactive"].includes(req.query.status)
      ? req.query.status
      : "all";
    const { page, limit, skip } = getPage(req);

    const base = {
      admin: req.session.admin,
      currentPage: isFreshers ? "freshers" : "users",
      pageTitle: isFreshers ? "Freshers" : "All Users",
      pageSubtitle: isFreshers
        ? "Manage fresher accounts"
        : "Manage all platform users",
      mode: isFreshers ? "freshers" : "users",
      search,
      role,
      status,
    };

    if (!User) {
      return res.render("admin/users", {
        ...base,
        users: [],
        modelMissing: true,
        pagination: makePagination(1, limit, 0),
        baseQuery: "",
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
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.render("admin/users", {
      ...base,
      users,
      modelMissing: false,
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
    if (!User)
      return res
        .status(500)
        .json({ success: false, message: "User model not found." });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID." });
    }

    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    if (user.role === "admin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Admin accounts cannot be deactivated here.",
        });
    }

    user.isActive = user.isActive === false ? true : false;
    await user.save({ validateBeforeSave: false });

    await audit(req, "user_toggle", {
      meta: { userId: id, email: user.email, isActive: user.isActive },
    });

    return res.json({
      success: true,
      isActive: user.isActive,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`,
    });
  } catch (error) {
    console.error("Toggle user error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update user." });
  }
};

// ============================================================
// PAYMENTS
// ============================================================

const listPayments = async (req, res) => {
  try {
    const Payment = loadModel("Payment", "Payment", "Transaction");
    const status = ["success", "pending", "failed"].includes(req.query.status)
      ? req.query.status
      : "all";
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
        ...base,
        payments: [],
        modelMissing: true,
        summary: { count: 0, revenue: 0, failed: 0 },
        pagination: makePagination(1, limit, 0),
        baseQuery: "",
      });
    }

    const filter = {};
    if (status === "success") filter.status = { $in: PAID_STATUSES };
    else if (status === "failed") filter.status = { $in: FAILED_STATUSES };
    else if (status === "pending")
      filter.status = {
        $nin: [...PAID_STATUSES, ...FAILED_STATUSES, "refunded"],
      };

    const [payments, total, count, revenueAgg, failed] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
      Payment.countDocuments(),
      Payment.aggregate([
        { $match: { status: { $in: PAID_STATUSES } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ status: { $in: FAILED_STATUSES } }),
    ]);

    return res.render("admin/payments", {
      ...base,
      payments,
      modelMissing: false,
      summary: {
        count,
        revenue: revenueAgg[0] ? revenueAgg[0].total : 0,
        failed,
      },
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
    const email = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";
    const name = process.env.ADMIN_NAME || "Super Admin";

    if (!email || !password) {
      console.warn(
        "ADMIN_EMAIL / ADMIN_PASSWORD not set. Skipping admin seed.",
      );
      return;
    }
    if (process.env.NODE_ENV === "production" && password === "Admin@123") {
      console.warn(
        "Refusing to seed an admin with the default password in production.",
      );
      return;
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log("Admin already exists in database:", email);
      return;
    }

    await new Admin({
      name,
      email,
      password,
      role: "superadmin",
      isActive: true,
    }).save();
    console.log("Admin created from .env successfully:", email);
  } catch (error) {
    console.error("Error seeding admin from .env:", error);
  }
};

module.exports = {
  showLoginPage,
  login,
  logout,
  injectPendingCount,
  dashboard,
  listMentors,
  exportMentors,
  mentorDetails,
  saveReview,
  approveMentor,
  rejectMentor,
  resetMentor,
  bulkMentorAction,
  listPayments,
  seedAdminFromEnv,
};
