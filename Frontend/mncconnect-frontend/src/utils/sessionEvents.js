// Pages call notifySessionsChanged() whenever a session/booking status changes,
// so headers (which own a separate copy of the data) refresh immediately.
export const SESSIONS_CHANGED = "sessions:changed";

export const notifySessionsChanged = (id) =>
  window.dispatchEvent(
    new CustomEvent(SESSIONS_CHANGED, { detail: { id: id ?? null } }),
  );