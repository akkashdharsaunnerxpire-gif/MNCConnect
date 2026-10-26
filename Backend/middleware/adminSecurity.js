// middleware/adminSecurity.js
// 1) loginLimiter  - blocks brute-force password guessing
// 2) sameOriginOnly - CSRF protection for every state-changing admin request
//    (no change needed in admin.js: browsers always send Sec-Fetch-Site / Origin)

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5; // failed attempts allowed per window
const LOCK_MS = 15 * 60 * 1000; // lock time after too many failures

const attempts = new Map(); // key -> { fails, first, lockedUntil }

const keyOf = (req) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  return `${req.ip}|${email}`;
};

// clean old entries so the map never grows forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) {
    if ((v.lockedUntil || 0) < now && now - v.first > WINDOW_MS) attempts.delete(k);
  }
}, 5 * 60 * 1000).unref();

const loginLimiter = (req, res, next) => {
  const key = keyOf(req);
  const now = Date.now();
  const rec = attempts.get(key);

  if (rec && rec.lockedUntil && rec.lockedUntil > now) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60000);
    return res
      .status(429)
      .render("admin/login", {
        error: `Too many failed attempts. Try again in ${mins} minute(s).`,
      });
  }

  res.on("finish", () => {
    const cur = attempts.get(key) || { fails: 0, first: Date.now(), lockedUntil: 0 };

    // 3xx = successful login (redirect to /admin) -> reset
    if (res.statusCode >= 300 && res.statusCode < 400) {
      attempts.delete(key);
      return;
    }

    // 401 / 403 = wrong credentials or inactive account
    if (res.statusCode === 401 || res.statusCode === 403) {
      if (Date.now() - cur.first > WINDOW_MS) {
        cur.fails = 0;
        cur.first = Date.now();
      }
      cur.fails += 1;
      if (cur.fails >= MAX_FAILS) cur.lockedUntil = Date.now() + LOCK_MS;
      attempts.set(key, cur);
    }
  });

  next();
};

// ============================================================
// CSRF: same-origin check
// ============================================================

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Optional: extra trusted origins, comma separated.
// e.g. ALLOWED_ORIGINS=http://localhost:3000,https://admin.mysite.com
const EXTRA_HOSTS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    try { return new URL(s).host.toLowerCase(); } catch (_) { return ""; }
  })
  .filter(Boolean);

const hostOf = (value) => {
  try {
    return new URL(value).host.toLowerCase();
  } catch (_) {
    return ""; // handles "null", empty, malformed values
  }
};

const isSameOrigin = (req) => {
  // 1) Modern browsers (Chrome, Edge, Firefox, Safari 16.4+) send Sec-Fetch-Site.
  //    It cannot be set or changed by page JavaScript, and it still works
  //    when Referrer-Policy is "no-referrer" (which makes Origin = "null").
  const fetchSite = String(req.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "same-origin") return true;
  // "none" = user typed the URL / bookmark (not applicable to POST, but harmless)
  if (fetchSite === "none") return true;

  // 2) Fallback: compare Origin (or Referer) with the Host the request came to
  const forwarded = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const allowedHosts = [req.get("host"), forwarded, ...EXTRA_HOSTS]
    .filter(Boolean)
    .map((h) => h.toLowerCase());

  const origin = req.get("origin");
  const source = origin && origin !== "null" ? origin : req.get("referer");
  const sourceHost = hostOf(source);

  if (sourceHost && allowedHosts.includes(sourceHost)) return true;

  // Browser said cross-site / same-site(other port) and the host isn't trusted
  return false;
};

const sameOriginOnly = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  if (isSameOrigin(req)) return next();

  if (process.env.NODE_ENV !== "production") {
    console.warn("[CSRF] Blocked request:", {
      method: req.method,
      url: req.originalUrl,
      host: req.get("host"),
      origin: req.get("origin"),
      referer: req.get("referer"),
      secFetchSite: req.get("sec-fetch-site"),
    });
  }

  const wantsJson =
    req.xhr || String(req.get("accept") || "").includes("application/json");
  return wantsJson
    ? res.status(403).json({ success: false, message: "Blocked: cross-site request." })
    : res.status(403).send("Blocked: cross-site request.");
};

module.exports = { loginLimiter, sameOriginOnly };