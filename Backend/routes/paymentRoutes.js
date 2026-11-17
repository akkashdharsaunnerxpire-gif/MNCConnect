// routes/paymentRoutes.js
// The webhook is registered in app.js (raw body, BEFORE express.json()).
// A 2nd webhook route here would never run, so it was removed.
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/panelAuth");
const {
  createOrder,
  verifyPayment,
  payWithWallet,
  markPaymentFailed,
  quoteFee,
} = require("../controllers/paymentController");

router.get("/fee-quote", requireAuth("fresher"), quoteFee);
router.post("/create-order", requireAuth("fresher"), createOrder);
router.post("/verify-payment", requireAuth("fresher"), verifyPayment);
router.post("/failed", requireAuth("fresher"), markPaymentFailed);
router.post("/pay-with-wallet", requireAuth("fresher"), payWithWallet);

module.exports = router;