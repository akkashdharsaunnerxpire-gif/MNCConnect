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
// Lazy-loaded pages
const Landing = lazy(() => import("./Landingpages/Landing"));
const Auth = lazy(() => import("./Authpage/Auth"));

const Login = lazy(
  () => import("./Authpage/FresherAuth/FresherLoginRegister")
);

const Forgetpassword = lazy(
  () => import("./Authpage/FresherAuth/Forgetpassword")
);

const FresherResetPassword = lazy(
  () => import("./Authpage/FresherAuth/FresherResetPassword")
);

const MentorRoutes = lazy(() => import("./Routes/MentorRoutes"));
const FresherRoutes = lazy(() => import("./Routes/FresherRoutes"));

// Old keys from the previous localStorage-based login. Removed once per browser. 
// ================= AUTH HELPERS =================

const HomeRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role === "mentor") return <Navigate to="/mentor/home" replace />;
  if (role === "fresher") return <Navigate to="/Home" replace />;

  return <Landing />;
};

const FresherLoginRoute = () => {
  const { role, loading } = useAuth();

  if (loading) return <SuspenseLoader />;
  if (role === "fresher") return <Navigate to="/Home" replace />;

  return <Login />;
};

// ================= INNER APP =================

function AppContent() {
  const { isLoading, start, stop } = useLoading();

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
          <Route path="/login" element={<FresherLoginRoute />} />
          <Route path="/forgot-password" element={<Forgetpassword />} />
          <Route
            path="/reset-password/:token"
            element={<FresherResetPassword />}
          />

          <Route path="/mentor/*" element={<MentorRoutes />} />
          <Route path="/Home/*" element={<FresherRoutes />} />

          <Route path="/profile" element={<Navigate to="/Home/profile" replace />} />
          <Route path="/Mnclogos" element={<Navigate to="/Home/mnc-logos" replace />} />
          <Route
            path="/employee-profile"
            element={<Navigate to="/mentor/register" replace />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
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