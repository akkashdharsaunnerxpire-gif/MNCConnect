const User = require('../models/User');

// @desc    Upload proof document for mentor verification
// @route   POST /api/verification/upload-proof
// @access  Private (Mentor only)
exports.uploadProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    const user = await User.findById(req.user._id);

    if (user && user.role === 'mentor') {
      user.mentorProfile.proofDocument = req.file.path;
      user.mentorProfile.verificationMethod = 'document';
      await user.save();

      res.json({
        message: 'Document uploaded successfully! Pending admin approval.',
        filePath: req.file.path
      });
    } else {
      res.status(403).json({ message: 'Only mentors can upload proof documents' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin Approve or Reject Mentor Verification
// @route   PUT /api/verification/approve/:mentorId
// @access  Private (Admin only)
exports.approveMentor = async (req, res) => {
  try {
    const { isApproved } = req.body;
    const mentor = await User.findById(req.params.mentorId);

    if (mentor && mentor.role === 'mentor') {
      mentor.mentorProfile.isVerified = isApproved;
      await mentor.save();

      res.json({
        message: `Mentor verification status updated to: ${isApproved}`,
        mentor
      });
    } else {
      res.status(404).json({ message: 'Mentor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};