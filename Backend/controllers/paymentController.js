// controllers/paymentController.js
//
// Razorpay createOrder / verifyPayment keep the SAME request shape (createOrder still returns the
// Razorpay order object, plus an extra `breakdown` field).
// payWithWallet  -> pay a session fully from the fresher's wallet balance (NO convenience fee).
//
// Extra exports used by other controllers / routes:
//   linkPaymentToRequest(...)   call when a session request is created
//   assignMentorToRequest(...)  call when a mentor accepts a request
//   claimPayment(...)           NEW: atomically claim a paid payment for ONE booking / join
//   reconcileStaleOrders()      NEW: scheduler job (captured-but-unverified, failed, abandoned)
//   quoteFee                    NEW: GET /payments/fee-quote?amount=
//   razorpayWebhook             NEW (optional): POST /payments/webhook  (needs express.raw)

const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Fresher = require("../models/Fresher");
const { optionalAuth } = require("../middleware/panelAuth");
const { notify, emitToUser } = require("../utils/realtime");
const { buildSessionFields } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");
const {
  calcConvenienceFee,
  getConfig,
  validateGatewayAmounts,
  toPaise,
  toRupees,
  round2,
} = require("../utils/pricing");

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 25);

// ============================================================
// HELPERS
// ============================================================

let razorpay = null;

