// controllers/paymentController.js
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Fresher = require("../models/Fresher");
const Booking = require("../models/Booking");
const { notify, emitToUser } = require("../utils/realtime");
const { buildSessionFields } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");
const { debitWallet } = require("../utils/walletLedger");
const { expectedPrice, validDuration } = require("../utils/sessionPrice");
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
    throw new Error(
      "Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)",
    );
  }
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  return razorpay;
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Route has requireAuth("fresher"); this is the 2nd line of defence.
// Returns the fresher or sends 401 and returns null.
const requireFresher = async (req, res) => {
  if (!req.user || req.user.role !== "fresher" || !req.user.id) {
    res.status(401).json({ success: false, message: "Please login to continue." });
    return null;
  }
  const f = await Fresher.findById(req.user.id).select("name email").lean();
  if (!f) {
    res.status(401).json({ success: false, message: "Account not found." });
    return null;
  }
  return f;
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

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

const feeModeOf = (quote) =>
  quote.bearerManaged
    ? "razorpay_bearer"
    : quote.convenienceFee > 0
      ? "platform"
      : "none";

const orConditionFor = (paymentId) => ({
  $or: [{ razorpayPaymentId: paymentId }, { razorpayOrderId: paymentId }],
});

// SERVER decides the price. The client never sends an amount we trust.
//   friend joining a group : { inviteCode }                 -> price comes from the booking
//   everything else        : { duration (minutes), mode }   -> price comes from env rates
const resolveSessionAmount = async (body) => {
  const code = String(body.inviteCode || "").trim().toUpperCase();
  if (code) {
    const b = await Booking.findOne({ inviteCode: code, sessionMode: "group" })
      .select("perPersonAmount amount")
      .lean();
    if (!b) return { error: "This invite link is not valid." };
    const amount = round2(Number(b.perPersonAmount || b.amount));
    if (!(amount > 0)) return { error: "Invalid group price." };
    return { amount, mode: "group" };
  }

  const minutes = Number(body.duration);
  if (!validDuration(minutes)) return { error: "Invalid duration" };
  const mode = body.mode === "group" ? "group" : "single";
  const amount = round2(expectedPrice(minutes, mode));
  if (!(amount > 0)) return { error: "Invalid amount" };
  return { amount, mode, minutes };
};

const sessionFieldsOf = (body) =>
  body.requestGroupId
    ? buildSessionFields({
        date: body.date,
        time: body.time,
        duration: body.duration,
      })
    : {};

// ============================================================
// FEE QUOTE   GET /api/payments/fee-quote?duration=60&mode=single  (or ?inviteCode=XXXX)
// display only; the real price is recalculated in createOrder
// ============================================================

exports.quoteFee = async (req, res) => {
  const r = await resolveSessionAmount(req.query || {});
  if (r.error) return res.status(400).json({ success: false, message: r.error });
  return res.json({
    success: true,
    sessionAmount: r.amount,
    ...calcConvenienceFee({ amount: r.amount, channel: "razorpay" }),
    walletFee: 0,
  });
};

// ============================================================
// 1. CREATE ORDER   POST /api/payments/create-order
//    body: { duration, mode, topic, requestGroupId, date, time }  or  { inviteCode }
//    (any `amount` sent by the client is IGNORED)
// ============================================================

exports.createOrder = async (req, res) => {
  try {
    const fresher = await requireFresher(req, res);
    if (!fresher) return;

    const body = req.body || {};
    const priced = await resolveSessionAmount(body);
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error });
    }
    const amount = priced.amount;

    const quote = calcConvenienceFee({ amount, channel: "razorpay" });
    const orderAmountPaise = toPaise(quote.orderAmount);
    if (orderAmountPaise <= 0) {
      return res.status(400).json({ message: "Invalid checkout amount" });
    }

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);

    const order = await getRazorpay().orders.create({
      amount: orderAmountPaise,
      currency: "INR",
      receipt,
    });

    const mode = feeModeOf(quote);

    try {
      await Payment.create({
        razorpayOrderId: order.id,
        receipt: order.receipt || receipt,
        amount, // ORIGINAL session price only
        currency: order.currency || "INR",

        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,

        convenienceFeeMode: mode,
        convenienceFee: quote.convenienceFee,
        checkoutAmount: quote.checkoutAmount,
        orderAmount: quote.orderAmount,

        gatewayFeeCollected: 0,
        convenienceFeeRefunded: 0,
        amountVerified: false,
        verifyRejected: false,
        status: "created",

        fresher: fresher._id, // owner is ALWAYS the logged-in fresher
        fresherName: fresher.name || "",
        fresherEmail: fresher.email || "",

        topic: body.topic ? String(body.topic).slice(0, 120) : "",
        requestGroupId: body.requestGroupId ? String(body.requestGroupId) : "",
        ...sessionFieldsOf(body),
      });
    } catch (dbError) {
      console.error("Payment record save failed:", order.id, dbError.message);
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
      convenienceFeeMode: mode,
      breakdown: {
        sessionAmount: amount,
        convenienceFee: quote.convenienceFee,
        checkoutAmount: quote.checkoutAmount,
        convenienceFeeMode: mode,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Razorpay order creation failed" });
  }
};

