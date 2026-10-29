// src/utils/logout.js
// Shared logout for BOTH fresher and mentor.
// The session lives only in the HttpOnly "mnc_token" cookie, so:
//   1. the server clears the cookie (JS cannot do this itself)
//   2. the realtime socket is closed
// Nothing is stored in localStorage / sessionStorage.
import { socket } from "./socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function performLogout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Logout request failed:", err);
  }

  try {
    socket.emit("employee-offline");
    socket.disconnect();
  } catch {
    /* ignore */
  }
}