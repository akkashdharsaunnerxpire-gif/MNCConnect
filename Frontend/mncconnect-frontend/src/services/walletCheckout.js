// src/services/walletCheckout.js
// Use this in your booking / checkout page.
import { api } from "./fresherApi";

// Pays the session fully from the wallet.
// Throws an Error with the server message when the balance is not enough:
//   "Insufficient wallet balance. You have ₹10 but this session needs ₹50."
export const payWithWallet = async ({ amount, topic, requestGroupId, date, time, duration }) => {
  return api("/payments/pay-with-wallet", {
    method: "POST",
    body: { amount, topic, requestGroupId, date, time, duration },
  });
};

/* ------------------------------------------------------------
   Example usage in the checkout page:

   import { payWithWallet } from "../../services/walletCheckout";

   const handleWalletPay = async () => {
     try {
       setPaying(true);
       const res = await payWithWallet({
         amount: sessionPrice,
         topic,
         requestGroupId,
         date, time, duration,
       });
       // success -> same next step you run after a Razorpay success
       onPaymentSuccess({ paymentId: res.paymentId });
     } catch (err) {
       // not enough money -> err.message already says how much is missing
       setError(err.message);
     } finally {
       setPaying(false);
     }
   };

   // optional: disable the button early using the balance you already have
   // const notEnough = walletBalance < sessionPrice;
------------------------------------------------------------ */