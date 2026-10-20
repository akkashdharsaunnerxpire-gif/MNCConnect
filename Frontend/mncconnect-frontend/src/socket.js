// src/socket.js
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Both mentor and fresher tokens can live in localStorage.
// The backend uses the token to know who you are (no spoofing).
const getToken = () =>
  localStorage.getItem("mnc_mentor_token") ||
  localStorage.getItem("fresher_token") ||
  "";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: getToken() }),
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

// If the user logs in / out while the page is open, reconnect with the new token
export const reconnectSocket = () => {
  socket.auth = { token: getToken() };
  if (socket.connected) {
    socket.disconnect().connect();
  }
};

export default socket;