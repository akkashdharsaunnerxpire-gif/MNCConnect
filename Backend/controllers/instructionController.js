// controllers/instructionController.js
const Instruction = require("../models/Instruction");

// Default instructions if DB is empty
const DEFAULT_INSTRUCTIONS = {
  en: {
    mentor: [
      "Be on time. The meeting opens 5 minutes before the scheduled start.",
      "Use professional language. Never be harsh or dismissive with the fresher.",
      "Listen first, then guide. Give actionable advice, not just opinions.",
      "If you cannot help with a topic, say so honestly and suggest alternatives.",
      "In the last 5 minutes of the session, ask the fresher to confirm the session went well.",
      "Ask the fresher to leave an honest review after confirming.",
      "Never leave the meeting early. If you leave, your payment will be withheld.",
      "Never share confidential company information."
    ],
    fresher: [
      "Join within 5 minutes of the meeting opening.",
      "Keep your microphone muted unless you are speaking.",
      "Be respectful. The mentor is giving their personal time to help you.",
      "Come prepared with specific questions.",
      "If you need to leave early, inform the mentor in chat.",
      "In the last 5 minutes, you will be asked to confirm the session went well.",
      "After confirming, write an honest review — it takes 30 seconds."
    ]
  },
  ta: {
    mentor: [
      "நேரத்திற்கு வாருங்கள். சந்திப்பு தொடங்கும் 5 நிமிடங்களுக்கு முன்பே அறை திறக்கும்.",
      "தொழில்முறை மொழியைப் பயன்படுத்துங்கள். ஃப்ரெஷரிடம் கடுமையாகவோ அவமதிப்பாகவோ பேசக்கூடாது.",
      "முதலில் கேளுங்கள், பிறகு வழிகாட்டுங்கள். கருத்துகள் அல்ல, செயல்படக்கூடிய ஆலோசனைகளை வழங்குங்கள்.",
      "ஒரு தலைப்பில் உதவ முடியாவிட்டால், நேர்மையாகச் சொல்லி மாற்று வழிகளை பரிந்துரைக்கவும்.",
      "கடைசி 5 நிமிடங்களில், ஃப்ரெஷரிடம் 'செஷன் நன்றாக நடந்ததா?' எனக் கேட்டு உறுதிப்படுத்தச் சொல்லுங்கள்.",
      "உறுதிப்படுத்திய பிறகு, மதிப்பாய்வு எழுதச் சொல்லுங்கள். இது கட்டாயம்.",
      "சந்திப்பை முன்கூட்டியே விட்டு வெளியேற வேண்டாம். நீங்கள் வெளியேறினால், உங்கள் பணம் தடுத்து நிறுத்தப்படும்.",
      "நிறுவனத்தின் ரகசிய தகவல்களை ஒருபோதும் பகிர வேண்டாம்."
    ],
    fresher: [
      "சந்திப்பு திறந்த 5 நிமிடங்களுக்குள் சேருங்கள்.",
      "பேசாதபோது மைக்ரோஃபோனை ம்யூட் செய்து வைத்திருங்கள்.",
      "மரியாதையாக இருங்கள். மென்டர் தனது தனிப்பட்ட நேரத்தை உங்களுக்கு உதவ ஒதுக்குகிறார்.",
      "குறிப்பிட்ட கேள்விகளுடன் தயாராக வாருங்கள்.",
      "நேரத்திற்கு முன்பே செல்ல வேண்டும் என்றால், அரட்டையில் மென்டருக்குத் தெரிவிக்கவும்.",
      "கடைசி 5 நிமிடங்களில், 'செஷன் நன்றாக நடந்ததா?' எனக் கேட்கப்படும்.",
      "உறுதிப்படுத்திய பிறகு, நேர்மையான மதிப்பாய்வை எழுதுங்கள் — அது 30 வினாடிகள் மட்டுமே."
    ]
  },
  hi: {
    mentor: [
      "समय पर आएं। बैठक निर्धारित समय से 5 मिनट पहले खुलती है।",
      "पेशेवर भाषा का प्रयोग करें। फ्रेशर से कभी कठोर या अपमानजनक व्यवहार न करें।",
      "पहले सुनें, फिर मार्गदर्शन करें। राय नहीं, व्यावहारिक सलाह दें।",
      "यदि किसी विषय में सहायता नहीं कर सकते, तो ईमानदारी से कहें।",
      "सत्र के अंतिम 5 मिनट में, फ्रेशर से सत्र अच्छा रहा या नहीं पूछें।",
      "पुष्टि के बाद, फ्रेशर से ईमानदार समीक्षा लिखने को कहें।",
      "कभी भी सत्र जल्दी न छोड़ें। यदि आप छोड़ते हैं, तो आपका भुगतान रोका जाएगा।",
      "कंपनी की गोपनीय जानकारी कभी साझा न करें।"
    ],
    fresher: [
      "बैठक खुलने के 5 मिनट के भीतर जुड़ें।",
      "बोलते समय छोड़कर, माइक्रोफ़ोन म्यूट रखें।",
      "सम्मानजनक रहें। मेंटर आपकी मदद के लिए अपना समय दे रहे हैं।",
      "विशिष्ट प्रश्नों के साथ तैयार होकर आएं।",
      "यदि आपको जल्दी जाना है, तो चैट में मेंटर को सूचित करें।",
      "अंतिम 5 मिनट में आपसे पूछा जाएगा कि सत्र कैसा रहा।",
      "पुष्टि के बाद, ईमानदार समीक्षा लिखें — इसमें केवल 30 सेकंड लगते हैं।"
    ]
  }
};

// GET /api/instructions?lang=en
exports.getInstructions = async (req, res) => {
  try {
    const role = req.user.role;
    if (!["mentor", "fresher"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only mentors and freshers can load instructions.",
      });
    }

    let language = String(req.query.lang || "en").toLowerCase();

    // If language is not in our default list, fallback to English
    if (!DEFAULT_INSTRUCTIONS[language]) {
      language = "en";
    }

    // Try to find in DB
    let items = await Instruction.find({
      role,
      language,
      isActive: true,
    })
      .sort({ order: 1 })
      .lean();

    // ✅ If DB is empty, use defaults and save them
    if (!items || items.length === 0) {
      console.log(`⚠️ No instructions found in DB for ${language}-${role}. Using defaults.`);
      
      const defaultTexts = DEFAULT_INSTRUCTIONS[language][role] || [];
      
      const docs = defaultTexts.map((text, index) => ({
        role,
        language,
        text,
        order: index,
        isActive: true,
      }));

      try {
        // Save to DB so next time it fetches from DB
        await Instruction.insertMany(docs);
      } catch (e) {
        console.error("Failed to save default instructions to DB:", e.message);
      }

      items = docs;
    }

    return res.json({ success: true, language, instructions: items });
  } catch (err) {
    console.error("getInstructions error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load instructions." });
  }
};