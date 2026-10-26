// models/MentorReview.js
// Stores the admin's MANUAL verification checklist for each mentor.
// Kept in its own collection so the existing Mentor schema is not touched.
const mongoose = require("mongoose");

// key, label, hint, required
const REVIEW_CHECKS = [
  {
    key: "offerLetterMatches",
    label: "Offer letter is genuine",
    hint: "Name, company, designation and joining date are consistent. Letterhead, signatory and fonts look right. No pasted or blurry text.",
    required: true,
  },
  {
    key: "idPhotoMatches",
    label: "Employee ID card matches the person",
    hint: "Name and company match the offer letter. Photo matches the mentor (profile photo or live video).",
    required: true,
  },
  {
    key: "workEmailBelongsToCompany",
    label: "Work email belongs to the company",
    hint: "Domain is the company's real domain (exact match, not a look-alike such as company-careers.com).",
    required: true,
  },
  {
    key: "linkedinMatches",
    label: "LinkedIn shows the same company and role",
    hint: "Company, role and joining period match. Profile is not brand new with no connections.",
    required: true,
  },
  {
    key: "noDuplicateAccount",
    label: "No duplicate or conflicting account",
    hint: "Employee ID, work email and phone are not used by another mentor.",
    required: true,
  },
  {
    key: "videoCallDone",
    label: "Short video call completed (recommended)",
    hint: "Live ID check and a few questions about the team and company.",
    required: false,
  },
];

const checksShape = {};
REVIEW_CHECKS.forEach((c) => {
  checksShape[c.key] = { type: Boolean, default: false };
});

const mentorReviewSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      unique: true,
      index: true,
    },
    checks: checksShape,
    notes: { type: String, default: "", maxlength: 1000 },
    reviewedBy: { name: String, email: String },
    reviewedAt: Date,
    history: [
      {
        at: { type: Date, default: Date.now },
        by: String,
        checks: mongoose.Schema.Types.Mixed,
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

const isComplete = (checks = {}) =>
  REVIEW_CHECKS.filter((c) => c.required).every((c) => checks[c.key] === true);

mentorReviewSchema.statics.REVIEW_CHECKS = REVIEW_CHECKS;
mentorReviewSchema.statics.isComplete = isComplete;

module.exports =
  mongoose.models.MentorReview ||
  mongoose.model("MentorReview", mentorReviewSchema);
module.exports.REVIEW_CHECKS = REVIEW_CHECKS;
module.exports.isComplete = isComplete;