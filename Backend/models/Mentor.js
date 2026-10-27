const mongoose = require("mongoose");

const mentorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Dial code only, e.g. "+91", "+1", "+971"
    countryCode: {
      type: String,
      trim: true,
      default: "+91",
      match: [/^\+\d{1,4}$/, "Invalid country code"],
    },

    // Full number stored as countryCode + national digits, e.g. "+919876543210"
    // (same format as the Fresher model, so duplicate checks work across both)
    mobile: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+\d{7,18}$/, "Mobile must include country code, e.g. +919876543210"],
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    profilePic: {
      type: String,
      default: "",
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
    },

    workEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    linkedinProfile: {
      type: String,
      trim: true,
      default: "",
    },

    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },

    currentCompany: {
      type: String,
      required: true,
      trim: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      lowercase: true,
      trim: true,
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    officeLocation: {
      type: String,
      trim: true,
      default: "",
    },

    // NEW: registration form sends skills, but schema did not have it
    skills: {
      type: [String],
      default: [],
    },

    languages: {
      type: [String],
      default: [],
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // Verification documents (private - never send these to public APIs)
    offerLetter: {
      type: String,
      default: "",
    },

    employeeIdProof: {
      type: String,
      default: "",
    },

    additionalProof: {
      type: String,
      default: "",
    },

    // Cloudinary public ids (needed to delete the files later)
    offerLetterPublicId: {
      type: String,
      default: "",
    },

    employeeIdProofPublicId: {
      type: String,
      default: "",
    },

    additionalProofPublicId: {
      type: String,
      default: "",
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },

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

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    accountStatus: {
      type: String,
      enum: ["pending", "active", "rejected", "suspended"],
      default: "pending",
      index: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: undefined,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: undefined,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Mentor", mentorSchema);