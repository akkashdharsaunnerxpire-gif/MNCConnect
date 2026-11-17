// src/MncEmployee/Components/MentorSidebar.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserPlus,
  CalendarDays,
  Wallet,
  Star,
  Bell,
  UserCircle,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { socket } from "../../utils/socket";
import {
  api,
  ENDPOINTS,
  EVENTS,
  NOTIFICATIONS_CHANGED,
} from "../../services/mentorApi";
import useMentorSessions from "../../hooks/useMentorSessions";
import { useAuth } from "../../context/AuthContext";
import { performLogout } from "../../utils/logout";
import { normalizeSessionRequest } from "../../utils/sessionRequests";
import { REQUESTS_CHANGED } from "../../utils/requestEvents";
import { SESSIONS_CHANGED } from "../../utils/sessionEvents";

const navItems = [
  { name: "Home", path: "/mentor/home", icon: LayoutDashboard },
  { name: "Requests", path: "/mentor/requests", icon: UserPlus },
  { name: "Sessions", path: "/mentor/sessions", icon: CalendarDays },
  { name: "Earnings", path: "/mentor/earnings", icon: Wallet },
  { name: "Reviews", path: "/mentor/reviews", icon: Star },
];

const accountItems = [
  { name: "Notifications", path: "/mentor/notifications", icon: Bell },
  { name: "Settings", path: "/mentor/settings", icon: Settings },
];

const PENDING_SYNC_MS = 10000;
const SESSIONS_SYNC_MS = 8000;
const CLOCK_TICK_MS = 5000;

const NOT_PENDING = [
  "accepted",
  "cancelled",
  "canceled",
  "expired",
  "declined",
  "rejected",
  "missed",
  "completed",
  "taken",
];

const isVideoCall = (r) => /video call/i.test(String(r?.type || ""));

/* ---------------- AVATAR ---------------- */
const PROFILE_IMAGE_KEYS = [
  "profilePic",
  "profileImage",
  "avatar",
  "photo",
  "photoUrl",
];

const getRawAvatarUrl = (u) => {
  for (const key of PROFILE_IMAGE_KEYS) {
    if (u?.[key]) return u[key];
  }
  return null;
};

const getFallbackAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Mentor")}&background=eff6ff&color=2563eb`;

const Avatar = ({ src, initial }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return initial ? (
    <span>{initial}</span>
  ) : (
    <UserCircle size={20} className="text-slate-500" />
  );
};

