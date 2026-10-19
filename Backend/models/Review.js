// models/Review.js
// A fresher reviews a mentor after a paid, finished session.
// One review per (fresher, session).

const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
    fresher: { type: Schema.Types.ObjectId, ref: "Fresher", required: true },
    fresherName: { type: String, default: "Fresher" },
    fresherRole: { type: String, default: "Fresher" },

    // requestGroupId of the session (or the payment id when there is none)
    sessionKey: { type: String, required: true },
    session: { type: String, default: "Mentoring session" },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000, trim: true },

    reply: {
      text: { type: String, default: "", maxlength: 1000 },
      repliedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ fresher: 1, sessionKey: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);