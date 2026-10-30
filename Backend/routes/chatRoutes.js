// routes/chatRoutes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/panelAuth");
const { getChatHistory, getUnreadCounts } = require("../models/ChatMessage");

// requireAuth reads the HttpOnly cookie and sets req.user
// NOTE: "/unread" must stay ABOVE "/:bookingId"
router.get("/unread", requireAuth("fresher", "mentor"), getUnreadCounts);
router.get("/:bookingId", requireAuth("fresher", "mentor"), getChatHistory);
module.exports = router;