// ============================================================
// SHARED: verified Razorpay payment -> "paid" Payment (atomic + idempotent)
// used by verifyPayment, reconcile job and webhook
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
        ...(rzPayment && rzPayment.id
          ? { razorpayPaymentId: rzPayment.id }
          : {}),
      },
    },
  ).catch(() => {});

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
        },
      );
    } catch (e) {
      console.error(
        "Mismatch refund FAILED (do it manually):",
        rzPayment.id,
        e?.error?.description || e.message,
      );
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            refundError: String(e?.error?.description || e.message).slice(0, 300),
            refundFailedAt: new Date(),
          },
        },
      ).catch(() => {});
    }
  }
};

const settleGatewayPayment = async ({
  payment,
  order,
  paymentId,
  signature = "",
  fresher = null,
}) => {
  let rzPayment = null;
  try {
    rzPayment = await withRetry(
      () => getRazorpay().payments.fetch(paymentId),
      2,
    );
  } catch (e) {
    console.error(
      "payments.fetch failed:",
      paymentId,
      e?.error?.description || e.message,
    );
  }

  if (rzPayment && rzPayment.status === "authorized") {
    try {
      await getRazorpay().payments.capture(
        paymentId,
        Number(rzPayment.amount),
        "INR",
      );
      rzPayment = await getRazorpay().payments.fetch(paymentId);
    } catch (e) {
      console.error(
        "capture failed:",
        paymentId,
        e?.error?.description || e.message,
      );
    }
  }
  if (!rzPayment) {
    return { ok: false, pending: true, reason: "Unable to fetch Razorpay payment" };
  }

  if (rzPayment.status !== "captured") {
    return { ok: false, pending: true, reason: `Payment is ${rzPayment.status}` };
  }

  if (!order) {
    return { ok: false, pending: true, reason: "Unable to fetch Razorpay order" };
  }

  const stored = payment.toObject ? payment.toObject() : payment;
  let convenienceFee = Number(stored.convenienceFee) || 0;
  let checkoutAmount =
    Number(stored.checkoutAmount) > 0
      ? Number(stored.checkoutAmount)
      : Number(stored.amount);
  let amountVerified = false;

  const check = validateGatewayAmounts({ payment: stored, order, rzPayment });
  if (!check.ok) {
    await rejectMismatch(payment, rzPayment, check.reason);
    return { ok: false, rejected: true, reason: check.reason };
  }
  convenienceFee = check.convenienceFee;
  checkoutAmount = check.checkoutAmount;
  amountVerified = true;

  let gatewayFee = 0;
  let gatewayTax = 0;
  let feeEstimated = false;
  if (rzPayment.fee !== null && rzPayment.fee !== undefined) {
    gatewayFee = toRupees(rzPayment.fee); // already includes GST
    gatewayTax = toRupees(rzPayment.tax || 0);
  } else {
    const pct = Number(process.env.RAZORPAY_FEE_PERCENT || 2);
    gatewayFee = round2(checkoutAmount * (pct / 100) * 1.18);
    feeEstimated = true;
  }

  const set = {
    status: "paid",
    failureReason: "",
    razorpayPaymentId: paymentId,
    paidAt: new Date(),
    checkoutAmount,
    convenienceFee,
    gatewayFeeCollected: convenienceFee,
    amountVerified,
    gatewayFee,
    gatewayTax,
    feeEstimated,
    gatewayFeeSyncedAt: feeEstimated ? null : new Date(),
    ...(signature ? { razorpaySignature: signature } : {}),
    method: rzPayment.method || "",
    payerEmail: rzPayment.email || "",
    payerContact: rzPayment.contact || "",
    ...(fresher && !payment.fresher
      ? {
          fresher: fresher._id,
          fresherName: fresher.name,
          fresherEmail: fresher.email,
        }
      : {}),
  };

  // ATOMIC: only ONE caller can move created/failed -> paid
  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: ["created", "failed"] },
      verifyRejected: { $ne: true },
    },
    { $set: set },
    { returnDocument: "after" },
  );

  if (!updated) {
    const cur = await Payment.findById(payment._id);
    return {
      ok: Boolean(cur && cur.status === "paid"),
      duplicate: true,
      payment: cur,
    };
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
// 2. VERIFY PAYMENT   POST /api/payments/verify-payment   (fresher, owner only)
// ============================================================

exports.verifyPayment = async (req, res) => {
  const fresher = await requireFresher(req, res);
  if (!fresher) return;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res
      .status(400)
      .json({ success: false, message: "Missing payment details" });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res
      .status(500)
      .json({ success: false, message: "Payment gateway is not configured" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (!safeEqual(expected, razorpay_signature)) {
    // only the OWNER's own order can be marked failed
    await Payment.updateOne(
      {
        razorpayOrderId: String(razorpay_order_id),
        status: "created",
        fresher: fresher._id,
      },
      { $set: { status: "failed", failureReason: "Invalid payment signature" } },
    ).catch(() => {});
    return res
      .status(400)
      .json({ success: false, message: "Invalid payment signature" });
  }

  try {
    const payment = await Payment.findOne({
      razorpayOrderId: String(razorpay_order_id),
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

    // OWNERSHIP: this order must belong to the logged-in fresher
    if (!payment.fresher || String(payment.fresher) !== String(fresher._id)) {
      return res
        .status(403)
        .json({ success: false, message: "This payment belongs to another account." });
    }

    if (payment.status === "paid") {
      return res.json({
        success: true,
        paymentId: payment.razorpayPaymentId || razorpay_payment_id,
        sessionAmount: payment.amount,
        convenienceFee: payment.convenienceFee,
        checkoutAmount: payment.checkoutAmount,
      });
    }
    if (payment.status === "refunded") {
      return res.status(409).json({
        success: false,
        message: "This payment was already refunded.",
      });
    }

    let order = null;
    try {
      order = await withRetry(
        () => getRazorpay().orders.fetch(razorpay_order_id),
        2,
      );
    } catch (e) {
      console.error(
        "orders.fetch failed:",
        razorpay_order_id,
        e?.error?.description || e.message,
      );
    }

    const result = await settleGatewayPayment({
      payment,
      order,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (result.ok) {
      const p = result.payment || payment;
      return res.json({
        success: true,
        paymentId: p.razorpayPaymentId || razorpay_payment_id,
        sessionAmount: p.amount,
        convenienceFee: p.convenienceFee,
        checkoutAmount: p.checkoutAmount,
      });
    }

    if (result.rejected) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount verification failed. Any captured money is being refunded.",
      });
    }

    if (result.pending) {
      return res.status(409).json({
        success: false,
        message:
          "Payment is still being confirmed. If money was deducted it will be confirmed or refunded automatically.",
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Unable to verify payment." });
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({
      success: false,
      message:
        "Unable to verify payment. Please contact support if money was deducted.",
    });
  }
};

// ============================================================
// 2a. PAYMENT FAILED   POST /api/payments/failed { razorpay_order_id, reason }
// ============================================================

exports.markPaymentFailed = async (req, res) => {
  try {
    if (req.user && req.user.role === "fresher") {
      const { razorpay_order_id, reason } = req.body || {};
      if (razorpay_order_id) {
        await Payment.updateOne(
          {
            razorpayOrderId: String(razorpay_order_id),
            status: "created",
            fresher: req.user.id, // owner only
          },
          {
            $set: {
              status: "failed",
              failureReason: String(reason || "Payment failed").slice(0, 200),
            },
          },
        );
      }
    }
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: true });
  }
};
exports.markFailed = exports.markPaymentFailed;

// ============================================================
// 2b. PAY WITH WALLET   POST /api/payments/pay-with-wallet  (fresher)
//     body: { duration, mode, requestGroupId, topic, date, time, idempotencyKey? }
//        or { inviteCode, idempotencyKey? }
//
//  - price calculated on the SERVER
//  - debit + Payment record happen in ONE Mongo transaction (all or nothing)
//  - idempotency: same key twice -> second call returns the SAME payment, no 2nd debit
//  Idempotency key: header "Idempotency-Key" / body.idempotencyKey / body.requestGroupId
//                   (friends joining: "join:<inviteCode>")
// ============================================================

const walletSuccess = async (payment, fresherId, duplicate = false) => {
  const f = await Fresher.findById(fresherId)
    .select("refundableBalance bonusBalance referralBalance")
    .lean();
  const walletBalance = f
    ? round2(
        (f.refundableBalance || 0) + (f.bonusBalance || 0) + (f.referralBalance || 0),
      )
    : 0;
  return {
    success: true,
    duplicate,
    paymentId: payment.razorpayPaymentId,
    amount: payment.amount,
    checkoutAmount: payment.checkoutAmount,
    walletBalance,
  };
};

exports.payWithWallet = async (req, res) => {
  let session = null;
  try {
    const fresher = await requireFresher(req, res);
    if (!fresher) return;
    const fresherId = String(fresher._id);

    const body = req.body || {};

    const clientKey = String(
      req.get("Idempotency-Key") ||
        body.idempotencyKey ||
        body.requestGroupId ||
        (body.inviteCode ? `join:${String(body.inviteCode).toUpperCase()}` : ""),
    ).trim();
    if (!clientKey || clientKey.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: "Idempotency key required." });
    }
    const idempotencyKey = `${fresherId}:${clientKey}`;

    // fast path: same request already processed -> return the same result
    const already = await Payment.findOne({ idempotencyKey });
    if (already) {
      if (already.status === "paid" || already.status === "refunded") {
        return res.json(await walletSuccess(already, fresherId, true));
      }
      return res
        .status(409)
        .json({ success: false, message: "Payment is already being processed." });
    }

    const priced = await resolveSessionAmount(body);
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error });
    }
    const amount = priced.amount;

    const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);
    const paymentId = `wallet_pay_${new mongoose.Types.ObjectId()}`;
    const orderId = `wallet_order_${new mongoose.Types.ObjectId()}`;

    let outcome = null;
    session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        outcome = null; // the callback can be retried by the driver

        const debit = await debitWallet(fresherId, amount, session);
        if (!debit.ok) {
          outcome = { failed: debit.reason };
          return; // nothing written -> nothing to roll back
        }

        const [payment] = await Payment.create(
          [
            {
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              idempotencyKey,
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
              walletBreakdown: debit.plan, // { bonus, referral, refundable }
              status: "paid",
              paidAt: new Date(),
              fresher: fresher._id,
              fresherName: fresher.name || "",
              fresherEmail: fresher.email || "",
              topic: body.topic ? String(body.topic).slice(0, 120) : "",
              requestGroupId: body.requestGroupId ? String(body.requestGroupId) : "",
              ...sessionFieldsOf(body),
            },
          ],
          { session },
        );
        outcome = { payment };
      });
    } catch (e) {
      if (e && e.code === 11000) {
        // double click / retry: transaction rolled back (no 2nd debit). Return the first result.
        const first = await Payment.findOne({ idempotencyKey });
        if (first && (first.status === "paid" || first.status === "refunded")) {
          return res.json(await walletSuccess(first, fresherId, true));
        }
        return res
          .status(409)
          .json({ success: false, message: "Payment is already being processed." });
      }
      throw e;
    }

    if (!outcome || outcome.failed) {
      if (outcome && outcome.failed === "INSUFFICIENT") {
        return res
          .status(402)
          .json({ success: false, message: "Insufficient wallet balance" });
      }
      return res.status(409).json({
        success: false,
        message: "Wallet is busy. Please try again.",
      });
    }

    const out = await walletSuccess(outcome.payment, fresherId, false);
    emitToUser(fresherId, "wallet:updated", { amount: -amount });
    return res.json(out);
  } catch (error) {
    console.error("Wallet payment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to process wallet payment" });
  } finally {
    if (session) session.endSession();
  }
};

