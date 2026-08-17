import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import NotificationToast from './components/NotificationToast';

const UserDashboard = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Normal User Dashboard</p>
      <h1 className="mt-4 text-4xl font-bold text-slate-900">Welcome to your dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-600">This is a UI placeholder for the normal user experience after login or signup simulation.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Mentors</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">128</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Connections</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">24</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Opportunities</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">9</p>
        </div>
      </div>
    </div>
  </div>
);

const MentorDashboard = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Mentor Dashboard</p>
      <h1 className="mt-4 text-4xl font-bold text-slate-900">Verified mentor portal</h1>
      <p className="mt-3 max-w-2xl text-slate-600">This is a UI placeholder for the verified mentor experience after onboarding and approval simulation.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-sm text-indigo-600">Students</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">42</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-sm text-indigo-600">Sessions</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">18</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-sm text-indigo-600">Requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">7</p>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <div className="bg-white text-gray-900 font-sans">
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/user-dashboard" element={<UserDashboard />} />
            <Route path="/mentor-dashboard" element={<MentorDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <NotificationToast />
      </div>
    </Router>
  );
}

export default App;
