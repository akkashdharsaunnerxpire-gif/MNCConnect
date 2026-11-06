// src/utils/sessionTiming.js
// ONE place for every timing rule, so Fresher and Mentor always show the same thing.

// Meeting room opens this long before the session start (both sides)
export const JOIN_OPEN_MS = 5 * 60 * 1000;
// "Final 5 minutes" warning
export const FINAL_WARNING_MS = 5 * 60 * 1000;
// How often we poll the booking for the live timer
export const TIMER_POLL_MS = 3000;

// timer = { remainingMs, running, at }  ->  live remaining ms (or null when not running)
export const liveRemaining = (timer, nowMs) => {
  if (!timer?.running || typeof timer.remainingMs !== "number") return null;
  return Math.max(0, timer.remainingMs - (nowMs - (timer.at || nowMs)));
};

// The meeting timer ran at least once and now stopped / reached 0
export const hasTimerFinished = (wasRunning, running, remainingMs) =>
  Boolean(wasRunning) &&
  (!running || (typeof remainingMs === "number" && remainingMs <= 0));