// ============================================================
// 3. LINK PAYMENT TO REQUEST
// ============================================================

exports.linkPaymentToRequest = async (a, b) => {
  const o =
    a && typeof a === "object"
      ? a
      : { razorpayPaymentId: a, requestGroupId: b };
  const paymentId = o.razorpayPaymentId || o.paymentId;
  if (!paymentId || !o.requestGroupId) return null;

  const set = { requestGroupId: String(o.requestGroupId) };
  if (o.topic) set.topic = String(o.topic).slice(0, 120);
  if (o.date && o.time) {
    try {
      Object.assign(
        set,
        buildSessionFields({ date: o.date, time: o.time, duration: o.duration }),
      );
    } catch (_) {
      /* ignore unreadable date */
    }
  }

  return Payment.findOneAndUpdate(
    orConditionFor(paymentId),
    { $set: set },
    { returnDocument: "after" },
  );
};

// ============================================================
// 4. ASSIGN MENTOR TO REQUEST
// ============================================================

exports.assignMentorToRequest = async (a, b) => {
  const o =
    a && typeof a === "object" ? a : { razorpayPaymentId: a, mentorId: b };
  const paymentId = o.razorpayPaymentId || o.paymentId;
  if (!o.mentorId || (!paymentId && !o.requestGroupId)) return null;

  const filter = {
    status: "paid",
    sessionStatus: { $nin: ["cancelled", "completed"] },
    ...(o.requestGroupId
      ? { requestGroupId: String(o.requestGroupId) }
      : orConditionFor(paymentId)),
  };

  return Payment.updateMany(filter, {
    $set: { mentor: o.mentorId, sessionStatus: "upcoming" },
  });
};

