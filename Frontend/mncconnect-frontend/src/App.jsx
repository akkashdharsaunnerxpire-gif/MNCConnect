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
import ScrollToTop from "./Commoncomponents/ScrollToTop";

import { LoadingProvider, useLoading } from "./context/LoadingContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { registerLoadingHandlers } from "./api/axios";
import { registerFetchHandlers } from "./api/fetchWithLoading";
import { clearLegacyStorage } from "./utils/auth";

// ================= LAZY-LOADED PAGES =================

const Landing = lazy(() => import("./Landingpages/Landing"));
const Auth = lazy(() => import("./Authpage/Auth"));

const MentorRoutes = lazy(() => import("./Routes/MentorRoutes"));
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
  const { loading: authLoading } = useAuth();

  // Clear legacy authentication storage
  useEffect(() => {
    clearLegacyStorage();
  }, []);

  // Register loading handlers
  useEffect(() => {
    registerLoadingHandlers(start, stop);
    registerFetchHandlers(start, stop);
  }, [start, stop]);

  // ================= PREVENT PAGE ZOOM =================

  useEffect(() => {
    // Prevent Ctrl + mouse wheel zoom
    const preventWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Prevent keyboard browser zoom shortcuts
    const preventKeyboardZoom = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const key = e.key;

      if (
        key === "+" ||
        key === "-" ||
        key === "=" ||
        key === "0" ||
        key === "_"
      ) {
        e.preventDefault();
      }
    };

    // Prevent trackpad/pinch gesture zoom where supported
    const preventGesture = (e) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", preventWheelZoom, {
      passive: false,
    });

    window.addEventListener("keydown", preventKeyboardZoom);

    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });

    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });

    document.addEventListener("gestureend", preventGesture, {
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", preventWheelZoom);

      window.removeEventListener("keydown", preventKeyboardZoom);

      document.removeEventListener("gesturestart", preventGesture);

      document.removeEventListener("gesturechange", preventGesture);

      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Global loading bar */}
      <LinearProgress isLoading={isLoading || authLoading} />

      <RouteProgress />

      {/* Reset page scroll on route navigation */}
      <ScrollToTop />

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

          {/* Mentor side */}
          <Route path="/mentor/*" element={<MentorRoutes />} />

          {/* Fresher side */}
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
