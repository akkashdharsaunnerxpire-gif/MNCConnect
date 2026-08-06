const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['fresher', 'mentor', 'admin'], default: 'fresher' },
  profilePic: { type: String, default: '' },
  
  // Mentor Specific Fields
  mentorProfile: {
    companyName: { type: String },
    companyLocation: { type: String },
    designation: { type: String },
    linkedinUrl: { type: String },
    workEmail: { type: String },
    languages: [{ type: String }], // e.g. ['Tamil', 'English']
    experienceYears: { type: Number },
    hourlyRate: { type: Number, default: 0 },
    bio: { type: String },
    proofDocument: { type: String }, // Path/URL for ID Card or Offer Letter
    isVerified: { type: Boolean, default: false },
    verificationMethod: { type: String, enum: ['email_otp', 'document', 'pending'], default: 'pending' }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);