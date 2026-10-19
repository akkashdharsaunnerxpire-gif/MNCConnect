// models/Notification.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ["mentor", "fresher"], default: "mentor" },

    title: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error", "payment", "review", "session"],
      default: "info",
    },
    link: { type: String, default: "" },

    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, role: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);