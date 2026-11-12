// utils/walletLedger.js
// All wallet money movement goes through here.
//   refundableBalance = real cash we owe (refunds)
//   bonusBalance      = promo credit (welcome bonus etc.)  -> NOT cash
//   referralBalance   = referral credit                    -> NOT cash
// Spend order: bonus -> referral -> refundable (promo money is used first).
const Fresher = require("../models/Fresher");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const n0 = (v) => Number(v) || 0;

const planDebit = (f, amount) => {
  let left = round2(amount);
  const plan = { bonus: 0, referral: 0, refundable: 0 };

  plan.bonus = round2(Math.min(n0(f.bonusBalance), left));
  left = round2(left - plan.bonus);

  plan.referral = round2(Math.min(n0(f.referralBalance), left));
  left = round2(left - plan.referral);

  plan.refundable = round2(Math.min(n0(f.refundableBalance), left));
  left = round2(left - plan.refundable);

  return { plan, short: left };
};

// Atomic debit (optimistic: the filter re-checks every bucket, so it can never go negative).
// Pass a mongoose `session` to run inside a transaction.
// returns { ok:true, plan } | { ok:false, reason:"INSUFFICIENT"|"BUSY"|"NOT_FOUND" }
const debitWallet = async (fresherId, amount, session = null) => {
  amount = round2(amount);
  if (!(amount > 0)) return { ok: false, reason: "INSUFFICIENT" };

  for (let i = 0; i < 4; i++) {
    const f = await Fresher.findById(fresherId)
      .select("refundableBalance bonusBalance referralBalance")
      .session(session)
      .lean();
    if (!f) return { ok: false, reason: "NOT_FOUND" };

    const { plan, short } = planDebit(f, amount);
    if (short > 0.001) return { ok: false, reason: "INSUFFICIENT" };

    const filter = { _id: fresherId };
    const inc = {};
    if (plan.bonus > 0) {
      filter.bonusBalance = { $gte: plan.bonus };
      inc.bonusBalance = -plan.bonus;
    }
    if (plan.referral > 0) {
      filter.referralBalance = { $gte: plan.referral };
      inc.referralBalance = -plan.referral;
    }
    if (plan.refundable > 0) {
      filter.refundableBalance = { $gte: plan.refundable };
      inc.refundableBalance = -plan.refundable;
    }

    const r = await Fresher.updateOne(filter, { $inc: inc }, { session });
    if (r.modifiedCount === 1) return { ok: true, plan };
    // balance changed between read and write -> retry
  }
  return { ok: false, reason: "BUSY" };
};

// credit = { bonus, referral, refundable }  (any missing = 0)
const creditWallet = async (fresherId, credit = {}, session = null) => {
  const inc = {};
  if (n0(credit.bonus) > 0) inc.bonusBalance = round2(credit.bonus);
  if (n0(credit.referral) > 0) inc.referralBalance = round2(credit.referral);
  if (n0(credit.refundable) > 0) inc.refundableBalance = round2(credit.refundable);
  if (!Object.keys(inc).length) return;
  await Fresher.updateOne({ _id: fresherId }, { $inc: inc }, { session });
};

module.exports = { debitWallet, creditWallet, planDebit, round2 };