// utils/finance.js
const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");
const CompanyPayout = require("../models/CompanyPayout");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } });

const getFinanceSummary = async () => {
  const isPaid = { $eq: ["$status", "paid"] };
  const isRefunded = { $eq: ["$status", "refunded"] };
  const done = { $eq: ["$sessionStatus", "completed"] };
  const open = {
    $and: [{ $ne: ["$sessionStatus", "completed"] }, { $ne: ["$sessionStatus", "cancelled"] }],
  };
  const paidDone = { $and: [isPaid, done] };
  const paidOpen = { $and: [isPaid, open] };

  const [payAgg, wdAgg, coAgg] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          gross: sumIf(isPaid, "$amount"),
          refunded: sumIf(isRefunded, "$amount"),
          grossProfit: sumIf(paidDone, "$platformFee"),
          heldProfit: sumIf(paidOpen, "$platformFee"),
          heldAmount: sumIf(paidOpen, "$amount"),
          mentorEarned: sumIf(paidDone, "$mentorEarning"),
          // Razorpay keeps its fee even when we refund, so refunded rows count too
          gatewayCost: sumIf({ $or: [isPaid, isRefunded] }, "$gatewayFee"),
          estimatedRows: sumIf(
            { $and: [{ $or: [isPaid, isRefunded] }, { $eq: ["$feeEstimated", true] }] },
            1
          ),
        },
      },
    ]),
    Withdrawal.aggregate([{ $group: { _id: "$status", total: { $sum: "$amount" } } }]),
    CompanyPayout.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  const p = payAgg[0] || {};
  const wd = { requested: 0, paid: 0, rejected: 0 };
  wdAgg.forEach((r) => {
    if (wd[r._id] !== undefined) wd[r._id] = r.total;
  });

  const netProfit = round2((p.grossProfit || 0) - (p.gatewayCost || 0));
  const companyTaken = round2(coAgg[0] ? coAgg[0].total : 0);
  const mentorOwed = round2(Math.max((p.mentorEarned || 0) - wd.paid - wd.requested, 0));

  return {
    count: p.count || 0,
    gross: round2(p.gross),
    refunded: round2(p.refunded),
    grossProfit: round2(p.grossProfit),
    gatewayCost: round2(p.gatewayCost),
    estimatedRows: p.estimatedRows || 0,
    netProfit,
    companyTaken,
    profitAvailable: round2(Math.max(netProfit - companyTaken, 0)),
    heldProfit: round2(p.heldProfit),
    heldAmount: round2(p.heldAmount),
    mentorEarned: round2(p.mentorEarned),
    mentorPaid: round2(wd.paid),
    mentorRequested: round2(wd.requested),
    mentorOwed,
    // money that must STAY in the bank: mentors' money + refundable money
    mustKeep: round2(mentorOwed + wd.requested + (p.heldAmount || 0)),
  };
};

const getTopMentors = (limit = 10) =>
  Payment.aggregate([
    { $match: { status: "paid", sessionStatus: "completed", mentor: { $ne: null } } },
    { $group: { _id: "$mentor", earned: { $sum: "$mentorEarning" }, fee: { $sum: "$platformFee" }, sessions: { $sum: 1 } } },
    { $lookup: { from: "mentors", localField: "_id", foreignField: "_id", as: "m" } },
    { $unwind: "$m" },
    { $project: { name: "$m.name", email: "$m.email", earned: 1, fee: 1, sessions: 1 } },
    { $sort: { earned: -1 } },
    { $limit: limit },
  ]);

module.exports = { getFinanceSummary, getTopMentors, round2 };