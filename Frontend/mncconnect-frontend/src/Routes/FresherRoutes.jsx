import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Home from "../FresherDashboard/pages/Home";
import FresherProfile from "../FresherDashboard/pages/FresherProfile";
import Mnclogos from "../FresherDashboard/mncLogos/Companylogos";
import MyBookings from "../FresherDashboard/pages/FresherBookings";
import SessionBoard from "../FresherDashboard/pages/Fresher_SessionsBoard";
import Notifications from "../FresherDashboard/pages/FresherNotifications";
import Header from "../FresherDashboard/Component/Header";
import BonusWallet from "../FresherDashboard/pages/FresherWallet";
import MeetingRoom from "../FresherDashboard/pages/Meetingroom";

const isFresherLoggedIn = () => Boolean(localStorage.getItem("fresher_token"));

const FresherProtectedRoute = () => {
  if (!isFresherLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const FresherLayout = () => (
  <div className="min-h-screen">
    <Header />
    <Outlet />
  </div>
);

const FresherRoutes = () => {
  return (
    <Routes>
      <Route element={<FresherProtectedRoute />}>
        {/* Full-screen meeting room (no header) */}
        <Route path="meeting/:bookingId" element={<MeetingRoom />} />

        <Route element={<FresherLayout />}>
          <Route index element={<Home />} />

          <Route path="sessionboard/:companyName" element={<SessionBoard />} />
          <Route path="bonus-wallet" element={<BonusWallet />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<FresherProfile />} />
          <Route path="mnc-logos" element={<Mnclogos />} />

          <Route path=":companyName" element={<SessionBoard />} />

          <Route path="*" element={<Navigate to="/Home" replace />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default FresherRoutes;