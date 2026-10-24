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
import { registerLoadingHandlers } from "./api/axios";
import { registerFetchHandlers } from "./api/fetchWithLoading";
import { isFresherLoggedIn, isMentorLoggedIn } from "./utils/auth";

// Lazy load = bundle size kuraiyum + route load progress kaattum
const Landing = lazy(() => import("./Landingpages/Landing"));
const Auth = lazy(() => import("./Authpage/Auth"));
const Login = lazy(() => import("./Authpage/FresherAuth/FresherLoginRegister"));
const Forgetpassword = lazy(() => import("./Authpage/FresherAuth/Forgetpassword"));
const FresherResetPassword = lazy(() => import("./Authpage/FresherAuth/FresherResetPassword"));
const MentorRoutes = lazy(() => import("./Routes/MentorRoutes"));
const FresherRoutes = lazy(() => import("./Routes/FresherRoutes"));

// ================= AUTH HELPERS =================
// isMentorLoggedIn / isFresherLoggedIn now come from ./utils/auth
// (they check the JWT expiry and clear expired tokens)

const HomeRoute = () => {
  if (isMentorLoggedIn()) return <Navigate to="/mentor/home" replace />;
  if (isFresherLoggedIn()) return <Navigate to="/Home" replace />;
  return <Landing />;
};

// ================= INNER APP =================

function AppContent() {
  const { isLoading, start, stop } = useLoading();

  // Interceptors ku start/stop connect pannuvom
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

          <Route
            path="/login"
            element={isFresherLoggedIn() ? <Navigate to="/Home" replace /> : <Login />}
          />

          <Route path="/forgot-password" element={<Forgetpassword />} />
          <Route path="/reset-password/:token" element={<FresherResetPassword />} />

          <Route path="/mentor/*" element={<MentorRoutes />} />
          <Route path="/Home/*" element={<FresherRoutes />} />

          <Route path="/profile" element={<Navigate to="/Home/profile" replace />} />
          <Route path="/Mnclogos" element={<Navigate to="/Home/mnc-logos" replace />} />
          <Route path="/employee-profile" element={<Navigate to="/mentor/register" replace />} />

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
        <AppContent />
      </Router>
    </LoadingProvider>
  );
}

export default App;