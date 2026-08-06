const User = require('../models/User');

// @desc    Get all verified mentors with filter options (Language, Company)
// @route   GET /api/mentors
// @access  Public
exports.getMentors = async (req, res) => {
  try {
    const { language, company, role } = req.query;

    let query = { role: 'mentor', 'mentorProfile.isVerified': true };

    // Filter by language if selected
    if (language) {
      query['mentorProfile.languages'] = { $in: [language] };
    }

    // Filter by company name if requested
    if (company) {
      query['mentorProfile.companyName'] = { $regex: company, $options: 'i' };
    }

    const mentors = await User.find(query).select('-password');
    res.json(mentors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single mentor profile details
// @route   GET /api/mentors/:id
// @access  Public
exports.getMentorById = async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id).select('-password');

    if (mentor && mentor.role === 'mentor') {
      res.json(mentor);
    } else {
      res.status(404).json({ message: 'Mentor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};