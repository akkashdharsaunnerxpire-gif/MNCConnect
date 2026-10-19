// controllers/paymentController.js
//
// Replaces the old controller. createOrder / verifyPayment keep the SAME
// request and response shape, so the fresher checkout code does not change.
// The difference: every order and payment is now saved in MongoDB.
//
// Extra exports used by other controllers:
//   linkPaymentToRequest(...)   call when a session request is created
//   assignMentorToRequest(...)  call when a mentor accepts a request

const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Fresher = require("../models/Fresher");
const { optionalAuth } = require("../middleware/panelAuth");
const { notify, emitToUser } = require("../utils/realtime");
const { buildSessionFields } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");

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

// ============================================================
// 1. CREATE ORDER   POST /api/payments/create-order  { amount, ...optional }
// ============================================================

exports.createOrder = async (req, res) => {
  try {
    const body = req.body || {};
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100), // paise, always an integer
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Saving the record must never block a real payment
    try {
      const fresher = await currentFresher(req);
      const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);

      await Payment.create({
        razorpayOrderId: order.id,
        receipt: order.receipt || "",
        amount,
        currency: order.currency || "INR",
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,
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
      console.error("Payment record not saved (order created):", dbError.message);
    }

    return res.json(order);
  } catch (error) {
    console.error("Create order error:", error.message);
    return res.status(500).json({ message: "Razorpay order creation failed" });
  }
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

  // ---------- valid: the money is real, so ALWAYS answer success ----------
  // Bookkeeping problems are logged but never shown as a failed payment.
  try {
    let payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });

    if (!payment) {
      // Order was created before this controller existed: rebuild from Razorpay
      const order = await getRazorpay().orders.fetch(razorpay_order_id);
      const amount = Number(order.amount) / 100;
      const { fee, earning } = splitAmount(amount, PLATFORM_FEE_PERCENT);

      payment = new Payment({
        razorpayOrderId: razorpay_order_id,
        amount,
        currency: order.currency || "INR",
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFee: fee,
        mentorEarning: earning,
      });
    }

    if (payment.status !== "paid") {
      const fresher = payment.fresher ? null : await currentFresher(req);

      payment.status = "paid";
      payment.failureReason = "";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.paidAt = new Date();

      if (fresher) {
        payment.fresher = fresher._id;
        payment.fresherName = fresher.name;
        payment.fresherEmail = fresher.email;
      }

      // Best effort: payment method / contact from Razorpay
      try {
        const details = await getRazorpay().payments.fetch(razorpay_payment_id);
        payment.method = details.method || "";
        payment.payerEmail = details.email || "";
        payment.payerContact = details.contact || "";
      } catch (_) { /* optional */ }

      await payment.save();

      if (payment.fresher) {
        notify({
          user: payment.fresher,
          role: "fresher",
          title: "Payment successful",
          message: `We received ${rupees(payment.amount)}. Your session request is on its way to mentors.`,
          type: "payment",
        });
      }
    }
  } catch (dbError) {
    console.error("PAYMENT VERIFIED BUT NOT SAVED:", razorpay_payment_id, dbError.message);
  }

  return res.json({ success: true, paymentId: razorpay_payment_id });
};

// ============================================================
// 3. MARK FAILED   POST /api/payments/failed  { razorpay_order_id, reason }
//    Call from Razorpay's "payment.failed" callback in the checkout.
// ============================================================

exports.markFailed = async (req, res) => {
  try {
    const { razorpay_order_id, reason } = req.body || {};
    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order id is required." });
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
// 4. LINK PAYMENT TO A SESSION REQUEST
//    Server hook: call this where the session request is created.
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
    { new: true }
  );
};

exports.linkPaymentToRequest = linkPaymentToRequest;

// HTTP version (fresher app can call it after creating the request)
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
//    First mentor wins. Safe to call more than once.
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
    { new: true }
  );

  if (payment) {
    notify({
      user: mentorId,
      role: "mentor",
      title: "Session booked",
      message: `${payment.fresherName || "A fresher"} booked a session. You will earn ${rupees(
        payment.mentorEarning
      )} once it is completed.`,
      type: "payment",
      link: "/mentor/sessions",
    });
    emitToUser(mentorId, "wallet:updated", { paymentId: payment._id });
    return { assigned: true };
  }

  // Already mine (second call), or taken by another mentor, or never linked
  const mine = await Payment.exists({ requestGroupId: String(requestGroupId), mentor: mentorId });
  return mine ? { assigned: true } : { assigned: false, reason: "not available" };
};

exports.assignMentorToRequest = assignMentorToRequest;

// HTTP version (mentor app calls it right after accepting a request)
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