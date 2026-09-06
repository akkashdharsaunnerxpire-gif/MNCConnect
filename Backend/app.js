const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const sessionRoutes = require("./routes/sessionroutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ================= CORS =================

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

// ================= HELMET =================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ================= CORS =================

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("CORS blocked origin:", origin);

      return callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
    },
    credentials: true,
  })
);

// ================= BODY PARSER =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= COOKIE =================

app.use(cookieParser());

// ================= SESSION =================

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mncconnect-secret",
    resave: false,
    saveUninitialized: false,

    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    },
  })
);

// ================= PUBLIC FILES =================

app.use(
  "/public",
  express.static(path.join(__dirname, "public"))
);

// ================= EJS =================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MNCConnect Backend is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// ================= API ROUTES =================

app.use("/api/auth", authRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/mentor", mentorRoutes);

app.use("/api/session", sessionRoutes);

app.use("/admin", adminRoutes);

// ================= 404 =================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ================= GLOBAL ERROR =================

app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;