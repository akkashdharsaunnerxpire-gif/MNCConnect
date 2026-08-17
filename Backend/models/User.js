const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Common User Fields
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ['fresher', 'mentor', 'admin'],
      default: 'fresher'
    },

    profilePic: {
      type: String,
      default: ''
    },

    // Mentor Specific Fields
    mentorProfile: {

      employeeId: {
        type: String,
        default: ''
      },

      workEmail: {
        type: String,
        default: ''
      },

      linkedinProfile: {
        type: String,
        default: ''
      },

      yearsOfExperience: {
        type: Number,
        default: 0
      },

      currentCompany: {
        type: String,
        default: ''
      },

      companyName: {
        type: String,
        default: ''
      },

      designation: {
        type: String,
        default: ''
      },

      department: {
        type: String,
        default: ''
      },

      officeLocation: {
        type: String,
        default: ''
      },

      languages: [{
        type: String
      }],

      hourlyRate: {
        type: Number,
        default: 0
      },

      bio: {
        type: String,
        default: ''
      },

      // Offer letter / ID card document
      offerLetter: {
        type: String,
        default: ''
      },

      // Verification
      isVerified: {
        type: Boolean,
        default: false
      },

      verificationMethod: {
        type: String,
        enum: ['email_otp', 'document', 'pending'],
        default: 'pending'
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);