
const express = require("express");
const router = express.Router();

const { getChatHistory } = require("../models/ChatMessage");

router.get("/:bookingId", getChatHistory);

module.exports = router;
