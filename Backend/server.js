// server.js
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

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

// ================= ONLINE USERS =================
// Map<userId(string), Set<socketId>>

const onlineEmployees = new Map(); // freshers
const onlineMentors = new Map(); // mentors

app.set("io", io);
app.set("onlineEmployees", onlineEmployees);
app.set("onlineMentors", onlineMentors);

// Initialize meetings (meeting rooms listen for their own events)
initMeetings(io);

// ================= PRESENCE HELPERS =================

const PRESENCE = {
  employee: { map: onlineEmployees, label: "Fresher" },
  mentor: { map: onlineMentors, label: "Mentor" },
};

const toKey = (id) =>
  id === undefined || id === null ? "" : String(id).trim();

// Add a socket to a user's set
const markOnline = (socket, role, rawId) => {
  const { map, label } = PRESENCE[role];
  const id = toKey(rawId);
  if (!id) return null;

  // If this socket was already tracking a different id under this role, clean up
  if (socket.data.presence && socket.data.presence[role] && socket.data.presence[role] !== id) {
    markOffline(socket, role);
  }

  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(socket.id);

  socket.data.presence = socket.data.presence || {};
  socket.data.presence[role] = id;

  console.log(`${label} ${id} is ONLINE (${map.get(id).size} socket${map.get(id).size > 1 ? "s" : ""})`);
  return id;
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
    } else {
      console.log(`${label} ${id} still has ${set.size} socket(s) online`);
    }
  }

  delete socket.data.presence[role];
};

// ================= JWT HANDSHAKE AUTH =================
// The client passes the token via socket.handshake.auth.token.
// The server derives identity from the token — a client can NEVER spoof it.

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id || !payload?.role) {
      return next(new Error("Invalid token payload"));
    }
    socket.data.user = {
      id: String(payload.id),
      role: String(payload.role),
    };
    return next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    return next(new Error("Invalid or expired token"));
  }
});

// ================= SOCKET CONNECTION =================

io.on("connection", (socket) => {
  const { id, role } = socket.data.user;
  console.log(`Socket connected: ${socket.id} (${role} ${id})`);

  // Mark user online based on the trusted role from the token
  if (role === "mentor") {
    markOnline(socket, "mentor", id);
    // Send pending booking requests to this mentor
    pushPendingToMentor(app, id).catch((err) =>
      console.error("pushPendingToMentor failed:", err.message)
    );
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

    server.listen(PORT, () => {
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
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});