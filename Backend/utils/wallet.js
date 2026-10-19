// utils/wallet.js
// Pure functions (no database) so the maths is easy to test.
//
// A payment is "released" (counts as earned) once its session has ended.
// Before that it is "pending" (clearing after the session).
//
//   lifetime  = sum of released earnings
//   pending   = sum of earnings whose session has not ended yet
//   available = lifetime - reserved   (reserved = withdrawals requested/paid)

const isReleased = (payment, now = new Date()) =>
  Boolean(payment.sessionEndsAt) && new Date(payment.sessionEndsAt).getTime() <= now.getTime();

const computeWallet = (payments, reserved = 0, now = new Date()) => {
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const wallet = {
    available: 0,
    pending: 0,
    lifetime: 0,
    week: 0,
    month: 0,
    withdrawn: reserved,
    completedCount: 0,
    pendingCount: 0,
  };

  for (const p of payments) {
    const earning = Number(p.mentorEarning) || 0;

    if (!isReleased(p, now)) {
      wallet.pending += earning;
      wallet.pendingCount += 1;
      continue;
    }

    const endedAt = new Date(p.sessionEndsAt);
    wallet.lifetime += earning;
    wallet.completedCount += 1;

    if (endedAt.getTime() >= weekAgo) wallet.week += earning;
    if (endedAt.getFullYear() === now.getFullYear() && endedAt.getMonth() === now.getMonth()) {
      wallet.month += earning;
    }
  }

  wallet.available = wallet.lifetime - reserved;
  return wallet;
};

// amount (rupees) -> { fee, earning }. The mentor share is rounded to a whole
// rupee, exactly like the mentor dashboard shows it.
const splitAmount = (amount, feePercent) => {
  const earning = Math.round((amount * (100 - feePercent)) / 100);
  const fee = Math.round((amount - earning) * 100) / 100;
  return { fee, earning };
};

module.exports = { isReleased, computeWallet, splitAmount };