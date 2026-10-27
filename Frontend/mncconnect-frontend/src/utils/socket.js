import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

socket.on("connect", () => console.log("Socket connected:", socket.id));
socket.on("connect_error", (err) =>
  console.warn("Socket error:", err.message),
);

export const reconnectSocket = () => {
  if (socket.connected) socket.disconnect();
  socket.connect();
};