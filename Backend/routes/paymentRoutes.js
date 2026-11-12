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
router.get("/fee-quote", requireAuth("fresher"), quoteFee);
router.post("/create-order", requireAuth("fresher"), createOrder);
router.post("/verify-payment", requireAuth("fresher"), verifyPayment);
router.post("/failed", requireAuth("fresher"), markPaymentFailed);
router.post("/pay-with-wallet", requireAuth("fresher"), payWithWallet);

// NO requireAuth here (Razorpay calls it, signature protects it)
router.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

module.exports = router;