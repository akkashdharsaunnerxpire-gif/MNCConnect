// models/Withdrawal.js
// A mentor asks to withdraw part of the released balance.
// status: requested -> (admin pays manually) -> paid, or rejected.
// requested + paid amounts are subtracted from the mentor's available balance.

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
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);