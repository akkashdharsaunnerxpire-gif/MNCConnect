
// controllers/instructionController.js

const Instruction = require("../models/Instruction");

// ============================================================
// DEFAULT INSTRUCTIONS
// English (en), Tamil (ta), Hindi (hi)
// ============================================================

const DEFAULT_INSTRUCTIONS = {
  en: {
    mentor: [
      "Be on time. The meeting opens 5 minutes before the scheduled start.",
      "Use professional language. Never be harsh or dismissive with the fresher.",
      "Listen first, then guide. Give actionable advice, not just opinions.",
      "If you cannot help with a topic, say so honestly and suggest alternatives.",
      "In the last 5 minutes of the session, ask the fresher to confirm the session went well.",
      "Ask the fresher to leave an honest review after confirming.",
      "Never leave the meeting early without a valid reason. Follow the platform's session completion policy.",
      "Never share confidential company information, internal documents, source code, or unreleased business information.",

      // PERSONAL INFORMATION & PRIVACY
      "Never ask the fresher for personal contact details such as phone numbers, personal email addresses, or home addresses.",
      "Never request passwords, OTPs, UPI PINs, bank details, card information, or government identity documents.",
      "Never ask the fresher to share private documents, account credentials, or sensitive personal information.",
      "Never request access to the fresher's personal accounts, devices, or social media accounts.",
      "Respect the fresher's privacy, personal boundaries, and individual decisions.",
      "Never force the fresher to connect through personal social media or messaging accounts.",

      // PROFESSIONAL CONDUCT
      "Never ask for money, gifts, loans, or payments outside the official MNCConnect platform.",
      "Do not make false promises about jobs, internships, referrals, salaries, or guaranteed placements.",
      "Never discriminate based on gender, age, language, background, or personal circumstances.",
      "Do not use abusive, threatening, sexually inappropriate, or harassing language.",
      "Do not promote scams, fraudulent job opportunities, or misleading services.",
      "Do not pressure the fresher to purchase courses, products, or services.",

      // SESSION SAFETY
      "Do not record, screenshot, or distribute session content without the other participant's consent.",
      "Do not share meeting links or session access with unauthorized people.",
      "Report suspicious activities, harassment, scams, or inappropriate requests through the official platform.",
      "Keep all mentoring discussions professional, respectful, and focused on the selected topic.",
      "If a technical issue occurs, communicate clearly and follow the official platform process."
    ],

    fresher: [
      "Join within 5 minutes of the meeting opening.",
      "Keep your microphone muted unless you are speaking.",
      "Be respectful. The mentor is giving their personal time to help you.",
      "Come prepared with specific questions.",
      "If you need to leave early, inform the mentor in chat.",
      "In the last 5 minutes, you will be asked to confirm the session went well.",
      "After confirming, write an honest review — it takes 30 seconds.",

      // PERSONAL INFORMATION & PRIVACY
      "Never share your phone number, personal email address, or home address during a session.",
      "Never share passwords, OTPs, UPI PINs, bank account details, card information, or government identity documents.",
      "Never share your MNCConnect login credentials with anyone.",
      "You are not required to share personal photographs, private documents, or sensitive information.",
      "Do not give anyone remote access to your personal device or accounts.",
      "Do not share private information about your family, friends, or other individuals without their permission.",

      // PAYMENT & SCAM SAFETY
      "Do not send money, gifts, or payments directly to a mentor outside the official MNCConnect payment system.",
      "Be careful of fake job offers, guaranteed placement promises, referral scams, and requests for money.",
      "Never share payment credentials or approve unknown payment requests.",
      "Do not click suspicious links or download unknown files shared during a session.",
      "MNCConnect payments should only be completed through the official payment process.",

      // SESSION SAFETY
      "Never record, screenshot, or distribute a session without the mentor's consent.",
      "Do not share meeting links or session access with unauthorized people.",
      "Immediately report harassment, inappropriate behaviour, suspicious requests, or fraud through the platform.",
      "Keep your conversations respectful and focused on learning and professional development.",
      "If a mentor makes you uncomfortable or asks for sensitive information, you can end the interaction and report it.",
      "A mentor should guide your career, not request your personal credentials or private information.",
      "Do not feel pressured to accept personal requests or communicate outside the platform."
    ]
  },

  // ============================================================
  // TAMIL
  // ============================================================

  ta: {
    mentor: [
      "நேரத்திற்கு வாருங்கள். சந்திப்பு தொடங்கும் 5 நிமிடங்களுக்கு முன்பே அறை திறக்கும்.",
      "தொழில்முறை மொழியைப் பயன்படுத்துங்கள். ஃப்ரெஷரிடம் கடுமையாகவோ அவமதிப்பாகவோ பேசக்கூடாது.",
      "முதலில் கேளுங்கள், பிறகு வழிகாட்டுங்கள். கருத்துகள் மட்டுமல்ல, செயல்படக்கூடிய ஆலோசனைகளை வழங்குங்கள்.",
      "ஒரு தலைப்பில் உதவ முடியாவிட்டால், நேர்மையாகச் சொல்லி மாற்று வழிகளைப் பரிந்துரைக்கவும்.",
      "கடைசி 5 நிமிடங்களில், ஃப்ரெஷரிடம் செஷன் நன்றாக நடந்ததா எனக் கேட்டு உறுதிப்படுத்தச் சொல்லுங்கள்.",
      "உறுதிப்படுத்திய பிறகு, ஃப்ரெஷரிடம் நேர்மையான மதிப்பாய்வு எழுதச் சொல்லுங்கள்.",
      "சரியான காரணமின்றி சந்திப்பை முன்கூட்டியே விட்டு வெளியேற வேண்டாம். தளத்தின் செஷன் நிறைவு விதிமுறைகளைப் பின்பற்றுங்கள்.",
      "நிறுவனத்தின் ரகசியத் தகவல்கள், உள்நாட்டு ஆவணங்கள், Source Code அல்லது வெளியிடப்படாத வணிகத் தகவல்களைப் பகிரக்கூடாது.",

      // தனிப்பட்ட தகவல் பாதுகாப்பு
      "ஃப்ரெஷரிடம் தொலைபேசி எண், தனிப்பட்ட மின்னஞ்சல் முகவரி அல்லது வீட்டு முகவரி போன்ற விவரங்களைக் கேட்கக்கூடாது.",
      "கடவுச்சொல், OTP, UPI PIN, வங்கிக் கணக்கு விவரங்கள், கார்டு தகவல்கள், ஆதார் அல்லது PAN விவரங்களைக் கேட்கக்கூடாது.",
      "ஃப்ரெஷரின் தனிப்பட்ட ஆவணங்கள், கணக்கு உள்நுழைவு விவரங்கள் அல்லது முக்கியமான தனிப்பட்ட தகவல்களைக் கேட்கக்கூடாது.",
      "ஃப்ரெஷரின் தனிப்பட்ட கணக்குகள், சாதனங்கள் அல்லது சமூக வலைத்தளக் கணக்குகளுக்கான அணுகலைக் கேட்கக்கூடாது.",
      "ஃப்ரெஷரின் தனியுரிமை மற்றும் தனிப்பட்ட எல்லைகளை மதிக்க வேண்டும்.",
      "தனிப்பட்ட சமூக வலைத்தளங்கள் அல்லது மெசேஜிங் கணக்குகளில் இணையுமாறு ஃப்ரெஷரை வற்புறுத்தக்கூடாது.",

      // தொழில்முறை நடத்தை
      "MNCConnect தளத்திற்கு வெளியே பணம், பரிசு, கடன் அல்லது வேறு எந்தக் கட்டணத்தையும் கேட்கக்கூடாது.",
      "வேலை, இன்டர்ன்ஷிப், ரெஃபரல் அல்லது வேலைவாய்ப்பு உறுதி போன்ற தவறான வாக்குறுதிகளை வழங்கக்கூடாது.",
      "பாலினம், வயது, மொழி அல்லது தனிப்பட்ட பின்னணியின் அடிப்படையில் பாகுபாடு காட்டக்கூடாது.",
      "அவமதிக்கும், மிரட்டும், பாலியல் ரீதியாகத் தவறான அல்லது துன்புறுத்தும் வார்த்தைகளைப் பயன்படுத்தக்கூடாது.",
      "மோசடி வேலைவாய்ப்புகள் அல்லது தவறான சேவைகளைப் பரிந்துரைக்கக்கூடாது.",
      "கோர்ஸ்கள், பொருட்கள் அல்லது சேவைகளை வாங்குமாறு ஃப்ரெஷரை வற்புறுத்தக்கூடாது.",

      // செஷன் பாதுகாப்பு
      "மற்றவரின் அனுமதியின்றி செஷனைப் பதிவு செய்யவோ, ஸ்கிரீன்ஷாட் எடுக்கவோ, பகிரவோ கூடாது.",
      "அனுமதியில்லாத நபர்களுடன் சந்திப்பு லிங்க் அல்லது செஷன் அணுகலைப் பகிரக்கூடாது.",
      "மோசடி, துன்புறுத்தல் அல்லது சந்தேகத்திற்கிடமான செயல்பாடுகள் இருந்தால் அதிகாரப்பூர்வ தளத்தின் மூலம் புகாரளிக்க வேண்டும்.",
      "அனைத்து உரையாடல்களும் தொழில்முறை, மரியாதையான மற்றும் தேர்ந்தெடுக்கப்பட்ட தலைப்பை மையமாகக் கொண்டதாக இருக்க வேண்டும்.",
      "தொழில்நுட்பப் பிரச்சினை ஏற்பட்டால் தெளிவாகத் தெரிவித்து அதிகாரப்பூர்வ தளத்தின் நடைமுறையைப் பின்பற்றுங்கள்."
    ],

    fresher: [
      "சந்திப்பு திறந்த 5 நிமிடங்களுக்குள் சேருங்கள்.",
      "பேசாதபோது மைக்ரோஃபோனை ம்யூட் செய்து வைத்திருங்கள்.",
      "மரியாதையாக இருங்கள். மென்டர் தனது தனிப்பட்ட நேரத்தை உங்களுக்கு உதவ ஒதுக்குகிறார்.",
      "குறிப்பிட்ட கேள்விகளுடன் தயாராக வாருங்கள்.",
      "நேரத்திற்கு முன்பே செல்ல வேண்டும் என்றால், அரட்டையில் மென்டருக்குத் தெரிவிக்கவும்.",
      "கடைசி 5 நிமிடங்களில், செஷன் நன்றாக நடந்ததா எனக் கேட்கப்படும்.",
      "உறுதிப்படுத்திய பிறகு, நேர்மையான மதிப்பாய்வை எழுதுங்கள்.",

      // தனிப்பட்ட தகவல் பாதுகாப்பு
      "உங்கள் தொலைபேசி எண், தனிப்பட்ட மின்னஞ்சல் முகவரி அல்லது வீட்டு முகவரி போன்ற விவரங்களைப் பகிர வேண்டாம்.",
      "கடவுச்சொல், OTP, UPI PIN, வங்கிக் கணக்கு விவரங்கள், கார்டு தகவல்கள், ஆதார் அல்லது PAN விவரங்களைப் பகிர வேண்டாம்.",
      "MNCConnect கணக்கின் உள்நுழைவு விவரங்களை யாரிடமும் பகிர வேண்டாம்.",
      "உங்கள் தனிப்பட்ட புகைப்படங்கள், ரகசிய ஆவணங்கள் அல்லது முக்கியமான தகவல்களைப் பகிர வேண்டிய அவசியமில்லை.",
      "உங்கள் தனிப்பட்ட சாதனம் அல்லது கணக்குகளுக்கு யாருக்கும் தொலைநிலை அணுகலை வழங்க வேண்டாம்.",
      "மற்றவர்களின் அனுமதியின்றி அவர்களின் தனிப்பட்ட தகவல்களைப் பகிர வேண்டாம்.",

      // பணம் மற்றும் மோசடி பாதுகாப்பு
      "அதிகாரப்பூர்வ MNCConnect கட்டண முறைக்கு வெளியே மென்டருக்கு நேரடியாகப் பணம், பரிசு அல்லது கட்டணம் செலுத்த வேண்டாம்.",
      "போலி வேலைவாய்ப்புகள், உறுதியான வேலை வாக்குறுதிகள், ரெஃபரல் மோசடிகள் மற்றும் பணம் கேட்கும் முயற்சிகள் குறித்து எச்சரிக்கையாக இருங்கள்.",
      "உங்கள் கட்டண விவரங்களைப் பகிரவோ, தெரியாத கட்டணக் கோரிக்கைகளுக்கு அனுமதி அளிக்கவோ வேண்டாம்.",
      "சந்தேகத்திற்கிடமான லிங்குகளைத் திறக்கவோ, தெரியாத கோப்புகளைப் பதிவிறக்கவோ வேண்டாம்.",
      "MNCConnect கட்டணங்களை அதிகாரப்பூர்வ கட்டண முறையின் மூலமாக மட்டுமே செலுத்துங்கள்.",

      // செஷன் பாதுகாப்பு
      "மென்டரின் அனுமதியின்றி செஷனைப் பதிவு செய்யவோ, ஸ்கிரீன்ஷாட் எடுக்கவோ, பகிரவோ வேண்டாம்.",
      "அனுமதியில்லாத நபர்களுடன் சந்திப்பு லிங்க் அல்லது செஷன் அணுகலைப் பகிர வேண்டாம்.",
      "துன்புறுத்தல், தவறான நடத்தை, சந்தேகத்திற்கிடமான கோரிக்கைகள் அல்லது மோசடி முயற்சிகள் இருந்தால் உடனடியாகப் புகாரளிக்கவும்.",
      "உரையாடல்களை மரியாதையாகவும் கற்றல் மற்றும் தொழில் வளர்ச்சியை மையமாகக் கொண்டும் வைத்திருங்கள்.",
      "மென்டர் உங்களைத் தவறாக நடத்தினால் அல்லது முக்கியமான தகவல்களைக் கேட்டால், உரையாடலை நிறுத்திவிட்டு புகாரளிக்கலாம்.",
      "மென்டரின் நோக்கம் உங்களுக்கு வழிகாட்டுவதுதான்; உங்கள் தனிப்பட்ட விவரங்களையோ கணக்கின் ரகசியங்களையோ கேட்பது அல்ல.",
      "தளத்திற்கு வெளியே தனிப்பட்ட முறையில் தொடர்புகொள்ளும் கோரிக்கைகளை ஏற்க வேண்டிய கட்டாயம் உங்களுக்கு இல்லை."
    ]
  },

  // ============================================================
  // HINDI
  // ============================================================

  hi: {
    mentor: [
      "समय पर आएं। बैठक निर्धारित समय से 5 मिनट पहले खुलती है।",
      "पेशेवर भाषा का प्रयोग करें। फ्रेशर से कभी कठोर या अपमानजनक व्यवहार न करें।",
      "पहले सुनें, फिर मार्गदर्शन करें। केवल राय नहीं, व्यावहारिक सलाह दें।",
      "यदि किसी विषय में सहायता नहीं कर सकते, तो ईमानदारी से बताएं और विकल्प सुझाएं।",
      "सत्र के अंतिम 5 मिनट में फ्रेशर से पूछें कि सत्र अच्छा रहा या नहीं।",
      "पुष्टि के बाद फ्रेशर से ईमानदार समीक्षा लिखने को कहें।",
      "बिना उचित कारण के सत्र जल्दी न छोड़ें। प्लेटफॉर्म के सत्र-समापन नियमों का पालन करें।",
      "कंपनी की गोपनीय जानकारी, आंतरिक दस्तावेज़, सोर्स कोड या अप्रकाशित व्यावसायिक जानकारी साझा न करें।",

      // PRIVACY
      "फ्रेशर से फोन नंबर, व्यक्तिगत ईमेल पता या घर का पता जैसी निजी जानकारी कभी न मांगें।",
      "पासवर्ड, OTP, UPI PIN, बैंक विवरण, कार्ड की जानकारी, आधार या PAN विवरण कभी न मांगें।",
      "फ्रेशर से निजी दस्तावेज़, अकाउंट लॉगिन विवरण या संवेदनशील व्यक्तिगत जानकारी न मांगें।",
      "फ्रेशर के निजी खातों, डिवाइस या सोशल मीडिया अकाउंट तक पहुंच न मांगें।",
      "फ्रेशर की गोपनीयता और व्यक्तिगत सीमाओं का सम्मान करें।",
      "फ्रेशर को व्यक्तिगत सोशल मीडिया या मैसेजिंग अकाउंट पर जुड़ने के लिए मजबूर न करें।",

      // PROFESSIONAL CONDUCT
      "आधिकारिक MNCConnect प्लेटफॉर्म के बाहर पैसे, उपहार, ऋण या भुगतान न मांगें।",
      "नौकरी, इंटर्नशिप, रेफरल, वेतन या नौकरी की गारंटी के बारे में झूठे वादे न करें।",
      "लिंग, उम्र, भाषा या व्यक्तिगत पृष्ठभूमि के आधार पर भेदभाव न करें।",
      "अपमानजनक, धमकी भरी, अनुचित या परेशान करने वाली भाषा का प्रयोग न करें।",
      "धोखाधड़ी वाली नौकरी या भ्रामक सेवाओं को बढ़ावा न दें।",
      "फ्रेशर पर कोर्स, उत्पाद या सेवाएं खरीदने का दबाव न डालें।",

      // SESSION SAFETY
      "दूसरे व्यक्ति की अनुमति के बिना सत्र रिकॉर्ड, स्क्रीनशॉट या साझा न करें।",
      "अनधिकृत व्यक्तियों के साथ मीटिंग लिंक या सत्र की पहुंच साझा न करें।",
      "संदिग्ध गतिविधि, उत्पीड़न या धोखाधड़ी की सूचना आधिकारिक प्लेटफॉर्म पर दें।",
      "सभी बातचीत पेशेवर, सम्मानजनक और चुने गए विषय पर केंद्रित रखें।",
      "तकनीकी समस्या होने पर स्पष्ट रूप से बताएं और प्लेटफॉर्म की आधिकारिक प्रक्रिया का पालन करें।"
    ],

    fresher: [
      "बैठक खुलने के 5 मिनट के भीतर जुड़ें।",
      "बोलते समय को छोड़कर माइक्रोफ़ोन म्यूट रखें।",
      "सम्मानजनक रहें। मेंटर आपकी मदद के लिए अपना समय दे रहे हैं।",
      "विशिष्ट प्रश्नों के साथ तैयार होकर आएं।",
      "यदि आपको जल्दी जाना है, तो चैट में मेंटर को सूचित करें।",
      "अंतिम 5 मिनट में आपसे पूछा जाएगा कि सत्र अच्छा रहा या नहीं।",
      "पुष्टि के बाद ईमानदार समीक्षा लिखें।",

      // PRIVACY
      "सत्र के दौरान अपना फोन नंबर, व्यक्तिगत ईमेल पता या घर का पता साझा न करें।",
      "पासवर्ड, OTP, UPI PIN, बैंक खाता विवरण, कार्ड की जानकारी, आधार या PAN विवरण साझा न करें।",
      "अपने MNCConnect अकाउंट का लॉगिन विवरण किसी के साथ साझा न करें।",
      "आपको अपनी निजी तस्वीरें, गोपनीय दस्तावेज़ या संवेदनशील जानकारी साझा करने की आवश्यकता नहीं है।",
      "किसी को भी अपने निजी डिवाइस या अकाउंट का रिमोट एक्सेस न दें।",
      "दूसरों की अनुमति के बिना उनकी निजी जानकारी साझा न करें।",

      // PAYMENT & SCAM SAFETY
      "आधिकारिक MNCConnect भुगतान प्रणाली के बाहर मेंटर को सीधे पैसे, उपहार या भुगतान न भेजें।",
      "फर्जी नौकरी के प्रस्तावों, नौकरी की गारंटी, रेफरल धोखाधड़ी और पैसे मांगने वालों से सावधान रहें।",
      "अपने भुगतान संबंधी विवरण साझा न करें और अनजान भुगतान अनुरोधों को मंजूरी न दें।",
      "संदिग्ध लिंक पर क्लिक न करें और अनजान फाइलें डाउनलोड न करें।",
      "MNCConnect भुगतान केवल आधिकारिक भुगतान प्रक्रिया के माध्यम से करें।",

      // SESSION SAFETY
      "मेंटर की अनुमति के बिना सत्र रिकॉर्ड, स्क्रीनशॉट या साझा न करें।",
      "अनधिकृत व्यक्तियों के साथ मीटिंग लिंक या सत्र की पहुंच साझा न करें।",
      "उत्पीड़न, अनुचित व्यवहार, संदिग्ध अनुरोध या धोखाधड़ी की तुरंत रिपोर्ट करें।",
      "अपनी बातचीत को सम्मानजनक और सीखने तथा करियर विकास पर केंद्रित रखें।",
      "यदि मेंटर आपको असहज महसूस कराता है या संवेदनशील जानकारी मांगता है, तो बातचीत समाप्त करके रिपोर्ट कर सकते हैं।",
      "मेंटर का काम आपको मार्गदर्शन देना है, न कि आपकी निजी जानकारी या अकाउंट के गोपनीय विवरण मांगना।",
      "प्लेटफॉर्म के बाहर व्यक्तिगत रूप से संपर्क करने के अनुरोध को स्वीकार करना आपके लिए अनिवार्य नहीं है।"
    ]
  }
};

