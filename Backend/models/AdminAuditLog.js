// models/AdminAuditLog.js
// Append-only record of every important admin action.
const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      // login_success, login_failed, logout, review_saved,
      // mentor_approve, mentor_reject, mentor_pending, bulk_*, export_mentors, user_toggle
    },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "Mentor", index: true },
    mentorName: String,
    adminEmail: { type: String, index: true },
    adminName: String,
    reason: String,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.AdminAuditLog || mongoose.model("AdminAuditLog", auditSchema);