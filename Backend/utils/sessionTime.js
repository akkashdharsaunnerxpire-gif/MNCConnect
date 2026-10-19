// utils/sessionTime.js
// Session requests carry date/time as text: "September 5, 2026" + "3:30 PM"
// (India time). These helpers turn them into real Dates so the server can
// decide when a session has finished and the mentor's money is released.

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const pad = (n) => String(n).padStart(2, "0");

const parseSessionStart = (date, time) => {
  if (!date || !time) return null;

  let year, month, day;
  const text = String(date).trim();

  const named = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (named) {
    month = MONTHS[named[1].toLowerCase()];
    day = Number(named[2]);
    year = Number(named[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]) - 1;
    day = Number(iso[3]);
  }
  if (month === undefined || !day || !year) return null;

  const t = String(time).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!t) return null;

  let hour = Number(t[1]);
  const minute = Number(t[2] || 0);
  const pm = t[3].toUpperCase() === "PM";
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;

  const result = new Date(
    `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`
  );
  return Number.isNaN(result.getTime()) ? null : result;
};

const parseDurationMinutes = (duration) => {
  if (typeof duration === "number" && duration > 0) return duration;

  const value = String(duration || "");
  const hours = value.match(/(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours)/i);
  const minutes = value.match(/(\d+)\s*(min|mins|minute|minutes)/i);

  let total = 0;
  if (hours) total += Number(hours[1]) * 60;
  if (minutes) total += Number(minutes[1]);

  if (!hours && !minutes) {
    const n = Number(value);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return total || 30;
};

// Returns { sessionDate, sessionTime, durationMinutes, sessionEndsAt }
const buildSessionFields = ({ date, time, duration }) => {
  const minutes = parseDurationMinutes(duration);
  const start = parseSessionStart(date, time);
  return {
    sessionDate: date ? String(date) : "",
    sessionTime: time ? String(time) : "",
    durationMinutes: minutes,
    sessionEndsAt: start ? new Date(start.getTime() + minutes * 60 * 1000) : null,
  };
};

module.exports = { parseSessionStart, parseDurationMinutes, buildSessionFields };