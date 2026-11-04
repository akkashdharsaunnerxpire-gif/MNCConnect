// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/panelAuth");
console.log(Object.keys(require("../controllers/paymentController")));
const {
  createOrder,
  verifyPayment,
  payWithWallet,
  markFailed,
  linkPayment,
  quoteFee,
  razorpayWebhook,
} = require("../controllers/paymentController");

// Razorpay
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/failed", markFailed);

// Wallet (fresher must be logged in)
router.post("/pay-with-wallet", requireAuth("fresher"), payWithWallet);

// link a paid payment to a session request
router.post("/link-payment", requireAuth("fresher"), linkPayment);
// public / optional auth, same place as create-order
router.get("/fee-quote", quoteFee);

// OPTIONAL webhook. It must be registered BEFORE express.json() or use raw only on this route:
router.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

module.exports = router;