
import React from "react";
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

/* =========================================
   FRESHER PAGES
========================================= */

import Home from "../FresherDashboard/pages/Home";
import FresherProfile from "../FresherDashboard/pages/FresherProfile";
import Mnclogos from "../FresherDashboard/mncLogos/Companylogos";
import MyBookings from "../FresherDashboard/pages/FresherBookings";
import SessionBoard from "../FresherDashboard/pages/Fresher_SessionsBoard";

/* =========================================
   COMMON HEADER
========================================= */
import Notifications from "../FresherDashboard/pages/FresherNotifications"
import Header from "../FresherDashboard/Component/Header";
import BonusWallet from "../FresherDashboard/pages/FresherWallet"
/* =========================================
   FRESHER LOGIN CHECK
========================================= */

const isFresherLoggedIn = () => {
  return Boolean(
    localStorage.getItem("fresher_token")
  );
};

/* =========================================
   PROTECTED ROUTE
========================================= */

const FresherProtectedRoute = ({ children }) => {
  if (!isFresherLoggedIn()) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
};

/* =========================================
   FRESHER ROUTES
========================================= */

const FresherRoutes = () => {
  return (
    <div className="min-h-screen">

      {/* =====================================
          COMMON FRESHER HEADER
          Shows on ALL Fresher pages
      ===================================== */}

      <Header />

      {/* =====================================
          FRESHER ROUTES
      ===================================== */}

      <Routes>

        {/* ==============================
            HOME
            /Home
        ============================== */}

        <Route
          path="/"
          element={
            <FresherProtectedRoute>
              <Home />
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            SESSION BOARD
            /Home/sessionboard/:companyName
        ============================== */}

        <Route
          path="sessionboard/:companyName"
          element={
            <FresherProtectedRoute>
              <SessionBoard />
            </FresherProtectedRoute>
          }
        />

        <Route
          path="bonus-wallet"
          element={
            <FresherProtectedRoute>
              <BonusWallet />
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            MY BOOKINGS
            /Home/my-bookings
        ============================== */}

        <Route
          path="my-bookings"
          element={
            <FresherProtectedRoute>
              <MyBookings />
            </FresherProtectedRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <FresherProtectedRoute>
              <Notifications/>
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            PROFILE
            /Home/profile
        ============================== */}

        <Route
          path="profile"
          element={
            <FresherProtectedRoute>
              <FresherProfile />
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            MNC LOGOS
            /Home/mnc-logos
        ============================== */}

        <Route
          path="mnc-logos"
          element={
            <FresherProtectedRoute>
              <Mnclogos />
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            COMPANY
            /Home/:companyName
        ============================== */}

        <Route
          path=":companyName"
          element={
            <FresherProtectedRoute>
              <SessionBoard />
            </FresherProtectedRoute>
          }
        />


        {/* ==============================
            INVALID FRESHER URL
        ============================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/Home"
              replace
            />
          }
        />

      </Routes>

    </div>
  );
};

export default FresherRoutes;