const getRazorpay = () => {
  if (razorpay) return razorpay;

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }

  razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return razorpay;
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Logged-in fresher (if the request carries a token), else null
const currentFresher = async (req) => {
  try {
    optionalAuth(req, null, () => {});
    if (!req.user || req.user.role !== "fresher") return null;
    return await Fresher.findById(req.user.id).select("name email").lean();
  } catch (_) {
    return null;
  }
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// run an async call up to `tries` times (network hiccups while talking to Razorpay)
const withRetry = async (fn, tries = 2) => {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
};

// ============================================================
// FEE QUOTE   GET /api/payments/fee-quote?amount=400
// ============================================================

exports.quoteFee = (req, res) => {
  const amount = round2(Number(req.query.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }
  return res.json({
    success: true,
    ...calcConvenienceFee({ amount, channel: "razorpay" }),
    walletFee: 0, // wallet payments never carry a convenience fee
  });
};

// ============================================================
// 1. CREATE ORDER   POST /api/payments/create-order  { amount, ...optional }
//    `amount` = ORIGINAL SESSION PRICE (rupees). The server adds the convenience fee itself.
// ============================================================

exports.createOrder = async (req, res) => {
  try {
    const body = req.body || {};
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Server-side calculation only. Never trust frontend fee values.
    const quote = calcConvenienceFee({
      amount,
      channel: "razorpay",
    });

    const orderAmountPaise = toPaise(quote.orderAmount);

    if (orderAmountPaise <= 0) {
      return res.status(400).json({ message: "Invalid checkout amount" });
    }

    const receipt = `receipt_${Date.now()}`;
    const fresher = await currentFresher(req);

    const { fee, earning } = splitAmount(
      amount,
      PLATFORM_FEE_PERCENT,
    );

    // Create the order.
    const order = await getRazorpay().orders.create({
      amount: orderAmountPaise,
      currency: "INR",
      receipt,
    });

    // Save the payment record BEFORE returning the order to frontend.
    try {
      await Payment.create({
        razorpayOrderId: order.id,
        receipt: order.receipt || receipt,

        // Original session price. Never include convenience fee here.
        amount,

        currency: order.currency || "INR",

        // Existing mentor/platform split remains unchanged.
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,

        // Separate convenience fee accounting.
        convenienceFeeMode: quote.bearerManaged
          ? "razorpay_bearer"
          : quote.convenienceFee > 0
            ? "platform"
            : "none",

        convenienceFee: quote.convenienceFee,
        checkoutAmount: quote.checkoutAmount,
        orderAmount: quote.orderAmount,

        gatewayFeeCollected: 0,
        convenienceFeeRefunded: 0,

        amountVerified: false,
        verifyRejected: false,

        status: "created",

        fresher: fresher ? fresher._id : null,
        fresherName: fresher ? fresher.name : "",
        fresherEmail: fresher ? fresher.email : "",

        topic: body.topic
          ? String(body.topic).slice(0, 120)
          : "",

        requestGroupId: body.requestGroupId
          ? String(body.requestGroupId)
          : "",

        ...(body.requestGroupId
          ? buildSessionFields({
              date: body.date,
              time: body.time,
              duration: body.duration,
            })
          : {}),
      });
    } catch (dbError) {
      console.error(
        "Payment record save failed:",
        order.id,
        dbError.message,
      );

      // Do not send an unusable order to the frontend.
      return res.status(500).json({
        success: false,
        message: "Unable to prepare payment. Please try again.",
      });
    }

    return res.json({
      ...order,
      sessionAmount: amount,
      convenienceFee: quote.convenienceFee,
      checkoutAmount: quote.checkoutAmount,
      convenienceFeeMode: quote.bearerManaged
        ? "razorpay_bearer"
        : quote.convenienceFee > 0
          ? "platform"
          : "none",
      // Keep both the legacy top-level fields and a structured breakdown.
      // Session amount remains the original amount used for mentor/platform split.
      breakdown: {
        sessionAmount: amount,
        convenienceFee: quote.convenienceFee,
        checkoutAmount: quote.checkoutAmount,
        convenienceFeeMode: quote.bearerManaged
          ? "razorpay_bearer"
          : quote.convenienceFee > 0
            ? "platform"
            : "none",
      },
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Razorpay order creation failed",
    });
  }
};

// ============================================================
// SHARED: turn a verified Razorpay payment into a "paid" Payment (atomic, idempotent)
// used by verifyPayment, the reconcile job and the webhook
// returns { ok, duplicate?, rejected?, pending?, payment?, reason? }
// ============================================================

const rejectMismatch = async (payment, rzPayment, reason) => {
  console.error("PAYMENT AMOUNT MISMATCH:", {
    order: payment.razorpayOrderId,
    payment: rzPayment && rzPayment.id,
    reason,
  });

  await Payment.updateOne(
    { _id: payment._id, status: { $in: ["created", "failed"] } },
    {
      $set: {
        status: "failed",
        verifyRejected: true,
        failureReason: `AMOUNT_MISMATCH: ${reason}`.slice(0, 200),
        ...(rzPayment && rzPayment.id ? { razorpayPaymentId: rzPayment.id } : {}),
      },
    }
  ).catch(() => {});

  // money was really captured for a wrong amount -> give exactly that back
  if (rzPayment && rzPayment.status === "captured" && rzPayment.id) {
    try {
      await getRazorpay().payments.refund(rzPayment.id, {
        amount: Number(rzPayment.amount),
        speed: "normal",
        notes: { reason: "amount mismatch" },
      });
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            refundMethod: "original",
            refundedAt: new Date(),
            refundAmount: toRupees(rzPayment.amount),
          },
        }
      );
    } catch (e) {
      console.error("Mismatch refund FAILED (do it manually):", rzPayment.id, e?.error?.description || e.message);
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { refundError: String(e?.error?.description || e.message).slice(0, 300), refundFailedAt: new Date() } }
      ).catch(() => {});
    }
  }
};
const settleGatewayPayment = async ({ payment, order, paymentId, signature = "", fresher = null }) => {
  let rzPayment = null;
  try {
    rzPayment = await withRetry(() => getRazorpay().payments.fetch(paymentId), 2);
  } catch (e) {
    console.error("payments.fetch failed:", paymentId, e?.error?.description || e.message);
  }

  // auto-capture OFF? capture now (amount must match what was authorised)
  if (rzPayment && rzPayment.status === "authorized") {
    try {
      await getRazorpay().payments.capture(paymentId, Number(rzPayment.amount), "INR");
      rzPayment = await getRazorpay().payments.fetch(paymentId);
    } catch (e) {
      console.error("capture failed:", paymentId, e?.error?.description || e.message);
    }
  }
  if (rzPayment && rzPayment.status !== "captured") {
    return { ok: false, pending: true, reason: `Payment is ${rzPayment.status}` };
  }

  const stored = payment.toObject ? payment.toObject() : payment;
  let convenienceFee = Number(stored.convenienceFee) || 0;
  let checkoutAmount = Number(stored.checkoutAmount) > 0 ? Number(stored.checkoutAmount) : Number(stored.amount);
  let amountVerified = false;

  if (rzPayment && order) {
    const check = validateGatewayAmounts({ payment: stored, order, rzPayment });
    if (!check.ok) {
      await rejectMismatch(payment, rzPayment, check.reason);
      return { ok: false, rejected: true, reason: check.reason };
    }
    convenienceFee = check.convenienceFee;
    checkoutAmount = check.checkoutAmount;
    amountVerified = true;
  }
  // (if Razorpay could not be reached the signature still binds this payment to OUR fixed order,
  //  so it is accepted as paid and amountVerified stays false until "Sync fees" re-checks it)

  // ---- what Razorpay charged us ----
  let gatewayFee = 0;
  let gatewayTax = 0;
  let feeEstimated = false;
  if (rzPayment && rzPayment.fee !== null && rzPayment.fee !== undefined) {
    gatewayFee = Number(rzPayment.fee) / 100; // already includes GST
    gatewayTax = Number(rzPayment.tax || 0) / 100;
  } else {
    const pct = Number(process.env.RAZORPAY_FEE_PERCENT || 2);
    gatewayFee = round2(checkoutAmount * (pct / 100) * 1.18); // estimate on what Razorpay really processed
    feeEstimated = true;
  }

  const set = {
    status: "paid",
    failureReason: "",
    razorpayPaymentId: paymentId,
    paidAt: new Date(),
    checkoutAmount,
    convenienceFee,
    gatewayFeeCollected: convenienceFee, // collected = what the customer paid on top
    amountVerified,
    gatewayFee,
    gatewayTax,
    feeEstimated,
    gatewayFeeSyncedAt: feeEstimated ? null : new Date(),
    ...(signature ? { razorpaySignature: signature } : {}),
    ...(rzPayment
      ? {
          method: rzPayment.method || "",
          payerEmail: rzPayment.email || "",
          payerContact: rzPayment.contact || "",
        }
      : {}),
    ...(fresher && !payment.fresher
      ? { fresher: fresher._id, fresherName: fresher.name, fresherEmail: fresher.email }
      : {}),
  };

  // ATOMIC: only ONE caller can move created/failed -> paid. A refunded / rejected payment can never become paid again.
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["created", "failed"] }, verifyRejected: { $ne: true } },
    { $set: set },
    { returnDocument: "after" }
  );

  if (!updated) {
    const cur = await Payment.findById(payment._id);
    return { ok: Boolean(cur && cur.status === "paid"), duplicate: true, payment: cur };
  }

  if (updated.fresher) {
    notify({
      user: updated.fresher,
      role: "fresher",
      title: "Payment successful",
      message:
        updated.convenienceFee > 0
          ? `We received ${rupees(updated.checkoutAmount)} (session ${rupees(updated.amount)} + convenience fee ${rupees(updated.convenienceFee)}). Your session request is on its way to mentors.`
          : `We received ${rupees(updated.amount)}. Your session request is on its way to mentors.`,
      type: "payment",
    });
  }

  return { ok: true, payment: updated };
};

