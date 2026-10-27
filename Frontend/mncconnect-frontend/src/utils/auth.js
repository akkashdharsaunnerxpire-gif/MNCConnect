// src/utils/auth.js
// Login state lives ONLY in the HttpOnly cookie (mnc_token) + the server.
// To know who is logged in, use:  const { user, role, loading } = useAuth();
// (from context/AuthContext.jsx). Nothing about the session is kept in localStorage.
// This file only removes the old keys left behind by the previous version.

const LEGACY_KEYS = [
  // old session marker
  "user",
  "mnc_session_exp",
  // old tokens
  "fresher_token",
  "mnc_mentor_token",
  "token",
  "fresherName",
  // old mentor keys
  "mentorId",
  "mentorName",
  "mnc_mentor_registered_email",
  "mnc_mentor_registration_complete",
  "mnc_mentor_verification_status",
  "mncconnect_accepted_sessions",
  "mncconnect_skipped_requests",
  "mncconnect_request_sound",
];

// Call once when the app starts (App.jsx does this).
export const clearLegacyStorage = () => {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// DEPRECATED shims: only here so old imports don't crash the app.
// Each one prints a warning in the console, so you can search and replace
// the files that still use them.
// ---------------------------------------------------------------------------

const warn = (name, instead) =>
  console.warn(`[auth] ${name}() is deprecated. ${instead}`);

// Does nothing now. After a successful login/register call `await refresh()`
// from useAuth() instead.
export const saveSession = () => {
  warn("saveSession", "Use `await refresh()` from useAuth() after login.");
};

// These only clean old browser keys. They do NOT log the user out,
// because only the server can clear the HttpOnly cookie. Use `logout()` from useAuth().
export const clearSession = () => {
  warn("clearSession", "Use `await logout()` from useAuth().");
  clearLegacyStorage();
};
export const clearFresherSession = clearSession;
export const clearMentorSession = clearSession;

// Always empty / false now. Replace with `const { user, role } = useAuth()`.
export const getStoredUser = () => {
  warn("getStoredUser", "Use `const { user } = useAuth()`.");
  return null;
};

export const isFresherLoggedIn = () => {
  warn("isFresherLoggedIn", "Use `const { role } = useAuth()`.");
  return false;
};

export const isMentorLoggedIn = () => {
  warn("isMentorLoggedIn", "Use `const { role } = useAuth()`.");
  return false;
};