// backend/utils/contactFilter.js
// Same rules as the frontend copy (src/utils/contactFilter.js).
// detectContact(text, recentOwnTexts?) -> null when fine, else { reason, message }
//
// recentOwnTexts = the SAME sender's previous messages in this chat
// (oldest -> newest, last ~10 minutes, max ~8). It is used to catch a phone
// number that is sent in pieces ("80158" then "74936").

const MESSAGE =
  "Phone numbers, emails, links and WhatsApp/social IDs are not allowed in chat. Please keep the conversation on the platform.";

/* ---------------- normalising ---------------- */

// zero-width chars, soft hyphen, keycap/variation selectors, bidi marks
const INVISIBLE = /[\u200B-\u200F\u2060\uFEFF\uFE0F\u20E3\u00AD\u202A-\u202E]/g;

// first code point of each non-latin digit block (Arabic, Devanagari, Bengali,
// Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam)
const DIGIT_ZEROS = [
  0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66,
  0x0ce6, 0x0d66,
];

const normalizeDigits = (s) =>
  s.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0);
    for (const z of DIGIT_ZEROS) if (cp >= z && cp <= z + 9) return String(cp - z);
    return c;
  });

const WORD_DIGITS = {
  // english
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9,
  // tanglish
  poojyam: 0, pujyam: 0, onnu: 1, rendu: 2, moonu: 3, munu: 3, naalu: 4,
  nalu: 4, anju: 5, ainthu: 5, aaru: 6, ezhu: 7, yezhu: 7, ettu: 8,
  onbathu: 9, ombodhu: 9,
  // hindi (in english letters)
  shunya: 0, sifar: 0, ek: 1, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5,
  chhe: 6, chah: 6, saat: 7, aath: 8, nau: 9,
};

// tamil script number words (no \b in JS for tamil, so a separate map)
const TAMIL_WORD_DIGITS = {
  பூஜ்ஜியம்: 0, பூஜ்யம்: 0, சுழியம்: 0,
  ஒன்று: 1, ஒண்ணு: 1, இரண்டு: 2, ரெண்டு: 2, மூன்று: 3, மூணு: 3,
  நான்கு: 4, நாலு: 4, ஐந்து: 5, அஞ்சு: 5, ஆறு: 6, ஏழு: 7, எட்டு: 8,
  ஒன்பது: 9, ஒம்போது: 9,
};

const LATIN_WORDS = new RegExp(
  `\\b(${Object.keys(WORD_DIGITS).join("|")})\\b`,
  "gi",
);
const TAMIL_WORDS = new RegExp(Object.keys(TAMIL_WORD_DIGITS).join("|"), "g");

// "nine eight" -> "9 8",  "double nine" -> "99",  "triple 7" -> "777"
const wordsToDigits = (s) =>
  s
    .replace(LATIN_WORDS, (w) => String(WORD_DIGITS[w.toLowerCase()]))
    .replace(TAMIL_WORDS, (w) => String(TAMIL_WORD_DIGITS[w]))
    .replace(/\b(?:double|dbl|dabal)\s*(\d)/gi, "$1$1")
    .replace(/\b(?:triple|tripple)\s*(\d)/gi, "$1$1$1");

// NFKC turns full-width / maths / circled digits into normal ones
const prepare = (text) =>
  normalizeDigits(String(text || "").normalize("NFKC").replace(INVISIBLE, ""));

// letters only, leet-speak undone:  "wh4ts @pp" -> "whatsapp"
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
const squash = (s) =>
  s
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c])
    .replace(/[^a-z]/g, "");

/* ---------------- phone ---------------- */

// dates must not look like phone numbers
const DATES =
  /\b(?:(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-](?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01]))\b/g;

// 10+ digits, up to 3 "symbol" chars between digits (space . - _ ( ) + / ...)
// (letters, commas and colons break the chain, so "12, 2026 10:55" is safe)
const PHONE_CHAIN = /\d(?:[^\p{L}\p{N},:]{0,3}\d){9,}/u;
// 10 single digits separated by , : ;   ->  9,8,7,6,0,1,6,8,9,5
const PHONE_COMMA = /(?:^|\D)\d(?:\s*[,:;]\s*\d){9,}(?!\d)/;

function hasPhone(text) {
  let n = wordsToDigits(prepare(text));
  n = n.replace(DATES, " ");
  // very long plain digit runs (13+) are ids / timestamps (booking id), not phones
  n = n.replace(/\d{13,}/g, " ");
  return PHONE_CHAIN.test(n) || PHONE_COMMA.test(n);
}

/* ---- phone sent in pieces: "80158" ... "74936" ---- */
const INDIAN_MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;

function digitInfo(text) {
  const n = wordsToDigits(prepare(text));
  const digits = (n.match(/\d/g) || []).join("");
  const letters = (n.match(/\p{L}/gu) || []).length;
  return { digits, letters };
}

// mostly numbers: "80158", "ph 74936", "nine eight seven"
const numericish = ({ digits, letters }) => digits.length >= 2 && letters <= digits.length;

