
const express = require("express");

const router = express.Router();

// Meta webhook verification
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Receive WhatsApp delivery updates
router.post("/", (req, res) => {
  try {
    const entries = req.body?.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Delivery status updates
        for (const status of value.statuses || []) {
          console.log("📱 WHATSAPP DELIVERY STATUS:", {
            messageId: status.id,
            recipient: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            errors: status.errors || [],
          });
        }

        // Incoming messages
        for (const message of value.messages || []) {
          console.log("📩 INCOMING WHATSAPP MESSAGE:", {
            from: message.from,
            type: message.type,
          });
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);
    return res.sendStatus(500);
  }
});

module.exports = router;
