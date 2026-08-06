import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import FresherDashboard from './pages/FresherDashboard';
import MentorDashboard from './pages/MentorDashboard';
import MyBookings from './pages/MyBookings';
import NotificationToast from './components/NotificationToast';

// Protected Route Guard Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/auth" replace />;
};

// Dynamic Dashboard Router based on User Role
const DynamicDashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.role === 'mentor' ? <MentorDashboard /> : <FresherDashboard />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500 selection:text-white">
        <Navbar />
        
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DynamicDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/my-bookings" 
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>

        {/* Global Socket Notification Pop-up */}
        <NotificationToast />
      </div>
    </Router>
  );
}

export default App;