function hasSplitPhone(text, recent = []) {
  const last = digitInfo(text);
  if (!numericish(last)) return false;

  // walk back over the sender's own messages while they are numbers too
  const chunks = [last.digits];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const info = digitInfo(recent[i]);
    if (!numericish(info)) break;
    chunks.unshift(info.digits);
  }
  if (chunks.length < 2) return false;

  // try every tail:  [a,b,c] -> abc, bc  (current message is always included)
  for (let start = 0; start < chunks.length - 1; start += 1) {
    if (INDIAN_MOBILE.test(chunks.slice(start).join(""))) return true;
  }
  return false;
}

/* ---------------- email / link / social ---------------- */

const MAIL_HOSTS = "gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|proton|protonmail|rediffmail";

const TLDS =
  "com|in|io|me|net|org|co|app|ly|link|xyz|dev|info|biz|ai|gg|tv|page|site|online|store|shop|tech|cc|ws";

const LONG_KEYWORDS = [
  "whatsapp", "whatsap", "watsapp", "watsap", "whtsapp", "whtsap", "wtsapp",
  "instagram", "instagrm", "telegram", "snapchat", "linkedin", "facebook",
  "gmail", "skype", "discord", "hangouts", "viber", "truecaller",
];

const RULES = [
  {
    reason: "email",
    test: (t) => {
      const s = t.toLowerCase();
      return (
        /[a-z0-9._%+-]+@[a-z0-9-]+/.test(s) ||
        /[a-z0-9._%+-]+\s*[([{]\s*at\s*[)\]}]\s*[a-z0-9-]+/.test(s) ||
        /\bat\s*(the)?\s*rate\b/.test(s) ||
        /\battherate\b/.test(s) ||
        new RegExp(`\\b(${MAIL_HOSTS})\\s*(\\.|\\bdot\\b|\\(\\s*dot\\s*\\))\\s*(com|in|net|org|co)\\b`).test(s) ||
        new RegExp(`\\bat\\s+(${MAIL_HOSTS})\\b`).test(s)
      );
    },
  },
  {
    reason: "phone",
    test: (t) => hasPhone(t),
  },
  {
    reason: "link",
    test: (t) => {
      const s = t.toLowerCase();
      return (
        /(https?:\/\/|www\.)\S+/.test(s) ||
        // a real dot has NO spaces around it ("free. In the morning" is fine)
        new RegExp(`\\b[a-z0-9-]{2,}\\.(${TLDS})\\b`).test(s) ||
        // "name dot com" / "name (dot) com" written in words
        new RegExp(`\\b[a-z0-9-]{2,}\\s*(\\(\\s*dot\\s*\\)|\\bdot\\b)\\s*(${TLDS})\\b`).test(s) ||
        /\b(wa\.me|t\.me|linkedin\.com|lnkd\.in|bit\.ly|tinyurl|instagr\.am)\b/.test(s)
      );
    },
  },
  {
    reason: "social",
    test: (t) => {
      const s = t.toLowerCase();
      const sq = squash(t);

      // letters only: catches "w h a t s a p p", "wh4tsapp", "i.n.s.t.a"
      if (LONG_KEYWORDS.some((k) => sq.includes(k))) return true;

      return (
        // @username
        /(^|[\s([{])@[a-z0-9._]{3,}/.test(s) ||
        // short words (need word boundaries, "install" must stay allowed)
        /\b(insta|ig|snap|fb|tg|wapp|wpp|dm|dms)\b/.test(s) ||
        // off-platform payment
        /\b(gpay|google\s*pay|phonepe|paytm|upi|bhim)\b/.test(s) ||
        // "my number", "phone no", "call me", "number tharen" ...
        /\b(my|your|ur|unga|en|enoda)\s+(num|number|nmbr|mobile|phone|cell)\b/.test(s) ||
        /\b(mobile|phone|contact|cell)\s*(no|num|number|nmbr)\b/.test(s) ||
        /\bnumber\s*(tharen|tharuga|kudu|kudunga|anupu|anuppu|venum|solren)\b/.test(s) ||
        /\b(call|phone)\s*(me|pannu|pannunga|panren|pannuren)\b/.test(s) ||
        // tamil script
        /வாட்ஸ்?\s*அப்|வாட்சப்|டெலிகிராம்|இன்ஸ்டா|ஜிமெயில்|நம்பர்|மொபைல்/.test(t)
      );
    },
  },
];

/* ---------------- public ---------------- */

function detectContact(text = "", recent = []) {
  const t = String(text || "");
  if (!t.trim()) return null;

  for (const rule of RULES) {
    if (rule.test(t)) return { reason: rule.reason, message: MESSAGE };
  }

  // number split over several messages
  if (hasSplitPhone(t, recent)) return { reason: "phone", message: MESSAGE };

  return null;
}

module.exports = { detectContact, CONTACT_BLOCKED_MESSAGE: MESSAGE };