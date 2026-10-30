// src/services/mentorApi.js

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const ENDPOINTS = {
  wallet: "/wallet/me",
  withdraw: "/wallet/withdraw",
  reviews: "/reviews/me",
  reviewReply: (id) => `/reviews/${id}/reply`,
  notifications: "/notifications",
  notificationRead: (id) => `/notifications/${id}/read`,
  notificationsReadAll: "/notifications/read-all",
  assignPayment: "/payments/assign-to-me",
  booking: (id) => `/bookings/${encodeURIComponent(id)}`,
  profileStats: "/mentor/profile/stats",
  mentorPending: "/bookings/mentor/pending",
};

export const EVENTS = {
  walletUpdated: "wallet:updated",
  notification: "notification:new",
  reviewNew: "review:new",
  reviewUpdated: "review:updated",
};

export const NOTIFICATIONS_CHANGED = "mnc:notifications-changed";

export const getToken = () => localStorage.getItem("mnc_mentor_token") || "";

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const timeAgo = (value) => {
  const t = new Date(value).getTime();

  if (!Number.isFinite(t) || t <= 0) return "";

  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));

  if (s < 60) return "Just now";

  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? "s" : ""} ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;

  if (d < 30) {
    const w = Math.floor(d / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  }

  return new Date(t).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
