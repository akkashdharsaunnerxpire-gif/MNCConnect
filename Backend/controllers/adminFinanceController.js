// controllers/adminFinanceController.js
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const CompanyPayout = require("../models/CompanyPayout");
const AdminAuditLog = require("../models/AdminAuditLog");
const { getFinanceSummary, getTopMentors, round2 } = require("../utils/finance");
const { getConfig, toPaise } = require("../utils/pricing");

const actorOf = (req) => {
  const a = (req.session && req.session.admin) || {};
  return { name: a.name || "Admin", email: a.email || "unknown" };
};

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
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
};

// GET /admin/finance
exports.showFinance = async (req, res) => {
  try {
    const [finance, payouts, topMentors] = await Promise.all([
      getFinanceSummary(),
      CompanyPayout.find().sort({ paidAt: -1 }).limit(20).lean(),
      getTopMentors(10),
    ]);

    return res.render("admin/finance", {
      admin: req.session.admin,
      currentPage: "finance",
      pageTitle: "Finance",
      pageSubtitle: "Platform profit, mentor payouts and company withdrawals",
      finance,
      payouts,
      topMentors,
      feePercent: Number(process.env.PLATFORM_FEE_PERCENT || 25),
      convenienceMode: getConfig().mode,
    });
  } catch (error) {
    console.error("Finance page error:", error);
    return res.status(500).send("Unable to load finance.");
  }
};

// POST /admin/finance/company-payout  { amount, reference, note }
exports.recordCompanyPayout = async (req, res) => {
  try {
    const amount = round2(req.body && req.body.amount);
    const reference = String((req.body && req.body.reference) || "").trim().slice(0, 60);
    const note = String((req.body && req.body.note) || "").trim().slice(0, 300);

    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: "Enter a valid amount." });
    }
    if (reference.length < 6) {
      return res.status(400).json({ success: false, message: "Enter the bank / UTR reference (min 6 characters)." });
    }

    // HARD GUARD: never take more than the real, earned profit
    const f = await getFinanceSummary();
    if (amount > f.profitAvailable) {
      return res.status(400).json({
        success: false,
        message: `You can take at most ₹${f.profitAvailable.toLocaleString("en-IN")} now. The rest belongs to mentors or is on hold for refunds.`,
      });
    }

    try {
      await CompanyPayout.create({ amount, reference, note, paidBy: actorOf(req).email });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ success: false, message: "This reference is already recorded." });
      }
      throw e;
    }

    await audit(req, "company_payout", { meta: { amount, reference } });
    return res.json({ success: true, message: "Company payout recorded." });
  } catch (error) {
    console.error("recordCompanyPayout error:", error);
    return res.status(500).json({ success: false, message: "Unable to record payout." });
  }
};

// POST /admin/finance/sync-fees
// Pulls the REAL Razorpay fee (and re-checks the paid amount) for payments that have
// no fee yet, only an estimate, or were saved without an amount check.
exports.syncGatewayFees = async (req, res) => {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: "Razorpay keys are not configured." });
    }
    const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    const cfg = getConfig();

    const rows = await Payment.find({
      status: { $in: ["paid", "refunded"] },
      razorpayPaymentId: /^pay_/,
      $or: [
        { gatewayFee: 0, gatewayFeeSyncedAt: null }, // never synced (also catches old documents)
        { feeEstimated: true },
        { amountVerified: false, createdAt: { $gte: new Date("2020-01-01") }, convenienceFeeMode: { $in: ["platform", "razorpay_bearer"] } },
      ],
    }).limit(50);

    let updated = 0;
    for (const p of rows) {
      try {
        const d = await rzp.payments.fetch(p.razorpayPaymentId);
        if (!d) continue;

        if (d.fee !== null && d.fee !== undefined) {
          p.gatewayFee = Number(d.fee) / 100;
          p.gatewayTax = Number(d.tax || 0) / 100;
          p.feeEstimated = false;
          p.gatewayFeeSyncedAt = new Date();
        }

        // re-check the amount that was really paid
        if (!p.amountVerified && d.amount) {
          const paidPaise = Number(d.amount);
          const orderPaise = toPaise(Number(p.orderAmount) > 0 ? p.orderAmount : p.amount);

          if (p.convenienceFeeMode === "razorpay_bearer") {
            const diff = paidPaise - orderPaise;
            if (diff >= 0 && diff <= cfg.maxPaise) {
              p.convenienceFee = diff / 100;
              p.gatewayFeeCollected = diff / 100;
              p.checkoutAmount = paidPaise / 100;
              p.amountVerified = true;
            }
          } else if (paidPaise === orderPaise) {
            p.amountVerified = true;
          }
        }

        await p.save();
        updated++;
      } catch (_) {
        /* skip this one */
      }
    }

    await audit(req, "sync_gateway_fees", { meta: { checked: rows.length, updated } });
    return res.json({ success: true, message: `${updated} of ${rows.length} payments updated.` });
  } catch (error) {
    console.error("syncGatewayFees error:", error);
    return res.status(500).json({ success: false, message: "Unable to sync fees." });
  }
};