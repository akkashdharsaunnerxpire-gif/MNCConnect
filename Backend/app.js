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
const mentorPanelRoutes = require("./routes/mentorPanelRoutes"); // wallet, reviews, notifications
// bookings, fresher notifications, mentor accept/reject (file name fixed: was ./routes/bookingRoutes)
const fresherBookingRoutes = require("./routes/fresherBookingRoutes");

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

// ================= CORS (single instance) =================

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

// Socket.IO (server.js) reads the same list so HTTP and websocket CORS never drift apart
app.set("allowedOrigins", allowedOrigins);

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");

    // Admin panel is served from this same server -> same-origin is always allowed
    const sameOrigin = origin === `${req.protocol}://${req.get("host")}`;

    // NOTE: "null" origin + credentials is risky (sandboxed iframes, file://).
    // Remove it if nothing in your setup needs it.
    const allowed =
      !origin ||
      origin === "null" ||
      sameOrigin ||
      allowedOrigins.includes(origin);

    if (!allowed) {
      console.log("CORS blocked origin:", origin);
      const err = new Error(`CORS blocked for origin: ${origin}`);
      err.status = 403; // otherwise the global handler answers 500
      return callback(err);
    }

    callback(null, { origin: true, credentials: true });
  })
);

// ================= BODY PARSER =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= COOKIE =================

app.use(cookieParser());

// ================= SESSION =================
// The default MemoryStore resets on every restart (Render restarts often) and leaks memory.
// If connect-mongo is installed (npm i connect-mongo) sessions are stored in MongoDB,
// re-using the same connection as mongoose. If it is not installed the app still starts
// with MemoryStore and prints a warning.
let store;
try {
  const MongoStore = require("connect-mongo");
  store = (MongoStore.default || MongoStore).create({
    clientPromise: mongoose.connection.asPromise().then((conn) => conn.getClient()),
    collectionName: "sessions",
  });
} catch (error) {
  console.warn("connect-mongo is not installed - sessions use MemoryStore. Run: npm i connect-mongo");
}

if (isProd && !process.env.SESSION_SECRET) {
  console.warn("⚠️  SESSION_SECRET is not set - using an insecure default!");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mncconnect-secret",
    store, // undefined -> MemoryStore
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ================= STATIC FILES =================

app.use("/public", express.static(path.join(__dirname, "public")));

// Admin assets: /admin/css/admin.css, /admin/js/admin.js
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
// ORDER MATTERS. Express uses the first matching route.

app.use("/api/auth", authRoutes);

// Booking router FIRST (before /api/session and the /api panels):
//  - it owns PATCH /api/session/session-requests/:id (new bookingController)
//    so the old handler inside sessionRoutes is never reached for that path
//  - it only declares specific paths, so every other request falls through untouched
app.use("/api", fresherBookingRoutes);

app.use("/api/payments", paymentRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/session", sessionRoutes);

// Mentor panel: /api/wallet/*, /api/reviews/*, /api/notifications/*, /api/payments/assign-to-me
// Mounted after the specific routers above so they keep priority.
app.use("/api", mentorPanelRoutes);

app.use("/admin", adminRoutes);

// ================= ROUTE CHECK (dev) =================
// Prints the booking routes that are really mounted, so a 404 is easy to debug.
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
      "⚠️  PATCH /api/session/session-requests/:requestGroupId is NOT handled by bookingController " +
        "(controllers/bookingController.js must export `updateRequest`)"
    );
  }
}

// ================= 404 =================

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ================= GLOBAL ERROR =================

app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  const status = err.status || 500;

  res.status(status).json({
    success: false,
    // don't leak internal error text for 5xx in production
    message: isProd && status >= 500 ? "Internal Server Error" : err.message || "Internal Server Error",
  });
});

module.exports = app;