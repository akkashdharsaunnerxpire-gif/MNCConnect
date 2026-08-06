const express = require('express');
const router = express.Router();

// Mock AI Logic (Replace with Groq / OpenAI / Gemini API call)
router.post('/generate-questions', async (req, res) => {
  const { companyName, requirements, duration } = req.body;

  try {
    // Standard AI output structured response
    const aiResponse = {
      summary: `Tailored preparation plan for ${companyName} (${duration} session)`,
      recommendedTopics: [
        `Core Technical Deep Dive for ${companyName}`,
        'System Design & Data Structures Fundamentals',
        'Behavioral & Culture Fit Assessment'
      ],
      customQuestions: [
        `Explain how you handled performance optimization in your projects for a role at ${companyName}.`,
        'Walk through the architecture of a full-stack web application you recently built.',
        `How do you manage asynchronous state updates and API failures in production?`
      ]
    };

    res.json(aiResponse);
  } catch (err) {
    res.status(500).json({ message: 'AI Preparation Generator failed' });
  }
});

module.exports = router;    