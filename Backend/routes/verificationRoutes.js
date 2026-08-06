const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadProof, approveMentor } = require('../controllers/verificationController');

// Mentor uploads proof document
router.post('/upload-proof', protect, authorize('mentor'), upload.single('proofDocument'), uploadProof);

// Admin approves mentor
router.put('/approve/:mentorId', protect, authorize('admin'), approveMentor);

module.exports = router;