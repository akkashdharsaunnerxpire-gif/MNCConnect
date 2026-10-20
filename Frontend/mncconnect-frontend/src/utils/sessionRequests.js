// src/utils/sessionRequests.js
// Shared by Home.jsx and MentorRequests.jsx so accept / reject / 30-minute-gap logic lives in ONE place.

import { API_URL, ENDPOINTS, getToken } from "../services/mentorApi";

export const ACCEPTED_SESSIONS_KEY = "mncconnect_accepted_sessions";
export const ACCEPTED_SESSIONS_EVENT = "mncconnect_session_accepted";

export const SESSION_GAP_MINUTES = 30;
export const DEFAULT_DURATION_MINUTES = 30;

const INDIA_TIMEZONE = "Asia/Kolkata";
const MINUTE_MS = 60 * 1000;
const KEEP_ENDED_SESSIONS_MS = 24 * 60 * MINUTE_MS;

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const pad = (n) => String(n).padStart(2, "0");

/* ---------------- parsing ---------------- */

// accepts "October 20, 2026", "Oct 20 2026" and "2026-10-20"
const parseDateParts = (date) => {
  const text = String(date || "").trim();

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };

  const named = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})$/);
  if (!named) return null;

  const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  return { year: Number(named[3]), month, day: Number(named[2]) };
};

// accepts "7 PM", "7:30 pm" and "19:30"
const parseTimeParts = (time) => {
  const text = String(time || "").trim();

  const twelve = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;

    const isPm = twelve[3].toUpperCase() === "PM";
    if (hour === 12) hour = isPm ? 12 : 0;
    else if (isPm) hour += 12;

    return { hour, minute };
  }

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
};

// Date + time strings are always treated as India time (+05:30)
export const getSessionDateTime = (date, time) => {
  const d = parseDateParts(date);
  const t = parseTimeParts(time);
  if (!d || !t) return null;

  const result = new Date(
    `${d.year}-${pad(d.month + 1)}-${pad(d.day)}T${pad(t.hour)}:${pad(t.minute)}:00+05:30`
  );

  return Number.isNaN(result.getTime()) ? null : result;
};

export const getDurationMinutes = (duration) => {
  if (typeof duration === "number" && duration > 0) return duration;

  const value = String(duration || "");

  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/i);
  const mins = value.match(/(\d+)\s*(?:mins?|minutes?)\b/i);

  const total = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
  if (total) return total;

  const numeric = Number(value);
  return numeric > 0 ? numeric : DEFAULT_DURATION_MINUTES;
};

export const formatDuration = (duration) => `${getDurationMinutes(duration)} mins`;

export const formatTime = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

const toMs = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/* ---------------- request shape ---------------- */

// socket payloads come in a few shapes (flat, or nested in requester / sessionDetails)
export const normalizeSessionRequest = (r) => {
  const d = r.sessionDetails || {};

  return {
    ...r,
    id: r.id || r.requestGroupId,
    name: r.name || r.requester?.fullName || "Fresher",
    avatar: r.avatar || r.requester?.image || "",
    role: r.role || "Fresher",
    company: r.company || r.companyName || "",
    topic: r.topic || d.topic || "Career guidance",
    date: r.date || d.date || "",
    time: r.time || d.time || "",
    duration: r.duration || d.duration || DEFAULT_DURATION_MINUTES,
    amount: Number(r.amount || d.amount || 0),
    message: r.message || d.message || "",
    type: "Video Call",
  };
};

/* ---------------- 30-minute gap rule ---------------- */

export const getAcceptedSessions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCEPTED_SESSIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Prefer the server times (startsAt / endsAt); fall back to parsing date + time strings
export const getSessionInterval = (session) => {
  const serverStart = toMs(session.startsAt);

  if (serverStart !== null) {
    const serverEnd = toMs(session.endsAt);
    return {
      startMs: serverStart,
      endMs: serverEnd ?? serverStart + getDurationMinutes(session.duration) * MINUTE_MS,
    };
  }

  const start = getSessionDateTime(session.date, session.time);
  if (!start) return null;

  const startMs = start.getTime();
  return { startMs, endMs: startMs + getDurationMinutes(session.duration) * MINUTE_MS };
};

/**
 * @param request          the request being accepted
 * @param serverSessions   the mentor's upcoming sessions from the server (source of truth).
 *                         Pass null while they are still loading and the locally saved
 *                         list is used as a fallback.
 * Returns null when there is no conflict.
 */
export const getSessionConflict = (request, serverSessions = null) => {
  const requested = getSessionInterval(request);
  if (!requested) return null;

  const pool = Array.isArray(serverSessions) ? serverSessions : getAcceptedSessions();
  const gapMs = SESSION_GAP_MINUTES * MINUTE_MS;

  for (const session of pool) {
    if (String(session.id) === String(request.id)) continue;

    const existing = getSessionInterval(session);
    if (!existing) continue;

    const conflict =
      requested.startMs < existing.endMs + gapMs &&
      requested.endMs + gapMs > existing.startMs;

    if (conflict) return { session, requested, existing };
  }

  return null;
};

export const getConflictMessage = ({ session, requested, existing }) => {
  const name = session.name || "another";

  if (requested.startMs >= existing.startMs) {
    return (
      `Cannot accept this request. There must be at least ${SESSION_GAP_MINUTES} minutes gap ` +
      `after "${name}" session. It ends at ${formatTime(existing.endMs)}.`
    );
  }

  return (
    `Cannot accept this request. There must be at least ${SESSION_GAP_MINUTES} minutes gap ` +
    `before "${name}" session. It starts at ${formatTime(existing.startMs)}.`
  );
};

export const persistAcceptedSession = (session) => {
  try {
    const cutoff = Date.now() - KEEP_ENDED_SESSIONS_MS;

    const kept = getAcceptedSessions().filter((item) => {
      if (String(item.id) === String(session.id)) return false;
      const interval = getSessionInterval(item);
      return !interval || interval.endMs > cutoff; // drop sessions that ended long ago
    });

    localStorage.setItem(ACCEPTED_SESSIONS_KEY, JSON.stringify([...kept, session]));
    window.dispatchEvent(new Event(ACCEPTED_SESSIONS_EVENT));
  } catch (error) {
    console.error("Failed to save accepted session:", error);
  }
};

/* ---------------- API ---------------- */

const authHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * PATCH /session/session-requests/:id   (handled by bookingController.respondToRequest)
 * status: "accepted" | "rejected"
 * Never throws on HTTP errors, only on network failure. `taken` is true on 409
 * (another mentor accepted first).
 */
export const respondToSessionRequest = async (request, status) => {
  const requestGroupId = request.requestGroupId || request.id;

  const res = await fetch(
    `${API_URL}/session/session-requests/${requestGroupId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        status, // "accepted" or "rejected"
        mentorId: localStorage.getItem("mentorId"),
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    taken: res.status === 409,
    status: res.status,
    data,
    requestGroupId,
  };
};
// Best effort: tie the fresher's payment to this mentor so the wallet updates.
// If bookingController.respondToRequest already assigns the payment, remove
// `assignPayment` from ENDPOINTS (mentorApi) and this becomes a no-op.
export const assignPaymentToMentor = (requestGroupId) => {
  if (!ENDPOINTS.assignPayment) return;

  fetch(`${API_URL}${ENDPOINTS.assignPayment}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ requestGroupId }),
  }).catch(() => {});
};