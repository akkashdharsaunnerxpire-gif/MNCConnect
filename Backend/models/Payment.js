// models/Payment.js
// One document per Razorpay order. Amounts are stored in RUPEES.
//
// Lifecycle:
//   created  -> order created, user is at the checkout
//   paid     -> signature verified (money is held by the platform)
//   failed   -> checkout failed / signature invalid
//   refunded -> refunded manually from the Razorpay dashboard
//
// A paid payment belongs to a mentor once the mentor accepts the session
// request (mentor + sessionStatus "upcoming"). The mentor's share becomes
// withdrawable automatically after sessionEndsAt has passed.

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
      enum: ["unassigned", "upcoming", "cancelled"],
      default: "unassigned",
    },
  },
  { timestamps: true }
);

paymentSchema.index({ mentor: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);