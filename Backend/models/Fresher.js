const mongoose = require("mongoose");

const fresherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, default: null },
    emailOtpExpiresAt: { type: Date, default: null },

    mobile: { type: String, required: true, trim: true },
    countryCode: { type: String, default: "+91", trim: true },

    password: { type: String, required: true, select: false },

    profilePic: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    passwordResetToken: { type: String, default: undefined, select: false },
    passwordResetExpires: { type: Date, default: undefined, select: false },

    // ================= WALLET (3 separate buckets) =================
    // refundableBalance : real cash returned from cancelled/missed/disputed sessions (we OWE this)
    // bonusBalance      : promo credit (welcome bonus ...)            -> not cash
    // referralBalance   : referral credit                             -> not cash
    // `walletBalance` below is a VIRTUAL (sum of the 3). It is NOT stored anymore.
    refundableBalance: { type: Number, default: 0, min: 0 },
    bonusBalance: { type: Number, default: 0, min: 0 },
    referralBalance: { type: Number, default: 0, min: 0 },

    // lifetime statistics only (never used as spendable money)
    totalRefunds: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },

    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Fresher", default: null },
    hasUsedReferral: { type: Boolean, default: false },

    welcomeBonusClaimed: { type: Boolean, default: false },
    welcomeBonusSeen: { type: Boolean, default: false },

    profilePicPublicId: { type: String, default: "", select: false },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer not to say", ""],
      default: "",
    },
    dateOfBirth: { type: Date, default: null },
    location: { type: String, trim: true, default: "" },
    nationality: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, maxlength: 2000, default: "" },

    education: { type: [mongoose.Schema.Types.Mixed], default: [] },
    career: { type: [mongoose.Schema.Types.Mixed], default: [] },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

fresherSchema.virtual("fullMobile").get(function () {
  return this.countryCode + this.mobile;
});

// total spendable credit (read-only). NEVER do $inc on walletBalance any more.
fresherSchema.virtual("walletBalance").get(function () {
  const r = (n) => Math.round((Number(n) || 0) * 100) / 100;
  return r(
    (this.refundableBalance || 0) +
      (this.bonusBalance || 0) +
      (this.referralBalance || 0),
  );
});

module.exports = mongoose.model("Fresher", fresherSchema);