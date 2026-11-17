const mongoose = require("mongoose");

const fresherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    // sha256 HMAC of the code (never the plain OTP)
    emailOtp: { type: String, default: null },
    emailOtpExpiresAt: { type: Date, default: null },
    emailOtpAttempts: { type: Number, default: 0 },

    // stored as "+919876543210" (see utils/phone.js)
    mobile: { type: String, required: true, trim: true },
    countryCode: { type: String, default: "+91", trim: true },

    password: { type: String, required: true, select: false },

    profilePic: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    passwordResetToken: { type: String, default: undefined, select: false },
    passwordResetExpires: { type: Date, default: undefined, select: false },

    // ================= WALLET (3 separate buckets) =================
    // refundableBalance : real cash returned from cancelled/missed/disputed sessions (we OWE this)
    // bonusBalance      : promo credit (welcome bonus ...)  -> not cash
    // referralBalance   : referral credit                   -> not cash
    // `walletBalance` below is a VIRTUAL (sum of the 3). NEVER $inc it.
    refundableBalance: { type: Number, default: 0, min: 0 },
    bonusBalance: { type: Number, default: 0, min: 0 },
    referralBalance: { type: Number, default: 0, min: 0 },

    // lifetime statistics only (never spendable)
    totalRefunds: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },

    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Fresher", default: null },
    hasUsedReferral: { type: Boolean, default: false },
    // code typed at sign-up. The reward is paid only AFTER the email is verified.
    pendingReferralCode: { type: String, default: "" },

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

    chatPrivacyAcceptedAt: { type: Date, default: null },
    chatPrivacyVersion: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// one phone number = one fresher account (the code also checks, this stops the race)
fresherSchema.index({ mobile: 1 }, { unique: true });

// "Temp" placeholders (created by send-otp) delete themselves after 24h.
// When the user finishes sign-up the name changes, so the account no longer matches.
fresherSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60, partialFilterExpression: { name: "Temp" } },
);

fresherSchema.virtual("fullMobile").get(function () {
  const m = String(this.mobile || "");
  return m.startsWith("+") ? m : `${this.countryCode || ""}${m}`;
});

// total spendable credit (read-only)
fresherSchema.virtual("walletBalance").get(function () {
  const r = (n) => Math.round((Number(n) || 0) * 100) / 100;
  return r(
    (this.refundableBalance || 0) +
      (this.bonusBalance || 0) +
      (this.referralBalance || 0),
  );
});

module.exports = mongoose.model("Fresher", fresherSchema);