// models/Payment.js
// One document per Razorpay order (or wallet payment). Amounts are stored in RUPEES.
//
//   amount              = ORIGINAL SESSION PRICE (platform fee + mentor earning come from this ONLY)
//   convenienceFee      = extra fee charged to the fresher to recover gateway cost
//   checkoutAmount      = amount + convenienceFee (0 on old docs => use amount)
//   gatewayFeeCollected = convenience fee actually collected (set only when verified paid)
//   gatewayFee/Tax      = what Razorpay really charged US (incl. GST)
//   walletBreakdown     = which wallet buckets paid (so a refund goes back to the SAME buckets)
//
// Lifecycle: created -> paid -> refunded   (or created -> failed)
// OLD DOCUMENTS: every new field has a default, nothing needs migrating.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = () => ({ type: Number, default: 0, min: 0, set: r2 });

const paymentSchema = new Schema(
  {
    // ---------- Razorpay ----------
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String }, // unique rule = partial index below
    razorpaySignature: { type: String, select: false },
    receipt: { type: String, default: "" },

    // wallet double-click / retry guard: "<fresherId>:<clientKey>"
    idempotencyKey: { type: String },

    // ---------- Money (rupees) ----------
    amount: { type: Number, required: true, min: 0, set: r2 }, // ORIGINAL session price
    currency: { type: String, default: "INR" },
    platformFeePercent: { type: Number, default: 25 },
    platformFee: money(), // from `amount` only
    mentorEarning: money(), // from `amount` only

    // ---------- Convenience fee ----------
    convenienceFeeMode: {
      type: String,
      enum: ["", "none", "platform", "razorpay_bearer"],
      default: "",
      set: (v) => (v === "off" ? "none" : v),
    },
    convenienceFee: money(),
    checkoutAmount: money(),
    orderAmount: money(), // amount the Razorpay ORDER was created for
    gatewayFeeCollected: money(),
    convenienceFeeRefunded: money(),
    refundAmount: money(), // total returned to the fresher
    amountVerified: { type: Boolean, default: false },
    verifyRejected: { type: Boolean, default: false }, // amount mismatch -> never flip to paid again

    // one booking / join may claim a paid payment, ONCE
    claimedBy: { type: String, default: "", index: true },

    // wallet payment: how much came from each bucket (refund goes back the same way)
    walletBreakdown: {
      bonus: money(),
      referral: money(),
      refundable: money(),
    },

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
    refundMethod: { type: String, enum: ["", "wallet", "original"], default: "" },
    refundedAt: { type: Date, default: null },
    refundError: { type: String, default: "" },
    refundFailedAt: { type: Date, default: null },

    // ---------- People ----------
    fresher: { type: Schema.Types.ObjectId, ref: "Fresher", default: null, index: true },
    fresherName: { type: String, default: "" },
    fresherEmail: { type: String, default: "" },
    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", default: null, index: true },

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
    releasedAt: { type: Date, default: null }, // when the mentor's share became withdrawable

    // ---------- What Razorpay charged us ----------
    gatewayFee: money(), // incl. GST
    gatewayTax: money(), // info only, already inside gatewayFee
    feeEstimated: { type: Boolean, default: false },
    gatewayFeeSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// "" can never collide (sparse would NOT protect against ""), only real ids are unique
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string", $gt: "" } } },
);
paymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } },
);

paymentSchema.index({ mentor: 1, status: 1, paidAt: -1 });
paymentSchema.index({ mentor: 1, status: 1, sessionStatus: 1 });
paymentSchema.index({ status: 1, createdAt: 1 }); // reconcile / abandoned job
paymentSchema.index({ status: 1, sessionStatus: 1, paidAt: 1 }); // orphan-refund scheduler

module.exports = mongoose.model("Payment", paymentSchema);