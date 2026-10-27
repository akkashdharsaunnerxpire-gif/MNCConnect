// src/Routes/FresherRoutes.jsx
import React from "react";
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

// The server (via cookie) decides. While it answers, show the loader.
const FresherProtectedRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role !== "fresher") return <Navigate to="/login" replace />;

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

// Shows which path failed to match, then goes Home
const UnknownRoute = () => {
  const location = useLocation();
  console.warn(
    "[FresherRoutes] No route matched:",
    location.pathname,
    "-> redirecting to /Home",
  );
  return <Navigate to="/Home" replace />;
};

const FresherRoutes = () => {
  return (
    <Routes>
      <Route element={<FresherProtectedRoute />}>
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

          <Route path="bonus-wallet" element={<BonusWallet />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<FresherProfile />} />
          <Route path="mnc-logos" element={<Mnclogos />} />
          <Route path=":companyName" element={<SessionBoardRoute />} />
          <Route path="*" element={<UnknownRoute />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default FresherRoutes;