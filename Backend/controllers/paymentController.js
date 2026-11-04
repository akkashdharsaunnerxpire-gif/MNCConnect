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
    const amount = round2(Number(body.amount));

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const fee = calcConvenienceFee({ amount, channel: "razorpay" });
    const modeStored = fee.mode === "off" ? "none" : fee.mode;

    const order = await getRazorpay().orders.create({
      amount: toPaise(fee.orderAmount), // paise, always an integer
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        sessionAmount: String(amount),
        convenienceFee: String(fee.convenienceFee),
        convenienceFeeMode: modeStored,
      },
    });

    // The stored record is now REQUIRED: verifyPayment compares against it.
    // If we cannot save it, we do not hand the order to the browser (nothing was paid yet).
    try {
      const fresher = await currentFresher(req);
      const { fee: platformFee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT); // session price ONLY

      await Payment.create({
        razorpayOrderId: order.id,
        receipt: order.receipt || "",
        amount,
        currency: order.currency || "INR",
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee,
        mentorEarning: earning,
        convenienceFeeMode: modeStored,
        convenienceFee: fee.convenienceFee,
        checkoutAmount: fee.checkoutAmount,
        orderAmount: fee.orderAmount,
        status: "created",
        fresher: fresher ? fresher._id : null,
        fresherName: fresher ? fresher.name : "",
        fresherEmail: fresher ? fresher.email : "",
        topic: body.topic ? String(body.topic).slice(0, 120) : "",
        requestGroupId: body.requestGroupId ? String(body.requestGroupId) : "",
        ...(body.requestGroupId
          ? buildSessionFields({ date: body.date, time: body.time, duration: body.duration })
          : {}),
      });
    } catch (dbError) {
      console.error("Payment record not saved, order NOT returned:", dbError.message);
      return res.status(500).json({ message: "Could not start the payment. Please try again." });
    }

    return res.json({
      ...order,
      breakdown: {
        sessionAmount: fee.sessionAmount,
        convenienceFee: fee.convenienceFee,
        checkoutAmount: fee.checkoutAmount,
        mode: fee.mode,
        bearerManaged: fee.bearerManaged,
      },
    });
  } catch (error) {
    console.error("Create order error:", error.message);
    return res.status(500).json({ message: "Razorpay order creation failed" });
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "Missing payment details" });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Payment gateway is not configured" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  // ---------- invalid signature ----------
  if (!safeEqual(expected, razorpay_signature)) {
    try {
      await Payment.updateOne(
        { razorpayOrderId: razorpay_order_id, status: "created" },
        { $set: { status: "failed", failureReason: "Invalid payment signature" } }
      );
    } catch (_) { /* ignore */ }

    return res.status(400).json({ success: false, message: "Invalid payment signature" });
  }

  // ---------- valid signature ----------
  try {
    let payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });

    // ---- duplicate / replayed verification ----
    if (payment && payment.status === "paid") {
      if (payment.razorpayPaymentId === razorpay_payment_id) {
        return res.json({ success: true, paymentId: razorpay_payment_id, duplicate: true });
      }
      return res.status(409).json({ success: false, message: "This order is already paid with another payment." });
    }
    if (payment && payment.status === "refunded") {
      return res.status(409).json({ success: false, message: "This payment was already refunded." });
    }
    if (payment && payment.verifyRejected) {
      return res.status(400).json({ success: false, message: "This payment was rejected and refunded." });
    }

    // ---- the Razorpay ORDER (source of truth for the order amount) ----
    let order = null;
    try {
      order = await withRetry(() => getRazorpay().orders.fetch(razorpay_order_id), 2);
    } catch (e) {
      console.error("orders.fetch failed:", razorpay_order_id, e?.error?.description || e.message);
    }

    // old orders that never got a record: rebuild one from the order itself
    if (!payment) {
      if (!order) {
        return res.status(502).json({ success: false, message: "Could not confirm the payment right now. Please retry in a moment." });
      }
      const notes = order.notes || {};
      const sessionAmount = Number(notes.sessionAmount) > 0 ? Number(notes.sessionAmount) : toRupees(order.amount);
      const fee = Number(notes.convenienceFee) || 0;
      const { fee: platformFee, earning } = splitAmount(sessionAmount, PLATFORM_FEE_PERCENT);
      try {
        payment = await Payment.create({
          razorpayOrderId: razorpay_order_id,
          amount: sessionAmount,
          currency: order.currency || "INR",
          platformFeePercent: PLATFORM_FEE_PERCENT,
          platformFee,
          mentorEarning: earning,
          convenienceFeeMode: notes.convenienceFeeMode || "none",
          convenienceFee: fee,
          checkoutAmount: toRupees(order.amount),
          orderAmount: toRupees(order.amount),
        });
      } catch (e) {
        payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id }); // created by a parallel call
        if (!payment) throw e;
      }
    }

    // Razorpay unreachable for the order: use OUR stored order amount (signature already ties payment to our order)
    if (!order) {
      order = {
        id: razorpay_order_id,
        amount: toPaise(payment.orderAmount > 0 ? payment.orderAmount : payment.amount),
      };
    }

    const fresher = payment.fresher ? null : await currentFresher(req);
    const result = await settleGatewayPayment({
      payment,
      order,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      fresher,
    });

    if (result.rejected) {
      return res.status(400).json({
        success: false,
        code: "AMOUNT_MISMATCH",
        message: "The paid amount did not match the order. It is being refunded automatically.",
      });
    }
    if (result.pending) {
      return res.status(409).json({ success: false, message: `Payment is not completed yet (${result.reason}).` });
    }
    if (!result.ok) {
      return res.status(409).json({ success: false, message: "This payment cannot be used." });
    }
  } catch (dbError) {
    // keep the old behaviour: the signature is valid, the money is real. The reconcile job completes the record.
    console.error("PAYMENT VERIFIED BUT NOT SAVED:", razorpay_payment_id, dbError.message);
  }

  return res.json({ success: true, paymentId: razorpay_payment_id });
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
      { returnDocument: "after" }
    ).select("name email walletBalance");

    if (!fresher) {
      const current = await Fresher.findById(fresherId).select("walletBalance").lean();
      const balance = Number(current?.walletBalance) || 0;

      return res.status(400).json({
        success: false,
        code: "INSUFFICIENT_WALLET",
        message: `Insufficient wallet balance. You have ${rupees(balance)} but this session needs ${rupees(amount)}.`,
        balance,
        required: amount,
        shortBy: Math.max(amount - balance, 0),
      });
    }

    const ref = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);

    let payment;
    try {
      payment = await Payment.create({
        razorpayOrderId: `wallet_order_${ref}`,
        razorpayPaymentId: `wallet_pay_${ref}`,
        receipt: `wallet_${ref}`,
        amount,
        currency: "INR",
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,
        // wallet: no convenience fee, no Razorpay cost
        convenienceFeeMode: "none",
        convenienceFee: 0,
        checkoutAmount: amount,
        orderAmount: amount,
        gatewayFeeCollected: 0,
        gatewayFee: 0,
        gatewayTax: 0,
        feeEstimated: false,
        amountVerified: true,
        status: "paid",
        method: "wallet",
        paidAt: new Date(),
        fresher: fresher._id,
        fresherName: fresher.name || "",
        fresherEmail: fresher.email || "",
        topic: body.topic ? String(body.topic).slice(0, 120) : "",
        requestGroupId: body.requestGroupId ? String(body.requestGroupId) : "",
        ...(body.requestGroupId
          ? buildSessionFields({ date: body.date, time: body.time, duration: body.duration })
          : {}),
      });
    } catch (dbError) {
      // could not save the payment -> give the money back
      console.error("Wallet payment not saved, refunding wallet:", dbError.message);
      await Fresher.updateOne({ _id: fresherId }, { $inc: { walletBalance: amount } });
      return res.status(500).json({ success: false, message: "Unable to complete wallet payment." });
    }

    notify({
      user: fresher._id,
      role: "fresher",
      title: "Paid from wallet",
      message: `${rupees(amount)} was paid from your wallet. Balance: ${rupees(fresher.walletBalance)}.`,
      type: "payment",
    });
    emitToUser(String(fresher._id), "wallet:updated", { balance: fresher.walletBalance });

    return res.json({
      success: true,
      paymentId: payment.razorpayPaymentId,
      balance: fresher.walletBalance,
    });
  } catch (error) {
    console.error("payWithWallet error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to pay from wallet." });
  }
};

