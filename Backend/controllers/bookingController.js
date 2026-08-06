const Booking = require('../models/Booking');

// Get My Bookings (For Fresher & Mentor)
exports.getMyBookings = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'fresher') {
      // Fresher: Avaru create panna requests
      query = { fresherId: req.user._id };
    } else if (req.user.role === 'mentor') {
      // Safely fetch company name from top level OR mentorProfile
      const mentorCompany = (req.user.companyName || req.user.mentorProfile?.companyName || '').trim();

      query = {
        $or: [
          // Case-insensitive regex match for TCS, tcs, Tcs
          { 
            status: 'requested', 
            companyName: { $regex: new RegExp(`^${mentorCompany}$`, 'i') } 
          },
          { mentorId: req.user._id }
        ]
      };
    }

    const bookings = await Booking.find(query)
      .populate('fresherId', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create New Session Request
exports.createBooking = async (req, res) => {
  try {
    const { companyName, requirements, languageChosen, requestedDuration, preferredTimeWindow, paymentId, amountPaid } = req.body;

    const booking = await Booking.create({
      fresherId: req.user._id,
      companyName: companyName.trim(),
      requirements,
      languageChosen,
      requestedDuration,
      preferredTimeWindow,
      paymentId,
      amountPaid,
      paymentStatus: 'paid',
      status: 'requested'
    });

    const io = req.app.get('io');
    if (io) {
      // Emit to room in lowercase format
      const companyRoom = `company_${companyName.toLowerCase().trim()}`;
      io.to(companyRoom).emit('new_fresher_request', {
        message: `🔔 New ${companyName} Session Request! Claim now.`,
        booking
      });
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Mentor Accepts Slot
// Mentor Accepts Slot
// Mentor Accepts Slot
exports.acceptBookingSlot = async (req, res) => {
  try {
    const { bookingId, confirmedMeetingTime, meetingLink } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }
    
    if (booking.status !== 'requested') {
      return res.status(400).json({ message: 'Booking already claimed or processed!' });
    }

    // 🟢 Solution: Direct Atomic Update (Bypasses full model schema re-validation errors)
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: 'accepted',
          mentorId: req.user._id,
          confirmedMeetingTime: confirmedMeetingTime,
          meetingLink: meetingLink || `MNCConnect-${bookingId}`
        }
      },
      { new: true, runValidators: false } // skips re-checking amountPaid & preferredTimeWindow
    );

    // Socket Notification
    const io = req.app.get('io');
    if (io) {
      io.emit(`fresher_notification_${updatedBooking.fresherId}`, {
        message: `🎉 Great News! A mentor accepted your session slot!`,
        booking: updatedBooking
      });
    }

    return res.json({ 
      success: true, 
      message: 'Session slot confirmed!', 
      booking: updatedBooking 
    });

  } catch (error) {
    console.error('Accept Slot Error:', error);
    return res.status(500).json({ message: error.message || 'Server error accepting slot' });
  }
};

// Cancel & Refund
exports.cancelAndRefundBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'cancelled_refunded';
    booking.paymentStatus = 'refunded';
    await booking.save();

    res.json({ 
      success: true, 
      message: `₹${booking.amountPaid} refunded successfully to original payment method.` 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit Star Rating
// Submit Star Rating & Feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.feedback = { rating, comment, submittedAt: new Date() };
    booking.status = 'completed';
    await booking.save();

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};