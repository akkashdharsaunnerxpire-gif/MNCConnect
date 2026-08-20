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
  },
  {
    timestamps: true,
  }
);

// Add a virtual for full mobile number
fresherSchema.virtual('fullMobile').get(function() {
  return this.countryCode + this.mobile;
});

module.exports = mongoose.model("Fresher", fresherSchema);