// ============================================================
// 3. MARK FAILED   POST /api/payments/failed  { razorpay_order_id, reason }
//    Only a "created" payment can fail. A paid / refunded one is never touched.
// ============================================================

exports.markFailed = async (req, res) => {
  try {
    const { razorpay_order_id, reason } = req.body || {};
    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order id is required." });
    }

    const existing = await Payment.findOne({ razorpayOrderId: String(razorpay_order_id) }).select("fresher status").lean();
    if (!existing) return res.json({ success: true });

    // someone else's order? ignore
    const me = await currentFresher(req);
    if (existing.fresher && (!me || String(me._id) !== String(existing.fresher))) {
      return res.status(403).json({ success: false, message: "Not your payment." });
    }

    await Payment.updateOne(
      { razorpayOrderId: String(razorpay_order_id), status: "created" },
      { $set: { status: "failed", failureReason: String(reason || "Payment failed").slice(0, 200) } }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Mark failed error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update payment." });
  }
};

// ============================================================
// 3b. CLAIM A PAID PAYMENT (one booking / one group-join per payment)
//     claimId = requestGroupId for a booking, `join:<code>:<userId>` for a friend joining
//     Calling it again with the SAME claimId is fine (Retry button).
// ============================================================

exports.claimPayment = (razorpayPaymentId, claimId) =>
  Payment.findOneAndUpdate(
    {
      razorpayPaymentId: String(razorpayPaymentId),
      status: "paid",
      claimedBy: { $in: [null, "", String(claimId)] }, // null also matches old documents without the field
    },
    { $set: { claimedBy: String(claimId) } },
    { returnDocument: "after" }
  );

