// utils/sessionPrice.js
// SINGLE SOURCE OF TRUTH for session prices. Never trust the client amount.
//
//   single : Rs 350 per hour   (30 min = 175, 60 min = 350, 90 min = 525 ...)
//   group  : Rs  99 per hour PER PERSON (30 min = 50, 60 min = 99, 90 min = 149 ...)
//
// IMPORTANT: if your .env still has SESSION_RATE_PER_HOUR or GROUP_RATE_PER_HOUR,
// the .env value WINS. Delete those two lines from .env (or set them to 350 / 99).
const RATE_PER_HOUR = Number(process.env.SESSION_RATE_PER_HOUR) || 499;
const GROUP_RATE_PER_HOUR = Number(process.env.GROUP_RATE_PER_HOUR) || 198;
const MAX_GROUP = Number(process.env.MAX_GROUP_MEMBERS) || 60;

const validDuration = (m) => Number.isInteger(m) && m >= 30 && m <= 240;

const expectedPrice = (minutes, mode = "single") =>
  Math.round(
    ((mode === "group" ? GROUP_RATE_PER_HOUR : RATE_PER_HOUR) * minutes) / 60,
  );

module.exports = {
  RATE_PER_HOUR,
  GROUP_RATE_PER_HOUR,
  MAX_GROUP,
  validDuration,
  expectedPrice,
};