// ============================================================
// 5. CLAIM PAYMENT  (a paid payment can belong to only ONE booking / join)
// ============================================================

exports.claimPayment = async (paymentId, bookingId) => {
  if (!paymentId || !bookingId) return null;

  return Payment.findOneAndUpdate(
    {
      $and: [
        orConditionFor(paymentId),
        { status: "paid" },
        {
          $or: [
            { claimedBy: { $exists: false } },
            { claimedBy: null },
            { claimedBy: "" },
            { claimedBy: String(bookingId) },
          ],
        },
      ],
    },
    { $set: { claimedBy: String(bookingId) } },
    { returnDocument: "after" },
  );
};

// ============================================================
// 6. RAZORPAY WEBHOOK  (NO user auth: protected by signature)
//    route needs express.raw({ type: "application/json" })
// ============================================================

exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || !signature) {
      return res
        .status(400)
        .json({ success: false, message: "Webhook configuration missing" });
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (!safeEqual(expected, signature)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid webhook signature" });
    }

    const event = JSON.parse(body.toString("utf8"));
    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity?.id || !paymentEntity?.order_id) {
      return res.json({ success: true, ignored: true });
    }

    if (event.event === "payment.failed") {
      await Payment.updateOne(
        { razorpayOrderId: paymentEntity.order_id, status: "created" },
        {
          $set: {
            status: "failed",
            failureReason: String(
              paymentEntity.error_description || "Payment failed",
            ).slice(0, 200),
          },
        },
      );
      return res.json({ success: true });
    }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      });
      if (payment && payment.status !== "paid" && payment.status !== "refunded") {
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
    return res
      .status(500)
      .json({ success: false, message: "Webhook processing failed" });
  }
};

