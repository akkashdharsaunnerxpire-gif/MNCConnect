require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const { seedAdminFromEnv } = require("./controllers/adminController");

const authRoutes = require("./routes/authRoutes");
const mentorRoutes = require("./routes/mentorRoutes");

const PORT = Number(process.env.PORT) || 5000;

app.use("/api/auth", authRoutes);
app.use("/api/mentor", mentorRoutes);

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is missing in environment variables."
      );
    }

    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing in environment variables."
      );
    }

    await connectDB();
    await seedAdminFromEnv();

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:3000",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    /*
      employeeId -> Set of socket IDs

      Example:

      {
        "EMP001": Set {
          "socket123",
          "socket456"
        }
      }

      Same employee multiple tabs/devices open
      pannalum online-ah maintain pannalam.
    */
    const onlineEmployees = new Map();

    /*
      mentorId -> Set of socket IDs
    */
    const onlineMentors = new Map();

    /*
      Make these available to controllers.

      Controller-la:

      const io = req.app.get("io");
      const onlineEmployees =
        req.app.get("onlineEmployees");
    */
    app.set("io", io);
    app.set(
      "onlineEmployees",
      onlineEmployees
    );
    app.set(
      "onlineMentors",
      onlineMentors
    );

    const addOnlineUser = (
      map,
      userId,
      socketId
    ) => {
      const id = String(userId);

      if (!map.has(id)) {
        map.set(id, new Set());
      }

      map.get(id).add(socketId);
    };

    const removeOnlineUser = (
      map,
      userId,
      socketId
    ) => {
      if (!userId) {
        return false;
      }

      const id = String(userId);

      const sockets = map.get(id);

      if (!sockets) {
        return false;
      }

      sockets.delete(socketId);

      if (sockets.size === 0) {
        map.delete(id);

        return true;
      }

      return false;
    };

    io.on("connection", (socket) => {
      console.log(
        "Socket connected:",
        socket.id
      );

      /*
        ========================================
        EMPLOYEE ONLINE
        ========================================
      */

      socket.on(
        "employee-online",
        (payload = {}) => {
          const employeeId =
            payload.employeeId;

          if (!employeeId) {
            console.log(
              "Employee ID missing"
            );

            return;
          }

          socket.employeeId =
            String(employeeId);

          addOnlineUser(
            onlineEmployees,
            employeeId,
            socket.id
          );

          console.log(
            `Employee ${employeeId} is ONLINE`
          );

          console.log(
            "Online employees:",
            Array.from(
              onlineEmployees.keys()
            )
          );

          io.emit(
            "employee-status",
            {
              employeeId:
                String(employeeId),

              isOnline: true,
            }
          );
        }
      );

      /*
        ========================================
        EMPLOYEE OFFLINE
        ========================================
      */

      socket.on(
        "employee-offline",
        (payload = {}) => {
          const employeeId =
            payload.employeeId ||
            socket.employeeId;

          if (!employeeId) {
            return;
          }

          const becameOffline =
            removeOnlineUser(
              onlineEmployees,
              employeeId,
              socket.id
            );

          console.log(
            `Employee ${employeeId} socket disconnected manually`
          );

          if (becameOffline) {
            io.emit(
              "employee-status",
              {
                employeeId:
                  String(employeeId),

                isOnline: false,
              }
            );
          }
        }
      );

      /*
        ========================================
        MENTOR ONLINE
        ========================================
      */

      socket.on(
        "mentor-online",
        (payload = {}) => {
          const mentorId =
            payload.mentorId;

          if (!mentorId) {
            console.log(
              "Mentor ID missing"
            );

            return;
          }

          socket.mentorId =
            String(mentorId);

          addOnlineUser(
            onlineMentors,
            mentorId,
            socket.id
          );

          console.log(
            `Mentor ${mentorId} is ONLINE`
          );

          io.emit(
            "mentor-status",
            {
              mentorId:
                String(mentorId),

              isOnline: true,
            }
          );
        }
      );

      /*
        ========================================
        MENTOR OFFLINE
        ========================================
      */

      socket.on(
        "mentor-offline",
        (payload = {}) => {
          const mentorId =
            payload.mentorId ||
            socket.mentorId;

          if (!mentorId) {
            return;
          }

          const becameOffline =
            removeOnlineUser(
              onlineMentors,
              mentorId,
              socket.id
            );

          console.log(
            `Mentor ${mentorId} went OFFLINE`
          );

          if (becameOffline) {
            io.emit(
              "mentor-status",
              {
                mentorId:
                  String(mentorId),

                isOnline: false,
              }
            );
          }
        }
      );

      /*
        ========================================
        SOCKET DISCONNECT
        ========================================
      */

      socket.on(
        "disconnect",
        (reason) => {
          console.log(
            "Socket disconnected:",
            socket.id,
            reason
          );

          /*
            Remove employee
          */

          if (socket.employeeId) {
            const employeeId =
              socket.employeeId;

            const becameOffline =
              removeOnlineUser(
                onlineEmployees,
                employeeId,
                socket.id
              );

            if (becameOffline) {
              console.log(
                `Employee ${employeeId} is OFFLINE`
              );

              io.emit(
                "employee-status",
                {
                  employeeId:
                    String(employeeId),

                  isOnline: false,
                }
              );
            }
          }

          /*
            Remove mentor
          */

          if (socket.mentorId) {
            const mentorId =
              socket.mentorId;

            const becameOffline =
              removeOnlineUser(
                onlineMentors,
                mentorId,
                socket.id
              );

            if (becameOffline) {
              console.log(
                `Mentor ${mentorId} is OFFLINE`
              );

              io.emit(
                "mentor-status",
                {
                  mentorId:
                    String(mentorId),

                  isOnline: false,
                }
              );
            }
          }
        }
      );
    });

    server.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          `API: http://localhost:${PORT}`
        );

        console.log(
          `Socket.IO: http://localhost:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};

startServer();