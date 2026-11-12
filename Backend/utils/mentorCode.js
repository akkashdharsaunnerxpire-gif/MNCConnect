const crypto = require("crypto");

// "Arun Kumar" -> "ARUN",  result: ARUN#4356356
const namePart = (name) =>
  String(name || "MENTOR")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 10) || "MENTOR";

const generateMentorCode = async (Mentor, name) => {
  const base = namePart(name);
  for (let i = 0; i < 10; i++) {
    const code = `${base}#${crypto.randomInt(1000000, 10000000)}`;
    if (!(await Mentor.exists({ mentorCode: code }))) return code;
  }
  // very rare: make it longer
  return `${base}#${crypto.randomInt(100000000, 1000000000)}`;
};

module.exports = { generateMentorCode };