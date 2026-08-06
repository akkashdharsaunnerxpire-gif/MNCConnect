const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getMyBookings, 
  createBooking, 
  acceptBookingSlot, 
  cancelAndRefundBooking, 
  submitFeedback 
} = require('../controllers/bookingController');

router.get('/my-bookings', protect, getMyBookings);
router.post('/', protect, createBooking);

// 🟢 MAKE SURE THIS ROUTE IS REGISTERED DIRECTLY:
router.post('/accept-slot', protect, acceptBookingSlot);

router.post('/cancel', protect, cancelAndRefundBooking);
router.post('/feedback', protect, submitFeedback);

module.exports = router;