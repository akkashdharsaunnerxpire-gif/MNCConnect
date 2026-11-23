import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Home,
  IndianRupee,
  Loader2,
  LogOut,
  Menu,
  Star,
  User,
  Video,
  Wallet,
  Headset,
  WifiOff,
  X,
} from "lucide-react";
import { JOIN_OPEN_MS } from "../../utils/sessionTiming";
import useLive from "../../hooks/useLive";
import useUserEvents from "../../hooks/useUserEvents";
import {
  getProfileStatus,
  getRawAvatarUrl,
  getGuideKey,
  REQUIRED_PERCENT,
} from "../../utils/profileCompletion";
import {
  api,
  ENDPOINTS,
  EVENTS,
  NOTIFICATIONS_CHANGED,
  getUser,
  getUserId,
  timeAgo,
} from "../../services/fresherApi";
import { performLogout } from "../../utils/logout";
import WelcomeBonus from "../pages/Welcomebonus";
import ReferralBonus from "../pages/ReferralBonus";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { path: "/Home", label: "Home", icon: Home, exact: true },
  {
    path: "/Home/my-bookings",
    label: "My Bookings",
    icon: CalendarDays,
    badge: "upcoming",
  },
  {
    path: "/Home/my-meetings",
    label: "Meetings",
    icon: Headset,
    badge: "meetings",
  },
];

const MENU_ITEMS = [
  { path: "/Home/profile", label: "My profile", icon: User },
  { path: "/Home/bonus-wallet", label: "Bonus wallet", icon: Wallet },
  { path: "/Home/my-bookings", label: "Session history", icon: Clock3 },
];

const TOAST_MS = 6000;
const REMINDER_STALE_MS = 3 * 3600 * 1000;

/* Google-style tonal palette (Material 3 inspired)
   surface            #F8FAFD   page / header background
   surface container  #E9EEF6   nav track, icon buttons
   secondary cont.    #C2E7FF   active nav pill
   primary            #0B57D0   links, badges, accents
   on-surface         #1F1F1F / #444746 (variant)                      */
const TYPE_STYLE = {
  session: { icon: Video, cls: "bg-[#D3E3FD] text-[#0B57D0]" },
  payment: { icon: IndianRupee, cls: "bg-[#C4EED0] text-[#146C2E]" },
  review: { icon: Star, cls: "bg-[#FEEFC3] text-[#B06000]" },
  success: { icon: CalendarDays, cls: "bg-[#C4EED0] text-[#146C2E]" },
};

const styleFor = (type) =>
  TYPE_STYLE[type] || { icon: Bell, cls: "bg-[#D3E3FD] text-[#0B57D0]" };

// Flat tonal surface with a hairline bottom edge (no gradient, no blur).
const HEADER_SURFACE = {
  background: "#F8FAFD",
  boxShadow: "0 1px 0 #E1E5EA",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const getGenderAvatarUrl = (u) => {
  const seed = encodeURIComponent(u?.email || u?.name || u?._id || u?.id || "fresher");
  const gender = String(u?.gender || "").trim().toLowerCase();
  if (gender.startsWith("m")) return `https://avatar.iran.liara.run/public/boy?username=${seed}`;
  if (gender.startsWith("f")) return `https://avatar.iran.liara.run/public/girl?username=${seed}`;
  return `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundType=solid&backgroundColor=dbeafe`;
};

const resolveAvatar = (u) => (u ? getRawAvatarUrl(u) || getGenderAvatarUrl(u) : null);

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

// Always-latest callback with a stable identity, so memoized children
// (like the notifications popup) don't re-render when the header does.
const useStableCallback = (fn) => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
};

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

