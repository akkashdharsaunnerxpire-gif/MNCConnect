// models/Withdrawal.js
// A mentor asks to withdraw part of the released balance.
// status: requested -> (admin pays manually) -> paid, or rejected.
// requested + paid amounts are subtracted from the mentor's available balance.
// A rejected request goes back to the mentor's available balance automatically.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawalSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    upiId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["requested", "paid", "rejected"],
      default: "requested",
      index: true,
    },
    note: { type: String, default: "" },
    utr: { type: String, default: "" }, // UPI transaction reference of the manual payout
    processedBy: { type: String, default: "" }, // admin email
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// DATABASE-LEVEL guard: one mentor can have only ONE "requested" withdrawal at a time.
// Two tabs / double click -> the second insert fails with E11000.
withdrawalSchema.index(
  { mentor: 1 },
  { unique: true, partialFilterExpression: { status: "requested" } }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);