const CountBadge = ({ count, active, label }) =>
  count > 0 ? (
    <span
      aria-label={`${count} ${label}`}
      className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
        active ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

const MentorSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const userId =
    user?.id || user?._id || user?.mentor?.id || user?.mentor?._id || null;

  const [open, setOpen] = useState(false); // mobile drawer
  const [connected, setConnected] = useState(socket.connected);
  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pending, setPending] = useState([]);
  const [clock, setClock] = useState(Date.now());
  const [me, setMe] = useState(null);

  /* ---------- mobile drawer behaviour ---------- */
  useEffect(() => {
    setOpen(false); // close after every navigation
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ---------- profile photo ---------- */
  const loadMe = useCallback(async () => {
    try {
      const d = await api("/auth/me");
      setMe(d?.user || d || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    window.addEventListener("profile:updated", loadMe);
    return () => window.removeEventListener("profile:updated", loadMe);
  }, [loadMe]);

  const displayName = (
    me?.name ||
    user?.name ||
    user?.mentor?.name ||
    ""
  ).trim();
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "";
  const avatarSrc =
    getRawAvatarUrl(me) ||
    getRawAvatarUrl(user) ||
    getRawAvatarUrl(user?.mentor) ||
    (displayName ? getFallbackAvatarUrl(displayName) : null);

  /* ---------- Sessions count ---------- */
  const { sessions, reload } = useMentorSessions();
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    let timeout = null;

    const refreshSessions = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => reloadRef.current?.(), 300);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSessions();
    };

    const bookingEvt = EVENTS?.booking || "booking:updated";
    socket.on(bookingEvt, refreshSessions);
    socket.on("meeting:timer", refreshSessions);
    socket.on("meeting:state", refreshSessions);
    socket.on("connect", refreshSessions);
    window.addEventListener(SESSIONS_CHANGED, refreshSessions);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    const poll = setInterval(refreshSessions, SESSIONS_SYNC_MS);

    return () => {
      clearTimeout(timeout);
      clearInterval(poll);
      socket.off(bookingEvt, refreshSessions);
      socket.off("meeting:timer", refreshSessions);
      socket.off("meeting:state", refreshSessions);
      socket.off("connect", refreshSessions);
      window.removeEventListener(SESSIONS_CHANGED, refreshSessions);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const upcomingCount = useMemo(
    () =>
      new Set(
        (sessions || [])
          .filter((s) => s.status === "Upcoming")
          .map((s) => String(s.id)),
      ).size,
    [sessions],
  );

  /* ---------- Pending requests count (server is the only truth) ---------- */
  const loadPending = useCallback(async () => {
    try {
      const d = await api(ENDPOINTS.mentorPending);
      const nowTs = Date.now();

      const list = (d.requests || [])
        .map((raw) => ({ raw, n: normalizeSessionRequest(raw) }))
        .filter(({ raw, n }) => {
          if (!n.id || !isVideoCall(n)) return false;

          const st = String(raw.status || n.status || "").toLowerCase();
          if (st && NOT_PENDING.includes(st)) return false;

          const exp = raw.expiresAt || n.expiresAt;
          if (exp) {
            const t = new Date(exp).getTime();
            if (Number.isFinite(t) && t <= nowTs) return false;
          }
          return true;
        })
        .map(({ raw, n }) => ({
          id: String(n.id),
          group: String(n.requestGroupId ?? ""),
          expiresAt: raw.expiresAt || n.expiresAt || null,
        }));

      setPending(list);
    } catch {
      /* keep last known count */
    }
  }, []);

  useEffect(() => {
    loadPending();

    let t = null;
    const loadSoon = () => {
      clearTimeout(t);
      t = setTimeout(loadPending, 400);
    };

    const onRequest = () => loadSoon();

    const onTaken = ({ id, requestGroupId } = {}) => {
      const key = String(id ?? requestGroupId ?? "");
      if (key)
        setPending((prev) =>
          prev.filter((p) => p.id !== key && p.group !== key),
        );
      loadSoon();
    };

    const onChanged = (e) => {
      const key = e.detail?.id != null ? String(e.detail.id) : "";
      if (key)
        setPending((prev) =>
          prev.filter((p) => p.id !== key && p.group !== key),
        );
      loadSoon();
    };

    const onFocus = () => {
      if (document.visibilityState === "visible") loadPending();
    };

    const bookingEvt = EVENTS?.booking || "booking:updated";

    socket.on("session-request", onRequest);
    socket.on("session-request-taken", onTaken);
    socket.on(bookingEvt, loadSoon);
    socket.on("connect", loadPending);
    window.addEventListener(REQUESTS_CHANGED, onChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    const poll = setInterval(loadPending, PENDING_SYNC_MS);

    return () => {
      clearTimeout(t);
      clearInterval(poll);
      socket.off("session-request", onRequest);
      socket.off("session-request-taken", onTaken);
      socket.off(bookingEvt, loadSoon);
      socket.off("connect", loadPending);
      window.removeEventListener(REQUESTS_CHANGED, onChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadPending]);

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);

  const pendingCount = useMemo(
    () =>
      new Set(
        pending
          .filter((p) => {
            if (!p.expiresAt) return true;
            const t = new Date(p.expiresAt).getTime();
            return !Number.isFinite(t) || t > clock;
          })
          .map((p) => p.group || p.id),
      ).size,
    [pending, clock],
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

  /* live unread badge + join the personal room */
  useEffect(() => {
    let alive = true;

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
  }, [userId]);

  const isActive = (path) => {
    const p = location.pathname.toLowerCase();
    return p === path || p.startsWith(`${path}/`);
  };

  const badgeFor = (path) => {
    if (path === "/mentor/sessions") return { count: upcomingCount, label: "upcoming" };
    if (path === "/mentor/requests") return { count: pendingCount, label: "pending" };
    if (path === "/mentor/notifications") return { count: unread, label: "unread" };
    return { count: 0, label: "" };
  };

  /* LOGOUT */
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await performLogout();
    } catch {
      /* ignore */
    }

    try {
      await refresh();
    } catch {
      /* ignore */
    }

    navigate("/", { replace: true });
  };

  const linkClass = (active) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active
        ? "bg-blue-50 text-blue-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const NavLink = ({ name, path, icon: Icon }) => {
    const active = isActive(path);
    const { count, label } = badgeFor(path);
    return (
      <Link
        to={path}
        aria-current={active ? "page" : undefined}
        className={linkClass(active)}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
        )}
        <Icon size={18} />
        <span>{name}</span>
        <CountBadge count={count} active={active} label={label} />
      </Link>
    );
  };

  const totalAlerts = pendingCount + unread;

  return (
    <>
      {/* ---------- MOBILE TOP BAR ---------- */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Menu size={22} />
          {totalAlerts > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" />
          )}
        </button>

        <Link to="/mentor/home" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="text-base font-bold text-slate-900">
            MNC<span className="text-blue-600">Connect</span>
          </span>
        </Link>

        <Link
          to="/mentor/profile"
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center"
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-blue-700 ring-2 ring-blue-100">
            <Avatar src={avatarSrc} initial={initial} />
          </span>
        </Link>
      </div>

      {/* ---------- MOBILE OVERLAY ---------- */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ---------- SIDEBAR (desktop fixed, mobile drawer) ---------- */}
      <aside
        aria-label="Mentor navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out motion-reduce:transition-none lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* brand */}
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-4">
          <Link to="/mentor/home" className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <span className="text-lg font-bold text-white">M</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900">
                MNC<span className="text-blue-600">Connect</span>
              </h1>
              <p className="text-[10px] text-slate-400">Employee Portal</p>
              <div className="mt-2 text-[10px]">
                <span
                  role="status"
                  aria-label={connected ? "You are online" : "Reconnecting"}
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-semibold ${
                    connected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {connected && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                        connected ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </span>
                  {connected ? "Online" : "Reconnecting…"}
                </span>
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
          <p className="mb-2 px-3 text-xs font-semibold text-slate-400">
            Workspace
          </p>
          <div className="space-y-2">
            {navItems.map((item) => (
              <NavLink key={item.path} {...item} />
            ))}
          </div>

          <p className="mb-2 mt-8 px-3 text-xs font-semibold text-slate-400">
            Account
          </p>
          <div className="space-y-2">
            {accountItems.map((item) => (
              <NavLink key={item.path} {...item} />
            ))}
          </div>
        </nav>

        {/* footer: status + user + logout */}
        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <Link
              to="/mentor/profile"
              aria-current={isActive("/mentor/profile") ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive("/mentor/profile")
                  ? "bg-blue-50"
                  : "hover:bg-slate-100"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-blue-700 ring-2 ring-blue-100">
                <Avatar src={avatarSrc} initial={initial} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {displayName || "Mentor"}
                </span>
                <span className="block text-[11px] text-slate-400">
                  View profile
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Logout"
              title="Logout"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogOut size={18} />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default MentorSidebar;