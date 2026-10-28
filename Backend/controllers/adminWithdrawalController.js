// controllers/adminWithdrawalController.js
// Admin panel (session login): see mentor withdrawal requests, pay them manually
// from your bank / GPay, then mark them paid (with the UPI reference) or reject.

const mongoose = require("mongoose");

const Withdrawal = require("../models/Withdrawal");
const AdminAuditLog = require("../models/AdminAuditLog");
const { notify, emitToUser } = require("../utils/realtime");

const PAGE_SIZE = 15;
const STATUSES = ["requested", "paid", "rejected"];
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const actorOf = (req) => {
  const a = (req.session && req.session.admin) || {};
  return { name: a.name || "Admin", email: a.email || "unknown" };
};

// never throws
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

// GET /admin/withdrawals?status=requested|paid|rejected|all&page=1
exports.listWithdrawals = async (req, res) => {
  try {
    const status = [...STATUSES, "all"].includes(req.query.status) ? req.query.status : "requested";
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = PAGE_SIZE;
    const skip = (page - 1) * limit;
    const filter = status === "all" ? {} : { status };

    const [withdrawals, total, agg] = await Promise.all([
      Withdrawal.find(filter)
        .sort({ createdAt: status === "requested" ? 1 : -1 }) // oldest request first
        .skip(skip)
        .limit(limit)
        .populate("mentor", "name email currentCompany")
        .lean(),
      Withdrawal.countDocuments(filter),
      Withdrawal.aggregate([{ $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    ]);

    const sums = {
      requested: { total: 0, count: 0 },
      paid: { total: 0, count: 0 },
      rejected: { total: 0, count: 0 },
    };
    agg.forEach((r) => {
      if (sums[r._id]) sums[r._id] = { total: r.total, count: r.count };
    });

    return res.render("admin/withdrawals", {
      admin: req.session.admin,
      currentPage: "withdrawals",
      pageTitle: "Withdrawals",
      pageSubtitle: "Pay mentors manually, then mark the request as paid",
      status,
      withdrawals,
      sums,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
      baseQuery: `status=${status}`,
    });
  } catch (error) {
    console.error("List withdrawals error:", error);
    return res.status(500).send("Unable to load withdrawals.");
  }
};

// PATCH /admin/withdrawals/:wid/paid   { utr }
exports.markPaid = async (req, res) => {
  try {
    const id = req.params.wid;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const utr = String((req.body && req.body.utr) || "").trim().slice(0, 60);
    if (utr.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Enter the UPI transaction / UTR number (at least 6 characters).",
      });
    }

    const actor = actorOf(req);

    // only a still-"requested" one can be processed (prevents double payout)
    const w = await Withdrawal.findOneAndUpdate(
      { _id: id, status: "requested" },
      { $set: { status: "paid", utr, note: `UTR: ${utr}`, processedAt: new Date(), processedBy: actor.email } },
      { new: true }
    );
    if (!w) {
      return res.status(404).json({ success: false, message: "Request not found or already processed." });
    }

    await audit(req, "withdrawal_paid", {
      mentor: w.mentor,
      meta: { withdrawalId: String(w._id), amount: w.amount, upiId: w.upiId, utr },
    });

    notify({
      user: w.mentor,
      role: "mentor",
      title: "Withdrawal paid",
      message: `${rupees(w.amount)} has been sent to ${w.upiId}. Ref: ${utr}`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(String(w.mentor), "wallet:updated", { withdrawalId: w._id, status: "paid" });

    return res.json({ success: true, message: "Marked as paid. The mentor has been notified." });
  } catch (error) {
    console.error("markPaid error:", error);
    return res.status(500).json({ success: false, message: "Unable to update withdrawal." });
  }
};

// PATCH /admin/withdrawals/:wid/reject   { reason }
exports.markRejected = async (req, res) => {
  try {
    const id = req.params.wid;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const reason = String((req.body && req.body.reason) || "").trim().slice(0, 300);
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: "Give a short reason (the mentor will see it)." });
    }

    const actor = actorOf(req);

    const w = await Withdrawal.findOneAndUpdate(
      { _id: id, status: "requested" },
      { $set: { status: "rejected", note: reason, processedAt: new Date(), processedBy: actor.email } },
      { new: true }
    );
    if (!w) {
      return res.status(404).json({ success: false, message: "Request not found or already processed." });
    }

    await audit(req, "withdrawal_rejected", {
      mentor: w.mentor,
      reason,
      meta: { withdrawalId: String(w._id), amount: w.amount },
    });

    notify({
      user: w.mentor,
      role: "mentor",
      title: "Withdrawal rejected",
      message: `Your request for ${rupees(w.amount)} was rejected. ${reason}`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(String(w.mentor), "wallet:updated", { withdrawalId: w._id, status: "rejected" });

    return res.json({ success: true, message: "Rejected. The amount is back in the mentor's balance." });
  } catch (error) {
    console.error("markRejected error:", error);
    return res.status(500).json({ success: false, message: "Unable to update withdrawal." });
  }
};