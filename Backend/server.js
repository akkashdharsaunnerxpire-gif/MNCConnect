require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");

const connectDB = require("./config/db");

const {
  seedAdminFromEnv,
} = require("./controllers/adminController");


// ========================================
// ENV
// ========================================

const PORT =
  Number(process.env.PORT) || 5000;

const CLIENT_URL =
  process.env.CLIENT_URL ||
  "http://localhost:5173";


// ========================================
// START SERVER
// ========================================

const startServer = async () => {

  try {

    // ========================================
    // ENV VALIDATION
    // ========================================

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


    if (!process.env.CLIENT_URL) {

      throw new Error(
        "CLIENT_URL is missing in environment variables."
      );
    }


    // ========================================
    // DATABASE
    // ========================================

    await connectDB();

    await seedAdminFromEnv();


    // ========================================
    // HTTP SERVER
    // ========================================

    const server =
      http.createServer(app);


    // ========================================
    // SOCKET.IO
    // ========================================

    const io = new Server(server, {

      cors: {

        origin: CLIENT_URL,

        methods: [
          "GET",
          "POST",
        ],

        credentials: true,
      },

    });


    // ========================================
    // ONLINE EMPLOYEES
    // ========================================

    /*
      employeeId -> Set of socket IDs

      Example:

      EMP001 -> {
        socket123,
        socket456
      }

      Multiple tabs/devices
      open pannalum online maintain pannalam.
    */

    const onlineEmployees =
      new Map();


    // ========================================
    // ONLINE MENTORS
    // ========================================

    /*
      mentorId -> Set of socket IDs
    */

    const onlineMentors =
      new Map();


    // ========================================
    // MAKE AVAILABLE TO CONTROLLERS
    // ========================================

    app.set(
      "io",
      io
    );

    app.set(
      "onlineEmployees",
      onlineEmployees
    );

    app.set(
      "onlineMentors",
      onlineMentors
    );


    // ========================================
    // ADD ONLINE USER
    // ========================================

    const addOnlineUser = (
      map,
      userId,
      socketId
    ) => {

      const id =
        String(userId);


      if (!map.has(id)) {

        map.set(
          id,
          new Set()
        );
      }


      map
        .get(id)
        .add(socketId);
    };


    // ========================================
    // REMOVE ONLINE USER
    // ========================================

    const removeOnlineUser = (
      map,
      userId,
      socketId
    ) => {

      if (!userId) {
        return false;
      }


      const id =
        String(userId);


      const sockets =
        map.get(id);


      if (!sockets) {
        return false;
      }


      sockets.delete(
        socketId
      );


      if (
        sockets.size === 0
      ) {

        map.delete(id);

        return true;
      }


      return false;
    };


    // ========================================
    // SOCKET CONNECTION
    // ========================================

    io.on(
      "connection",
      (socket) => {

        console.log(
          "Socket connected:",
          socket.id
        );


        // ========================================
        // EMPLOYEE ONLINE
        // ========================================

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


        // ========================================
        // EMPLOYEE OFFLINE
        // ========================================

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


        // ========================================
        // MENTOR ONLINE
        // ========================================

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


        // ========================================
        // MENTOR OFFLINE
        // ========================================

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


        // ========================================
        // SOCKET DISCONNECT
        // ========================================

        socket.on(
          "disconnect",
          (reason) => {

            console.log(
              "Socket disconnected:",
              socket.id,
              reason
            );


            // ========================================
            // REMOVE EMPLOYEE
            // ========================================

            if (
              socket.employeeId
            ) {

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


            // ========================================
            // REMOVE MENTOR
            // ========================================

            if (
              socket.mentorId
            ) {

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

      }
    );


    // ========================================
    // START SERVER
    // ========================================

    server.listen(
      PORT,
      () => {

        console.log(
          "========================================"
        );

        console.log(
          `✅ Server running on port ${PORT}`
        );

        console.log(
          `✅ API: http://localhost:${PORT}`
        );

        console.log(
          `✅ Socket.IO: http://localhost:${PORT}`
        );

        console.log(
          `✅ Client URL: ${CLIENT_URL}`
        );

        console.log(
          "========================================"
        );

      }
    );

  } catch (error) {

    console.error(
      "❌ Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};


startServer();