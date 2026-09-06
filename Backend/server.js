require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      CLIENT_URL,
      "http://localhost:5174",
    ],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const onlineEmployees = new Map();
const onlineMentors = new Map();

app.set("io", io);
app.set("onlineEmployees", onlineEmployees);
app.set("onlineMentors", onlineMentors);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ================= EMPLOYEE ONLINE =================
  socket.on("employee-online", (employeeId) => {
    if (!employeeId) return;

    if (!onlineEmployees.has(employeeId)) {
      onlineEmployees.set(employeeId, new Set());
    }

    onlineEmployees.get(employeeId).add(socket.id);
    socket.employeeId = employeeId;

    console.log(`Employee ${employeeId} is ONLINE`);
  });

  // ================= EMPLOYEE OFFLINE =================
  socket.on("employee-offline", (employeeId) => {
    if (!employeeId) return;

    const sockets = onlineEmployees.get(employeeId);

    if (sockets) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineEmployees.delete(employeeId);
        console.log(`Employee ${employeeId} is OFFLINE`);
      }
    }
  });

  // ================= MENTOR ONLINE =================
  socket.on("mentor-online", (mentorId) => {
    if (!mentorId) return;

    if (!onlineMentors.has(mentorId)) {
      onlineMentors.set(mentorId, new Set());
    }

    onlineMentors.get(mentorId).add(socket.id);
    socket.mentorId = mentorId;

    console.log(`Mentor ${mentorId} is ONLINE`);
  });

  // ================= MENTOR OFFLINE =================
  socket.on("mentor-offline", (mentorId) => {
    if (!mentorId) return;

    const sockets = onlineMentors.get(mentorId);

    if (sockets) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineMentors.delete(mentorId);
        console.log(`Mentor ${mentorId} is OFFLINE`);
      }
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    // Employee cleanup
    if (socket.employeeId) {
      const sockets = onlineEmployees.get(socket.employeeId);

      if (sockets) {
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          onlineEmployees.delete(socket.employeeId);

          console.log(
            `Employee ${socket.employeeId} is OFFLINE`
          );
        }
      }
    }

    // Mentor cleanup
    if (socket.mentorId) {
      const sockets = onlineMentors.get(socket.mentorId);

      if (sockets) {
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          onlineMentors.delete(socket.mentorId);

          console.log(
            `Mentor ${socket.mentorId} is OFFLINE`
          );
        }
      }
    }
  });
});

const startServer = async () => {
  try {
    await connectDB();

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