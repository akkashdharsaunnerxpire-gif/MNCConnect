import React, { createContext, useContext, useState } from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "./Landingpages/Landing";
import LinearProgress from "./components/LinearProgress";
import Auth from "./Authpage/Auth";
import Login from "./Authpage/FresherAuth/FresherLoginRegister";
import Forgetpassword from "./Authpage/FresherAuth/Forgetpassword";
import MentorRoutes from "./Routes/MentorRoutes";
import FresherRoutes from "./Routes/FresherRoutes";
import FresherResetPassword from "./Authpage/FresherAuth/FresherResetPassword";

export const LoadingContext = createContext(null);

export const useLoading = () => {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error("useLoading must be used within LoadingContext.Provider");
  }

  return context;
};

const isMentorLoggedIn = () =>
  Boolean(localStorage.getItem("mnc_mentor_token"));

const isFresherLoggedIn = () => Boolean(localStorage.getItem("fresher_token"));

const HomeRoute = () => {
  if (isMentorLoggedIn()) {
    return <Navigate to="/mentor/home" replace />;
  }

  if (isFresherLoggedIn()) {
    return <Navigate to="/Home" replace />;
  }

  return <Landing />;
};

function App() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      <Router>
        <div className="min-h-screen bg-white font-sans text-gray-900">
          <LinearProgress isLoading={isLoading} />

          <Routes>
            <Route path="/" element={<HomeRoute />} />

            <Route path="/auth" element={<Auth />} />

            <Route
              path="/login"
              element={
                isFresherLoggedIn() ? (
                  <Navigate to="/Home" replace />
                ) : (
                  <Login />
                )
              }
            />

            <Route path="/forgot-password" element={<Forgetpassword />} />
            <Route
              path="/reset-password/:token"
              element={<FresherResetPassword />}
            />
            <Route path="/mentor/*" element={<MentorRoutes />} />

            <Route path="/Home/*" element={<FresherRoutes />} />

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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </LoadingContext.Provider>
  );
}

export default App;
