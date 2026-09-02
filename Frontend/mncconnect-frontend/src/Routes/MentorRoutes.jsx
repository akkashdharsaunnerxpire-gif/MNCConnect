import React from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

/* =========================================
   AUTH PAGES
========================================= */

import Login from "../Authpage/Login";
import MncRegister from "../Authpage/MncRegister";
import ForgotPassword from "../components/ForgotPassword";

/* =========================================
   MENTOR PAGES
========================================= */

import Home from "../MncEmployee/pages/Home";
import MentorNotifications from "../MncEmployee/pages/notifications";
import MentorProfile from "../MncEmployee/pages/MentorProfile";

import MentorRequests from "../MncEmployee/pages/MentorRequests";
import MentorSessions from "../MncEmployee/pages/MentorSessions";
import MentorEarnings from "../MncEmployee/pages/MentorEarnings";
import MentorReviews from "../MncEmployee/pages/MentorReviews";
import MentorSettings from "../MncEmployee/pages/MentorSettings";

/* =========================================
   MENTOR HEADER
========================================= */

import MentorHeader from "../MncEmployee/Components/MentorHeader";

/* =========================================
   MENTOR LOGIN CHECK
========================================= */

const isMentorLoggedIn = () => {
  return Boolean(
    localStorage.getItem("mnc_mentor_token")
  );
};

/* =========================================
   PROTECTED ROUTE
========================================= */

const MentorProtectedRoute = ({ children }) => {
  if (!isMentorLoggedIn()) {
    return (
      <Navigate
        to="/mentor/login"
        replace
      />
    );
  }

  return children;
};

/* =========================================
   MENTOR LAYOUT
   HEADER + PAGE
========================================= */

const MentorLayout = () => {
  return (
    <div className="min-h-screen bg-[#080612] text-white">

      {/* =====================================
          COMMON MENTOR HEADER
      ===================================== */}

      <MentorHeader />

      {/* =====================================
          PAGE CONTENT
      ===================================== */}

      <main className="min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>

    </div>
  );
};

/* =========================================
   MENTOR ROUTES
========================================= */

const MentorRoutes = () => {
  return (
    <Routes>

      {/* =====================================
          LOGIN
          /mentor/login
      ===================================== */}

      <Route
        path="login"
        element={<Login />}
      />


      {/* =====================================
          REGISTER
          /mentor/register
      ===================================== */}

      <Route
        path="register"
        element={<MncRegister />}
      />


      {/* =====================================
          FORGOT PASSWORD
          /mentor/forgot-password
      ===================================== */}

      <Route
        path="forgot-password"
        element={<ForgotPassword />}
      />


      {/* =====================================
          PROTECTED MENTOR AREA

          HEADER WILL SHOW ON ALL
          PROTECTED PAGES
      ===================================== */}

      <Route
        element={
          <MentorProtectedRoute>
            <MentorLayout />
          </MentorProtectedRoute>
        }
      >

        {/* ===================================
            MENTOR HOME
            /mentor/home
        =================================== */}

        <Route
          path="home"
          element={<Home />}
        />


        {/* ===================================
            FRESHER REQUESTS
            /mentor/requests
        =================================== */}

        <Route
          path="requests"
          element={<MentorRequests />}
        />


        {/* ===================================
            SESSIONS
            /mentor/sessions
        =================================== */}

        <Route
          path="sessions"
          element={<MentorSessions />}
        />


        {/* ===================================
            EARNINGS
            /mentor/earnings
        =================================== */}

        <Route
          path="earnings"
          element={<MentorEarnings />}
        />


        {/* ===================================
            REVIEWS
            /mentor/reviews
        =================================== */}

        <Route
          path="reviews"
          element={<MentorReviews />}
        />


        {/* ===================================
            PROFILE
            /mentor/profile
        =================================== */}

        <Route
          path="profile"
          element={<MentorProfile />}
        />


        {/* ===================================
            NOTIFICATIONS
            /mentor/notifications
        =================================== */}

        <Route
          path="notifications"
          element={<MentorNotifications />}
        />


        {/* ===================================
            SETTINGS
            /mentor/settings
        =================================== */}

        <Route
          path="settings"
          element={<MentorSettings />}
        />

      </Route>


      {/* =====================================
          /mentor
          DEFAULT
      ===================================== */}

      <Route
        index
        element={
          <Navigate
            to={
              isMentorLoggedIn()
                ? "/mentor/home"
                : "/mentor/login"
            }
            replace
          />
        }
      />


      {/* =====================================
          INVALID MENTOR URL
      ===================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/mentor"
            replace
          />
        }
      />

    </Routes>
  );
};

export default MentorRoutes;