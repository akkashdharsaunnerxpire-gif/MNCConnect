// src/services/fresherApi.js
import { clearSession, getStoredUser } from "../utils/auth";

// must include /api (backend mounts routes at /api/...)
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const ENDPOINTS = {
  createOrder: "/payments/create-order",
  verifyPayment: "/payments/verify-payment",
  createBooking: "/bookings",
  myBookings: "/bookings/me",
  booking: (id) => `/bookings/${encodeURIComponent(id)}`,
  needsReview: "/bookings/needs-review",
  review: "/reviews",
  notifications: "/fresher/notifications",
  notificationRead: (id) => `/fresher/notifications/${id}/read`,
  notificationsReadAll: "/fresher/notifications/read-all",
  companies: "/mentor/companies",
  companyDepartments: (name) => `/mentor/company-departments/${encodeURIComponent(name)}`,
};

export const EVENTS = {
  booking: "booking:updated",
  reminder: "booking:reminder",
  notification: "notification:new",
};

export const NOTIFICATIONS_CHANGED = "fresher:notifications-changed";

export const PRICE_PER_30_MIN = 200; // ₹400 / hour. Keep equal to PRICE_PER_30_MIN on the server.
export const priceFor = (minutes) => (minutes / 30) * PRICE_PER_30_MIN;

export const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];
export const durationLabel = (m) =>
  m < 60
    ? `${m} min`
    : m % 60 === 0
      ? `${m / 60} hr`
      : `${Math.floor(m / 60)} hr 30 min`;

// Auth is cookie based now (HttpOnly mnc_token). JS cannot read it.
// Kept only so old imports do not break; always empty.
export const getToken = () => "";

// Logged-in user comes from the session marker saved by saveSession()
export const getUser = () => getStoredUser() || {};

export const getUserId = () => {
  const u = getUser();
  return String(u.id || u._id || "");
};

// only one redirect at a time (many requests can fail together)
let redirectingToLogin = false;

const sessionExpired = () => {
  clearSession(); // clear FIRST, so /login does not bounce back to /Home
  if (!redirectingToLogin && window.location.pathname !== "/login") {
    redirectingToLogin = true;
    window.location.replace("/login");
  }
};

export async function api(path, { method = "GET", body, token } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include", // sends the HttpOnly mnc_token cookie
    headers: {
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
      // optional explicit token (only if a caller passes one)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // cookie missing / expired -> clear UI session and go to login
  if (res.status === 401 && token === undefined) {
    sessionExpired();
    const err = new Error("Session expired. Please login again.");
    err.status = 401;
    throw err;
  }

  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const timeAgo = (value) => {
  const t = new Date(value).getTime();
  if (!t) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d < 7
    ? `${d} day${d > 1 ? "s" : ""} ago`
    : new Date(t).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-10-20" -> "October 20, 2026"   (the format the backend / mentor app parse)
export const toApiDate = (iso) => {
  const [y, m, d] = String(iso).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
};

// "15:30" -> "3:30 PM"
export const toApiTime = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

// India time, same as the server
export const startFrom = (isoDate, hhmm) =>
  new Date(`${isoDate}T${hhmm}:00+05:30`);

export const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};