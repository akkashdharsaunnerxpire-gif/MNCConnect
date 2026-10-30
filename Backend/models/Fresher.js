const mongoose = require("mongoose");

const fresherSchema = new mongoose.Schema(
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
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailOtp: {
      type: String,
      default: null,
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
    },

    countryCode: {
      type: String,
      default: "+91",
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
    walletBalance: {
      type: Number,
      default: 0, // Amount available to use for bookings
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fresher",
      default: null,
    },
    hasUsedReferral: {
      type: Boolean,
      default: false,
    },

    // welcome bonus ₹25 wallet la add aachu
    welcomeBonusClaimed: {
      type: Boolean,
      default: false,
    },
    // gift animation user paathu "claim" pannitaara? true aana marubadi varaadhu
    welcomeBonusSeen: {
      type: Boolean,
      default: false,
    },
    profilePicPublicId: {
  type: String,
  default: "",
  select: false,
},
gender: {
  type: String,
  enum: ["male", "female", "other", "prefer not to say", ""],
  default: "",
},

dateOfBirth: {
  type: Date,
  default: null,
},

location: {
  type: String,
  trim: true,
  default: "",
},

nationality: {
  type: String,
  trim: true,
  default: "",
},

bio: {
  type: String,
  trim: true,
  maxlength: 2000,
  default: "",
},

education: {
  type: [mongoose.Schema.Types.Mixed],
  default: [],
},

career: {
  type: [mongoose.Schema.Types.Mixed],
  default: [],
},

skills: {
  type: [String],
  default: [],
},

interests: {
  type: [String],
  default: [],
},
  },
  {
    timestamps: true,
  },
);

// Add a virtual for full mobile number
fresherSchema.virtual("fullMobile").get(function () {
  return this.countryCode + this.mobile;
});

module.exports = mongoose.model("Fresher", fresherSchema);