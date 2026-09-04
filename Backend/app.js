const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const mentorRoutes = require("./routes/mentorRoutes");

const app = express();


// ========================================
// BASIC CONFIG
// ========================================

app.disable("x-powered-by");


// ========================================
// HELMET
// ========================================

app.use(
  helmet({
    contentSecurityPolicy: false,

    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);


// ========================================
// SESSION
// ========================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "mncconnect-session-secret-dev",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite: "lax",

      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);


// ========================================
// COOKIE PARSER
// ========================================

app.use(cookieParser());


// ========================================
// CORS
// ========================================

const allowedOrigins = (
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log(
  "✅ Allowed CORS origins:",
  allowedOrigins
);


const corsOptions = {
  origin: (origin, callback) => {

    // Allow requests like Postman / server-to-server
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(
      "❌ Blocked CORS origin:",
      origin
    );

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
    "X-Requested-With",
  ],
};


// Apply CORS to API routes
app.use("/api", cors(corsOptions));


// ========================================
// BODY PARSER
// ========================================

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


// ========================================
// STATIC FILES
// ========================================

app.use(express.static("public"));


// ========================================
// EJS
// ========================================

app.set("view engine", "ejs");

app.set(
  "views",
  path.join(__dirname, "views")
);


// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {

  res.status(200).json({
    success: true,
    message: "MNCConnect API is running",
    timestamp: new Date().toISOString(),
  });

});


// ========================================
// API ROUTES
// ========================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/payments",
  paymentRoutes
);

app.use(
  "/api/mentor",
  mentorRoutes
);


// ========================================
// ADMIN ROUTES
// ========================================

app.use(
  "/admin",
  adminRoutes
);


// ========================================
// 404 HANDLER
// ========================================

app.use((req, res) => {

  if (req.path.startsWith("/api/")) {

    return res.status(404).json({
      success: false,
      message:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }


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

            h1 {
              font-size: 4rem;
              color: #818cf8;
              margin-bottom: 0;
            }

            p {
              font-size: 1.2rem;
              color: #94a3b8;
            }

            a {
              color: #818cf8;
              text-decoration: none;
            }

            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>

        <body>

          <div class="container">

            <h1>404</h1>

            <p>
              Page not found:
              ${req.method} ${req.originalUrl}
            </p>

            <p>
              <a href="/admin">
                ← Back to Admin Dashboard
              </a>
            </p>

          </div>

        </body>

      </html>
    `);
  }


  return res.status(404).send(`
    <!DOCTYPE html>

    <html>

      <head>
        <title>404 - Not Found</title>
      </head>

      <body>

        <h1>404 - Not Found</h1>

        <p>
          The requested resource was not found.
        </p>

      </body>

    </html>
  `);
});


// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {

  console.error(
    "Global error:",
    error
  );


  // ========================================
  // CORS ERROR
  // ========================================

  if (
    error.message?.startsWith("CORS:")
  ) {

    if (
      req.path.startsWith("/api/")
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Request origin is not allowed.",
      });
    }

    return res.status(403).send(`
      <!DOCTYPE html>

      <html>

        <head>
          <title>403 - Forbidden</title>
        </head>

        <body>

          <h1>403 - Forbidden</h1>

          <p>
            Request origin is not allowed.
          </p>

          <p>
            <a href="/admin">
              ← Back to Admin
            </a>
          </p>

        </body>

      </html>
    `);
  }


  // ========================================
  // FILE SIZE ERROR
  // ========================================

  if (
    error.code === "LIMIT_FILE_SIZE"
  ) {

    if (
      req.path.startsWith("/api/")
    ) {

      return res.status(400).json({
        success: false,
        message:
          "File size cannot exceed 5MB.",
      });
    }

    return res.status(400).send(
      "File size cannot exceed 5MB."
    );
  }


  // ========================================
  // MULTER ERROR
  // ========================================

  if (
    error instanceof
    require("multer").MulterError
  ) {

    if (
      req.path.startsWith("/api/")
    ) {

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "File upload failed.",
      });
    }

    return res.status(400).send(
      error.message ||
      "File upload failed."
    );
  }


  // ========================================
  // GENERAL API ERROR
  // ========================================

  if (
    req.path.startsWith("/api/")
  ) {

    return res.status(500).json({
      success: false,
      message:
        "Internal server error.",
      error:
        error.message,
    });
  }


  // ========================================
  // GENERAL HTML ERROR
  // ========================================

  return res.status(500).send(`
    <!DOCTYPE html>

    <html>

      <head>

        <title>
          500 - Server Error
        </title>

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

          h1 {
            font-size: 3rem;
            color: #ef4444;
          }

          p {
            color: #94a3b8;
          }

          a {
            color: #818cf8;
            text-decoration: none;
          }

        </style>

      </head>

      <body>

        <div class="container">

          <h1>
            500 - Server Error
          </h1>

          <p>
            Something went wrong.
            Please try again later.
          </p>

          <p>
            <a href="/admin">
              ← Back to Admin
            </a>
          </p>

        </div>

      </body>

    </html>
  `);

});


module.exports = app;