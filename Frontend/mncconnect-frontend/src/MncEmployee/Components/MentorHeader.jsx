import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserPlus,
  CalendarDays,
  Wallet,
  Star,
  Bell,
  UserCircle,
  LogOut,
} from "lucide-react";

const MentorHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      name: "Home",
      path: "/mentor/Home",
      icon: LayoutDashboard,
    },
    {
      name: "Requests",
      path: "/mentor/requests",
      icon: UserPlus,
    },
    {
      name: "Sessions",
      path: "/mentor/sessions",
      icon: CalendarDays,
    },
    {
      name: "Earnings",
      path: "/mentor/earnings",
      icon: Wallet,
    },
    {
      name: "Reviews",
      path: "/mentor/reviews",
      icon: Star,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("mnc_mentor_token");
    localStorage.removeItem("mnc_mentor_user");
    navigate("/mentor/login", { replace: true });
  };

  return (
<header className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 backdrop-blur-xl shadow-[0_4px_20px_rgba(59,130,246,0.08)]">      <div className="flex items-center justify-between h-16 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">

        {/* LOGO */}
        <Link
          to="/mentor/dashboard"
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg shadow-purple-500/20">
            <span className="text-lg font-bold text-white">
              M
            </span>
          </div>

          <div className="hidden sm:block">
            <h1 className="text-base font-bold text-white">
              MNC<span className="text-purple-400">Connect</span>
            </h1>

            <p className="text-[10px] text-gray-500">
               Employee Portal
            </p>
          </div>
        </Link>

        {/* NAVIGATION */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          {navItems.map((item) => {
            const Icon = item.icon;

            const active =
              location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "text-black bg-purple-500/15"
                    : "text-gray-400 hover:text-black hover:bg-white/10"
                }`}
              >
                <Icon size={17} />

                <span>{item.name}</span>

                {active && (
                  <span className="absolute bottom-0 left-1/2 w-5 h-0.5 -translate-x-1/2 rounded-full bg-purple-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 ml-auto">

          {/* NOTIFICATIONS */}
          <Link
            to="/mentor/notifications"
            aria-label="Notifications"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
              location.pathname === "/mentor/notifications"
                ? "text-white bg-purple-500/15"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Bell size={19} />

            {/* notification badge */}
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 border-2 border-[#080612]" />
          </Link>

          {/* PROFILE */}
          <Link
            to="/mentor/profile"
            aria-label="Profile"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
              location.pathname === "/mentor/profile"
                ? "text-white bg-purple-500/15"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <UserCircle size={21} />
          </Link>

          {/* LOGOUT */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logout"
            className="flex items-center justify-center w-10 h-10 text-gray-400 transition-all rounded-xl hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>

      {/* MOBILE NAV */}
      <div className="border-t md:hidden border-white/[0.06]">
        <nav className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;

            const active =
              location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  active
                    ? "text-white bg-purple-500/20"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={15} />

                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default MentorHeader;