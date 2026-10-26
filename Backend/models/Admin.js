// models/Admin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
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
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    // Validated on the PLAIN password before it is hashed.
    // Raise minlength to 12 once your .env password is long enough.
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// HASH PASSWORD BEFORE SAVING
// ============================================================

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ============================================================
// COMPARE PASSWORD
// ============================================================

adminSchema.methods.comparePassword = async function (enteredPassword) {
  // password is `select: false`; without .select("+password") it is undefined
  if (!this.password || !enteredPassword) return false;
  return bcrypt.compare(String(enteredPassword), this.password);
};

// `models.Admin ||` avoids OverwriteModelError on nodemon hot reload
module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);