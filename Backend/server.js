require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

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

// Same origin list as the Express CORS config (set in app.js), plus local dev ports
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
// Map<userId(string), Set<socketId>>  -> one user can have many tabs/devices.
// Keys are ALWAYS strings, so controllers must look up with String(id).

const onlineEmployees = new Map();
const onlineMentors = new Map();

// Make Socket.IO and online users available inside Express routes
app.set("io", io);
app.set("onlineEmployees", onlineEmployees);
app.set("onlineMentors", onlineMentors);

// Initialize meetings only after Socket.IO is created
initMeetings(io);

// ================= PRESENCE HELPERS =================

const PRESENCE = {
  employee: { map: onlineEmployees, field: "employeeId", label: "Employee" },
  mentor: { map: onlineMentors, field: "mentorId", label: "Mentor" },
};

const toKey = (id) => (id === undefined || id === null ? "" : String(id).trim());

const markOffline = (socket, role) => {
  const { map, field, label } = PRESENCE[role];
  const id = socket[field];

  if (!id) return;

  const sockets = map.get(id);

  if (sockets) {
    sockets.delete(socket.id);

    if (sockets.size === 0) {
      map.delete(id);
      console.log(`${label} ${id} is OFFLINE`);
    }
  }

  delete socket[field];
};

const markOnline = (socket, role, rawId) => {
  const { map, field, label } = PRESENCE[role];
  const id = toKey(rawId);

  if (!id) return null;

  // same socket re-announcing under a different id -> clean the old entry first
  if (socket[field] && socket[field] !== id) {
    markOffline(socket, role);
  }

  if (!map.has(id)) {
    map.set(id, new Set());
  }

  map.get(id).add(socket.id);
  socket[field] = id;

  console.log(`${label} ${id} is ONLINE`);

  return id;
};

// ================= SOCKET CONNECTION =================
// SECURITY TODO: the client currently tells us who it is (employeeId / mentorId)
// with no proof. Anyone could emit "mentor-online" with another mentor's id and
// receive that mentor's pending requests. Verify the JWT in io.use() and take the
// id from the token instead of from the event payload.

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ---------------- EMPLOYEE ----------------

  socket.on("employee-online", (employeeId) => {
    markOnline(socket, "employee", employeeId);
  });

  // the socket can only take itself offline (the id argument is ignored on purpose)
  socket.on("employee-offline", () => {
    markOffline(socket, "employee");
  });

  // ---------------- MENTOR ----------------

  socket.on("mentor-online", async (mentorId) => {
    const id = markOnline(socket, "mentor", mentorId);

    if (!id) return;

    // Send pending booking requests to this mentor
    try {
      await pushPendingToMentor(app, id);
    } catch (error) {
      console.error("Failed to send pending requests to mentor:", error.message);
    }
  });

  socket.on("mentor-offline", () => {
    markOffline(socket, "mentor");
  });

  // ---------------- DISCONNECT ----------------

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    markOffline(socket, "employee");
    markOffline(socket, "mentor");
  });
});

// ================= START SERVER =================

const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    console.log("MongoDB connected successfully");

    // Start booking schedulers after database connection
    // (if you ever run more than one instance, run schedulers on ONE of them only)
    startSchedulers(app);

    // Start HTTP and Socket.IO server
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

// ================= SHUTDOWN / SAFETY NET =================

// Render sends SIGTERM on every deploy/restart
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);

  // io.close() also closes the underlying HTTP server
  io.close(() => process.exit(0));

  // don't hang forever if a connection refuses to close
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});