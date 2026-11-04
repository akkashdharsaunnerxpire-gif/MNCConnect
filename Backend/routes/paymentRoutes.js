// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/panelAuth");

const {
  createOrder,
  verifyPayment,
  payWithWallet,
  markPaymentFailed,
  quoteFee,
  razorpayWebhook,
} = require("../controllers/paymentController");

// Fee quote
router.get("/fee-quote", quoteFee);

// Razorpay
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/failed", markPaymentFailed);

// Wallet
router.post(
  "/pay-with-wallet",
  requireAuth("fresher"),
  payWithWallet
);

// Razorpay Webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);

module.exports = router;