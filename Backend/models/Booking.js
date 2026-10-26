// models/Booking.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    requestGroupId: { type: String, required: true, unique: true },

    fresher: {
      type: Schema.Types.ObjectId,
      ref: "Fresher",
      default: null,
      index: true,
    },
    fresherName: { type: String, default: "Fresher" },
    fresherEmail: { type: String, default: "", lowercase: true, trim: true },
    fresherImage: { type: String, default: "" },

    companyName: { type: String, required: true, trim: true },
    sessionType: { type: String, default: "" },
    reason: { type: String, default: "", maxlength: 1000 },
    role: { type: String, default: "" },
    otherRole: { type: String, default: "" },
    gender: { type: String, default: "" },
    language: { type: String, default: "" },

    durationMinutes: { type: Number, required: true },
    amount: { type: Number, required: true },

    date: { type: String, default: "" },
    time: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "in_progress",
        "awaiting_confirmation",
        "completed",
        "disputed",
        "expired",
        "missed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      default: null,
      index: true,
    },

    // "Book again": the fresher picked this exact mentor. null = normal broadcast request.
    preferredMentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      default: null,
      index: true,
    },

    notified: [{ type: Schema.Types.ObjectId }],
    declinedBy: [{ type: Schema.Types.ObjectId }],

    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    razorpayPaymentId: { type: String, default: "" },
    refundStatus: {
      type: String,
      enum: ["", "refunded", "failed"],
      default: "",
    },

    reminderSent: { type: Boolean, default: false },
    reviewed: { type: Boolean, default: false },

    meeting: {
      remainingMs: { type: Number, default: null },
      startedAt: { type: Date, default: null },
      timerEndsAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      successRequested: { type: Boolean, default: false },
      fresherConfirmed: { type: Boolean, default: false },
      instructionsAccepted: {
        mentor: { type: Boolean, default: false },
        fresher: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true },
);

bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ mentor: 1, status: 1, startsAt: 1 });
bookingSchema.index({ status: 1, "meeting.timerEndsAt": 1 });
bookingSchema.index({ status: 1, refundStatus: 1 });

// Prevent duplicate bookings using the same Razorpay payment ID
bookingSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string", $gt: "" },
    },
  },
);

// Improve queries filtering by status and notification state
bookingSchema.index({ status: 1, notified: 1 });

module.exports = mongoose.model("Booking", bookingSchema);

module.exports = mongoose.model("Booking", bookingSchema);
