const express = require('express');
const router = express.Router();
const { getMentors, getMentorById } = require('../controllers/mentorController');

router.get('/', getMentors);
router.get('/:id', getMentorById);

module.exports = router;