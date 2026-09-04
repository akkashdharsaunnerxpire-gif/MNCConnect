import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Home,
  Menu,
  MessageSquare,
  User,
  Wallet,
  X,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";

const notifications = [
  {
    id: 1,
    type: "session",
    title: "Mentoring Session Confirmed",
    message: "Your mentoring session has been confirmed successfully.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    type: "bonus",
    title: "₹25 Bonus Added",
    message: "You received ₹25 for completing a mentoring session.",
    time: "30 min ago",
    unread: true,
  },
  {
    id: 3,
    type: "mentor",
    title: "New Mentor Available",
    message: "A new mentor from a top company is now available.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 4,
    type: "booking",
    title: "Upcoming Session",
    message: "Your mentoring session is scheduled for today.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: 5,
    type: "referral",
    title: "Referral Bonus",
    message: "Your referral was successful. ₹25 has been added.",
    time: "3 hours ago",
    unread: true,
  },
  {
    id: 6,
    type: "welcome",
    title: "Welcome to MNCConnect",
    message: "Your ₹25 welcome bonus has been added to your wallet.",
    time: "Yesterday",
    unread: true,
  },
  {
    id: 7,
    type: "session",
    title: "Session Reminder",
    message: "Don't forget your upcoming mentoring session.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: 8,
    type: "system",
    title: "Profile Update",
    message: "Complete your profile to improve your mentor experience.",
    time: "2 days ago",
    unread: false,
  },
];

const getNotificationIcon = (type) => {
  switch (type) {
    case "session":
      return <GraduationCap size={17} />;
    case "bonus":
      return <Wallet size={17} />;
    case "mentor":
      return <User size={17} />;
    case "booking":
      return <CalendarDays size={17} />;
    case "referral":
      return <User size={17} />;
    default:
      return <Bell size={17} />;
  }
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [balance, setBalance] = useState(0);

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  const loadBalance = () => {
    const savedBalance = localStorage.getItem("fresherCoins");

    setBalance(savedBalance ? Number(savedBalance) : 0);
  };

  useEffect(() => {
    loadBalance();

    window.addEventListener("fresherCoinsUpdated", loadBalance);
    window.addEventListener("storage", loadBalance);

    return () => {
      window.removeEventListener("fresherCoinsUpdated", loadBalance);
      window.removeEventListener("storage", loadBalance);
    };
  }, []);

  useEffect(() => {
    setShowNotifications(false);
    setMobileMenu(false);
  }, [location.pathname]);

  const openNotifications = () => {
    setMobileMenu(false);
    setShowNotifications(true);
  };

  const closeNotifications = () => {
    setShowNotifications(false);
  };

  const goToWallet = () => {
    setMobileMenu(false);
    setShowNotifications(false);
    navigate("/Home/bonus-wallet");
  };

  const goToProfile = () => {
    setMobileMenu(false);
    setShowNotifications(false);
    navigate("/Home/profile");
  };

  const goToBookings = () => {
    setMobileMenu(false);
    setShowNotifications(false);
    navigate("/Home/my-bookings");
  };

  const goToNotificationsPage = () => {
    setMobileMenu(false);
    setShowNotifications(false);
    navigate("/Home/notifications");
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/Home"
            className="flex items-center gap-2"
            onClick={() => {
              setMobileMenu(false);
              setShowNotifications(false);
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-200">
              <GraduationCap size={22} className="text-white" />
            </div>

            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                MNC<span className="text-indigo-600">Connect</span>
              </h1>

              <p className="text-[10px] font-medium text-slate-500">
                Fresher Community
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              to="/Home"
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive("/Home")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
              }`}
            >
              <Home size={17} />
              Home
            </Link>

            <Link
              to="/Home/my-bookings"
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive("/Home/my-bookings")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
              }`}
            >
              <CalendarDays size={17} />
              My Bookings
            </Link>

            <Link
              to="/Home/messages"
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive("/Home/messages")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
              }`}
            >
              <MessageSquare size={17} />
              Messages
            </Link>

            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600"
            >
              Dashboard
            </Link>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={openNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 px-0.5 text-[7px] font-bold leading-none text-white shadow-md ring-1 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={goToWallet}
              className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 transition hover:bg-indigo-100"
            >
              <Wallet size={18} className="text-indigo-600" />

              <span className="font-bold text-indigo-700">
                ₹{balance}
              </span>
            </button>

            <button
              type="button"
              onClick={goToProfile}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-indigo-100 bg-slate-100 transition hover:border-indigo-300"
            >
              <User size={19} className="text-slate-600" />
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={openNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 px-0.5 text-[7px] font-bold leading-none text-white ring-1 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenu((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100"
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-100 bg-white lg:hidden"
            >
              <div className="space-y-1 px-4 py-4">
                <Link
                  to="/Home"
                  onClick={() => setMobileMenu(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Home size={19} />
                  Home
                </Link>

                <Link
                  to="/browse-mentors"
                  onClick={() => setMobileMenu(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <User size={19} />
                  Browse Mentors
                </Link>

                <button
                  type="button"
                  onClick={goToBookings}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <CalendarDays size={19} />
                  My Bookings
                </button>

                <Link
                  to="/Home/messages"
                  onClick={() => setMobileMenu(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <MessageSquare size={19} />
                  Messages
                </Link>

                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenu(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={goToWallet}
                  className="flex w-full items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-3 font-semibold text-indigo-700">
                    <Wallet size={19} />
                    Bonus Wallet
                  </span>

                  <span className="font-bold text-indigo-700">
                    ₹{balance}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={openNotifications}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <span className="flex items-center gap-3">
                    <Bell size={19} />
                    Notifications
                  </span>

                  {unreadCount > 0 && (
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={goToProfile}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <User size={19} />
                  Profile
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/30 px-4 pt-20 backdrop-blur-[2px]"
            onClick={closeNotifications}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeNotifications}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                  >
                    <ArrowLeft size={19} />
                  </button>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Notifications
                    </h2>

                    <p className="text-xs text-slate-500">
                      {unreadCount} unread notifications
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeNotifications}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[430px] overflow-y-auto">
                {notifications.slice(0, 6).map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                      notification.unread
                        ? "bg-indigo-50/30"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-800">
                          {notification.title}
                        </h3>

                        {notification.unread && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {notification.message}
                      </p>

                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {notifications.length > 6 && (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">
                    {notifications.length - 6} more notifications
                  </span>

                  <button
                    type="button"
                    onClick={goToNotificationsPage}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-800"
                  >
                    Read all
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;