const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  fresherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyName: { type: String, required: true },
  languageChosen: { type: String, required: true },
  requirements: { type: String, required: true },
  requestedDuration: { type: String, default: '30 mins' },
  
  // Dynamic Flexible Windows
  preferredTimeWindow: { type: String, required: true }, // e.g., '6:00 PM - 9:00 PM'
  confirmedMeetingTime: { type: Date }, // Exact time set by mentor
  
  // Payment Status
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  paymentId: { type: String },
  amountPaid: { type: Number, required: true },
  
  // Swiggy Style Lifecycle Status
  status: { 
    type: String, 
    enum: ['requested', 'accepted', 'completed', 'cancelled_refunded'], 
    default: 'requested' 
  },
  meetingLink: { type: String },

  // Post-Session Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    submittedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);