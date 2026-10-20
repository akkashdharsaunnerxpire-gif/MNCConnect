// app.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const sessionRoutes = require("./routes/sessionroutes");
const adminRoutes = require("./routes/adminRoutes");
const mentorPanelRoutes = require("./routes/mentorPanelRoutes");
const fresherBookingRoutes = require("./routes/fresherBookingRoutes");
const instructionRoutes = require("./routes/instructionRoutes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const isProd = process.env.NODE_ENV === "production";

// ================= SECURITY HEADERS =================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

// ================= CORS =================

const allowedOrigins = [
  ...new Set(
    [
      process.env.CLIENT_URL,
      "https://mncconnect.onrender.com",
      "https://mncconnect-backend.onrender.com",
      "http://localhost:5173",
      "http://localhost:5174",
    ].filter(Boolean)
  ),
];

app.set("allowedOrigins", allowedOrigins);
console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    const sameOrigin = origin === `${req.protocol}://${req.get("host")}`;

    const allowed =
      !origin ||
      origin === "null" ||
      sameOrigin ||
      allowedOrigins.includes(origin);

    if (!allowed) {
      console.log("CORS blocked origin:", origin);
      const err = new Error(`CORS blocked for origin: ${origin}`);
      err.status = 403;
      return callback(err);
    }

    callback(null, {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    });
  })
);

// ================= BODY PARSER =================
// MUST come before any route that reads req.body

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================= SESSION =================

let store;
try {
  const MongoStore = require("connect-mongo");
  store = (MongoStore.default || MongoStore).create({
    clientPromise: mongoose.connection
      .asPromise()
      .then((conn) => conn.getClient())
      .catch((err) => {
        console.error("Session store Mongo connection failed:", err.message);
        throw err;
      }),
    collectionName: "sessions",
  });
} catch (error) {
  console.warn(
    "connect-mongo is not installed - sessions use MemoryStore. Run: npm i connect-mongo"
  );
}

if (isProd && !process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set - using an insecure default!");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mncconnect-secret",
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// ================= STATIC FILES =================

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));

// ================= EJS =================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "MNCConnect Backend is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

// ================= ROUTES =================
// ORDER MATTERS.

app.use("/api/auth", authRoutes);

// Booking router FIRST so it owns PATCH /api/session/session-requests/:id
app.use("/api", fresherBookingRoutes);

app.use("/api/payments", paymentRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/session", sessionRoutes);

// Mentor panel: /api/wallet/*, /api/reviews/*, /api/notifications/*
app.use("/api", mentorPanelRoutes);

// Meeting instructions (used by both mentor and fresher)
app.use("/api/instructions", instructionRoutes);

app.use("/admin", adminRoutes);

// ================= DEV ROUTE CHECK =================

if (!isProd) {
  const listed = [];
  (fresherBookingRoutes.stack || []).forEach((layer) => {
    if (layer.route) {
      Object.keys(layer.route.methods).forEach((m) =>
        listed.push(`${m.toUpperCase()} /api${layer.route.path}`)
      );
    }
  });
  console.log(
    "Booking routes mounted:\n  " +
      (listed.join("\n  ") || "NONE - check routes/fresherBookingRoutes.js")
  );
  if (!listed.some((l) => l.includes("/session/session-requests/"))) {
    console.warn(
      "PATCH /api/session/session-requests/:requestGroupId is NOT handled by bookingController"
    );
  }
}

// ================= 404 =================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= GLOBAL ERROR =================

app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message:
      isProd && status >= 500
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
  });
});

module.exports = app;