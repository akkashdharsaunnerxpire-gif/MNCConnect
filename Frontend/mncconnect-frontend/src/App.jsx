
import React, { useState, createContext, useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "./Landingpages/Landing";
import LinearProgress from "./components/LinearProgress";

import MentorRoutes from "./Routes/MentorRoutes";
import FresherRoutes from "./Routes/FresherRoutes";

/* =========================================
   LOADING CONTEXT
========================================= */

export const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error(
      "useLoading must be used within LoadingProvider"
    );
  }

  return context;
};

/* =========================================
   LOGIN CHECK
========================================= */

const isMentorLoggedIn = () => {
  return Boolean(
    localStorage.getItem("mnc_mentor_token")
  );
};

const isFresherLoggedIn = () => {
  return Boolean(
    localStorage.getItem("fresher_token")
  );
};

/* =========================================
   ROOT
========================================= */

const HomeRoute = () => {

  // Mentor already logged in
  if (isMentorLoggedIn()) {
    return (
      <Navigate
        to="/mentor/dashboard"
        replace
      />
    );
  }

  // Fresher already logged in
  if (isFresherLoggedIn()) {
    return (
      <Navigate
        to="/Home"
        replace
      />
    );
  }

  // Nobody logged in
  return <Landing />;
};

/* =========================================
   APP
========================================= */

function App() {

  const [isLoading, setIsLoading] = useState(false);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        setIsLoading,
      }}
    >

      <Router>

        <div className="min-h-screen font-sans text-gray-900 bg-white">

          {/* Global Loading */}
          <LinearProgress
            isLoading={isLoading}
          />

          <Routes>

            {/* ==============================
                LANDING
                /
            ============================== */}

            <Route
              path="/"
              element={<HomeRoute />}
            />


            {/* ==============================
                ALL MENTOR ROUTES
                /mentor/*
            ============================== */}

            <Route
              path="/mentor/*"
              element={<MentorRoutes />}
            />


            {/* ==============================
                ALL FRESHER ROUTES
                /Home/*
            ============================== */}

            <Route
              path="/Home/*"
              element={<FresherRoutes />}
            />


            {/* ==============================
                OLD PROFILE URL
                /profile
            ============================== */}

            <Route
              path="/profile"
              element={
                <Navigate
                  to="/Home/profile"
                  replace
                />
              }
            />


            {/* ==============================
                OLD MNC LOGOS URL
                /Mnclogos
            ============================== */}

            <Route
              path="/Mnclogos"
              element={
                <Navigate
                  to="/Home/mnc-logos"
                  replace
                />
              }
            />


            {/* ==============================
                OLD EMPLOYEE PROFILE
            ============================== */}

            <Route
              path="/employee-profile"
              element={
                <Navigate
                  to="/mentor/register"
                  replace
                />
              }
            />


            {/* ==============================
                INVALID URL
            ============================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </div>

      </Router>

    </LoadingContext.Provider>
  );
}

export default App;

