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
import MentorSidebar from "../MncEmployee/Components/MentorSidebar";
import ResetPassword from "../Authpage/MncEmployeeAuth/ResetPassword";
import MeetingRoom from "../Commoncomponents/Meetingroom";
import SuspenseLoader from "../Commoncomponents/SuspenseLoader";
import ChatAlertHost from "../Commoncomponents/ChatAlertHost";
import { useAuth } from "../context/AuthContext";
import LaptopOnlyGuard from "../Commoncomponents/LaptopOnlyGuard";

// The server (via cookie) decides. While it answers, show the loader.
const MentorProtectedRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role !== "mentor") return <Navigate to="/mentor/login" replace />;

  return <Outlet />;
};

const MentorFallback = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;

  return (
    <Navigate to={role === "mentor" ? "/mentor/home" : "/mentor/login"} replace />
  );
};

/*
  Sidebar layout
  - desktop (lg+): fixed 17rem sidebar on the left, content has lg:pl-[17rem]
  - mobile: 56px top bar (pt-14) + slide-in drawer
*/
const MentorLayout = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    {/* hide the page scrollbar on every mentor page (scrolling still works) */}
    <style>{`
      html { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar { display: none; width: 0; height: 0; }
    `}</style>
    <MentorSidebar />
    {/* new-message alert on every mentor page (not inside the meeting room) */}
    <ChatAlertHost role="mentor" />
    <div className="lg:pl-[17rem]">
      <main className="min-h-screen pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  </div>
);

const MentorRoutes = () => {
  return (
    <Routes>
      {/* public */}
      <Route path="reset-password/:token" element={<ResetPassword />} />
      <Route path="register" element={<MncEmployeeProfile />} />
      <Route path="login" element={<MncEmployeeProfile />} />
      <Route path="forgot-password" element={<MncEmployeeProfile />} />

      {/* private */}
      <Route element={<MentorProtectedRoute />}>
        {/* Full-screen meeting room (no sidebar, no chat alert) */}
        <Route
          path="meeting/:bookingId"
          element={
            <LaptopOnlyGuard>
              <MeetingRoom />
            </LaptopOnlyGuard>
          }
        />

        <Route element={<MentorLayout />}>
          <Route index element={<Navigate to="/mentor/home" replace />} />
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

      <Route path="*" element={<MentorFallback />} />
    </Routes>
  );
};

export default MentorRoutes;