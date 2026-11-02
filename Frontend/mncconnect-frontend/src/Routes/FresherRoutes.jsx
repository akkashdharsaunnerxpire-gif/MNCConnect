// src/Routes/FresherRoutes.jsx
//
// Mounted in App.jsx as  <Route path="/*" element={<FresherRoutes />} />
// (App.jsx's "/", "/auth" and "/mentor/*" are more specific, so they win first.)
//
//   PUBLIC     /login  /forgot-password  /reset-password/:token
//   PROTECTED  /Home/...  (fresher cookie required)
import React, { lazy } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";

import Home from "../FresherDashboard/pages/Home";
import FresherProfile from "../FresherDashboard/pages/FresherProfile";
import Mnclogos from "../FresherDashboard/mncLogos/Companylogos";
import MyBookings from "../FresherDashboard/pages/FresherBookings";
import SessionBoard from "../FresherDashboard/pages/Fresher_SessionsBoard";
import Notifications from "../FresherDashboard/pages/FresherNotifications";
import Header from "../FresherDashboard/Component/Header";
import BonusWallet from "../FresherDashboard/pages/FresherWallet";
import MeetingRoom from "../Commoncomponents/Meetingroom";
import SuspenseLoader from "../Commoncomponents/SuspenseLoader";
import { useAuth } from "../context/AuthContext";
import JoinGroup from "../FresherDashboard/pages/JoinGroup";

// Fresher auth pages (lazy, only loaded when opened)
const Login = lazy(() => import("../Authpage/FresherAuth/FresherLoginRegister"));
const Forgetpassword = lazy(
  () => import("../Authpage/FresherAuth/Forgetpassword"),
);
const FresherResetPassword = lazy(
  () => import("../Authpage/FresherAuth/FresherResetPassword"),
);

// ================= "come back after login" (group invite links) =================
// A friend opens  /Home/join/ABC123  while logged out -> we remember the link,
// send him to /login, and after login (he lands on /Home) we send him back to the link.

const AFTER_LOGIN_KEY = "mnc_after_login";
const AFTER_LOGIN_TTL_MS = 30 * 60 * 1000; // forget the link after 30 minutes
const RETURN_PATH = /^\/Home\/(join|meeting)\//; // only these links are remembered

const saveAfterLogin = (path) => {
  try {
    if (RETURN_PATH.test(path)) {
      sessionStorage.setItem(
        AFTER_LOGIN_KEY,
        JSON.stringify({ path, at: Date.now() }),
      );
    }
  } catch {
    /* storage blocked, ignore */
  }
};

const readAfterLogin = () => {
  try {
    const raw = sessionStorage.getItem(AFTER_LOGIN_KEY);
    if (!raw) return "";
    const { path, at } = JSON.parse(raw);
    if (!RETURN_PATH.test(String(path || "")) || Date.now() - at > AFTER_LOGIN_TTL_MS) {
      sessionStorage.removeItem(AFTER_LOGIN_KEY);
      return "";
    }
    return path;
  } catch {
    return "";
  }
};

const clearAfterLogin = () => {
  try {
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
  } catch {
    /* ignore */
  }
};

// ================= GUARDS =================

// PUBLIC login page: already-logged-in fresher goes straight to /Home
const FresherLoginRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role === "fresher") return <Navigate to="/Home" replace />;

  return <Login />;
};

// PROTECTED dashboard: the server (via cookie) decides.
const FresherProtectedRoute = () => {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SuspenseLoader />;

  if (role !== "fresher") {
    // remember an invite / meeting link so we can return to it after login
    saveAfterLogin(`${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }

  const here = `${location.pathname}${location.search}`;
  const saved = readAfterLogin();

  // just logged in and landed on /Home -> go to the link he came for
  if (saved && /^\/Home\/?$/.test(location.pathname)) {
    return <Navigate to={saved} replace />;
  }
  // arrived at the remembered link -> forget it
  if (saved && saved === here) clearAfterLogin();

  return <Outlet />;
};

const FresherLayout = () => (
  <div className="min-h-screen">
    <Header />
    <Outlet />
  </div>
);

/**
 * Wraps SessionBoard so that:
 *  - "Book again" (location.state.rebook) always opens the form directly
 *  - company names that contain "/" still match (splat route)
 *  - the page remounts on every new navigation (fresh rebook state)
 */
const SessionBoardRoute = () => {
  const location = useLocation();
  const params = useParams();

  // works for both  sessionboard/:companyName  and  sessionboard/*
  const company = params.companyName || params["*"] || "";

  if (!company && !location.state?.rebook?.companyName) {
    return <Navigate to="/Home" replace />;
  }

  return <SessionBoard key={location.key} />;
};

// Unknown path inside /Home -> log it, then go Home
const UnknownHomeRoute = () => {
  const location = useLocation();
  console.warn(
    "[FresherRoutes] No route matched:",
    location.pathname,
    "-> redirecting to /Home",
  );
  return <Navigate to="/Home" replace />;
};

// ================= ROUTES =================

const FresherRoutes = () => {
  return (
    <Routes>
      {/* ---------- PUBLIC (no login needed) ---------- */}
      <Route path="login" element={<FresherLoginRoute />} />
      <Route path="forgot-password" element={<Forgetpassword />} />
      <Route path="reset-password/:token" element={<FresherResetPassword />} />

      {/* ---------- PROTECTED (/Home/...) ---------- */}
      <Route path="Home" element={<FresherProtectedRoute />}>
        {/* Full-screen meeting room (no header) */}
        <Route path="meeting/:bookingId" element={<MeetingRoom />} />

        <Route element={<FresherLayout />}>
          <Route index element={<Home />} />

          {/* Book session + Book again (same mentor) */}
          <Route
            path="sessionboard/:companyName"
            element={<SessionBoardRoute />}
          />
          <Route path="sessionboard/*" element={<SessionBoardRoute />} />

          {/* Group session: a friend opens the invite link */}
          <Route path="join/:code" element={<JoinGroup />} />

          <Route path="bonus-wallet" element={<BonusWallet />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<FresherProfile />} />
          <Route path="mnc-logos" element={<Mnclogos />} />
          <Route path=":companyName" element={<SessionBoardRoute />} />
          <Route path="*" element={<UnknownHomeRoute />} />
        </Route>
      </Route>

      {/* ---------- anything else -> landing ---------- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default FresherRoutes;