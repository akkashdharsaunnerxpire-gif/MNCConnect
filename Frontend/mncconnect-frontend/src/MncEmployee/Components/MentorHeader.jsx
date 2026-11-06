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
  LogOut,
  Loader2,
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

const PENDING_SYNC_MS = 10000; // re-sync the Requests badge with the server
const SESSIONS_SYNC_MS = 8000; // re-sync the Sessions badge with the server
const CLOCK_TICK_MS = 5000; // hide requests that expired meanwhile

// statuses that are NOT a pending request any more
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

// "Video Call" AND "Group Video Call"
const isVideoCall = (r) => /video call/i.test(String(r?.type || ""));

/* ------------------------------------------------------------------
   AVATAR (same logic as MentorProfile)
------------------------------------------------------------------ */
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
    <UserCircle size={21} className="text-slate-500" />
  );
};

const CountBadge = ({ count, active, label = "upcoming" }) =>
  count > 0 ? (
    <span
      aria-label={`${count} ${label}`}
      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
        active ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

const MentorHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const userId =
    user?.id || user?._id || user?.mentor?.id || user?.mentor?._id || null;

  const [connected, setConnected] = useState(socket.connected);
  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pending, setPending] = useState([]); // [{ id, group, expiresAt }]
  const [clock, setClock] = useState(Date.now());
  const [me, setMe] = useState(null);

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

  /* ---------- Sessions count ----------
     Only Upcoming, each meeting ONCE (group = many rows, one id).
     NOTE: this hook has its OWN state (not shared with the Sessions page),
     so the header must refresh it by itself: socket events, the
     SESSIONS_CHANGED event (sent by the pages), focus and a short poll. */
  const { sessions, reload } = useMentorSessions();
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    let timeout = null;

    const refreshSessions = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => reloadRef.current?.(), 300); // debounce
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

  /* ---------- Pending requests count ----------
     The SERVER list is the only truth. The badge is never increased from a
     socket event any more (that left a stale "1" when the request was already
     taken / expired). A socket event only asks the server again.
     - rows that are not pending / already expired are dropped
     - a group (many rows) is counted ONCE */
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
      /* ignore: keep the last known count */
    }
  }, []);

  useEffect(() => {
    loadPending();

    let t = null;
    const loadSoon = () => {
      clearTimeout(t);
      t = setTimeout(loadPending, 400); // debounce
    };

    // new / changed request -> ask the server (do NOT add it locally)
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

  // clock so a request that expires is removed from the badge by itself
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
          .map((p) => p.group || p.id), // group = ONE request
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

  const isActive = (path) => location.pathname.toLowerCase() === path;

  const badgeFor = (path) => {
    if (path === "/mentor/sessions") return upcomingCount;
    if (path === "/mentor/requests") return pendingCount;
    return 0;
  };
  const badgeLabel = (path) =>
    path === "/mentor/requests" ? "pending" : "upcoming";

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

  const iconBtn = (active) =>
    `relative flex h-10 w-10 items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active
        ? "bg-blue-50 text-blue-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const profileActive = isActive("/mentor/profile");

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
                key={path}
                to={path}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={17} />
                <span>{name}</span>
                <CountBadge
                  count={badgeFor(path)}
                  active={active}
                  label={badgeLabel(path)}
                />
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-blue-600" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div
            role="status"
            aria-label={connected ? "You are online" : "Reconnecting"}
            className={`mr-1 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              connected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            {connected ? "Online" : "Reconnecting…"}
          </div>

          <Link
            to="/mentor/notifications"
            aria-label={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
            className={iconBtn(isActive("/mentor/notifications"))}
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <Link
            to="/mentor/profile"
            aria-label="Profile"
            title={displayName || "Profile"}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-blue-700 ring-2 transition ${
                profileActive
                  ? "ring-blue-500"
                  : "ring-blue-100 hover:ring-blue-300"
              }`}
            >
              <Avatar src={avatarSrc} initial={initial} />
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Logout"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 size={19} className="animate-spin" />
            ) : (
              <LogOut size={19} />
            )}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 md:hidden">
        <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2">
          {navItems.map(({ name, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={15} />
                {name}
                <CountBadge
                  count={badgeFor(path)}
                  active={active}
                  label={badgeLabel(path)}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default MentorHeader;