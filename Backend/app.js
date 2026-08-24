const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const mentorRoutes = require("./routes/mentorRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ============================================================
// SECURITY HEADERS
// ============================================================

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "same-site",
    },
  })
);

// ============================================================
// SESSION CONFIGURATION (For Admin)
// ============================================================

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mncconnect-session-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ============================================================
// COOKIE PARSER
// ============================================================

app.use(cookieParser());

// ============================================================
// CORS CONFIGURATION - Applied ONLY to /api routes
// ============================================================

const allowedOrigins = (
  process.env.CLIENT_URLS ||
  "http://localhost:5173"
)
.split(",")
.map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests / Postman / no origin
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(
      new Error("CORS: Origin not allowed")
    );
  },
  credentials: true,
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

// ============================================================
// CORS - Apply ONLY to /api routes
// ============================================================

// Apply CORS middleware ONLY to API routes
app.use("/api", cors(corsOptions));
app.use("/api/mentors", mentorRoutes);

// ============================================================
// BODY PARSERS - Global
// ============================================================

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// ============================================================
// STATIC FILES - For Admin panel (CSS, JS, etc.)
// ============================================================

app.use(express.static("public"));

// ============================================================
// VIEW ENGINE - EJS for Admin panel
// ============================================================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ============================================================
// HEALTH CHECK - Public route (no CORS needed)
// ============================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MNCConnect API is running",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// API ROUTES - With CORS applied
// ============================================================

app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);

// ============================================================
// ADMIN ROUTES - NO CORS (uses EJS + sessions)
// ============================================================

app.use("/admin", adminRoutes);

// ============================================================
// 404 HANDLER - Detect if it's an API or Admin route
// ============================================================

app.use((req, res) => {
  // If it's an API route, return JSON error
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }

  // For Admin routes, return simple HTML error
  if (req.path.startsWith("/admin/")) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>404 - Page Not Found</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: #0f172a; 
              color: #e2e8f0; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0;
            }
            .container { 
              text-align: center; 
              padding: 2rem;
            }
            h1 { font-size: 4rem; color: #818cf8; margin-bottom: 0; }
            p { font-size: 1.2rem; color: #94a3b8; }
            a { color: #818cf8; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>404</h1>
            <p>Page not found: ${req.method} ${req.originalUrl}</p>
            <p><a href="/admin">← Back to Admin Dashboard</a></p>
          </div>
        </body>
      </html>
    `);
  }

  // Default fallback
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
      <head><title>404 - Not Found</title></head>
      <body>
        <h1>404 - Not Found</h1>
        <p>The requested resource was not found.</p>
      </body>
    </html>
  `);
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
  console.error("Global error:", error);

  // CORS errors - Return JSON for API, HTML for Admin
  if (error.message?.startsWith("CORS:")) {
    // If it's an API route, return JSON
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({
        success: false,
        message: "Request origin is not allowed.",
      });
    }

    // For Admin routes, return HTML
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>403 - Forbidden</title></head>
        <body>
          <h1>403 - Forbidden</h1>
          <p>Request origin is not allowed.</p>
          <p><a href="/admin">← Back to Admin</a></p>
        </body>
      </html>
    `);
  }

  // File size limit errors
  if (error.code === "LIMIT_FILE_SIZE") {
    if (req.path.startsWith("/api/")) {
      return res.status(400).json({
        success: false,
        message: "File size cannot exceed 5MB.",
      });
    }
    return res.status(400).send("File size cannot exceed 5MB.");
  }

  // Multer errors
  if (error instanceof require("multer").MulterError) {
    if (req.path.startsWith("/api/")) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed.",
      });
    }
    return res.status(400).send(error.message || "File upload failed.");
  }

  // API route errors - Return JSON
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }

  // Admin route errors - Return HTML
  return res.status(500).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>500 - Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 2rem; }
          h1 { font-size: 3rem; color: #ef4444; }
          p { color: #94a3b8; }
          a { color: #818cf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>500 - Server Error</h1>
          <p>Something went wrong. Please try again later.</p>
          <p><a href="/admin">← Back to Admin Dashboard</a></p>
        </div>
      </body>
    </html>
  `);
});

module.exports = app;