// routes/instructionRoutes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/panelAuth");
const { getInstructions } = require("../controllers/instructionController");

router.get("/", requireAuth("mentor", "fresher"), getInstructions);

module.exports = router;