
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
import MyBookings from "../FresherDashboard/pages/MyBookings";
import SessionBoard from "../FresherDashboard/pages/SessionsBoard";

/* =========================================
   COMMON HEADER
========================================= */

import Header from "../FresherDashboard/Component/Header";

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
          index
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

