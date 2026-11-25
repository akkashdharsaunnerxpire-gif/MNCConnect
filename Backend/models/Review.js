// models/Review.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      index: true,
    },
    fresher: {
      type: Schema.Types.ObjectId,
      ref: "Fresher",
      required: true,
    },
    fresherName: { type: String, default: "Fresher" },
    fresherRole: { type: String, default: "Fresher" },

    sessionKey: { type: String, required: true },
    session: { type: String, default: "Mentoring session" },

    // Snapshot of the session time (so the date never goes missing)
    sessionStartsAt: { type: Date, default: null },
    sessionEndsAt: { type: Date, default: null },
    sessionDate: { type: String, default: "" },
    sessionTime: { type: String, default: "" },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000, trim: true },

    // Users who liked this review
    likedBy: [
      {
        user: { type: Schema.Types.ObjectId, required: true },
        role: {
          type: String,
          enum: ["mentor", "fresher"],
          required: true,
        },
      },
    ],

    reply: {
      text: { type: String, default: "", maxlength: 1000 },
      repliedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ fresher: 1, sessionKey: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);