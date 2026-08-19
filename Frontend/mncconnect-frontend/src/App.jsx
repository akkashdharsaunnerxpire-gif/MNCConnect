import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import EmployeeProfile from "./pages/MncEmployeeProfile";
function App() {
  return (
    <Router>
      <div className="bg-white text-gray-900 font-sans">
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/employee-profile" element={<EmployeeProfile />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
