export const REQUESTS_CHANGED = "mentor-requests-changed";

/* Tell the header that a request was accepted / rejected / is gone.
   Pass an id to remove just that request, or nothing to force a re-fetch. */
export const notifyRequestsChanged = (id) =>
  window.dispatchEvent(
    new CustomEvent(REQUESTS_CHANGED, { detail: { id: id ?? null } }),
  );