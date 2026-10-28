// models/Payment.js
// One document per Razorpay order (or wallet payment). Amounts are stored in RUPEES.
//
// Lifecycle:
//   created  -> order created, user is at the checkout
//   paid     -> signature verified (money is held by the platform)
//   failed   -> checkout failed / signature invalid
//   refunded -> refunded (Razorpay refund API, wallet refund, or manually from the dashboard)
//
// A paid payment belongs to a mentor once the mentor accepts the session
// (mentor + sessionStatus "upcoming"). When the session is confirmed / auto-confirmed
// sessionStatus becomes "completed" and the mentor's share becomes withdrawable.

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
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    platformFeePercent: { type: Number, default: 25 },
    platformFee: { type: Number, default: 0 },
    mentorEarning: { type: Number, default: 0 },

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
    // when the mentor's share became withdrawable
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ mentor: 1, status: 1, paidAt: -1 });
paymentSchema.index({ mentor: 1, status: 1, sessionStatus: 1 });

module.exports = mongoose.model("Payment", paymentSchema);