
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/panelAuth");

const {
  getChatHistory,
  getUnreadCounts,
} = require("../models/ChatMessage");

const {
  getPrivacyStatus,
  acceptPrivacy,
  requirePrivacyAccepted,
} = require("../controllers/chatPrivacyController");

const chatAuth = requireAuth("fresher", "mentor");

// Privacy endpoints
router.get("/privacy", chatAuth, getPrivacyStatus);
router.post("/privacy/accept", chatAuth, acceptPrivacy);

// Existing chat endpoints
// Keep /unread above /:bookingId
router.get(
  "/unread",
  chatAuth,
  requirePrivacyAccepted,
  getUnreadCounts
);

router.get(
  "/:bookingId",
  chatAuth,
  requirePrivacyAccepted,
  getChatHistory
);

module.exports = router;
