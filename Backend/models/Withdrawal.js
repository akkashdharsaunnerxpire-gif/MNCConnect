// models/Withdrawal.js
// requested -> (admin pays manually) -> paid, or rejected.
// requested + paid amounts are subtracted from the mentor's available balance.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawalSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      set: (n) => Math.round((Number(n) || 0) * 100) / 100,
    },
    upiId: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["requested", "paid", "rejected"],
      default: "requested",
      index: true,
    },
    note: { type: String, default: "" },
    utr: { type: String, default: "" },
    processedBy: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// one mentor = ONE "requested" withdrawal at a time (double click / 2 tabs -> E11000)
withdrawalSchema.index(
  { mentor: 1 },
  { unique: true, partialFilterExpression: { status: "requested" } },
);
withdrawalSchema.index(
  { utr: 1 },
  { unique: true, partialFilterExpression: { utr: { $type: "string", $gt: "" } } },
);
// mentor's own list (the partial indexes above cannot serve this)
withdrawalSchema.index({ mentor: 1, createdAt: -1 });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);