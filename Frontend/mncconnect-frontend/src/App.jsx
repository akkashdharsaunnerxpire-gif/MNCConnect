import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import EmployeeProfile from "./pages/MncEmployeeProfile";
import LinearProgress from './components/LinearProgress';

// Create a context for loading state
export const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

function App() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      <Router>
        <div className="bg-white text-gray-900 font-sans">
          <LinearProgress isLoading={isLoading} />
          <main>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/employee-profile" element={<EmployeeProfile />} />
            </Routes>
          </main>
        </div>
      </Router>
    </LoadingContext.Provider>
  );
}

export default App;