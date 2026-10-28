// utils/wallet.js
// Pure functions (no database) so the maths is easy to test.
//
// A payment is "released" (counts as earned) ONLY when the session is completed:
//   - the fresher confirmed it, or
//   - the fresher did not answer and it was auto-confirmed (bookingController.settleCompleted)
// Before that it is "pending". Refunded / cancelled payments never reach here.
//
//   lifetime  = sum of released earnings
//   pending   = sum of earnings whose session is not completed yet
//   available = lifetime - reserved   (reserved = withdrawals requested/paid)

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 25);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const isReleased = (payment) => payment.sessionStatus === "completed";

const computeWallet = (payments, reserved = 0, now = new Date()) => {
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const wallet = {
    available: 0,
    pending: 0,
    lifetime: 0,
    week: 0,
    month: 0,
    withdrawn: round2(reserved),
    completedCount: 0,
    pendingCount: 0,
  };

  for (const p of payments) {
    const earning = Number(p.mentorEarning) || 0;

    if (!isReleased(p)) {
      wallet.pending += earning;
      wallet.pendingCount += 1;
      continue;
    }

    const releasedAt = new Date(p.releasedAt || p.sessionEndsAt || p.paidAt || now);
    wallet.lifetime += earning;
    wallet.completedCount += 1;

    if (releasedAt.getTime() >= weekAgo) wallet.week += earning;
    if (
      releasedAt.getFullYear() === now.getFullYear() &&
      releasedAt.getMonth() === now.getMonth()
    ) {
      wallet.month += earning;
    }
  }

  wallet.lifetime = round2(wallet.lifetime);
  wallet.pending = round2(wallet.pending);
  wallet.week = round2(wallet.week);
  wallet.month = round2(wallet.month);
  wallet.available = round2(Math.max(wallet.lifetime - reserved, 0));
  return wallet;
};

// amount (rupees) -> { fee, earning }
// Done in paise so fee + earning is ALWAYS exactly equal to the amount.
const splitAmount = (amountRupees, percent = PLATFORM_FEE_PERCENT) => {
  const paise = Math.round(Number(amountRupees) * 100);
  const feePaise = Math.round((paise * percent) / 100);
  const earningPaise = paise - feePaise;
  return { fee: feePaise / 100, earning: earningPaise / 100 };
};

module.exports = { PLATFORM_FEE_PERCENT, round2, isReleased, computeWallet, splitAmount };