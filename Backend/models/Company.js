
const mongoose = require("mongoose");

const normalize = (name = "") =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[._-]/g, "");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      type: String,
      unique: true,
    },

    // Previous names are retained when admin renames a company.
    previousNames: {
      type: [String],
      default: [],
    },

    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },

    logoPublicId: { type: String, default: "" },
    coverPublicId: { type: String, default: "" },

    industry: {
      type: String,
      default: "Technology",
      trim: true,
    },

    category: {
      type: String,
      default: "Technology",
      trim: true,
    },
  },
  { timestamps: true }
);

companySchema.pre("validate", function () {
  this.normalizedName = normalize(this.name);
});

companySchema.statics.normalize = normalize;

module.exports = mongoose.model("Company", companySchema);
