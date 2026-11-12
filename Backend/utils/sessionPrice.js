// utils/sessionPrice.js
// SINGLE SOURCE OF TRUTH for session prices. Never trust the client amount.
const RATE_PER_HOUR = Number(process.env.SESSION_RATE_PER_HOUR) || 400;
const GROUP_RATE_PER_HOUR = Number(process.env.GROUP_RATE_PER_HOUR) || 50;
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