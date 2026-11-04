
// utils/pricing.js
// Pure helpers (no database):
// 1. Convenience fee calculation
// 2. Razorpay order/payment amount validation
// 3. Wallet payment fee handling
// 4. Refund amount calculation

// ============================================================
// HELPERS
// ============================================================

const num = (name, def) => {
  const raw = process.env[name];

  if (raw === undefined || raw === "") return def;

  const n = Number(raw);

  return Number.isFinite(n) ? n : def;
};

const toPaise = (rupees) =>
  Math.round((Number(rupees) || 0) * 100);

const toRupees = (paise) =>
  Math.round(Number(paise) || 0) / 100;

const round2 = (n) =>
  Math.round((Number(n) || 0) * 100) / 100;

const MODES = ["off", "platform", "razorpay_bearer"];

// ============================================================
// CONFIGURATION
// ============================================================

const getConfig = () => {
  const mode = String(
    process.env.CONVENIENCE_FEE_MODE || "off"
  )
    .trim()
    .toLowerCase();

  return {
    mode: MODES.includes(mode) ? mode : "off",

    // Razorpay approximate fee: 2% + 18% GST
    percent: num("CONVENIENCE_FEE_PERCENT", 2.36),

    grossUp:
      String(
        process.env.CONVENIENCE_FEE_GROSS_UP || "true"
      ).toLowerCase() !== "false",

    minPaise: Math.max(
      0,
      toPaise(num("CONVENIENCE_FEE_MIN", 0))
    ),

    maxPaise: Math.max(
      0,
      toPaise(num("CONVENIENCE_FEE_MAX", 100))
    ),

    refundable:
      String(
        process.env.CONVENIENCE_FEE_REFUNDABLE || "true"
      ).toLowerCase() !== "false",
  };
};

// ============================================================
// WALLET PAYMENT CHECK
// ============================================================

const isWalletPayment = (payment) =>
  Boolean(payment) &&
  (
    payment.method === "wallet" ||
    String(payment.razorpayPaymentId || "").startsWith(
      "wallet_pay_"
    ) ||
    String(payment.razorpayOrderId || "").startsWith(
      "wallet_order_"
    )
  );

// ============================================================
// CONVENIENCE FEE CALCULATION
// ============================================================

const calcConvenienceFee = ({
  amount,
  channel = "razorpay",
}) => {
  const cfg = getConfig();

  const sessionPaise = toPaise(amount);

  const base = {
    mode: cfg.mode,
    sessionAmount: toRupees(sessionPaise),
    convenienceFee: 0,
    checkoutAmount: toRupees(sessionPaise),
    orderAmount: toRupees(sessionPaise),
    bearerManaged: false,
    eligible: false,
  };

  if (
    !Number.isSafeInteger(sessionPaise) ||
    sessionPaise <= 0 ||
    channel === "wallet" ||
    cfg.mode === "off"
  ) {
    return base;
  }

  // Razorpay manages the additional fee.
  if (cfg.mode === "razorpay_bearer") {
    return {
      ...base,
      eligible: true,
      bearerManaged: true,
    };
  }

  const rate = cfg.percent / 100;

  if (!(rate > 0 && rate < 0.5)) {
    return base;
  }

  let feePaise = Math.ceil(
    sessionPaise *
      (cfg.grossUp
        ? rate / (1 - rate)
        : rate) -
      1e-9
  );

  feePaise = Math.max(feePaise, cfg.minPaise);
  feePaise = Math.min(feePaise, cfg.maxPaise);

  if (!Number.isSafeInteger(feePaise) || feePaise < 0) {
    return base;
  }

  const totalPaise = sessionPaise + feePaise;

  if (!Number.isSafeInteger(totalPaise)) {
    return base;
  }

  return {
    ...base,
    eligible: true,
    convenienceFee: toRupees(feePaise),
    checkoutAmount: toRupees(totalPaise),
    orderAmount: toRupees(totalPaise),
  };
};

// ============================================================
// LEGACY PAYMENT SUPPORT
// ============================================================

const checkoutOf = (payment) => {
  if (!payment) return 0;

  return Number(payment.checkoutAmount) > 0
    ? Number(payment.checkoutAmount)
    : Number(payment.amount) || 0;
};

const convenienceFeeOf = (payment) => {
  if (!payment || isWalletPayment(payment)) {
    return 0;
  }

  return Number(payment.convenienceFee) || 0;
};

// ============================================================
// REFUND AMOUNT
// ============================================================

const refundableAmountOf = (payment) => {
  if (!payment) return 0;

  const { refundable } = getConfig();

  const sessionAmount = Number(payment.amount) || 0;

  const fee = refundable
    ? convenienceFeeOf(payment)
    : 0;

  return round2(sessionAmount + fee);
};

// ============================================================
// RAZORPAY GATEWAY AMOUNT VALIDATION
//
// Validates:
// 1. Local payment record exists
// 2. Razorpay order ID matches local order ID
// 3. Razorpay payment belongs to the same order
// 4. Both currencies are INR
// 5. Gateway order amount matches stored order amount
// 6. Captured payment amount matches expected amount
// 7. Bearer-managed fee is within allowed limits
// ============================================================

