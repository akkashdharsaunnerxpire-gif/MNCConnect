// models/Payment.js
// One document per Razorpay order (or wallet payment). Amounts are stored in RUPEES.
//
//   amount            = ORIGINAL SESSION PRICE (unchanged meaning, platform fee + mentor earning come from this ONLY)
//   convenienceFee    = extra fee charged to the fresher to recover gateway cost (0 for wallet / when off)
//   checkoutAmount    = amount + convenienceFee  (what the customer really paid; 0 on old docs => use amount)
//   gatewayFeeCollected = convenience fee actually collected from the customer (set only when verified paid)
//   gatewayFee / gatewayTax = what Razorpay really charged US (incl. GST)
//
// Lifecycle:
//   created  -> order created, user is at the checkout
//   paid     -> signature + amounts verified (money is held by the platform)
//   failed   -> checkout failed / abandoned / signature invalid / amount mismatch
//   refunded -> refunded (Razorpay refund API, wallet refund, or manually from the dashboard)
//
// OLD DOCUMENTS: every new field has a default, so nothing needs migrating.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    // ---------- Razorpay ----------
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String, select: false },
    receipt: { type: String, default: "" },

    // ---------- Money (rupees) ----------
    amount: { type: Number, required: true, min: 0 }, // ORIGINAL session price
    currency: { type: String, default: "INR" },
    platformFeePercent: { type: Number, default: 25 },
    platformFee: { type: Number, default: 0 }, // from `amount` only
    mentorEarning: { type: Number, default: 0 }, // from `amount` only

    // ---------- Convenience fee (NEW) ----------
    convenienceFeeMode: {
      type: String,
      enum: ["", "none", "platform", "razorpay_bearer"],
      default: "",
    },
    convenienceFee: { type: Number, default: 0, min: 0 },
    checkoutAmount: { type: Number, default: 0, min: 0 },
    orderAmount: { type: Number, default: 0, min: 0 }, // amount the Razorpay ORDER was created for
    gatewayFeeCollected: { type: Number, default: 0, min: 0 },
    convenienceFeeRefunded: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 }, // total returned to the fresher
    amountVerified: { type: Boolean, default: false }, // true once order/payment amounts were checked against Razorpay
    verifyRejected: { type: Boolean, default: false }, // amount mismatch -> never flip to paid again

    // one booking / join may claim a paid payment, ONCE (prevents duplicate bookings)
    claimedBy: { type: String, default: "", index: true },

    // ---------- Status ----------
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
      index: true,
    },
    failureReason: { type: String, default: "" },
    method: { type: String, default: "" },
    payerEmail: { type: String, default: "" },
    payerContact: { type: String, default: "" },
    paidAt: { type: Date, default: null },

    // ---------- Refund ----------
    refundMethod: {
      type: String,
      enum: ["", "wallet", "original"],
      default: "",
    },
    refundedAt: { type: Date, default: null },

    // ---------- People ----------
    fresher: {
      type: Schema.Types.ObjectId,
      ref: "Fresher",
      default: null,
      index: true,
    },
    fresherName: { type: String, default: "" },
    fresherEmail: { type: String, default: "" },
    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      default: null,
      index: true,
    },

    // ---------- Session ----------
    requestGroupId: { type: String, default: "", index: true },
    topic: { type: String, default: "" },
    sessionDate: { type: String, default: "" },
    sessionTime: { type: String, default: "" },
    durationMinutes: { type: Number, default: 30 },
    sessionEndsAt: { type: Date, default: null },
    sessionStatus: {
      type: String,
      enum: ["unassigned", "upcoming", "completed", "cancelled"],
      default: "unassigned",
    },
    // when the mentor's share became withdrawable
    releasedAt: { type: Date, default: null },
    refundError: { type: String, default: "" },
    refundFailedAt: { type: Date, default: null },

    // ---------- What Razorpay charged us ----------
    gatewayFee: { type: Number, default: 0 }, // Razorpay fee incl. GST, in rupees
    gatewayTax: { type: Number, default: 0 }, // GST part (info only, already inside gatewayFee)
    feeEstimated: { type: Boolean, default: false },
    gatewayFeeSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ mentor: 1, status: 1, paidAt: -1 });
paymentSchema.index({ mentor: 1, status: 1, sessionStatus: 1 });
paymentSchema.index({ status: 1, createdAt: 1 }); // reconcile / abandoned job

module.exports = mongoose.model("Payment", paymentSchema);