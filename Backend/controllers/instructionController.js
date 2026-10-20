// controllers/instructionController.js
const Instruction = require("../models/Instruction");

// GET /api/instructions?lang=en   (mentor or fresher)
exports.getInstructions = async (req, res) => {
  try {
    const role = req.user.role;
    if (!["mentor", "fresher"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only mentors and freshers can load instructions.",
      });
    }

    const language = String(req.query.lang || "en").toLowerCase();

    let items = await Instruction.find({
      role,
      language,
      isActive: true,
    })
      .sort({ order: 1 })
      .lean();

    if (!items.length) {
      items = await Instruction.find({
        role,
        language: "en",
        isActive: true,
      })
        .sort({ order: 1 })
        .lean();
    }

    return res.json({ success: true, language, instructions: items });
  } catch (err) {
    console.error("getInstructions error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load instructions." });
  }
};