const validateGatewayAmounts = ({
  payment,
  order,
  rzPayment,
}) => {
  const cfg = getConfig();

  // ----------------------------------------------------------
  // 1. Required objects
  // ----------------------------------------------------------

  if (!payment || !order || !rzPayment) {
    return {
      ok: false,
      reason: "Missing payment verification data",
    };
  }

  // ----------------------------------------------------------
  // 2. Validate local payment details
  // ----------------------------------------------------------

  if (!payment.razorpayOrderId) {
    return {
      ok: false,
      reason: "Local Razorpay order ID is missing",
    };
  }

  const sessionAmount = Number(payment.amount);

  if (
    !Number.isFinite(sessionAmount) ||
    sessionAmount <= 0
  ) {
    return {
      ok: false,
      reason: "Invalid stored session amount",
    };
  }

  // ----------------------------------------------------------
  // 3. Validate Razorpay order ID
  // ----------------------------------------------------------

  if (
    !order.id ||
    order.id !== payment.razorpayOrderId
  ) {
    return {
      ok: false,
      reason: "Razorpay order ID does not match stored order",
    };
  }

  // ----------------------------------------------------------
  // 4. Validate Razorpay payment order ID
  // ----------------------------------------------------------

  if (
    !rzPayment.order_id ||
    rzPayment.order_id !== payment.razorpayOrderId
  ) {
    return {
      ok: false,
      reason: "Payment belongs to a different or invalid order",
    };
  }

  // ----------------------------------------------------------
  // 5. Validate currency
  // ----------------------------------------------------------

  if (
    order.currency !== "INR" ||
    rzPayment.currency !== "INR"
  ) {
    return {
      ok: false,
      reason: "Unexpected or missing payment currency",
    };
  }

  // ----------------------------------------------------------
  // 6. Validate amounts
  // ----------------------------------------------------------

  const orderPaise = Number(order.amount);
  const paidPaise = Number(rzPayment.amount);

  const storedOrderAmount =
    Number(payment.orderAmount) > 0
      ? Number(payment.orderAmount)
      : sessionAmount;

  const storedOrderPaise = toPaise(storedOrderAmount);

  if (
    !Number.isSafeInteger(orderPaise) ||
    !Number.isSafeInteger(paidPaise) ||
    !Number.isSafeInteger(storedOrderPaise) ||
    orderPaise <= 0 ||
    paidPaise <= 0 ||
    storedOrderPaise <= 0
  ) {
    return {
      ok: false,
      reason: "Invalid or missing gateway amount",
    };
  }

  // ----------------------------------------------------------
  // 7. Validate Razorpay order amount against database
  // ----------------------------------------------------------

  if (orderPaise !== storedOrderPaise) {
    return {
      ok: false,
      reason:
        `Gateway order amount ${orderPaise} paise ` +
        `does not match stored amount ${storedOrderPaise} paise`,
    };
  }

  // ----------------------------------------------------------
  // 8. Validate convenience fee configuration
  // ----------------------------------------------------------

  const feeMode = payment.convenienceFeeMode || "none";

  if (
    feeMode === "platform" ||
    feeMode === "none" ||
    feeMode === "off"
  ) {
    const storedFeePaise = toPaise(
      Number(payment.convenienceFee) || 0
    );

    if (storedFeePaise < 0) {
      return {
        ok: false,
        reason: "Invalid stored convenience fee",
      };
    }

    if (
      storedOrderPaise !==
      toPaise(sessionAmount) + storedFeePaise
    ) {
      return {
        ok: false,
        reason:
          "Stored session amount and convenience fee do not match order amount",
      };
    }
  }

  // ----------------------------------------------------------
  // 9. Razorpay bearer-managed convenience fee
  // ----------------------------------------------------------

  if (feeMode === "razorpay_bearer") {
    // Razorpay order should contain only the session amount.
    if (orderPaise !== toPaise(sessionAmount)) {
      return {
        ok: false,
        reason:
          "Bearer-managed order amount must match session amount",
      };
    }

    const difference = paidPaise - orderPaise;

    if (
      difference < 0 ||
      difference > cfg.maxPaise
    ) {
      return {
        ok: false,
        reason:
          `Bearer fee ${difference} paise is outside the allowed range`,
      };
    }

    return {
      ok: true,
      convenienceFee: toRupees(difference),
      checkoutAmount: toRupees(paidPaise),
    };
  }

  // ----------------------------------------------------------
  // 10. Normal payment amount validation
  // ----------------------------------------------------------

  if (paidPaise !== orderPaise) {
    return {
      ok: false,
      reason:
        `Paid ${paidPaise} paise but order is ${orderPaise}. ` +
        "If Razorpay Fee Bearer is enabled, configure " +
        "CONVENIENCE_FEE_MODE=razorpay_bearer.",
    };
  }

  return {
    ok: true,
    convenienceFee: round2(
      Number(payment.convenienceFee) || 0
    ),
    checkoutAmount: toRupees(paidPaise),
  };
};

// ============================================================
// EXPORTS
// ============================================================

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