// ============================================================
// 7. RECONCILE STALE ORDERS (call from the scheduler)
// ============================================================

exports.reconcileStaleOrders = async () => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const oldest = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stalePayments = await Payment.find({
      status: { $in: ["created", "failed"] },
      verifyRejected: { $ne: true },
      createdAt: { $lte: cutoff, $gte: oldest },
      razorpayOrderId: { $exists: true, $ne: "", $not: /^wallet_order_/ },
    }).limit(100);

    let processed = 0;
    let pending = 0;
    let failed = 0;

    for (const payment of stalePayments) {
      try {
        const order = await getRazorpay().orders.fetch(payment.razorpayOrderId);
        const payments = await getRazorpay().orders.fetchPayments(
          payment.razorpayOrderId,
        );
        const items = Array.isArray(payments?.items) ? payments.items : [];

        const candidate =
          items.find((p) => p.status === "captured") ||
          items.find((p) => p.status === "authorized");

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

    return { success: true, checked: stalePayments.length, processed, pending, failed };
  } catch (error) {
    console.error("reconcileStaleOrders error:", error);
    return { success: false, message: error.message };
  }
};

exports.getRazorpay = getRazorpay;
exports.settleGatewayPayment = settleGatewayPayment;
exports.rejectMismatch = rejectMismatch;