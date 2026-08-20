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
     
    countryCode: {
      type: String,
      default: "+91",
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
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

    languages: {
      type: [String],
      default: [],
    },

    hourlyRate: {
      type: Number,
      min: 0,
      default: 0,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // Verification documents
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Mentor", mentorSchema);