// ============================================================
// 3c. RECONCILE (scheduler, every ~5 min)
//     - captured at Razorpay but the browser never called verify  -> mark paid
//     - every attempt failed (30 min)                              -> failed
//     - nobody ever paid (24 h)                                    -> failed "abandoned"
// ============================================================

exports.reconcileStaleOrders = async () => {
  const now = Date.now();
  const MIN10 = 10 * 60 * 1000;
  const MIN30 = 30 * 60 * 1000;
  const H24 = 24 * 60 * 60 * 1000;
  const D7 = 7 * H24;

  // very old "created" rows: abandoned, no API call needed
  await Payment.updateMany(
    { status: "created", method: { $ne: "wallet" }, createdAt: { $lte: new Date(now - D7) } },
    { $set: { status: "failed", failureReason: "Abandoned (no payment within 7 days)" } }
  ).catch(() => {});

  const rows = await Payment.find({
    status: "created",
    method: { $ne: "wallet" },
    razorpayOrderId: /^order_/,
    createdAt: { $lte: new Date(now - MIN10), $gte: new Date(now - D7) },
  })
    .sort({ createdAt: 1 })
    .limit(20);

  for (const p of rows) {
    try {
      const rz = getRazorpay();
      const list = await rz.orders.fetchPayments(p.razorpayOrderId);
      const items = (list && list.items) || [];
      const captured = items.find((i) => i.status === "captured" || i.status === "authorized");

      if (captured) {
        const order = await rz.orders.fetch(p.razorpayOrderId);
        await settleGatewayPayment({ payment: p, order, paymentId: captured.id });
        continue;
      }

      const age = now - new Date(p.createdAt).getTime();
      if (items.length && items.every((i) => i.status === "failed") && age >= MIN30) {
        await Payment.updateOne(
          { _id: p._id, status: "created" },
          { $set: { status: "failed", failureReason: "Payment failed at the gateway" } }
        );
      } else if (!items.length && age >= H24) {
        await Payment.updateOne(
          { _id: p._id, status: "created" },
          { $set: { status: "failed", failureReason: "Abandoned (checkout never completed)" } }
        );
      }
    } catch (e) {
      console.error("reconcile skip:", p.razorpayOrderId, e?.error?.description || e.message);
    }
  }
};

// ============================================================
// 3d. WEBHOOK (optional but recommended)  POST /api/payments/webhook
//     Route MUST use express.raw({ type: "application/json" }) (see PATCHES.md).
//     Dashboard events: payment.captured, payment.failed
// ============================================================

exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ success: false, message: "Webhook not configured" });

    const raw = req.body;
    const sig = req.get("x-razorpay-signature") || "";
    if (!Buffer.isBuffer(raw)) return res.status(400).json({ success: false, message: "Raw body required" });

    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (!safeEqual(expected, sig)) return res.status(400).json({ success: false, message: "Bad signature" });

    const evt = JSON.parse(raw.toString("utf8"));
    const ent = evt?.payload?.payment?.entity;

    if (ent && ent.order_id) {
      if (evt.event === "payment.captured") {
        const payment = await Payment.findOne({ razorpayOrderId: ent.order_id });
        if (payment && ["created", "failed"].includes(payment.status) && !payment.verifyRejected) {
          const order = await getRazorpay().orders.fetch(ent.order_id);
          await settleGatewayPayment({ payment, order, paymentId: ent.id });
        }
      } else if (evt.event === "payment.failed") {
        await Payment.updateOne(
          { razorpayOrderId: ent.order_id, status: "created" },
          { $set: { status: "failed", failureReason: String(ent.error_description || "Payment failed").slice(0, 200) } }
        );
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("webhook error:", error.message);
    return res.status(500).json({ success: false }); // Razorpay retries
  }
};

// ============================================================
// 4. LINK PAYMENT TO A SESSION REQUEST
// ============================================================

const linkPaymentToRequest = async ({
  razorpayPaymentId,
  razorpayOrderId,
  requestGroupId,
  topic,
  date,
  time,
  duration,
}) => {
  if (!requestGroupId || (!razorpayPaymentId && !razorpayOrderId)) return null;

  const filter = razorpayPaymentId
    ? { razorpayPaymentId: String(razorpayPaymentId) }
    : { razorpayOrderId: String(razorpayOrderId) };

  return Payment.findOneAndUpdate(
    { ...filter, status: "paid" },
    {
      $set: {
        requestGroupId: String(requestGroupId),
        topic: topic ? String(topic).slice(0, 120) : "",
        ...buildSessionFields({ date, time, duration }),
      },
    },
    { returnDocument: "after" }
  );
};

exports.linkPaymentToRequest = linkPaymentToRequest;

exports.linkPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, requestGroupId, topic, date, time, duration } = req.body || {};

    if (!razorpay_payment_id || !requestGroupId) {
      return res
        .status(400)
        .json({ success: false, message: "razorpay_payment_id and requestGroupId are required." });
    }

    const owned = await Payment.exists({
      razorpayPaymentId: String(razorpay_payment_id),
      fresher: req.user.id,
    });
    if (!owned) {
      return res.status(404).json({ success: false, message: "Payment not found for this account." });
    }

    const payment = await linkPaymentToRequest({
      razorpayPaymentId: razorpay_payment_id,
      requestGroupId,
      topic,
      date,
      time,
      duration,
    });

    return res.json({ success: true, linked: Boolean(payment) });
  } catch (error) {
    console.error("Link payment error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to link payment." });
  }
};

// ============================================================
// 5. ASSIGN THE ACCEPTING MENTOR TO THE PAYMENT
// ============================================================

const assignMentorToRequest = async ({ requestGroupId, mentorId }) => {
  if (!requestGroupId || !mongoose.Types.ObjectId.isValid(mentorId)) {
    return { assigned: false, reason: "invalid input" };
  }

  const payment = await Payment.findOneAndUpdate(
    {
      requestGroupId: String(requestGroupId),
      status: "paid",
      mentor: null,
      sessionStatus: { $ne: "cancelled" },
    },
    { $set: { mentor: mentorId, sessionStatus: "upcoming" } },
    { returnDocument: "after" }
  );

  if (payment) {
    notify({
      user: mentorId,
      role: "mentor",
      title: "Session booked",
      message: `${payment.fresherName || "A fresher"} booked a session. You will earn ${rupees(
        payment.mentorEarning // from the session price only, never the convenience fee
      )} once it is completed.`,
      type: "payment",
      link: "/mentor/sessions",
    });
    emitToUser(mentorId, "wallet:updated", { paymentId: payment._id });
    return { assigned: true };
  }

  const mine = await Payment.exists({ requestGroupId: String(requestGroupId), mentor: mentorId });
  return mine ? { assigned: true } : { assigned: false, reason: "not available" };
};

exports.assignMentorToRequest = assignMentorToRequest;

exports.assignToMe = async (req, res) => {
  try {
    const { requestGroupId } = req.body || {};
    if (!requestGroupId) {
      return res.status(400).json({ success: false, message: "requestGroupId is required." });
    }

    const result = await assignMentorToRequest({ requestGroupId, mentorId: req.user.id });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Assign payment error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to assign payment." });
  }
};