// ============================================================
// HELPER: MERGE DEFAULT AND DATABASE INSTRUCTIONS
// ============================================================

const mergeInstructions = (defaults = [], databaseItems = []) => {
  const result = [];
  const seen = new Set();

  const addItem = (item, source) => {
    const text = String(item.text || "").trim();

    if (!text) return;

    const key = text.toLowerCase();

    if (seen.has(key)) return;

    seen.add(key);

    result.push({
      ...(item._id ? { _id: item._id } : {}),
      role: item.role,
      language: item.language,
      text,
      order: result.length,
      isActive: true,
      source
    });
  };

  // Mandatory default instructions first
  defaults.forEach((text) => {
    addItem(
      {
        text,
        role: undefined,
        language: undefined
      },
      "default"
    );
  });

  // Existing custom DB instructions after defaults
  databaseItems.forEach((item) => {
    addItem(item, "database");
  });

  return result;
};

// ============================================================
// GET /api/instructions?lang=en
// ============================================================

exports.getInstructions = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    if (!["mentor", "fresher"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only mentors and freshers can load instructions."
      });
    }

    let language = String(req.query.lang || "en")
      .trim()
      .toLowerCase();

    // Supported languages
    if (!DEFAULT_INSTRUCTIONS[language]) {
      language = "en";
    }

    const defaultTexts =
      DEFAULT_INSTRUCTIONS[language][role] || [];

    // Fetch active instructions from MongoDB
    const databaseItems = await Instruction.find({
      role,
      language,
      isActive: true
    })
      .sort({ order: 1 })
      .lean();

    // If DB is empty, seed the default instructions
    if (!databaseItems || databaseItems.length === 0) {
      console.log(
        `No instructions found for ${language}-${role}. Seeding defaults.`
      );

      const docs = defaultTexts.map((text, index) => ({
        role,
        language,
        text,
        order: index,
        isActive: true
      }));

      try {
        await Instruction.insertMany(docs);
      } catch (seedError) {
        console.error(
          "Instruction default seeding failed:",
          seedError.message
        );
      }
    }

    // Always merge defaults with DB records.
    // This ensures newly added safety instructions appear
    // even if older instructions already exist in MongoDB.
    const instructions = mergeInstructions(
      defaultTexts.map((text) => ({
        text,
        role,
        language
      })),
      databaseItems || []
    );

    return res.status(200).json({
      success: true,
      language,
      role,
      count: instructions.length,
      instructions
    });

  } catch (err) {
    console.error(
      "getInstructions error:",
      err.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load instructions."
    });
  }
};
