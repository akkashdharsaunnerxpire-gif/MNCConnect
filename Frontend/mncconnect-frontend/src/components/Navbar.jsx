import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  if (!token) return null;

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/mentors" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg shadow-md shadow-blue-500/20">MNC</span>
          Connect
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1 sm:gap-6">
          <Link 
            to="/mentors" 
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              location.pathname === '/mentors' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Mentors
          </Link>
          <Link 
            to="/my-bookings" 
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              location.pathname === '/my-bookings' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            My Sessions
          </Link>
        </nav>

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center text-sm shadow-sm">
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-bold text-slate-800 leading-tight">{user.name}</span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{user.role || 'Fresher'}</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="ml-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all border border-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;