import React, { useState, createContext, useContext } from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "./pages/Landing";
import EmployeeProfile from "./pages/MncEmployeeProfile";
import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import LinearProgress from "./components/LinearProgress";

import MentorDashboard from "./pages/MncEmployee/MentorDashboard";
import MentorNotifications from "./pages/MncEmployee/notifications";
import MentorProfile from "./pages/MncEmployee/profile";
import MentorSettings from "./pages/MncEmployee/settings";
import BrowseMentors from "./pages/FresherDashboard/BrowseMentors";
export const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }

  return context;
};

const isMentorLoggedIn = () => {
  const token = localStorage.getItem("mnc_mentor_token");

  return Boolean(token);
};

const HomeRoute = () => {
  if (isMentorLoggedIn()) {
    return <Navigate to="/mentordashboard" replace />;
  }

  return <Landing />;
};

const MentorDashboardRoute = () => {
  if (!isMentorLoggedIn()) {
    return <Navigate to="/mentor/login" replace />;
  }

  return <MentorDashboard />;
};

const MentorLoginRoute = () => {
  if (isMentorLoggedIn()) {
    return <Navigate to="/mentordashboard" replace />;
  }

  return <Login />;
};

const MentorRegisterRoute = () => {
  if (isMentorLoggedIn()) {
    return <Navigate to="/mentordashboard" replace />;
  }

  return null;
};

const ProtectedMentorPage = ({ children }) => {
  if (!isMentorLoggedIn()) {
    return <Navigate to="/mentor/login" replace />;
  }

  return children;
};

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
        <div className="bg-white text-gray-900 font-sans">
          <LinearProgress isLoading={isLoading} />

          <main>
            <Routes>
              <Route path="/" element={<HomeRoute />} />

              <Route path="/mentor" element={<EmployeeProfile />}>
                <Route index element={<Navigate to="register" replace />} />

                <Route path="register" element={<MentorRegisterRoute />} />

                <Route path="login" element={<MentorLoginRoute />} />

                <Route path="forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* MENTOR */}

              <Route
                path="/mentordashboard"
                element={<MentorDashboardRoute />}
              />

              <Route
                path="/mentor/profile"
                element={
                  <ProtectedMentorPage>
                    <MentorProfile />
                  </ProtectedMentorPage>
                }
              />

              <Route
                path="/mentor/notifications"
                element={
                  <ProtectedMentorPage>
                    <MentorNotifications />
                  </ProtectedMentorPage>
                }
              />

              <Route
                path="/mentor/settings"
                element={
                  <ProtectedMentorPage>
                    <MentorSettings />
                  </ProtectedMentorPage>
                }
              />

              {/* FRESHER */}

              <Route path="/browse-mentors" element={<BrowseMentors />} />

              <Route
                path="/employee-profile"
                element={<Navigate to="/mentor/register" replace />}
              />

              <Route
                path="*"
                element={
                  <Navigate
                    to={isMentorLoggedIn() ? "/mentordashboard" : "/"}
                    replace
                  />
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </LoadingContext.Provider>
  );
}

export default App;
