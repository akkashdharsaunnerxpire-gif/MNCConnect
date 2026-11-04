// utils/pricing.js   (NEW FILE)
// Pure helpers (no database): convenience fee maths + gateway amount validation.
//
// CONVENIENCE_FEE_MODE
//   off              -> nothing extra is charged (DEFAULT, safe until you decide)
//   platform         -> WE add the fee to the Razorpay order amount (separate line in our UI)
//   razorpay_bearer  -> Razorpay's own "Convenience Fee Model" (Dashboard -> Settings -> Fee Bearer)
//                       adds the fee at checkout. Order amount stays = session price.
//
// Wallet payments NEVER carry a convenience fee.

const num = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
};

const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise) => Math.round(Number(paise) || 0) / 100;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const MODES = ["off", "platform", "razorpay_bearer"];

const getConfig = () => {
  const m = String(process.env.CONVENIENCE_FEE_MODE || "off").trim().toLowerCase();
  return {
    mode: MODES.includes(m) ? m : "off",
    // Razorpay ~2% + 18% GST on the fee = 2.36% of the amount charged
    percent: num("CONVENIENCE_FEE_PERCENT", 2.36),
    // true  -> fee is grossed up so that (session + fee) - razorpay cost = session
    grossUp: String(process.env.CONVENIENCE_FEE_GROSS_UP || "true").toLowerCase() !== "false",
    minPaise: toPaise(num("CONVENIENCE_FEE_MIN", 0)),
    maxPaise: toPaise(num("CONVENIENCE_FEE_MAX", 100)), // sanity cap per payment (rupees)
    // true -> when a payment is refunded the convenience fee goes back too
    refundable: String(process.env.CONVENIENCE_FEE_REFUNDABLE || "true").toLowerCase() !== "false",
  };
};

const isWalletPayment = (p) =>
  Boolean(p) &&
  (p.method === "wallet" ||
    String(p.razorpayPaymentId || "").startsWith("wallet_pay_") ||
    String(p.razorpayOrderId || "").startsWith("wallet_order_"));

// ---------------------------------------------------------------
// Quote: what the fresher pays for a session price (rupees)
// ---------------------------------------------------------------
const calcConvenienceFee = ({ amount, channel = "razorpay" }) => {
  const cfg = getConfig();
  const sessionPaise = toPaise(amount);

  const base = {
    mode: cfg.mode,
    sessionAmount: toRupees(sessionPaise),
    convenienceFee: 0,
    checkoutAmount: toRupees(sessionPaise), // what the customer pays in total
    orderAmount: toRupees(sessionPaise), // what the Razorpay ORDER is created for
    bearerManaged: false, // true = Razorpay decides the fee at checkout
    eligible: false,
  };

  if (channel === "wallet" || cfg.mode === "off" || sessionPaise <= 0) return base;
  if (cfg.mode === "razorpay_bearer") return { ...base, eligible: true, bearerManaged: true };

  const r = cfg.percent / 100;
  if (!(r > 0 && r < 0.5)) return base;

  let feePaise = Math.ceil(sessionPaise * (cfg.grossUp ? r / (1 - r) : r) - 1e-9);
  feePaise = Math.max(feePaise, cfg.minPaise);
  feePaise = Math.min(feePaise, cfg.maxPaise);

  const total = toRupees(sessionPaise + feePaise);
  return {
    ...base,
    eligible: true,
    convenienceFee: toRupees(feePaise),
    checkoutAmount: total,
    orderAmount: total,
  };
};

// Legacy documents have no checkoutAmount -> it equals amount
const checkoutOf = (p) => (Number(p.checkoutAmount) > 0 ? Number(p.checkoutAmount) : Number(p.amount) || 0);

const convenienceFeeOf = (p) => (isWalletPayment(p) ? 0 : Number(p.convenienceFee) || 0);

// What goes back to the fresher on a refund
const refundableAmountOf = (p) => {
  const { refundable } = getConfig();
  return round2((Number(p.amount) || 0) + (refundable ? convenienceFeeOf(p) : 0));
};

// ---------------------------------------------------------------
// Validate 3 numbers: Razorpay ORDER amount, our STORED amount, and the VERIFIED payment amount
// order / rzPayment are the raw Razorpay objects (amounts in paise)
// ---------------------------------------------------------------
const validateGatewayAmounts = ({ payment, order, rzPayment }) => {
  const cfg = getConfig();
  const orderPaise = Number(order && order.amount);
  const paidPaise = Number(rzPayment && rzPayment.amount);
  const storedOrderPaise = toPaise(Number(payment.orderAmount) > 0 ? payment.orderAmount : payment.amount);

  if (!Number.isFinite(orderPaise) || !Number.isFinite(paidPaise))
    return { ok: false, reason: "Missing amount from gateway" };
  if (rzPayment.order_id && order.id && rzPayment.order_id !== order.id)
    return { ok: false, reason: "Payment belongs to a different order" };
  if (rzPayment.currency && rzPayment.currency !== "INR")
    return { ok: false, reason: `Unexpected currency ${rzPayment.currency}` };
  if (orderPaise !== storedOrderPaise)
    return { ok: false, reason: `Order amount ${orderPaise} differs from stored ${storedOrderPaise}` };

  if (payment.convenienceFeeMode === "razorpay_bearer") {
    const diff = paidPaise - orderPaise;
    if (diff < 0 || diff > cfg.maxPaise)
      return { ok: false, reason: `Bearer fee ${diff} paise is outside the allowed range` };
    return { ok: true, convenienceFee: toRupees(diff), checkoutAmount: toRupees(paidPaise) };
  }

  if (paidPaise !== orderPaise) {
    return {
      ok: false,
      reason:
        `Paid ${paidPaise} paise but order is ${orderPaise}. ` +
        "If Razorpay Fee Bearer is ON in the dashboard, set CONVENIENCE_FEE_MODE=razorpay_bearer.",
    };
  }
  return { ok: true, convenienceFee: round2(payment.convenienceFee || 0), checkoutAmount: toRupees(paidPaise) };
};

module.exports = {
  getConfig,
  toPaise,
  toRupees,
  round2,
  isWalletPayment,
  calcConvenienceFee,
  checkoutOf,
  convenienceFeeOf,
  refundableAmountOf,
  validateGatewayAmounts,
};