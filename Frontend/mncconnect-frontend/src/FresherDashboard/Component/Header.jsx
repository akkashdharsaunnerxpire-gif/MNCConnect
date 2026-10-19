import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Bell, CalendarDays, CheckCheck, ChevronDown, ChevronRight, Clock3, GraduationCap,
  Home, IndianRupee, Loader2, Menu, MessageSquare, Star, User, Video, Wallet, WifiOff, X,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import useUserEvents from "../../hooks/useUserEvents";
import { api, ENDPOINTS, EVENTS, NOTIFICATIONS_CHANGED, getToken, getUserId, timeAgo } from "../../services/fresherApi";

/* ------------------------------------------------------------------
   Edit these two lists to add / remove menu items.
   Every `path` must exist in your router.
------------------------------------------------------------------ */
const NAV_ITEMS = [
  { path: "/Home", label: "Home", icon: Home, exact: true },
  { path: "/Home/my-bookings", label: "My Bookings", icon: CalendarDays, badge: "upcoming" },
  { path: "/Home/notifications", label: "Alerts", icon: Bell, badge: "unread" },
];

const MENU_ITEMS = [
  { path: "/Home/profile", label: "My profile", icon: User },
  { path: "/Home/bonus-wallet", label: "Bonus wallet", icon: Wallet },
  { path: "/Home/my-bookings", label: "Session history", icon: Clock3 },
];

const OPEN_BEFORE_MS = 5 * 60 * 1000; // meeting room opens 5 minutes early (same as the server)
const TOAST_MS = 6000;

const TYPE_STYLE = {
  session: { icon: Video, cls: "bg-indigo-50 text-indigo-600" },
  payment: { icon: IndianRupee, cls: "bg-emerald-50 text-emerald-600" },
  review: { icon: Star, cls: "bg-amber-50 text-amber-600" },
  success: { icon: CalendarDays, cls: "bg-emerald-50 text-emerald-600" },
};
const styleFor = (type) => TYPE_STYLE[type] || { icon: Bell, cls: "bg-indigo-50 text-indigo-600" };

const toMs = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(n) ? n : null;
};

const countdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${pad(m)}:${pad(sec)}`;
};

const Badge = ({ count, tone = "indigo" }) =>
  count > 0 ? (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white shadow-md ring-1 ring-white ${
        tone === "amber" ? "bg-amber-500" : "bg-gradient-to-br from-purple-500 to-indigo-600"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  ) : null;

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useMemo(() => getUserId(), []);
  const userName = localStorage.getItem("fresherName") || "";

  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [balance, setBalance] = useState(0);
  const [reminder, setReminder] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [toasts, setToasts] = useState([]);
  const [ring, setRing] = useState(0);

  const menuRef = useRef(null);
  const seenIds = useRef(null); // ids we have already shown, so only NEW notifications pop up
  const timers = useRef([]);

  /* ---------- live notifications from the server ---------- */
  const { data, reload, setData, connected } = useLive({
    fetcher: () => (getToken() ? api(`${ENDPOINTS.notifications}?limit=20`) : Promise.resolve({ notifications: [], unreadCount: 0 })),
    events: [EVENTS.notification],
    userId,
  });

  const notifications = (data?.notifications || []).map((n) => ({ ...n, id: n.id || n._id }));
  const unreadCount = data?.unreadCount ?? notifications.filter((n) => !n.read).length;

  /* ---------- live bookings (next session, waiting requests) ---------- */
  const { data: bookingData } = useLive({
    fetcher: () => (getToken() ? api(ENDPOINTS.myBookings || "/bookings/me") : Promise.resolve({ bookings: [] })),
    events: ["booking:updated", EVENTS.reminder].filter(Boolean),
    userId,
  });

  const bookings = bookingData?.bookings || [];

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "accepted" && (toMs(b.endsAt) ?? 0) > now)
        .sort((a, b) => (toMs(a.startsAt) ?? 0) - (toMs(b.startsAt) ?? 0)),
    [bookings, now]
  );
  const pendingCount = bookings.filter(
    (b) => b.status === "pending" && (toMs(b.expiresAt) ?? Infinity) > now
  ).length;

  const nextBooking = upcoming[0];
  const nextStart = toMs(nextBooking?.startsAt);
  const msToStart = nextStart !== null ? nextStart - now : null;
  const joinOpen = Boolean(nextBooking) && msToStart !== null && msToStart <= OPEN_BEFORE_MS;
  const nextId = nextBooking?.requestGroupId || nextBooking?.id;

  // reminder from the server, or (if the page was opened late) derived from the next booking
  const reminderFresh = reminder && !(toMs(reminder.startsAt) && now - toMs(reminder.startsAt) > 3 * 3600 * 1000);
  const banner = reminderFresh
    ? { id: reminder.requestGroupId, startsAt: toMs(reminder.startsAt) }
    : joinOpen
    ? { id: nextId, startsAt: nextStart }
    : null;
  const showBanner = Boolean(banner?.id) && banner.id !== dismissedId;
  const bannerMs = banner?.startsAt != null ? banner.startsAt - now : null;

  // tick every second only while something is counting down
  const needsTick = upcoming.length > 0 || Boolean(reminder);
  useEffect(() => {
    if (!needsTick) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [needsTick]);

  useEffect(() => {
    setNow(Date.now());
  }, [bookingData]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED, reload);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, reload);
  }, [reload]);

  // 5-minute alert pushed by the server
  useUserEvents(userId, {
    [EVENTS.reminder]: (p) => {
      setDismissedId(null);
      setReminder(p);
    },
  });

  /* ---------- pop-up toast + bell ring for every NEW notification ---------- */
  useEffect(() => {
    if (!data) return;

    const ids = (data.notifications || []).map((n) => n.id || n._id);

    if (seenIds.current === null) {
      seenIds.current = new Set(ids); // first load: do not toast old items
      return;
    }

    const fresh = (data.notifications || [])
      .map((n) => ({ ...n, id: n.id || n._id }))
      .filter((n) => !seenIds.current.has(n.id) && !n.read);

    ids.forEach((id) => seenIds.current.add(id));

    if (!fresh.length) return;

    setRing((r) => r + 1);
    fresh.slice(0, 2).forEach((n) => {
      setToasts((t) => [n, ...t.filter((x) => x.id !== n.id)].slice(0, 3));
      timers.current.push(setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), TOAST_MS));
    });
  }, [data]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* ---------- tab title: "(3) ..." while unread ---------- */
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadCount]);

  /* ---------- internet connection ---------- */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* ---------- notification actions ---------- */
  const openNotification = (n) => {
    if (!n.read) {
      setData((d) => ({
        ...(d || {}),
        unreadCount: Math.max(0, (d?.unreadCount || 1) - 1),
        notifications: (d?.notifications || []).map((x) => ((x.id || x._id) === n.id ? { ...x, read: true } : x)),
      }));
      api(ENDPOINTS.notificationRead(n.id), { method: "PATCH" }).catch(reload);
    }
    setToasts((t) => t.filter((x) => x.id !== n.id));
    setShowNotifications(false);
    if (typeof n.link === "string" && n.link.startsWith("/") && !n.link.startsWith("//")) navigate(n.link);
  };

  const markAllRead = () => {
    setData((d) => ({
      ...(d || {}),
      unreadCount: 0,
      notifications: (d?.notifications || []).map((x) => ({ ...x, read: true })),
    }));
    api(ENDPOINTS.notificationsReadAll || "/fresher/notifications/read-all", { method: "PATCH" })
      .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
      .catch(reload);
  };

  /* ---------- bonus wallet (local for now) ---------- */
  const loadBalance = () => {
    const saved = localStorage.getItem("fresherCoins");
    setBalance(saved ? Number(saved) : 0);
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

  /* ---------- close things ---------- */
  useEffect(() => {
    setShowNotifications(false);
    setMobileMenu(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setShowNotifications(false);
      setMenuOpen(false);
      setMobileMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const go = (path) => {
    setMobileMenu(false);
    setShowNotifications(false);
    setMenuOpen(false);
    navigate(path);
  };

  const joinMeeting = (id) => {
    setDismissedId(id);
    setReminder(null);
    navigate(`/Home/meeting/${id}`);
  };

  const dismissBanner = () => {
    setDismissedId(banner?.id || null);
    setReminder(null);
  };

  const isActive = (item) => (item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path));
  const navCls = (item) =>
    `relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
      isActive(item) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
    }`;

  const badgeFor = (key) => (key === "unread" ? unreadCount : key === "upcoming" ? upcoming.length : 0);

  const shown = (filter === "unread" ? notifications.filter((n) => !n.read) : notifications).slice(0, 8);
  const initial = userName ? userName.trim().charAt(0).toUpperCase() : "";

  /* small "next session" chip, used on desktop and in the mobile menu */
  const renderSessionChip = (block = false) => {
    const base = block ? "flex w-full justify-center" : "inline-flex";
    if (nextBooking && nextId) {
      return joinOpen ? (
        <button
          type="button"
          onClick={() => joinMeeting(nextId)}
          className={`${base} items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-green-200 transition hover:bg-green-700 active:scale-95`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <Video size={14} /> {msToStart <= 0 ? "Join live session" : "Join now"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => go("/Home/my-bookings")}
          title="Your next session"
          className={`${base} items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100`}
        >
          <Clock3 size={14} />
          Next session in <span className="font-mono tabular-nums">{countdown(msToStart ?? 0)}</span>
        </button>
      );
    }
    if (pendingCount > 0) {
      return (
        <button
          type="button"
          onClick={() => go("/Home/my-bookings")}
          className={`${base} items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100`}
        >
          <Loader2 size={14} className="motion-safe:animate-spin" />
          Waiting for employee{pendingCount > 1 ? ` (${pendingCount})` : ""}
        </button>
      );
    }
    return null;
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        {/* offline bar */}
        <AnimatePresence>
          {!online && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-900 text-white" role="alert">
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-xs font-semibold">
                <WifiOff size={14} /> You're offline. Live updates will resume when you reconnect.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/Home" className="flex items-center gap-2" onClick={() => { setMobileMenu(false); setShowNotifications(false); }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-200">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">MNC<span className="text-indigo-600">Connect</span></h1>
              <p className="text-[10px] font-medium text-slate-500">Fresher Community</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className={navCls(item)} aria-current={isActive(item) ? "page" : undefined}>
                  <Icon size={17} />
                  {item.label}
                  {item.badge && <Badge count={badgeFor(item.badge)} tone={item.badge === "upcoming" ? "amber" : "indigo"} />}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {renderSessionChip()}

            {connected !== undefined && (
              <span
                title={connected ? "Live updates connected" : "Reconnecting to live updates…"}
                className="flex h-10 items-center px-1"
              >
                <span className="relative flex h-2.5 w-2.5">
                  {connected && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
                </span>
              </span>
            )}

            <button type="button" onClick={() => setShowNotifications(true)} aria-label={`Notifications, ${unreadCount} unread`} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600">
              <motion.span key={ring} animate={ring ? { rotate: [0, -16, 14, -10, 6, 0] } : {}} transition={{ duration: 0.6 }} className="flex" style={{ transformOrigin: "50% 10%" }}>
                <Bell size={20} />
              </motion.span>
              <span className="absolute -right-0.5 -top-0.5"><Badge count={unreadCount} /></span>
            </button>

            <button type="button" onClick={() => go("/Home/bonus-wallet")} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 transition hover:bg-indigo-100">
              <Wallet size={18} className="text-indigo-600" /><span className="font-bold text-indigo-700">₹{balance}</span>
            </button>

            {/* profile menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 rounded-full border-2 border-indigo-100 bg-slate-100 py-0.5 pl-0.5 pr-2 transition hover:border-indigo-300"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-indigo-700">
                  {initial || <User size={17} className="text-slate-600" />}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                  >
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="truncate text-sm font-bold text-slate-900">{userName || "My account"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Bonus balance ₹{balance}</p>
                    </div>
                    <div className="p-1.5">
                      {MENU_ITEMS.map(({ path, label, icon: Icon }) => (
                        <button key={label} type="button" role="menuitem" onClick={() => go(path)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700">
                          <Icon size={17} />{label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setShowNotifications(true)} aria-label={`Notifications, ${unreadCount} unread`} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
              <motion.span key={ring} animate={ring ? { rotate: [0, -16, 14, -10, 6, 0] } : {}} transition={{ duration: 0.6 }} className="flex" style={{ transformOrigin: "50% 10%" }}>
                <Bell size={20} />
              </motion.span>
              <span className="absolute -right-0.5 -top-0.5"><Badge count={unreadCount} /></span>
            </button>
            <button type="button" onClick={() => setMobileMenu((p) => !p)} aria-label="Menu" aria-expanded={mobileMenu} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100">
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* session-start banner: server reminder, or derived from the next booking */}
        <AnimatePresence>
          {showBanner && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-green-600 text-white">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
                <span className="flex items-center gap-2 font-semibold">
                  <Video size={16} />
                  {bannerMs !== null && bannerMs <= 0
                    ? "Your session is live. The meeting room is open."
                    : `Your session starts in ${bannerMs !== null ? countdown(bannerMs) : "5 minutes"}. The meeting room is open.`}
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => joinMeeting(banner.id)} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-green-700 hover:bg-green-50">Join now</button>
                  <button type="button" onClick={dismissBanner} aria-label="Dismiss"><X size={16} /></button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* mobile menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-white lg:hidden">
              <div className="space-y-1 px-4 py-4">
                <div className="mb-2">{renderSessionChip(true)}</div>

                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const count = item.badge ? badgeFor(item.badge) : 0;
                  return (
                    <button key={item.path} type="button" onClick={() => go(item.path)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition ${isActive(item) ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"}`}>
                      <Icon size={19} />
                      <span className="flex-1">{item.label}</span>
                      <Badge count={count} tone={item.badge === "upcoming" ? "amber" : "indigo"} />
                    </button>
                  );
                })}

                {MENU_ITEMS.filter((m) => !NAV_ITEMS.some((n) => n.path === m.path) && m.path !== "/Home/bonus-wallet").map(({ path, label, icon: Icon }) => (
                  <button key={label} type="button" onClick={() => go(path)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700">
                    <Icon size={19} />{label}
                  </button>
                ))}

                <button type="button" onClick={() => go("/Home/bonus-wallet")} className="flex w-full items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-left">
                  <span className="flex items-center gap-3 font-semibold text-indigo-700"><Wallet size={19} />Bonus Wallet</span>
                  <span className="font-bold text-indigo-700">₹{balance}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* live notification pop-ups */}
      <div className="pointer-events-none fixed right-4 top-20 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((n) => {
            const { icon: Icon, cls } = styleFor(n.type);
            return (
              <motion.button
                key={n.id}
                type="button"
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                onClick={() => openNotification(n)}
                className="pointer-events-auto flex w-full gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-xl transition hover:border-indigo-200"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{n.message}</span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Dismiss"
                  onClick={(e) => { e.stopPropagation(); setToasts((t) => t.filter((x) => x.id !== n.id)); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setToasts((t) => t.filter((x) => x.id !== n.id)); } }}
                  className="self-start rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* notification panel */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/30 px-4 pt-20 backdrop-blur-[2px]" onClick={() => setShowNotifications(false)}>
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.96 }} transition={{ duration: 0.2 }} className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowNotifications(false)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft size={19} /></button>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Notifications</h2>
                    <p className="text-xs text-slate-500">{unreadCount} unread</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllRead} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50">
                      <CheckCheck size={15} /> Mark all read
                    </button>
                  )}
                  <button type="button" onClick={() => setShowNotifications(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>
              </div>

              <div className="flex gap-1 border-b border-slate-100 px-4 py-2" role="tablist">
                {[
                  { id: "all", label: "All" },
                  { id: "unread", label: `Unread${unreadCount ? ` (${unreadCount})` : ""}` },
                ].map((t) => (
                  <button
                    key={t.id} type="button" role="tab" aria-selected={filter === t.id}
                    onClick={() => setFilter(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === t.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {shown.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-400">
                    {filter === "unread" ? "You're all caught up" : "No notifications yet"}
                  </p>
                ) : (
                  shown.map((n) => {
                    const { icon: Icon, cls } = styleFor(n.type);
                    return (
                      <button key={n.id} type="button" onClick={() => openNotification(n)} className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${n.read ? "bg-white" : "bg-indigo-50/30"}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-800">{n.title}</h3>
                            {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{n.message}</p>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                <span className="text-[11px] text-slate-400">{connected === false ? "Reconnecting…" : "Updates live"}</span>
                <button type="button" onClick={() => go("/Home/notifications")} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                  Read all <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;