// ============================================================
// 2. VERIFY PAYMENT   POST /api/payments/verify-payment
//    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ============================================================

exports.verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body || {};

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing payment details",
    });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Payment gateway is not configured",
    });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (!safeEqual(expected, razorpay_signature)) {
    await Payment.updateOne(
      {
        razorpayOrderId: razorpay_order_id,
        status: "created",
      },
      {
        $set: {
          status: "failed",
          failureReason: "Invalid payment signature",
        },
      },
    ).catch(() => {});

    return res.status(400).json({
      success: false,
      message: "Invalid payment signature",
    });
  }

  try {
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      console.error(
        "Verified Razorpay payment has no local Payment record:",
        razorpay_order_id,
      );

      return res.status(409).json({
        success: false,
        message: "Payment record missing. Please contact support.",
      });
    }

    // Idempotency: already verified payments should not be processed again.
    if (payment.status === "paid" && payment.amountVerified) {
      return res.json({
        success: true,
        paymentId: payment.razorpayPaymentId,
      });
    }

    const [order, details] = await Promise.all([
      getRazorpay().orders.fetch(razorpay_order_id),
      getRazorpay().payments.fetch(razorpay_payment_id),
    ]);

    if (details.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured yet.",
      });
    }

    const validation = validateGatewayAmounts({
      payment,
      order,
      rzPayment: details,
    });

    if (!validation.ok) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            verifyRejected: true,
            failureReason: validation.reason,
          },
        },
      );

      console.error("PAYMENT AMOUNT VALIDATION FAILED:", {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        reason: validation.reason,
      });

      return res.status(400).json({
        success: false,
        message: "Payment amount verification failed. Please contact support.",
      });
    }

    const fresher = payment.fresher
      ? null
      : await currentFresher(req);

    payment.status = "paid";
    payment.failureReason = "";
    payment.verifyRejected = false;

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();

    payment.amountVerified = true;

    // Keep original session price unchanged.
    // Update only separately tracked convenience fee values.
    if (payment.convenienceFeeMode === "razorpay_bearer") {
      payment.convenienceFee = validation.convenienceFee;
    }

    payment.checkoutAmount = validation.checkoutAmount;

    if (fresher) {
      payment.fresher = fresher._id;
      payment.fresherName = fresher.name;
      payment.fresherEmail = fresher.email;
    }

    payment.method = details.method || "";
    payment.payerEmail = details.email || "";
    payment.payerContact = details.contact || "";

    // Razorpay fee includes GST.
    if (details.fee !== null && details.fee !== undefined) {
      payment.gatewayFee = toRupees(details.fee);
      payment.gatewayTax = toRupees(details.tax || 0);
      payment.feeEstimated = false;
    } else {
      const pct = Number(process.env.RAZORPAY_FEE_PERCENT || 2);

      payment.gatewayFee =
        Math.round(
          payment.amount * (pct / 100) * 1.18 * 100,
        ) / 100;

      payment.feeEstimated = true;
    }

    payment.gatewayFeeCollected = payment.convenienceFee || 0;

    await payment.save();

    if (payment.fresher) {
      notify({
        user: payment.fresher,
        role: "fresher",
        title: "Payment successful",
        message: `We received ${rupees(payment.checkoutAmount)}. Your session request is on its way to mentors.`,
        type: "payment",
      });
    }

    return res.json({
      success: true,
      paymentId: razorpay_payment_id,
      sessionAmount: payment.amount,
      convenienceFee: payment.convenienceFee,
      checkoutAmount: payment.checkoutAmount,
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify payment. Please contact support if money was deducted.",
    });
  }
};
// ============================================================
// 2b. PAY WITH WALLET   POST /api/payments/pay-with-wallet   (fresher)
//     { amount, topic, requestGroupId, date, time, duration }
//     NO convenience fee, NO gateway fee.
// ============================================================

