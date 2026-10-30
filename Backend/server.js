// server.js
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// tiny cookie parser: works with any version, no "cookie" package needed
const parseCookies = (header = "") =>
  String(header)
    .split(";")
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index < 0) return acc;

      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!key) return acc;

      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});

const { registerChat } = require("./models/ChatMessage");

// ---- never let one bad handler kill the whole server ----
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const app = require("./app");
const connectDB = require("./config/db");
const { initMeetings } = require("./utils/meeting");
const {
  startSchedulers,
  pushPendingToMentor,
} = require("./controllers/bookingController");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

console.log("Client URL:", CLIENT_URL);

// ================= HTTP SERVER =================

const server = http.createServer(app);

// ================= SOCKET.IO =================

const socketOrigins = [
  ...new Set([
    CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    ...(app.get("allowedOrigins") || []),
  ]),
];

const io = new Server(server, {
  cors: {
    origin: socketOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// ================= COOKIE-BASED SOCKET AUTH =================
// IMPORTANT: this must be registered BEFORE registerChat / initMeetings,
// so every socket is authenticated before any other handler runs.
// The browser sends the HttpOnly cookie "mnc_token" automatically
// (client needs withCredentials: true). Identity comes from the token,
// so a client can NEVER spoof it.

io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie || "");
    const token = cookies.mnc_token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return next(new Error("Authentication configuration error"));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload?.id || !["mentor", "fresher"].includes(payload.role)) {
      return next(new Error("Invalid token payload"));
    }

    socket.data.user = {
      id: String(payload.id),
      role: String(payload.role),
    };

    return next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    return next(new Error("Invalid or expired session"));
  }
});

// ================= ONLINE USERS =================
// Map<userId(string), Set<socketId>>

const onlineEmployees = new Map(); // freshers
const onlineMentors = new Map(); // mentors

app.set("io", io);
app.set("onlineEmployees", onlineEmployees);
app.set("onlineMentors", onlineMentors);

registerChat(io);

// Initialize meetings (meeting rooms listen for their own events)
initMeetings(io);

// ================= PRESENCE HELPERS =================

const PRESENCE = {
  employee: { map: onlineEmployees, label: "Fresher" },
  mentor: { map: onlineMentors, label: "Mentor" },
};

const toKey = (id) =>
  id === undefined || id === null ? "" : String(id).trim();

// NEW: broadcast mentor presence so fresher pages update without reload
const offlineTimers = new Map(); // mentorId -> timeout (grace period for page refresh)

const emitMentorPresence = (mentorId, isOnline) => {
  io.emit("mentor-presence", { mentorId, isOnline });
};

// Remove this socket from a user's set
const markOffline = (socket, role) => {
  const { map, label } = PRESENCE[role];
  const id = socket.data.presence?.[role];
  if (!id) return;

  const set = map.get(id);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) {
      map.delete(id);
      console.log(`${label} ${id} is OFFLINE`);

      // NEW: tell freshers, after a short grace period
      if (role === "mentor") {
        // 3s grace: a mentor refreshing the page should not flicker offline
        clearTimeout(offlineTimers.get(id));
        offlineTimers.set(
          id,
          setTimeout(() => {
            offlineTimers.delete(id);
            if (!map.has(id)) emitMentorPresence(id, false);
          }, 3000),
        );
      }
    } else {
      console.log(`${label} ${id} still has ${set.size} socket(s) online`);
    }
  }

  delete socket.data.presence[role];
};

// Add a socket to a user's set
const markOnline = (socket, role, rawId) => {
  const { map, label } = PRESENCE[role];
  const id = toKey(rawId);
  if (!id) return null;

  // If this socket was already tracking a different id under this role, clean up
  if (
    socket.data.presence &&
    socket.data.presence[role] &&
    socket.data.presence[role] !== id
  ) {
    markOffline(socket, role);
  }

  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(socket.id);

  socket.data.presence = socket.data.presence || {};
  socket.data.presence[role] = id;

  // NEW: tell freshers a mentor just came online
  if (role === "mentor") {
    clearTimeout(offlineTimers.get(id)); // reconnected within grace period
    offlineTimers.delete(id);
    if (map.get(id).size === 1) emitMentorPresence(id, true); // first socket = just came online
  }

  console.log(
    `${label} ${id} is ONLINE (${map.get(id).size} socket${map.get(id).size > 1 ? "s" : ""})`,
  );
  return id;
};

// ================= SOCKET CONNECTION =================

io.on("connection", (socket) => {
  const { id, role } = socket.data.user;
  console.log(`Socket connected: ${socket.id} (${role} ${id})`);

  // Mark user online based on the trusted role from the token
  if (role === "mentor") {
    markOnline(socket, "mentor", id);
    // Send pending booking requests to this mentor
    if (typeof pushPendingToMentor === "function") {
      Promise.resolve(pushPendingToMentor(app, id)).catch((err) =>
        console.error("pushPendingToMentor failed:", err.message),
      );
    }
  } else if (role === "fresher") {
    markOnline(socket, "employee", id);
  }

  // Client can explicitly go offline (e.g. logout button)
  socket.on("mentor-offline", () => markOffline(socket, "mentor"));
  socket.on("employee-offline", () => markOffline(socket, "employee"));

  // Disconnect: clean up BOTH roles in case something weird happened
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
    markOffline(socket, "mentor");
    markOffline(socket, "employee");
  });
});

// ================= START SERVER =================

const startServer = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected successfully");

    // Run schedulers on ONE instance only
    startSchedulers(app);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO running on port ${PORT}`);
      console.log(`Allowed frontend: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();

// ================= SHUTDOWN =================

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));