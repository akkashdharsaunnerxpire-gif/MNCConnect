// models/CompanyPayout.js
// Every time the admin moves PROFIT from the Razorpay/bank balance to the company account.
const mongoose = require("mongoose");

const companyPayoutSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1 },
    reference: { type: String, required: true, trim: true }, // bank / UTR reference
    note: { type: String, default: "", maxlength: 300 },
    paidBy: { type: String, default: "" }, // admin email
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

companyPayoutSchema.index({ reference: 1 }, { unique: true });

module.exports =
  mongoose.models.CompanyPayout || mongoose.model("CompanyPayout", companyPayoutSchema);