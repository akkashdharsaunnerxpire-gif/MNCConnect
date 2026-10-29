// src/App.jsx
import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LinearProgress from "./components/LinearProgress";
import RouteProgress from "./Commoncomponents/RouteProgress";
import SuspenseLoader from "./Commoncomponents/SuspenseLoader";

import { LoadingProvider, useLoading } from "./context/LoadingContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { registerLoadingHandlers } from "./api/axios";
import { registerFetchHandlers } from "./api/fetchWithLoading";
import { clearLegacyStorage } from "./utils/auth";

// ================= LAZY-LOADED PAGES =================

const Landing = lazy(() => import("./Landingpages/Landing"));
const Auth = lazy(() => import("./Authpage/Auth"));

// All mentor pages (login, register, forgot/reset password, dashboard)
const MentorRoutes = lazy(() => import("./Routes/MentorRoutes"));

// All fresher pages (login, forgot/reset password, /Home dashboard)
const FresherRoutes = lazy(() => import("./Routes/FresherRoutes"));

// ================= AUTH HELPERS =================

const HomeRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role === "mentor") return <Navigate to="/mentor/home" replace />;
  if (role === "fresher") return <Navigate to="/Home" replace />;

  return <Landing />;
};

// ================= INNER APP =================

function AppContent() {
  const { isLoading, start, stop } = useLoading();

  // Old keys from the previous localStorage-based login. Removed once per browser.
  useEffect(() => {
    clearLegacyStorage();
  }, []);

  useEffect(() => {
    registerLoadingHandlers(start, stop);
    registerFetchHandlers(start, stop);
  }, [start, stop]);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <LinearProgress isLoading={isLoading} />
      <RouteProgress />

      <Suspense fallback={<SuspenseLoader />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/auth" element={<Auth />} />

          {/* Legacy redirects */}
          <Route
            path="/profile"
            element={<Navigate to="/Home/profile" replace />}
          />
          <Route
            path="/Mnclogos"
            element={<Navigate to="/Home/mnc-logos" replace />}
          />
          <Route
            path="/employee-profile"
            element={<Navigate to="/mentor/register" replace />}
          />

          {/* Mentor side: everything under /mentor/... */}
          <Route path="/mentor/*" element={<MentorRoutes />} />

          {/* Fresher side: /login, /forgot-password, /reset-password/:token, /Home/... */}
          <Route path="/*" element={<FresherRoutes />} />
        </Routes>
      </Suspense>
    </div>
  );
}

// ================= APP =================

function App() {
  return (
    <LoadingProvider>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </LoadingProvider>
  );
}

export default App;