import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, UserPlus, CalendarDays, Wallet, Star, Bell, UserCircle, LogOut } from "lucide-react";
import {socket} from "../../utils/socket";
import { api, ENDPOINTS, EVENTS, NOTIFICATIONS_CHANGED } from "../../services/mentorApi";
import useMentorSessions from "../../hooks/useMentorSessions";

const navItems = [
  { name: "Home", path: "/mentor/home", icon: LayoutDashboard },
  { name: "Requests", path: "/mentor/requests", icon: UserPlus },
  { name: "Sessions", path: "/mentor/sessions", icon: CalendarDays },
  { name: "Earnings", path: "/mentor/earnings", icon: Wallet },
  { name: "Reviews", path: "/mentor/reviews", icon: Star },
];

const MentorHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [connected, setConnected] = useState(socket.connected);
  const [unread, setUnread] = useState(0);

  /* Sessions count: only Upcoming (finished / cancelled / awaiting are NOT counted) */
  const { sessions } = useMentorSessions();
  const upcomingCount = useMemo(
    () => (sessions || []).filter((s) => s.status === "Upcoming").length,
    [sessions],
  );

  /* online / reconnecting pill */
  useEffect(() => {
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    socket.on("connect", up);
    socket.on("disconnect", down);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", up);
      socket.off("disconnect", down);
    };
  }, []);

  /* live unread badge + join the personal room so pushes reach every page */
  useEffect(() => {
    let alive = true;
    const userId = localStorage.getItem("mentorId");

    const load = () =>
      api(`${ENDPOINTS.notifications}?limit=1`)
        .then((d) => alive && setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    const onNew = () => setUnread((u) => u + 1);
    const onConnect = () => {
      if (userId) socket.emit("join-user", userId);
      load();
    };

    load();
    socket.on(EVENTS.notification, onNew);
    socket.on("connect", onConnect);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    if (socket.connected && userId) socket.emit("join-user", userId);

    return () => {
      alive = false;
      socket.off(EVENTS.notification, onNew);
      socket.off("connect", onConnect);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, []);

  const isActive = (path) => location.pathname.toLowerCase() === path;

  // badge number for each nav item (only Sessions has one)
  const badgeFor = (path) => (path === "/mentor/sessions" ? upcomingCount : 0);

  const handleLogout = () => {
    const mentorId = localStorage.getItem("mentorId");
    if (mentorId && socket.connected) socket.emit("mentor-offline", mentorId);
    socket.disconnect();
    localStorage.removeItem("mnc_mentor_token");
    localStorage.removeItem("mnc_mentor_user");
    navigate("/mentor/login", { replace: true });
  };

  const iconBtn = (active) =>
    `relative flex h-10 w-10 items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const CountBadge = ({ count, active }) =>
    count > 0 ? (
      <span
        aria-label={`${count} upcoming`}
        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
          active ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
        }`}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/mentor/home" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold leading-tight text-slate-900">
              MNC<span className="text-blue-600">Connect</span>
            </h1>
            <p className="text-[10px] text-slate-400">Employee Portal</p>
          </div>
        </Link>

        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {navItems.map(({ name, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path} to={path} aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={17} />
                <span>{name}</span>
                <CountBadge count={badgeFor(path)} active={active} />
                {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-blue-600" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div
            role="status"
            aria-label={connected ? "You are online" : "Reconnecting"}
            className={`mr-1 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {connected && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            </span>
            {connected ? "Online" : "Reconnecting…"}
          </div>

          <Link
            to="/mentor/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className={iconBtn(isActive("/mentor/notifications"))}
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <Link to="/mentor/profile" aria-label="Profile" className={iconBtn(isActive("/mentor/profile"))}>
            <UserCircle size={21} />
          </Link>

          <button
            type="button" onClick={handleLogout} aria-label="Logout"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 md:hidden">
        <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2">
          {navItems.map(({ name, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path} to={path} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={15} />
                {name}
                <CountBadge count={badgeFor(path)} active={active} />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default MentorHeader;