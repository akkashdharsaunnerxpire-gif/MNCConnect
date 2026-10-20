// models/Instruction.js
const mongoose = require("mongoose");

const instructionSchema = new mongoose.Schema({
  role: { type: String, enum: ["mentor", "fresher"], required: true, index: true },
  language: { type: String, required: true, index: true }, // "en", "ta", "hi", "ml", "te", "kn"
  order: { type: Number, default: 0 },
  text: { type: String, required: true, maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

instructionSchema.index({ role: 1, language: 1, order: 1 });

module.exports = mongoose.model("Instruction", instructionSchema);