exports.payWithWallet = async (req, res) => {
  try {
    const body = req.body || {};
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const fresherId = req.user.id;

    // atomic: only deducts if the balance covers the full amount
    const fresher = await Fresher.findOneAndUpdate(
      { _id: fresherId, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true }
    );

    if (!fresher) {
      return res.status(402).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);
    const paymentId = `wallet_pay_${new mongoose.Types.ObjectId()}`;
    const orderId = `wallet_order_${new mongoose.Types.ObjectId()}`;

    try {
      const payment = await Payment.create({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amount,
        currency: "INR",
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,
        convenienceFeeMode: "none",
        convenienceFee: 0,
        checkoutAmount: amount,
        orderAmount: amount,
        gatewayFeeCollected: 0,
        convenienceFeeRefunded: 0,
        gatewayFee: 0,
        gatewayTax: 0,
        feeEstimated: false,
        amountVerified: true,
        verifyRejected: false,
        method: "wallet",
        status: "paid",
        paidAt: new Date(),
        fresher: fresher._id,
        fresherName: fresher.name || "",
        fresherEmail: fresher.email || "",
        topic: body.topic ? String(body.topic).slice(0, 120) : "",
        requestGroupId: body.requestGroupId ? String(body.requestGroupId) : "",
        ...(body.requestGroupId
          ? buildSessionFields({
              date: body.date,
              time: body.time,
              duration: body.duration,
            })
          : {}),
      });

      return res.json({
        success: true,
        paymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        checkoutAmount: payment.checkoutAmount,
        walletBalance: fresher.walletBalance,
      });
    } catch (dbError) {
      // Restore the wallet if the payment record could not be created.
      await Fresher.updateOne(
        { _id: fresherId },
        { $inc: { walletBalance: amount } },
      ).catch((e) => console.error("Wallet rollback failed:", e.message));

      console.error("Wallet payment record save failed:", dbError);
      return res.status(500).json({
        success: false,
        message: "Unable to complete wallet payment. Your balance was restored if possible.",
      });
    }
  } catch (error) {
    console.error("Wallet payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process wallet payment",
    });
  }
};

