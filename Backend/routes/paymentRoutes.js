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
} = require("../controllers/paymentController");

// Razorpay
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/failed", markFailed);

// Wallet (fresher must be logged in)
router.post("/pay-with-wallet", requireAuth("fresher"), payWithWallet);

// link a paid payment to a session request
router.post("/link-payment", requireAuth("fresher"), linkPayment);

module.exports = router;