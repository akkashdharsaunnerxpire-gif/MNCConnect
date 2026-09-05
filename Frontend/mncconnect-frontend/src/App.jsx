import React, {
  useState,
  createContext,
  useContext,
} from "react";

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

/* =========================================================
   LOADING CONTEXT
========================================================= */

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

/* =========================================================
   AUTH CHECKS
========================================================= */

const isMentorLoggedIn = () => {
  return Boolean(
    window.localStorage.getItem("mnc_mentor_token")
  );
};

const isFresherLoggedIn = () => {
  return Boolean(
    window.localStorage.getItem("fresher_token")
  );
};

/* =========================================================
   HOME ROUTE
========================================================= */

const HomeRoute = () => {
  /*
    If mentor is already logged in,
    send them to the actual mentor dashboard.
  */
  if (isMentorLoggedIn()) {
    return (
      <Navigate
        to="/mentor/home"
        replace
      />
    );
  }

  /*
    If fresher is already logged in,
    send them to fresher home.
  */
  if (isFresherLoggedIn()) {
    return (
      <Navigate
        to="/Home"
        replace
      />
    );
  }

  /*
    Otherwise show landing page.
  */
  return <Landing />;
};

/* =========================================================
   APP
========================================================= */

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
        <div className="min-h-screen bg-white font-sans text-gray-900">

          {/* Global loading progress */}
          <LinearProgress
            isLoading={isLoading}
          />

          <Routes>

            {/* =================================================
                ROOT
            ================================================= */}

            <Route
              path="/"
              element={<HomeRoute />}
            />

            {/* =================================================
                MENTOR ROUTES
                /mentor/*
            ================================================= */}

            <Route
              path="/mentor/*"
              element={<MentorRoutes />}
            />

            {/* =================================================
                FRESHER ROUTES
                /Home/*
            ================================================= */}

            <Route
              path="/Home/*"
              element={<FresherRoutes />}
            />

            {/* =================================================
                LEGACY / SHORTCUT ROUTES
            ================================================= */}

            <Route
              path="/profile"
              element={
                <Navigate
                  to="/Home/profile"
                  replace
                />
              }
            />

            <Route
              path="/Mnclogos"
              element={
                <Navigate
                  to="/Home/mnc-logos"
                  replace
                />
              }
            />

            <Route
              path="/employee-profile"
              element={
                <Navigate
                  to="/mentor/register"
                  replace
                />
              }
            />

            {/* =================================================
                UNKNOWN ROUTES
            ================================================= */}

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