// ============================================================
// 3. LINK PAYMENT TO REQUEST
// ============================================================

exports.linkPaymentToRequest = async (paymentId, requestGroupId) => {
  if (!paymentId || !requestGroupId) return null;

  return Payment.findOneAndUpdate(
    {
      $or: [
        { razorpayPaymentId: paymentId },
        { razorpayOrderId: paymentId },
      ],
    },
    { $set: { requestGroupId: String(requestGroupId) } },
    { new: true },
  );
};

// ============================================================
// 4. ASSIGN MENTOR TO REQUEST
// ============================================================

exports.assignMentorToRequest = async (paymentId, mentorId) => {
  if (!paymentId || !mentorId) return null;

  return Payment.findOneAndUpdate(
    {
      $or: [
        { razorpayPaymentId: paymentId },
        { razorpayOrderId: paymentId },
      ],
    },
    { $set: { mentor: mentorId } },
    { new: true },
  );
};

// ============================================================
// 5. CLAIM PAYMENT
//     A paid payment can be claimed by only one booking / join.
// ============================================================

exports.claimPayment = async (paymentId, bookingId) => {
  if (!paymentId || !bookingId) return null;

  return Payment.findOneAndUpdate(
    {
      $or: [
        { razorpayPaymentId: paymentId },
        { razorpayOrderId: paymentId },
      ],
      status: "paid",
      $or: [
        { claimedBy: { $exists: false } },
        { claimedBy: null },
        { claimedBy: "" },
        { claimedBy: String(bookingId) },
      ],
    },
    { $set: { claimedBy: String(bookingId) } },
    { new: true },
  );
};

// ============================================================
// 6. RAZORPAY WEBHOOK
//     Configure express.raw({ type: "application/json" }) for this route.
// ============================================================

exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || !signature) {
      return res.status(400).json({
        success: false,
        message: "Webhook configuration missing",
      });
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (!safeEqual(expected, signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(body.toString("utf8"));
    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity?.id || !paymentEntity?.order_id) {
      return res.json({ success: true, ignored: true });
    }

    if (
      event.event === "payment.captured" ||
      event.event === "order.paid"
    ) {
      const payment = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      });

      if (payment && payment.status !== "paid") {
        const order = await getRazorpay().orders.fetch(paymentEntity.order_id);

        await settleGatewayPayment({
          payment,
          order,
          paymentId: paymentEntity.id,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// ============================================================
// 7. RECONCILE STALE ORDERS
//     Call this from your existing scheduler.
// ============================================================

exports.reconcileStaleOrders = async () => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);

    const stalePayments = await Payment.find({
      status: { $in: ["created", "failed"] },
      verifyRejected: { $ne: true },
      createdAt: { $lte: cutoff },
      razorpayOrderId: { $exists: true, $ne: "" },
      razorpayOrderId: { $not: /^wallet_order_/ },
    }).limit(100);

    let processed = 0;
    let pending = 0;
    let failed = 0;

    for (const payment of stalePayments) {
      try {
        const order = await getRazorpay().orders.fetch(payment.razorpayOrderId);
        const payments = await getRazorpay().orders.fetchPayments(payment.razorpayOrderId);
        const items = Array.isArray(payments?.items) ? payments.items : [];

        const captured = items.find((p) => p.status === "captured");
        const authorized = items.find((p) => p.status === "authorized");

        const candidate = captured || authorized;

        if (!candidate) {
          pending += 1;
          continue;
        }

        const result = await settleGatewayPayment({
          payment,
          order,
          paymentId: candidate.id,
        });

        if (result.ok) processed += 1;
        else if (result.pending) pending += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          "Stale payment reconciliation failed:",
          payment.razorpayOrderId,
          error?.error?.description || error.message,
        );
      }
    }

    return {
      success: true,
      checked: stalePayments.length,
      processed,
      pending,
      failed,
    };
  } catch (error) {
    console.error("reconcileStaleOrders error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// ============================================================
// 8. EXPORT HELPERS FOR OTHER CONTROLLERS
// ============================================================

exports.getRazorpay = getRazorpay;
exports.settleGatewayPayment = settleGatewayPayment;
exports.rejectMismatch = rejectMismatch;