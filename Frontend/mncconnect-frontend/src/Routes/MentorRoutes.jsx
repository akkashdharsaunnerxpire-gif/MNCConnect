import React from "react";

import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

/* =========================================================
   MENTOR AUTH
========================================================= */

/*
  IMPORTANT:

  Do NOT import Login.jsx separately.

  MncRegister.jsx already contains:

  - Register UI
  - Mentor Login UI
  - Forgot Password UI
  - AuthSidebar
  - Header
  - Mobile Auth Navigation

  It decides what to show based on the current URL.
*/

import MncEmployeeProfile from "../Authpage/MncRegister";

/* =========================================================
   MENTOR PAGES
========================================================= */

import Home from "../MncEmployee/pages/Home";

import MentorNotifications
  from "../MncEmployee/pages/notifications";

import MentorProfile
  from "../MncEmployee/pages/MentorProfile";

import MentorRequests
  from "../MncEmployee/pages/MentorRequests";

import MentorSessions
  from "../MncEmployee/pages/MentorSessions";

import MentorEarnings
  from "../MncEmployee/pages/MentorEarnings";

import MentorReviews
  from "../MncEmployee/pages/MentorReviews";

import MentorSettings
  from "../MncEmployee/pages/MentorSettings";

import MentorHeader
  from "../MncEmployee/Components/MentorHeader";

/* =========================================================
   MENTOR AUTH CHECK
========================================================= */

const isMentorLoggedIn = () => {
  return Boolean(
    window.localStorage.getItem("mnc_mentor_token")
  );
};

/* =========================================================
   PROTECTED ROUTE
========================================================= */

const MentorProtectedRoute = ({ children }) => {
  /*
    If mentor is NOT logged in,
    send them to the SAME mentor login page.
  */

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

/* =========================================================
   PROTECTED MENTOR LAYOUT
========================================================= */

const MentorLayout = () => {
  return (
    <div className="min-h-screen bg-[#080612] text-white">

      {/* Mentor dashboard header */}
      <MentorHeader />

      {/* Mentor page content */}
      <main className="min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>

    </div>
  );
};

/* =========================================================
   MENTOR ROUTES
========================================================= */

const MentorRoutes = () => {
  return (
    <Routes>

      {/* =====================================================
          PUBLIC MENTOR AUTH ROUTES
      ===================================================== */}

      {/*
        REGISTER

        /mentor/register

        MncEmployeeProfile checks the pathname and
        renders the registration UI + AuthSidebar.
      */}

      <Route
        path="register"
        element={
          <MncEmployeeProfile />
        }
      />

      {/*
        LOGIN

        /mentor/login

        SAME MncEmployeeProfile component.

        It detects /mentor/login and renders:

        - Header
        - Mentor Access sidebar
        - Mentor Login form
      */}

      <Route
        path="login"
        element={
          <MncEmployeeProfile />
        }
      />

      {/*
        FORGOT PASSWORD

        /mentor/forgot-password

        SAME MncEmployeeProfile component.

        It renders:

        - Header
        - Mentor Access sidebar
        - Forgot Password form
      */}

      <Route
        path="forgot-password"
        element={
          <MncEmployeeProfile />
        }
      />

      {/* =====================================================
          PROTECTED MENTOR ROUTES
      ===================================================== */}

      <Route
        element={
          <MentorProtectedRoute>
            <MentorLayout />
          </MentorProtectedRoute>
        }
      >

        {/* ===================================================
            MENTOR HOME / DASHBOARD
        =================================================== */}

        <Route
          path="home"
          element={<Home />}
        />

        {/* ===================================================
            REQUESTS
        =================================================== */}

        <Route
          path="requests"
          element={<MentorRequests />}
        />

        {/* ===================================================
            SESSIONS
        =================================================== */}

        <Route
          path="sessions"
          element={<MentorSessions />}
        />

        {/* ===================================================
            EARNINGS
        =================================================== */}

        <Route
          path="earnings"
          element={<MentorEarnings />}
        />

        {/* ===================================================
            REVIEWS
        =================================================== */}

        <Route
          path="reviews"
          element={<MentorReviews />}
        />

        {/* ===================================================
            PROFILE
        =================================================== */}

        <Route
          path="profile"
          element={<MentorProfile />}
        />

        {/* ===================================================
            NOTIFICATIONS
        =================================================== */}

        <Route
          path="notifications"
          element={<MentorNotifications />}
        />

        {/* ===================================================
            SETTINGS
        =================================================== */}

        <Route
          path="settings"
          element={<MentorSettings />}
        />

      </Route>

      {/* =====================================================
          /mentor
          
          If logged in:
            /mentor → /mentor/home

          If not logged in:
            /mentor → /mentor/login
      ===================================================== */}

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

      {/* =====================================================
          UNKNOWN MENTOR ROUTE
      ===================================================== */}

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