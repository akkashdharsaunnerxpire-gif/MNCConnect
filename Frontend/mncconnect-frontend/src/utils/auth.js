// src/utils/auth.js
// Auth uses an HttpOnly cookie (mnc_token). JavaScript cannot read it, so we
// keep a small "session marker" in localStorage ONLY for route guarding in the UI.
// The real security check always happens on the server through the cookie.

const SESSION_DAYS = 7; // must match the JWT / cookie lifetime on the server
const USER_KEY = "user";
const EXP_KEY = "mnc_session_exp";

const LEGACY_KEYS = [
  "fresher_token",
  "mnc_mentor_token",
  "token",
  "fresherName",
];

const parseJSON = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

// ---------- save / clear ----------

// Call this right after a successful login or register
export const saveSession = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(
      EXP_KEY,
      String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    );
    // remove old token keys so nothing stale is left behind
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXP_KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

// kept for backward compatibility (other files may already import these)
export const clearFresherSession = clearSession;
export const clearMentorSession = clearSession;

// ---------- read ----------

// Returns the stored user only if the session marker has not expired
export const getStoredUser = () => {
  try {
    const exp = Number(localStorage.getItem(EXP_KEY) || 0);

    if (!exp || Date.now() > exp) {
      // missing or expired -> clean up
      if (localStorage.getItem(USER_KEY)) clearSession();
      return null;
    }

    return parseJSON(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export const isFresherLoggedIn = () => {
  const user = getStoredUser();
  return Boolean(user && user.role === "fresher");
};

export const isMentorLoggedIn = () => {
  const user = getStoredUser();
  return Boolean(user && user.role === "mentor");
};