const LogoMark = ({ size = 40 }) => (
  <svg
    width={size}
    height={size * 0.8}
    viewBox="0 0 40 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="mh-logo" x1="0" y1="0" x2="40" y2="32">
        <stop offset="0" stopColor="#0B57D0" />
        <stop offset="1" stopColor="#4C8DF6" />
      </linearGradient>
    </defs>
    <path
      d="M5 27V11.5C5 7.5 10 6.5 12.2 9.8L20 21.5l7.8-11.7C30 6.5 35 7.5 35 11.5V27"
      stroke="url(#mh-logo)"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* Ticks on its own, so only this tiny node re-renders every second
   instead of the whole header. */
const Countdown = ({ target }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{countdown(target - Date.now())}</>;
};

const Avatar = ({ src, initial, iconSize = 17 }) => {
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
  return initial ? <span>{initial}</span> : <User size={iconSize} className="text-[#444746]" />;
};

const GuideHand = ({ getTarget, title, text, onSkip }) => {
  const [pos, setPos] = useState(null);
  const getRef = useRef(getTarget);
  getRef.current = getTarget;

  useEffect(() => {
    const update = () => {
      const el = getRef.current();
      if (!el) {
        setPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const next = { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom) };
      setPos((p) => (p && p.x === next.x && p.y === next.y ? p : next));
    };

    // Scroll events can fire many times per frame; measure at most once per frame.
    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    const id = setInterval(update, 250);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    return () => {
      clearInterval(id);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
    };
  }, []);

  if (!pos) return null;

  const vw = window.innerWidth;
  const bubbleW = Math.min(260, vw - 24);
  const left = Math.min(Math.max(pos.x - bubbleW / 2, 12), vw - bubbleW - 12);

  return (
    <>
      <motion.div
        className="pointer-events-none fixed z-[120]"
        style={{ left: pos.x - 24, top: pos.y + 2 }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <span
          className="block select-none text-5xl leading-none opacity-90"
          style={{ filter: "drop-shadow(0 8px 6px rgba(15,23,42,.45))" }}
          aria-hidden="true"
        >
          👆
        </span>
      </motion.div>
      <div
        role="status"
        className="fixed z-[120] rounded-[20px] bg-[#F0F4F9] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
        style={{ left, top: pos.y + 62, width: bubbleW }}
      >
        <p className="text-sm font-semibold text-[#1F1F1F]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#444746]">{text}</p>
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 rounded-full px-2 py-1 text-[11px] font-semibold text-[#0B57D0] hover:bg-[#D3E3FD]"
        >
          Skip
        </button>
      </div>
    </>
  );
};

/* Sliding active pill for the nav.
   We measure the active item (offsetLeft / offsetWidth, both relative to the nav)
   and move the pill with a CSS transform. Unlike framer-motion's layoutId, this
   does not depend on the page scroll position, so the pill can never fly
   up/down when you navigate while the page is scrolled. */
const useSlidePill = (activeKey) => {
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const [box, setBox] = useState(null);

  const measure = useCallback(() => {
    const el = activeKey ? itemRefs.current[activeKey] : null;
    if (!el || !el.offsetWidth) {
      setBox(null);
      return;
    }
    const x = el.offsetLeft;
    const w = el.offsetWidth;
    setBox((p) => (p && p.x === x && p.w === w ? p : { x, w, anim: Boolean(p) }));
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      if (navRef.current) ro.observe(navRef.current);
      const el = activeKey ? itemRefs.current[activeKey] : null;
      if (el) ro.observe(el);
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [measure, activeKey]);

  return { navRef, itemRefs, box };
};

/* Tonal "secondary container" indicator: flat, no shadow */
const SlidePill = ({ box }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute bottom-1.5 left-0 top-1.5 rounded-full bg-[#C2E7FF]"
    style={{
      width: box ? box.w : 0,
      opacity: box ? 1 : 0,
      transform: `translate3d(${box ? box.x : 0}px,0,0)`,
      transition: box && box.anim
        ? "transform 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1)"
        : "none",
      willChange: "transform",
    }}
  />
);

const Badge = ({ count, tone = "blue", ring = "ring-[#F8FAFD]" }) =>
  count > 0 ? (
    <span
      className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ${ring} ${
        tone === "amber" ? "bg-[#B06000]" : "bg-[#0B57D0]"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  ) : null;

const CountUp = ({ value, instant = false }) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const a = from.current;
    if (instant || a === value) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - t0) / 800, 1);
      const v = p === 1 ? value : Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, instant]);

  return <span className="tabular-nums">₹{shown}</span>;
};

/* ------------------------------------------------------------------ */
/* Notifications popup (memoized, so header updates don't re-render it) */
/* ------------------------------------------------------------------ */

const NotificationRow = React.memo(function NotificationRow({ n, onOpen }) {
  const { icon: Icon, cls } = styleFor(n.type);
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#E9EEF6] ${
        n.read ? "bg-transparent" : "bg-[#EDF2FA]"
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm text-[#1F1F1F] ${n.read ? "font-medium" : "font-semibold"}`}>
            {n.title}
          </h3>
          {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0B57D0]" />}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-[#444746]">{n.message}</p>
        <p className="mt-1 text-[10px] font-medium text-[#747775]">{timeAgo(n.createdAt)}</p>
      </div>
    </button>
  );
});

const NotificationsPopup = React.memo(function NotificationsPopup({
  open,
  unreadCount,
  notifications,
  connected,
  onClose,
  onOpenItem,
  onMarkAll,
  onReadAll,
}) {
  const [filter, setFilter] = useState("all");

  const shown = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications).slice(0, 8),
    [filter, notifications]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="notifications"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-start justify-center px-3 pb-3 pt-[76px] sm:px-4 lg:justify-end lg:pr-6"
        >
          {/* Backdrop: plain tint, no backdrop-filter (that is what made scrolling lag). */}
          <button
            type="button"
            aria-label="Close notifications"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default touch-none bg-black/30"
          />

          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="relative flex max-h-[calc(100dvh-92px)] w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] bg-[#F8FAFD] shadow-[0_8px_30px_rgba(0,0,0,0.22)]"
          >
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#E9EEF6]"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-[#1F1F1F]">Notifications</h2>
                  <p className="text-xs text-[#444746]">{unreadCount} unread</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAll}
                    className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-[#0B57D0] transition-colors hover:bg-[#D3E3FD]"
                  >
                    <CheckCheck size={15} /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#E9EEF6]"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-4 pb-3 pt-1" role="tablist">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: `Unread${unreadCount ? ` (${unreadCount})` : ""}` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    filter === t.id
                      ? "bg-[#C2E7FF] text-[#001D35]"
                      : "bg-transparent text-[#444746] ring-1 ring-[#C4C7C5] hover:bg-[#E9EEF6]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* The only scroll container. contain + overscroll keep it isolated
                from the page, so wheel / touch scrolling stays on the compositor. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto"
              style={{
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                contain: "layout paint",
              }}
            >
              {shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[#747775]">
                  {filter === "unread" ? "You're all caught up" : "No notifications yet"}
                </p>
              ) : (
                shown.map((n) => <NotificationRow key={n.id} n={n} onOpen={onOpenItem} />)
              )}
            </div>

            <div className="flex items-center justify-between bg-[#EDF2FA] px-4 py-2.5">
              <span className="text-[11px] text-[#747775]">
                {connected === false ? "Reconnecting…" : "Updates live"}
              </span>
              <button
                type="button"
                onClick={onReadAll}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#0B57D0] transition-colors hover:bg-[#D3E3FD]"
              >
                Read all <ChevronRight size={15} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useMemo(() => getUserId(), []);

  /* ---- UI state ---- */
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [toasts, setToasts] = useState([]);
  const [ring, setRing] = useState(0);
  const [hold, setHold] = useState(null);
  const [lockPad, setLockPad] = useState(0);

  /* ---- refs ---- */
  const menuRef = useRef(null);
  const seenIds = useRef(null);
  const timers = useRef([]);
  const profileBtnRef = useRef(null);
  const profileItemRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const walletBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const walletCtl = useAnimationControls();

  /* ---- lock the page behind the notifications popup ----
     No more `position: fixed` on <body>. That trick re-laid-out the whole page,
     reset scrollY (firing scroll handlers) and was the main cause of the lag.
     Now we only switch the viewport to overflow:hidden and pad for the
     scrollbar, so nothing moves and nothing reflows while the list scrolls. */
  useEffect(() => {
    if (!showNotifications) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlPad: html.style.paddingRight,
      bodyOverflow: body.style.overflow,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbar) html.style.paddingRight = `${scrollbar}px`;
    html.style.setProperty("--lock-pad", `${scrollbar}px`);
    setLockPad(scrollbar);

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.paddingRight = prev.htmlPad;
      body.style.overflow = prev.bodyOverflow;
      html.style.removeProperty("--lock-pad");
      setLockPad(0);
    };
  }, [showNotifications]);

  /* ---- logout ---- */
  const handleLogout = async () => {
    try {
      await performLogout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  /* ---- user data ---- */
  const { data: meData, reload: reloadMe } = useLive({
    fetcher: () => api("/auth/me"),
    events: [EVENTS.notification, "wallet:updated"],
    userId,
  });

  const me = meData?.user || meData || null;
  const realBalance = Number(me?.walletBalance) || 0;
  const userName = (me?.name || getUser().name || "").trim();
  const avatarSrc = getRawAvatarUrl(me);

  const profileStatus = useMemo(() => getProfileStatus(me), [me]);
  const onProfilePage = location.pathname.toLowerCase().startsWith("/home/profile");
  const guideKey = getGuideKey(userId);

  /* ---- profile guide ---- */
  const [guideSeen, setGuideSeen] = useState(() => {
    try {
      return localStorage.getItem(guideKey) === "1";
    } catch {
      return false;
    }
  });
  const [guideReady, setGuideReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGuideReady(true), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!onProfilePage || guideSeen) return;
    setGuideSeen(true);
    try {
      localStorage.setItem(guideKey, "1");
    } catch {
      /* ignore storage errors */
    }
  }, [onProfilePage, guideSeen, guideKey]);

  const skipGuide = () => {
    setGuideSeen(true);
    try {
      localStorage.setItem(guideKey, "1");
    } catch {
      /* ignore storage errors */
    }
  };

  const showGuide = Boolean(me) && guideReady && !guideSeen && !profileStatus.ok && !onProfilePage;

  const getGuideTarget = () => {
    const visible = (el) => (el && el.getBoundingClientRect().width > 0 ? el : null);
    return (
      (menuOpen ? visible(profileItemRef.current) : null) ||
      visible(profileBtnRef.current) ||
      visible(mobileProfileRef.current)
    );
  };

  const guideOnItem = menuOpen && Boolean(profileItemRef.current?.getBoundingClientRect().width);

  useEffect(() => {
    if (typeof reloadMe !== "function") return undefined;
    const onProfile = () => reloadMe();
    window.addEventListener("profile:updated", onProfile);
    return () => window.removeEventListener("profile:updated", onProfile);
  }, [reloadMe]);

  /* ---- wallet ---- */
  const balance = hold ?? realBalance;
  const showWelcome = location.pathname.toLowerCase() === "/home";

  const bumpWallet = () => {
    walletCtl.start({
      scale: [1, 1.25, 0.96, 1],
      boxShadow: [
        "0 0 0 0 rgba(176,96,0,0)",
        "0 0 0 10px rgba(176,96,0,.25)",
        "0 0 0 0 rgba(176,96,0,0)",
      ],
      transition: { duration: 0.7 },
    });
  };

  /* ---- notifications ---- */
  const { data, reload, setData, connected } = useLive({
    fetcher: () => api(`${ENDPOINTS.notifications}?limit=20`),
    events: [EVENTS.notification],
    userId,
  });

  const notifications = useMemo(
    () => (data?.notifications || []).map((n) => ({ ...n, id: n.id || n._id })),
    [data]
  );
  const unreadCount = data?.unreadCount ?? notifications.filter((n) => !n.read).length;

  /* ---- bookings ---- */
  const { data: bookingData } = useLive({
    fetcher: () => api(ENDPOINTS.myBookings || "/bookings/me"),
    events: ["booking:updated", EVENTS.reminder].filter(Boolean),
    userId,
  });

  const bookings = useMemo(() => bookingData?.bookings || [], [bookingData]);

  /* ---- clock: re-render only when something actually changes state ----
     (join window opens, session starts/ends, request expires, reminder goes stale).
     The ticking digits live in <Countdown/>, so no 1s re-render of the whole header. */
  const boundaries = useMemo(() => {
    const list = [];
    bookings.forEach((b) => {
      const s = toMs(b.startsAt);
      const e = toMs(b.endsAt);
      const x = toMs(b.expiresAt);
      if (s !== null) list.push(s - JOIN_OPEN_MS, s);
      if (e !== null) list.push(e);
      if (x !== null) list.push(x);
    });
    const rs = toMs(reminder?.startsAt);
    if (rs !== null) list.push(rs + REMINDER_STALE_MS);
    return list;
  }, [bookings, reminder]);

  useEffect(() => {
    const t = Date.now();
    let next = Infinity;
    for (const v of boundaries) if (v > t && v < next) next = v;
    if (next === Infinity) return undefined;
    // cap at 1h so very distant sessions never overflow setTimeout
    const id = setTimeout(() => setNow(Date.now()), Math.min(next - t, 3600000) + 50);
    return () => clearTimeout(id);
  }, [boundaries, now]);

  useEffect(() => {
    setNow(Date.now());
  }, [bookingData]);

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

  // Sessions still waiting (room not open yet) -> "My Bookings" badge
  // Sessions whose room is open (start - JOIN_OPEN_MS) -> "Meetings" badge
  const waitingCount = upcoming.filter(
    (b) => (toMs(b.startsAt) ?? 0) - now > JOIN_OPEN_MS
  ).length;
  const meetingsCount = upcoming.length - waitingCount;

  const nextBooking = upcoming[0];
  const nextStart = toMs(nextBooking?.startsAt);
  const msToStart = nextStart !== null ? nextStart - now : null;
  const joinOpen =
    Boolean(nextBooking) && msToStart !== null && msToStart <= JOIN_OPEN_MS;
  const nextId = nextBooking?.requestGroupId || nextBooking?.id;

  const reminderFresh =
    reminder && !(toMs(reminder.startsAt) && now - toMs(reminder.startsAt) > REMINDER_STALE_MS);
  const banner = reminderFresh
    ? { id: reminder.requestGroupId, startsAt: toMs(reminder.startsAt) }
    : joinOpen
      ? { id: nextId, startsAt: nextStart }
      : null;
  const showBanner = Boolean(banner?.id) && banner.id !== dismissedId;
  const bannerMs = banner?.startsAt != null ? banner.startsAt - now : null;

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED, reload);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, reload);
  }, [reload]);

  useUserEvents(userId, {
    [EVENTS.reminder]: (p) => {
      setDismissedId(null);
      setReminder(p);
    },
  });

  /* ---- toast for fresh notifications ---- */
  useEffect(() => {
    if (!data) return;
    const ids = (data.notifications || []).map((n) => n.id || n._id);
    if (seenIds.current === null) {
      seenIds.current = new Set(ids);
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
      timers.current.push(
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), TOAST_MS)
      );
    });
  }, [data]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* ---- unread count in the tab title ---- */
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadCount]);

  /* ---- online / offline ---- */
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

  /* ---- notification actions (stable identities for the memoized popup) ---- */
  const openNotification = (n) => {
    if (!n.read) {
      setData((d) => ({
        ...(d || {}),
        unreadCount: Math.max(0, (d?.unreadCount || 1) - 1),
        notifications: (d?.notifications || []).map((x) =>
          (x.id || x._id) === n.id ? { ...x, read: true } : x
        ),
      }));
      api(ENDPOINTS.notificationRead(n.id), { method: "PATCH" }).catch(reload);
    }
    setToasts((t) => t.filter((x) => x.id !== n.id));
    setShowNotifications(false);
    if (typeof n.link === "string" && n.link.startsWith("/") && !n.link.startsWith("//")) {
      navigate(n.link);
    }
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

  /* ---- close popups on route change / Escape / outside click ---- */
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

  /* ---- navigation helpers ---- */
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

  const closePopups = () => {
    setMobileMenu(false);
    setShowNotifications(false);
  };

  const stableOpenItem = useStableCallback(openNotification);
  const stableMarkAll = useStableCallback(markAllRead);
  const stableReadAll = useStableCallback(() => go("/Home/notifications"));
  const stableClose = useCallback(() => setShowNotifications(false), []);

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const activeNavPath = NAV_ITEMS.find(isActive)?.path ?? null;
  const islandNav = useSlidePill(activeNavPath);
  const dockNav = useSlidePill(activeNavPath);

  const badgeFor = (key) =>
    key === "unread"
      ? unreadCount
      : key === "upcoming"
        ? waitingCount
        : key === "meetings"
          ? meetingsCount
          : 0;

  const initial = userName ? userName.charAt(0).toUpperCase() : "";
  const bellActive = location.pathname.toLowerCase().startsWith("/home/notifications");

  /* ---- session chip (next session / waiting for employee) ----
     variant: "pill" (separate pill beside the bell, desktop), "block" (full-width, mobile menu) */
  const chipKind =
    nextBooking && nextId ? (joinOpen ? "join" : "next") : pendingCount > 0 ? "pending" : null;

  const renderSessionChip = (variant = "pill") => {
    const block = variant === "block";

    if (chipKind === "join") {
      return (
        <button
          type="button"
          onClick={() => go("/Home/my-meetings")}
          className={
            block
              ? "flex w-full items-center justify-center gap-2 rounded-full bg-[#146C2E] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0F5223] active:scale-95"
              : "inline-flex h-10 items-center gap-2 rounded-full bg-[#146C2E] px-4 text-xs font-semibold text-white transition hover:bg-[#0F5223] active:scale-95"
          }
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <Video size={14} /> {msToStart <= 0 ? "Join live session" : "Join now"}
        </button>
      );
    }

    if (chipKind === "next") {
      return (
        <button
          type="button"
          onClick={() => go("/Home/my-bookings")}
          title="Your next session"
          className={
            block
              ? "flex w-full items-center justify-center gap-2 rounded-full bg-[#D3E3FD] px-3 py-2.5 text-xs font-semibold text-[#041E49] transition hover:bg-[#C2D7F7]"
              : "inline-flex h-10 items-center gap-2 rounded-full bg-[#D3E3FD] px-4 text-xs font-semibold text-[#041E49] transition-colors hover:bg-[#C2D7F7]"
          }
        >
          <Clock3 size={14} className="text-[#0B57D0]" />
          <span className={block ? "" : "hidden xl:inline"}>Next session in</span>{" "}
          <span className="font-mono tabular-nums">
            {nextStart !== null ? <Countdown target={nextStart} /> : "--"}
          </span>
        </button>
      );
    }

    if (chipKind === "pending") {
      return (
        <button
          type="button"
          onClick={() => go("/Home/my-bookings")}
          className={
            block
              ? "flex w-full items-center justify-center gap-2 rounded-full bg-[#FEEFC3] px-3 py-2.5 text-xs font-semibold text-[#4D3800] transition hover:bg-[#FBE5A0]"
              : "inline-flex h-10 items-center gap-2 rounded-full bg-[#FEEFC3] px-4 text-xs font-semibold text-[#4D3800] transition-colors hover:bg-[#FBE5A0]"
          }
        >
          <Loader2 size={14} className="motion-safe:animate-spin" /> Waiting for employee
          {pendingCount > 1 ? ` (${pendingCount})` : ""}
        </button>
      );
    }

    return null;
  };

  const bellButtonClass =
    "relative flex items-center justify-center rounded-full bg-[#E9EEF6] text-[#444746] transition-colors hover:bg-[#DDE3EA]";

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* Spacer for the fixed header */}
      <div aria-hidden="true" className="h-[76px] bg-[#F8FAFD]" />

      {/* Fixed header: flat tonal surface, same look at the top and while scrolling */}
      <header
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={lockPad ? { paddingRight: lockPad } : undefined}
      >
        <div className="relative h-[76px]" style={HEADER_SURFACE}>
          <div className="mx-auto flex h-[76px] max-w-[1400px] items-center justify-between gap-3 px-3 sm:px-5">
            {/* Brand */}
            <Link
              to="/Home"
              onClick={closePopups}
              aria-label="NC Connect home"
              className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#0B57D0]"
            >
              <LogoMark size={32} />
              <span className="flex flex-col leading-none">
                <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#1F1F1F]">
                  NC<span className="text-[#0B57D0]"> Connect</span>
                </span>
                <span className="mt-1 hidden text-[11px] font-medium text-[#444746] sm:block">
                  Fresher community
                </span>
              </span>
            </Link>

            {/* ---- Navigation (desktop) ----
                Tonal track with a secondary-container pill that glides between items. */}
            <div className="pointer-events-auto hidden min-w-0 lg:block">
              <nav
                ref={islandNav.navRef}
                aria-label="Main navigation"
                className="relative flex items-center gap-0.5 rounded-full bg-[#E9EEF6] p-1.5"
              >
                <SlidePill box={islandNav.box} />
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.path}
                      ref={(el) => (islandNav.itemRefs.current[item.path] = el)}
                      to={item.path}
                      onClick={closePopups}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center rounded-full px-4 py-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0B57D0] ${
                        active
                          ? "text-[#001D35]"
                          : "text-[#444746] hover:bg-[#DDE3EA] hover:text-[#1F1F1F]"
                      }`}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <Icon size={17} />
                        {item.label}
                        {item.badge && (
                          <Badge count={badgeFor(item.badge)} tone="amber" ring="ring-[#E9EEF6]" />
                        )}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* ---- Desktop actions ---- */}
            <div className="pointer-events-auto hidden shrink-0 items-center gap-2 lg:flex">
              {chipKind && (
                <motion.div
                  key={chipKind}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {renderSessionChip("pill")}
                </motion.div>
              )}

              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                aria-label={`Notifications, ${unreadCount} unread`}
                className={`${bellButtonClass} h-10 w-10 ${
                  bellActive ? "!bg-[#C2E7FF] !text-[#001D35]" : ""
                }`}
              >
                <motion.span
                  key={ring}
                  animate={ring ? { rotate: [0, -16, 14, -10, 6, 0] } : {}}
                  transition={{ duration: 0.6 }}
                  className="flex"
                  style={{ transformOrigin: "50% 10%" }}
                >
                  <Bell size={19} />
                </motion.span>
                <span className="absolute -right-1 -top-1 z-10">
                  <Badge count={unreadCount} />
                </span>
              </button>

              <motion.button
                ref={walletBtnRef}
                animate={walletCtl}
                type="button"
                onClick={() => go("/Home/bonus-wallet")}
                aria-label="Bonus wallet"
                className="flex h-10 items-center gap-2 rounded-full bg-[#FEF7E0] pl-1.5 pr-4 transition-colors hover:bg-[#FEEFC3]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FEEFC3] text-[#B06000]">
                  <Wallet size={15} />
                </span>
                <span className="text-sm font-semibold text-[#B06000]">
                  {me ? <CountUp value={balance} instant={hold !== null} /> : "₹–"}
                </span>
              </motion.button>

              <div className="relative" ref={menuRef}>
                <button
                  ref={profileBtnRef}
                  type="button"
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-label="Profile menu"
                  className={`flex h-10 items-center gap-1 rounded-full py-1 pl-1 pr-2.5 transition-colors ${
                    menuOpen ? "bg-[#DDE3EA]" : "bg-[#E9EEF6] hover:bg-[#DDE3EA]"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#D3E3FD] text-sm font-semibold text-[#0B57D0]">
                    <Avatar src={avatarSrc} initial={initial} iconSize={20} />
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-[#444746] transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      style={{ transformOrigin: "top right" }}
                      className="absolute right-0 mt-3 w-72 overflow-hidden rounded-[28px] bg-[#F0F4F9] p-2 text-[#1F1F1F] shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
                    >
                      <div className="mb-1 flex items-center gap-3 rounded-[22px] bg-white px-3.5 py-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D3E3FD] text-base font-semibold text-[#0B57D0]">
                          <Avatar src={avatarSrc} initial={initial} iconSize={22} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1F1F1F]">
                            {userName || "My account"}
                          </p>
                          <p className="mt-0.5 text-xs text-[#444746]">Bonus balance ₹{balance}</p>
                        </div>
                      </div>

                      <div className="p-1">
                        {MENU_ITEMS.map(({ path, label, icon: Icon }) => (
                          <button
                            key={label}
                            ref={path === "/Home/profile" ? profileItemRef : undefined}
                            type="button"
                            role="menuitem"
                            onClick={() => go(path)}
                            className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#E1E8F2]"
                          >
                            <Icon size={18} className="text-[#444746]" /> {label}
                          </button>
                        ))}
                        <div className="mx-3 my-1 border-t border-[#C4C7C5]/60" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[#B3261E] transition-colors hover:bg-[#F9DEDC]"
                        >
                          <LogOut size={18} /> Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ---- Mobile actions ---- */}
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                aria-label={`Notifications, ${unreadCount} unread`}
                className={`${bellButtonClass} h-10 w-10 ${
                  bellActive ? "!bg-[#C2E7FF] !text-[#001D35]" : ""
                }`}
              >
                <motion.span
                  key={ring}
                  animate={ring ? { rotate: [0, -16, 14, -10, 6, 0] } : {}}
                  transition={{ duration: 0.6 }}
                  className="flex"
                  style={{ transformOrigin: "50% 10%" }}
                >
                  <Bell size={19} />
                </motion.span>
                <span className="absolute -right-1 -top-1 z-10">
                  <Badge count={unreadCount} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => go("/Home/profile")}
                aria-label="My profile"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#D3E3FD] text-sm font-semibold text-[#0B57D0]"
              >
                <Avatar src={avatarSrc} initial={initial} />
              </button>

              <button
                ref={menuBtnRef}
                type="button"
                onClick={() => setMobileMenu((p) => !p)}
                aria-label="Menu"
                aria-expanded={mobileMenu}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9EEF6] text-[#444746] transition-colors hover:bg-[#DDE3EA]"
              >
                {mobileMenu ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Stack under the bar: offline notice, mobile menu, session banner */}
          <div className="absolute inset-x-0 top-[84px] mx-auto flex max-w-[1400px] flex-col gap-2 px-3 sm:px-5">
            <AnimatePresence>
              {!online && (
                <motion.div
                  key="offline"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-auto self-center rounded-full bg-[#303030] text-white shadow-lg"
                  role="alert"
                >
                  <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium">
                    <WifiOff size={14} /> You're offline. Live updates will resume when you reconnect.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile expandable account menu */}
            <AnimatePresence>
              {mobileMenu && (
                <motion.div
                  key="mobile-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="pointer-events-auto max-h-[calc(100dvh-170px)] overflow-y-auto rounded-[28px] bg-[#F0F4F9] text-[#1F1F1F] shadow-[0_8px_30px_rgba(0,0,0,0.2)] lg:hidden"
                  style={{ overscrollBehavior: "contain" }}
                >
                  <div className="space-y-1 p-3">
                    <button
                      ref={mobileProfileRef}
                      type="button"
                      onClick={() => go("/Home/profile")}
                      className="mb-2 flex w-full items-center gap-3 rounded-[22px] bg-white px-3 py-3 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D3E3FD] text-lg font-semibold text-[#0B57D0]">
                        <Avatar src={avatarSrc} initial={initial} iconSize={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#1F1F1F]">
                          {userName || "My account"}
                        </span>
                        <span className="block text-xs text-[#444746]">View profile</span>
                      </span>
                      <ChevronRight size={18} className="text-[#747775]" />
                    </button>

                    {chipKind && <div className="mb-2">{renderSessionChip("block")}</div>}

                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => go(item.path)}
                          className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                            isActive(item)
                              ? "bg-[#C2E7FF] text-[#001D35]"
                              : "text-[#1F1F1F] hover:bg-[#E1E8F2]"
                          }`}
                        >
                          <Icon size={18} />
                          <span className="flex-1">{item.label}</span>
                          <Badge
                            count={item.badge ? badgeFor(item.badge) : 0}
                            tone="amber"
                            ring="ring-[#F0F4F9]"
                          />
                        </button>
                      );
                    })}

                    {MENU_ITEMS.filter((m) => !NAV_ITEMS.some((n) => n.path === m.path)).map(
                      ({ path, label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => go(path)}
                          className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#E1E8F2]"
                        >
                          <Icon size={18} /> {label}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => go("/Home/bonus-wallet")}
                      className="flex w-full items-center justify-between rounded-full bg-[#FEF7E0] px-4 py-3 text-left"
                    >
                      <span className="flex items-center gap-3 text-sm font-medium text-[#B06000]">
                        <Wallet size={18} /> Bonus Wallet
                      </span>
                      <span className="text-sm font-semibold text-[#B06000]">₹{balance}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[#B3261E] transition-colors hover:bg-[#F9DEDC]"
                    >
                      <LogOut size={18} /> Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Session alert banner */}
            <AnimatePresence>
              {showBanner && (
                <motion.div
                  key="banner"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="pointer-events-auto rounded-[20px] bg-[#C4EED0] text-[#072711] shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Video size={16} className="shrink-0 text-[#146C2E]" />
                      <span>
                        {bannerMs !== null && bannerMs <= 0 ? (
                          "Your session is live. The meeting room is open."
                        ) : (
                          <>
                            Your session starts in{" "}
                            {bannerMs !== null ? <Countdown target={banner.startsAt} /> : "20 minutes"}. The
                            meeting room is open.
                          </>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => joinMeeting(banner.id)}
                        className="rounded-full bg-[#146C2E] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0F5223]"
                      >
                        Join now
                      </button>
                      <button
                        type="button"
                        onClick={dismissBanner}
                        aria-label="Dismiss"
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#A8DBB5]"
                      >
                        <X size={16} />
                      </button>
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ---- Floating dock (mobile / tablet): same tonal language ---- */}
      <div
        className="fixed inset-x-3 z-50 rounded-full bg-[#E9EEF6] shadow-[0_4px_20px_rgba(0,0,0,0.18)] lg:hidden"
        style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <nav
          ref={dockNav.navRef}
          aria-label="Mobile navigation"
          className="relative flex items-center justify-between gap-1 rounded-full p-1.5"
        >
          <SlidePill box={dockNav.box} />
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                ref={(el) => (dockNav.itemRefs.current[item.path] = el)}
                to={item.path}
                onClick={closePopups}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-semibold transition-colors ${
                  active ? "text-[#001D35]" : "text-[#444746]"
                }`}
              >
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <span className="relative">
                    <Icon size={19} />
                    {item.badge && badgeFor(item.badge) > 0 && (
                      <span className="absolute -right-2.5 -top-1.5">
                        <Badge count={badgeFor(item.badge)} tone="amber" ring="ring-[#E9EEF6]" />
                      </span>
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profile guide */}
      {showGuide && (
        <GuideHand
          getTarget={getGuideTarget}
          title={guideOnItem ? "Tap “My profile”" : "Start with your profile"}
          text={
            guideOnItem
              ? "Open your profile and fill your details."
              : `Tap your profile picture. You need a photo and ${REQUIRED_PERCENT}% details filled to book meetings.`
          }
          onSkip={skipGuide}
        />
      )}

      {/* Toasts */}
      <div
        className="pointer-events-none fixed right-4 top-20 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((n) => {
            const { icon: Icon, cls } = styleFor(n.type);
            const dismissToast = () => setToasts((t) => t.filter((x) => x.id !== n.id));
            return (
              <motion.button
                key={n.id}
                type="button"
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                onClick={() => openNotification(n)}
                className="pointer-events-auto flex w-full gap-3 rounded-[20px] bg-[#F0F4F9] p-3.5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-colors hover:bg-[#E9EEF6]"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cls}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#1F1F1F]">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[#444746]">
                    {n.message}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      dismissToast();
                    }
                  }}
                  className="self-start rounded-full p-1.5 text-[#747775] transition-colors hover:bg-[#DDE3EA] hover:text-[#1F1F1F]"
                >
                  <X size={14} />
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Notifications popup */}
      <NotificationsPopup
        open={showNotifications}
        unreadCount={unreadCount}
        notifications={notifications}
        connected={connected}
        onClose={stableClose}
        onOpenItem={stableOpenItem}
        onMarkAll={stableMarkAll}
        onReadAll={stableReadAll}
      />

      {/* Bonus overlays */}
      {showWelcome && me && (
        <WelcomeBonus
          targetRef={walletBtnRef}
          fallbackRef={menuBtnRef}
          onHold={setHold}
          onLand={bumpWallet}
        />
      )}
      {me && (
        <ReferralBonus
          me={me}
          targetRef={walletBtnRef}
          fallbackRef={menuBtnRef}
          onHold={setHold}
          onLand={bumpWallet}
        />
      )}
    </>
  );
};

export default Header;