// scripts/seedInstructions.js
const Instruction = require("../models/Instruction");

const DEFAULTS = {
  en: {
    mentor: [
      "Be on time. The meeting opens 5 minutes before the scheduled start.",
      "Use professional language. Never be harsh or dismissive with the fresher.",
      "Listen first, then guide. Give actionable advice, not just opinions.",
      "If you cannot help with a topic, say so honestly and suggest alternatives.",
      "In the last 5 minutes of the session, ask the fresher to confirm the session went well (they must click 'Yes, all good').",
      "Ask the fresher to leave an honest review after confirming. This is required.",
      "Never leave the meeting early. If you leave, the timer still runs but the fresher can report an issue and your payment will be withheld.",
      "Never share confidential company information.",
    ],
    fresher: [
      "Join within 5 minutes of the meeting opening. If you don't, the session may be cancelled.",
      "Keep your microphone muted unless you are speaking.",
      "Be respectful. The mentor is giving their personal time to help you.",
      "Come prepared with specific questions.",
      "If you need to leave early, inform the mentor in chat.",
      "In the last 5 minutes, you will be asked to confirm the session went well. Only click 'Yes' if the mentor attended and helped you.",
      "After confirming, write an honest review — it takes 30 seconds.",
    ],
  },
  ta: {
    mentor: [
      "நேரத்திற்கு வாருங்கள். சந்திப்பு தொடங்கும் 5 நிமிடங்களுக்கு முன்பே அறை திறக்கும்.",
      "தொழில்முறை மொழியைப் பயன்படுத்துங்கள். ஃப்ரெஷரிடம் கடுமையாகவோ அவமதிப்பாகவோ பேசக்கூடாது.",
      "முதலில் கேளுங்கள், பிறகு வழிகாட்டுங்கள். கருத்துகள் அல்ல, செயல்படக்கூடிய ஆலோசனைகளை வழங்குங்கள்.",
      "ஒரு தலைப்பில் உதவ முடியாவிட்டால், நேர்மையாகச் சொல்லி மாற்று வழிகளை பரிந்துரைக்கவும்.",
      "கடைசி 5 நிமிடங்களில், ஃப்ரெஷரிடம் 'செஷன் நன்றாக நடந்ததா?' எனக் கேட்டு உறுதிப்படுத்தச் சொல்லுங்கள் ('Yes, all good' click பண்ண சொல்லுங்கள்).",
      "உறுதிப்படுத்திய பிறகு, மதிப்பாய்வு எழுதச் சொல்லுங்கள். இது கட்டாயம்.",
      "சந்திப்பை முன்கூட்டியே விட்டு வெளியேற வேண்டாம். நீங்கள் வெளியேறினால், ஃப்ரெஷர் பிரச்சனை என்று சொன்னால் உங்கள் பணம் தடுத்து நிறுத்தப்படும்.",
      "நிறுவனத்தின் ரகசிய தகவல்களை ஒருபோதும் பகிர வேண்டாம்.",
    ],
    fresher: [
      "சந்திப்பு திறந்த 5 நிமிடங்களுக்குள் சேருங்கள். இல்லையெனில், அமர்வு ரத்து செய்யப்படலாம்.",
      "பேசாதபோது மைக்ரோஃபோனை ம்யூட் செய்து வைத்திருங்கள்.",
      "மரியாதையாக இருங்கள். மென்டர் தனது தனிப்பட்ட நேரத்தை உங்களுக்கு உதவ ஒதுக்குகிறார்.",
      "குறிப்பிட்ட கேள்விகளுடன் தயாராக வாருங்கள்.",
      "நேரத்திற்கு முன்பே செல்ல வேண்டும் என்றால், அரட்டையில் மென்டருக்குத் தெரிவிக்கவும்.",
      "கடைசி 5 நிமிடங்களில், 'செஷன் நன்றாக நடந்ததா?' எனக் கேட்கப்படும். மென்டர் வந்து உதவியிருந்தால் மட்டும் 'Yes' click செய்யுங்கள்.",
      "உறுதிப்படுத்திய பிறகு, நேர்மையான மதிப்பாய்வை எழுதுங்கள் — அது 30 வினாடிகள் மட்டுமே.",
    ],
  },
  hi: {
    mentor: [
      "समय पर आएं। बैठक निर्धारित समय से 5 मिनट पहले खुलती है।",
      "पेशेवर भाषा का प्रयोग करें। फ्रेशर से कभी कठोर या अपमानजनक व्यवहार न करें।",
      "पहले सुनें, फिर मार्गदर्शन करें। राय नहीं, व्यावहारिक सलाह दें।",
      "यदि किसी विषय में सहायता नहीं कर सकते, तो ईमानदारी से कहें और विकल्प सुझाएं।",
      "सत्र के अंतिम 5 मिनट में, फ्रेशर से सत्र अच्छा रहा या नहीं पूछें और 'Yes, all good' क्लिक करवाएं।",
      "पुष्टि के बाद, फ्रेशर से ईमानदार समीक्षा लिखने को कहें। यह आवश्यक है।",
      "कभी भी सत्र जल्दी न छोड़ें। यदि आप छोड़ते हैं और फ्रेशर शिकायत करता है, तो आपका भुगतान रोका जाएगा।",
      "कंपनी की गोपनीय जानकारी कभी साझा न करें।",
    ],
    fresher: [
      "बैठक खुलने के 5 मिनट के भीतर जुड़ें। अन्यथा, सत्र रद्द हो सकता है।",
      "बोलते समय छोड़कर, माइक्रोफ़ोन म्यूट रखें।",
      "सम्मानजनक रहें। मेंटर आपकी मदद के लिए अपना व्यक्तिगत समय दे रहे हैं।",
      "विशिष्ट प्रश्नों के साथ तैयार होकर आएं।",
      "यदि आपको जल्दी जाना है, तो चैट में मेंटर को सूचित करें।",
      "अंतिम 5 मिनट में आपसे पूछा जाएगा कि सत्र कैसा रहा। यदि मेंटर ने भाग लिया और मदद की, तो 'Yes' क्लिक करें।",
      "पुष्टि के बाद, ईमानदार समीक्षा लिखें — इसमें केवल 30 सेकंड लगते हैं।",
    ],
  },
  // ml, te, kn — add pannunga same structure la
};

module.exports = async function seedInstructions() {
  let count = 0;
  for (const [lang, roles] of Object.entries(DEFAULTS)) {
    for (const [role, texts] of Object.entries(roles)) {
      for (let i = 0; i < texts.length; i++) {
        await Instruction.updateOne(
          { role, language: lang, order: i },
          { $set: { text: texts[i], isActive: true } },
          { upsert: true }
        );
        count++;
      }
    }
  }
  console.log(`✅ Instructions seeded (${count} entries)`);
};