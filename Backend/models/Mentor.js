const mongoose = require("mongoose");

const mentorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    countryCode: {
      type: String,
      trim: true,
      default: "+91",
      match: [/^\+\d{1,4}$/, "Invalid country code"],
    },
    mobile: {
  type: String,
  required: true,
  trim: true,
  match: [/^\+\d{7,18}$/, "Enter a valid mobile number"],
},
    password: { type: String, required: true, select: false },
    profilePic: { type: String, default: "" },

    // Company's own employee ID (private, never shown to freshers)
    employeeId: { type: String, required: true, trim: true },

    // Public unique ID, e.g. ARUN#4356356 (freshers can search with it)
    mentorCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },

    workEmail: { type: String, lowercase: true, trim: true, default: "" },
    linkedinProfile: { type: String, trim: true, default: "" },
    yearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
    currentCompany: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      lowercase: true,
      trim: true,
      required: true,
    },
    department: { type: String, required: true, trim: true },
    officeLocation: { type: String, trim: true, default: "" },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    bio: { type: String, trim: true, maxlength: 2000, default: "" },

    // Verification documents (private - never send these to public APIs)
    offerLetter: { type: String, default: "" },
    employeeIdProof: { type: String, default: "" },
    additionalProof: { type: String, default: "" },

    // Cloudinary public ids (needed to delete the files later)
    offerLetterPublicId: { type: String, default: "" },
    employeeIdProofPublicId: { type: String, default: "" },
    additionalProofPublicId: { type: String, default: "" },

    // Verification
    isVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verificationMethod: {
      type: String,
      enum: ["document", "email_otp", "pending"],
      default: "pending",
    },
    rejectionReason: { type: String, trim: true, default: "" },
    accountStatus: {
      type: String,
      enum: ["pending", "active", "rejected", "suspended"],
      default: "pending",
      index: true,
    },

    // ---- stats (written by createReview / settleCompleted) ----
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    totalSessions: { type: Number, default: 0, min: 0 },
      missedSessions: { type: Number, default: 0, min: 0 },

    lastLoginAt: { type: Date, default: null },
    passwordResetToken: { type: String, default: undefined, select: false },
    passwordResetExpires: { type: Date, default: undefined, select: false },
    profilePicPublicId: { type: String, default: "", select: false },
    chatPrivacyAcceptedAt: { type: Date, default: null },
    chatPrivacyVersion: { type: String, default: "" },
  },
  { timestamps: true },
);

mentorSchema.index({ currentCompany: 1, name: 1 });
mentorSchema.index({ mobile: 1 }, { unique: true });
// duplicate-account guards (the admin checklist "noDuplicateAccount" is now enforced by the DB)
mentorSchema.index(
  { currentCompany: 1, employeeId: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
mentorSchema.index(
  { workEmail: 1 },
  { unique: true, partialFilterExpression: { workEmail: { $type: "string", $gt: "" } } },
);

module.exports = mongoose.model("Mentor", mentorSchema);