// utils/finance.js
const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");
const CompanyPayout = require("../models/CompanyPayout");
const Fresher = require("../models/Fresher");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sumIf = (cond, expr) => ({ $sum: { $cond: [cond, expr, 0] } });
const f = (name) => ({ $ifNull: ["$" + name, 0] });

const getFinanceSummary = async () => {
  const isPaid = { $eq: ["$status", "paid"] };
  const isRefunded = { $eq: ["$status", "refunded"] };
  const done = { $eq: ["$sessionStatus", "completed"] };
  const open = {
    $and: [
      { $ne: ["$sessionStatus", "completed"] },
      { $ne: ["$sessionStatus", "cancelled"] },
    ],
  };
  const paidDone = { $and: [isPaid, done] };
  const paidOpen = { $and: [isPaid, open] };
  const paidOrRefunded = { $or: [isPaid, isRefunded] };
  const recognizedRow = { $or: [paidDone, isRefunded] }; // revenue / cost is "settled" for these rows

  const checkoutExpr = {
    $cond: [{ $gt: [f("checkoutAmount"), 0] }, f("checkoutAmount"), "$amount"],
  };
  const refundTotalExpr = {
    $cond: [{ $gt: [f("refundAmount"), 0] }, f("refundAmount"), "$amount"],
  };

  const [payAgg, wdAgg, coAgg, walletAgg] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },

          gross: sumIf(isPaid, "$amount"),
          completedRevenue: sumIf(paidDone, "$amount"),
          checkoutGross: sumIf(isPaid, checkoutExpr),

          refunded: sumIf(isRefunded, "$amount"),
          refundedTotal: sumIf(isRefunded, refundTotalExpr),
          refundedConvenience: sumIf(isRefunded, f("convenienceFeeRefunded")),

          grossProfit: sumIf(paidDone, "$platformFee"),
          heldProfit: sumIf(paidOpen, "$platformFee"),
          heldAmount: sumIf(paidOpen, "$amount"),
          mentorEarned: sumIf(paidDone, "$mentorEarning"),

          convenienceCollected: sumIf(paidOrRefunded, f("gatewayFeeCollected")),
          convenienceHeld: sumIf(paidOpen, f("gatewayFeeCollected")),
          convenienceRecognized: {
            $sum: {
              $add: [
                { $cond: [paidDone, f("gatewayFeeCollected"), 0] },
                {
                  $cond: [
                    isRefunded,
                    {
                      $subtract: [
                        f("gatewayFeeCollected"),
                        f("convenienceFeeRefunded"),
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
          },

          // everything Razorpay charged us (display)
          gatewayCost: sumIf(paidOrRefunded, "$gatewayFee"),
          // only the part that belongs to finished rows (used for profit).
          // Razorpay keeps its fee even on refunds, so refunded rows count.
          gatewayCostRecognized: sumIf(recognizedRow, "$gatewayFee"),
          gatewayCostHeld: sumIf(paidOpen, "$gatewayFee"),
          estimatedRows: sumIf(
            { $and: [paidOrRefunded, { $eq: ["$feeEstimated", true] }] },
            1,
          ),
        },
      },
    ]),
    Withdrawal.aggregate([
      { $group: { _id: "$status", total: { $sum: "$amount" } } },
    ]),
    CompanyPayout.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // refunds that were credited to wallets and are not spent yet = money we OWE (cash must stay in bank)
    // (promo money like welcome bonus is not cash, so it is capped by totalRefunds)
    Fresher.aggregate([
      { $group: { _id: null, total: { $sum: f("refundableBalance") } } },
    ]),
  ]);

  const p = payAgg[0] || {};
  const wd = { requested: 0, paid: 0, rejected: 0 };
  wdAgg.forEach((r) => {
    if (wd[r._id] !== undefined) wd[r._id] = r.total;
  });

  const walletLiability = round2(
    Math.max(walletAgg[0] ? walletAgg[0].total : 0, 0),
  );
  const convenienceRetained = round2(
    (p.convenienceCollected || 0) - (p.refundedConvenience || 0),
  );
  const convenienceRecognized = round2(p.convenienceRecognized);
  const gatewayCostRecognized = round2(p.gatewayCostRecognized);

  // Profit = platform fee (completed sessions) + convenience fee that is really ours
  //          - Razorpay cost of the SAME finished rows
  const netProfit = round2(
    (p.grossProfit || 0) + convenienceRecognized - gatewayCostRecognized,
  );
  const companyTaken = round2(coAgg[0] ? coAgg[0].total : 0);
  const mentorOwed = round2(
    Math.max((p.mentorEarned || 0) - wd.paid - wd.requested, 0),
  );

  const gap = round2(gatewayCostRecognized - convenienceRecognized);

  return {
    count: p.count || 0,

    gross: round2(p.gross),
    sessionRevenue: round2(p.gross),
    completedRevenue: round2(p.completedRevenue),
    checkoutGross: round2(p.checkoutGross),

    refunded: round2(p.refunded),
    refundedTotal: round2(p.refundedTotal),
    refundedConvenience: round2(p.refundedConvenience),

    convenienceCollected: round2(p.convenienceCollected),
    convenienceRetained,
    convenienceRecognized,
    convenienceHeld: round2(p.convenienceHeld),

    gatewayCost: round2(p.gatewayCost),
    gatewayCostRecognized,
    gatewayCostHeld: round2(p.gatewayCostHeld),
    unrecoveredGatewayCharges: Math.max(gap, 0),
    convenienceSurplus: Math.max(-gap, 0),
    estimatedRows: p.estimatedRows || 0,

    grossProfit: round2(p.grossProfit),
    netProfit,
    companyTaken,
    profitAvailable: round2(Math.max(netProfit - companyTaken, 0)),
    heldProfit: round2(p.heldProfit),
    heldAmount: round2(p.heldAmount),

    mentorEarned: round2(p.mentorEarned),
    mentorPaid: round2(wd.paid),
    mentorRequested: round2(wd.requested),
    mentorOwed,

    walletLiability, // refunds sitting in fresher wallets

    // money that must STAY in the bank
    mustKeep: round2(
      mentorOwed +
        wd.requested +
        (p.heldAmount || 0) +
        (p.convenienceHeld || 0) +
        walletLiability,
    ),
  };
};

const getTopMentors = (limit = 10) =>
  Payment.aggregate([
    {
      $match: {
        status: "paid",
        sessionStatus: "completed",
        mentor: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$mentor",
        earned: { $sum: "$mentorEarning" },
        fee: { $sum: "$platformFee" },
        sessions: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "mentors",
        localField: "_id",
        foreignField: "_id",
        as: "m",
      },
    },
    { $unwind: "$m" },
    {
      $project: {
        name: "$m.name",
        email: "$m.email",
        earned: 1,
        fee: 1,
        sessions: 1,
      },
    },
    { $sort: { earned: -1 } },
    { $limit: limit },
  ]);

module.exports = { getFinanceSummary, getTopMentors, round2 };
