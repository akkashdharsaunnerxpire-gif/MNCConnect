// src/Routes/MentorRoutes.jsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import MncEmployeeProfile from "../Authpage/MncEmployeeAuth/MncLoginRegister";
import Home from "../MncEmployee/pages/Home";
import MentorNotifications from "../MncEmployee/pages/notifications";
import MentorProfile from "../MncEmployee/pages/MentorProfile";
import MentorRequests from "../MncEmployee/pages/MentorRequests";
import MentorSessions from "../MncEmployee/pages/MentorSessions";
import MentorEarnings from "../MncEmployee/pages/MentorEarnings";
import MentorReviews from "../MncEmployee/pages/MentorReviews";
import MentorSettings from "../MncEmployee/pages/MentorSettings";
import MentorHeader from "../MncEmployee/Components/MentorHeader";
import ResetPassword from "../Authpage/MncEmployeeAuth/ResetPassword";
import MeetingRoom from "../FresherDashboard/pages/Meetingroom";

const isMentorLoggedIn = () =>
  Boolean(localStorage.getItem("mnc_mentor_token"));

const MentorProtectedRoute = () => {
  if (!isMentorLoggedIn()) {
    return <Navigate to="/mentor/login" replace />;
  }
  return <Outlet />;
};

const MentorLayout = () => (
  <div className="min-h-screen bg-[#080612] text-white">
    <MentorHeader />
    <main className="min-h-[calc(100vh-64px)]">
      <Outlet />
    </main>
  </div>
);

const MentorRoutes = () => {
  return (
    <Routes>
      <Route path="reset-password/:token" element={<ResetPassword />} />
      <Route path="register" element={<MncEmployeeProfile />} />
      <Route path="login" element={<MncEmployeeProfile />} />
      <Route path="forgot-password" element={<MncEmployeeProfile />} />

      <Route element={<MentorProtectedRoute />}>
        {/* Full-screen meeting room (no header) */}
        <Route path="meeting/:bookingId" element={<MeetingRoom />} />

        <Route element={<MentorLayout />}>
          <Route
            index
            element={
              <Navigate
                to={isMentorLoggedIn() ? "/mentor/home" : "/mentor/login"}
                replace
              />
            }
          />
          <Route path="home" element={<Home />} />
          <Route path="requests" element={<MentorRequests />} />
          <Route path="sessions" element={<MentorSessions />} />
          <Route path="earnings" element={<MentorEarnings />} />
          <Route path="reviews" element={<MentorReviews />} />
          <Route path="profile" element={<MentorProfile />} />
          <Route path="notifications" element={<MentorNotifications />} />
          <Route path="settings" element={<MentorSettings />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={isMentorLoggedIn() ? "/mentor/home" : "/mentor/login"}
            replace
          />
        }
      />
    </Routes>
  );
};

export default MentorRoutes;