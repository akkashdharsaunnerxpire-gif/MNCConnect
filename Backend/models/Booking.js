// models/Booking.js
// One document per fresher session request. requestGroupId is the public id
// used by both apps (fresher + mentor), the socket events and the meeting room.
//
//  pending   -> paid, waiting for an online employee to accept
//  accepted  -> an employee accepted, session is scheduled
//  completed -> meeting timer finished (mentor money is released)
//  expired   -> nobody accepted before the start time  -> refunded
//  missed    -> accepted but the meeting never really started -> refunded

const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    requestGroupId: { type: String, required: true, unique: true },

    fresher: { type: Schema.Types.ObjectId, ref: "Fresher", default: null, index: true },
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

    date: { type: String, default: "" }, // "October 20, 2026"
    time: { type: String, default: "" }, // "3:30 PM"  (India time)
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "expired", "missed"],
      default: "pending",
      index: true,
    },

    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", default: null, index: true },
    notified: [{ type: Schema.Types.ObjectId }],
    declinedBy: [{ type: Schema.Types.ObjectId }],

    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    razorpayPaymentId: { type: String, default: "" },
    refundStatus: { type: String, enum: ["", "refunded", "failed"], default: "" },

    reminderSent: { type: Boolean, default: false },
    reviewed: { type: Boolean, default: false },

    meeting: {
      remainingMs: { type: Number, default: null },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ mentor: 1, status: 1, startsAt: 1 });

module.exports = mongoose.model("Booking", bookingSchema);