// utils/finance.js
const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");
const CompanyPayout = require("../models/CompanyPayout");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const sumIf = (cond, expr) => ({ $sum: { $cond: [cond, expr, 0] } });

// old documents do not have the new fields -> treat as 0
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

  // what the customer really paid (old docs: = amount)
  const checkoutExpr = {
    $cond: [{ $gt: [f("checkoutAmount"), 0] }, f("checkoutAmount"), "$amount"],
  };
  // what went back to the customer (old docs: = amount)
  const refundTotalExpr = {
    $cond: [{ $gt: [f("refundAmount"), 0] }, f("refundAmount"), "$amount"],
  };

  const [payAgg, wdAgg, coAgg] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },

          // ---- session revenue (ORIGINAL session price only) ----
          gross: sumIf(isPaid, "$amount"), // paid + not refunded = total session revenue
          completedRevenue: sumIf(paidDone, "$amount"),
          checkoutGross: sumIf(isPaid, checkoutExpr), // session + convenience, paid & not refunded

          // ---- refunds ----
          refunded: sumIf(isRefunded, "$amount"), // session part of refunds (old key, kept)
          refundedTotal: sumIf(isRefunded, refundTotalExpr), // session + convenience actually returned
          refundedConvenience: sumIf(isRefunded, f("convenienceFeeRefunded")),

          // ---- platform fee / mentor money (from session price only) ----
          grossProfit: sumIf(paidDone, "$platformFee"),
          heldProfit: sumIf(paidOpen, "$platformFee"),
          heldAmount: sumIf(paidOpen, "$amount"),
          mentorEarned: sumIf(paidDone, "$mentorEarning"),

          // ---- convenience fees ----
          convenienceCollected: sumIf(paidOrRefunded, f("gatewayFeeCollected")), // gross, before refunds
          convenienceHeld: sumIf(paidOpen, f("gatewayFeeCollected")), // session not finished: may still be refunded
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

          // ---- what Razorpay really charged us ----
          // Razorpay keeps its fee even when we refund, so refunded rows count too
          gatewayCost: sumIf(paidOrRefunded, "$gatewayFee"),
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
  ]);

  const p = payAgg[0] || {};
  const wd = { requested: 0, paid: 0, rejected: 0 };
  wdAgg.forEach((r) => {
    if (wd[r._id] !== undefined) wd[r._id] = r.total;
  });
  const convenienceRetained =
    (p.convenienceCollected || 0) - (p.refundedConvenience || 0);
  const convenienceRecognized = round2(p.convenienceRecognized);

  // Profit = platform fee (completed sessions) + convenience fees that are really ours - Razorpay cost
  const netProfit = round2(
    (p.grossProfit || 0) + convenienceRecognized - (p.gatewayCost || 0),
  );
  const companyTaken = round2(coAgg[0] ? coAgg[0].total : 0);
  const mentorOwed = round2(
    Math.max((p.mentorEarned || 0) - wd.paid - wd.requested, 0),
  );

  // gateway cost minus every convenience fee still in hand (recognised + held)
  const gap = round2(
    (p.gatewayCost || 0) - convenienceRecognized - (p.convenienceHeld || 0),
  );

  return {
    count: p.count || 0,

    // session revenue
    gross: round2(p.gross),
    sessionRevenue: round2(p.gross),
    completedRevenue: round2(p.completedRevenue),
    checkoutGross: round2(p.checkoutGross),

    // refunds
    refunded: round2(p.refunded),
    refundedTotal: round2(p.refundedTotal),
    refundedConvenience: round2(p.refundedConvenience),

    // convenience fees
    convenienceCollected: round2(p.convenienceCollected), // gross
    convenienceRetained, // after refunds
    convenienceRecognized, // counted as profit
    convenienceHeld: round2(p.convenienceHeld),

    // gateway
    gatewayCost: round2(p.gatewayCost), // actual Razorpay charges
    unrecoveredGatewayCharges: Math.max(gap, 0),
    convenienceSurplus: Math.max(-gap, 0), // collected more than Razorpay charged
    estimatedRows: p.estimatedRows || 0,

    // profit
    grossProfit: round2(p.grossProfit), // platform fee on completed sessions
    netProfit,
    companyTaken,
    profitAvailable: round2(Math.max(netProfit - companyTaken, 0)),
    heldProfit: round2(p.heldProfit),
    heldAmount: round2(p.heldAmount),

    // mentors
    mentorEarned: round2(p.mentorEarned),
    mentorPaid: round2(wd.paid),
    mentorRequested: round2(wd.requested),
    mentorOwed,

    // money that must STAY in the bank: mentors' money + refundable money (session + held convenience fee)
    mustKeep: round2(
      mentorOwed +
        wd.requested +
        (p.heldAmount || 0) +
        (p.convenienceHeld || 0),
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
