// src/FresherDashboard/pages/MyBookings.jsx
// Upcoming only (pending + confirmed). Open rooms live on /Home/my-meetings,
// finished / refunded sessions live in Meetings -> Past.
//
// Order: waiting (pending) requests first, then confirmed sessions by date & time.
// The title bar is position:fixed under the header, so it never moves; only the
// session cards scroll underneath it.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import useChatNotificationSound from "../../hooks/useChatNotificationSound";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  Award,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Video,
  Building2,
  UserRound,
  Inbox,
  Loader2,
  Radio,
  ArrowRight,
  MessageSquare,
  Quote,
  Send,
  Star,
  UserCheck,
  Check,
  Users,
  Copy,
  X,
} from "lucide-react";

import useLive from "../../hooks/useLive";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import { socket } from "../../utils/socket";
import { JOIN_OPEN_MS } from "../../utils/sessionTiming";

import {
  api,
  ENDPOINTS,
  EVENTS,
  getUserId,
  durationLabel,
  fmtClock,
  inr,
} from "../../services/fresherApi";

// same room-open time as the mentor side (shared constant)
const OPEN_BEFORE_MS = JOIN_OPEN_MS;
const IST = "Asia/Kolkata";

const fmtTimeIST = (ms) =>
  Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString("en-IN", {
        timeZone: IST,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

// these statuses never show here (they belong to Meetings -> Past)
const PAST_STATUSES = [
  "completed",
  "awaiting_confirmation",
  "disputed",
  "expired",
  "missed",
  "cancelled",
];

const TONES = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
};

// Header is 76px tall; the fixed title bar sits right under it.
const HEADER_H = 76;
const BAR_H = 64;

// popup open / close animation time (ms)
const MODAL_ANIM_MS = 220;

/* =========================================================================
   LIVE CLOCK
========================================================================= */

const tickListeners = new Set();
let tickTimer = null;

const subscribeTick = (fn) => {
  tickListeners.add(fn);

  if (!tickTimer) {
    tickTimer = setInterval(() => tickListeners.forEach((f) => f()), 1000);
  }

  return () => {
    tickListeners.delete(fn);

    if (!tickListeners.size && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
};

const LiveClock = ({ target }) => {
  const [, setTick] = useState(0);

  useEffect(() => subscribeTick(() => setTick((n) => n + 1)), []);

  return <>{fmtClock(Math.max(0, target - Date.now()))}</>;
};

/* =========================================================================
   SKELETON
========================================================================= */

const Bone = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

const BookingCardSkeleton = () => (
  <div
    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    aria-hidden="true"
  >
    <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 gap-4">
        <Bone className="h-14 w-14 shrink-0 !rounded-2xl" />

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Bone className="h-5 w-40 sm:w-52" />
            <Bone className="h-6 w-24 !rounded-full" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-4 w-36" />
            <Bone className="h-4 w-28" />
            <Bone className="h-4 w-40" />
          </div>

          <Bone className="mt-4 h-4 w-full max-w-sm" />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-56">
        <Bone className="h-11 w-full !rounded-xl" />
        <Bone className="h-11 w-full !rounded-xl" />
      </div>
    </div>

    <div className="mx-3 mb-4 sm:mx-6">
      <div className="mx-auto flex max-w-2xl">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <Bone className="h-7 w-7 !rounded-full" />
            <Bone className="mt-2 h-3 w-14" />
            <Bone className="mt-1.5 h-2.5 w-16" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
      <Bone className="h-3.5 w-40" />
      <Bone className="h-3.5 w-16" />
    </div>
  </div>
);

const BookingsSkeleton = ({ count = 3 }) => (
  <div
    className="space-y-5"
    role="status"
    aria-busy="true"
    aria-label="Loading bookings"
  >
    {Array.from({ length: count }).map((_, i) => (
      <BookingCardSkeleton key={i} />
    ))}

    <span className="sr-only">Loading bookings…</span>
  </div>
);

/* =========================================================================
   BOOKING STEPPER
========================================================================= */

const STEPS = [
  { label: "Requested", icon: Send },
  { label: "Accepted", icon: UserCheck },
  { label: "Session", icon: Video },
  { label: "Completed", icon: CheckCircle2 },
];

const progressOf = (v) => (v.key === "pending" ? 0 : 2);

const subOf = (i, b, v) => {
  if (i === 0) return `Paid ${inr(b.amount)}`;

  if (i === 1) {
    if (v.key === "pending") return "";
    return b.mentor?.name || "Accepted";
  }

  if (i === 2 && v.key === "confirmed") {
    return (
      <>
        Opens in <LiveClock target={v.opens} />
      </>
    );
  }

  return "";
};

const BookingStepper = ({ b, v }) => {
  const active = progressOf(v);
  const confirmed = v.key === "confirmed";

  const solid = confirmed ? "bg-emerald-600" : "bg-blue-600";
  const ring = confirmed ? "ring-emerald-100" : "ring-blue-100";

  const idle = confirmed
    ? "bg-white text-emerald-300 border-2 border-emerald-200"
    : "bg-white text-blue-300 border-2 border-blue-200";

  const lineOff = confirmed ? "bg-emerald-100" : "bg-blue-100";

  return (
    <div
      className="mx-auto flex max-w-2xl"
      role="list"
      aria-label="Booking progress"
    >
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < active;
        const isCurrent = i === active;

        const circle = isDone
          ? `${solid} text-white`
          : isCurrent
            ? `${solid} text-white shadow ring-2 ${ring}`
            : idle;

        const labelCls =
          isDone || isCurrent ? "text-slate-900" : "text-slate-400";

        const subCls = isCurrent
          ? confirmed
            ? "text-emerald-700"
            : "text-blue-700"
          : "text-slate-400";

        const sub = subOf(i, b, v);

        return (
          <div
            key={step.label}
            role="listitem"
            className="relative flex min-w-0 flex-1 flex-col items-center"
          >
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-3.5 h-[2px] w-full -translate-y-1/2 rounded-full ${
                  i < active ? solid : lineOff
                }`}
              />
            )}

            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full ${circle}`}
            >
              {isDone ? (
                <Check className="relative h-3.5 w-3.5" />
              ) : (
                <Icon className="relative h-3.5 w-3.5" />
              )}
            </span>

            <p
              className={`mt-1.5 text-center text-[11px] font-semibold ${labelCls}`}
            >
              {step.label}
            </p>

            <p
              className={`mt-0.5 max-w-[84px] truncate text-center text-[10px] tabular-nums sm:max-w-[130px] ${subCls}`}
              title={typeof sub === "string" ? sub : undefined}
            >
              {sub || "\u00A0"}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/* =========================================================================
   GROUP INFO
========================================================================= */

const NAMES_SHOWN = 8;

const GroupInfo = ({ b, me }) => {
  const [copied, setCopied] = useState(false);

  if (b.mode !== "group") return null;

  const isHost = String(b.hostId) === String(me);
  const link = `${window.location.origin}/Home/join/${b.inviteCode}`;

  const canInvite =
    isHost && b.inviteCode && ["pending", "accepted"].includes(b.status);

  const members = b.members || [];
  const shown = members.slice(0, NAMES_SHOWN).map((m) => m.name);
  const more = Math.max(0, members.length - NAMES_SHOWN);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", link);
    }
  };

  return (
    <div className="mx-5 mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:mx-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
          <Users className="h-4 w-4" />
          Group session · {members.length || 1}/{b.maxMembers} joined
          {isHost ? " · you are the host" : ""}
        </p>

        {canInvite && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Link copied" : "Copy invite link"}
          </button>
        )}
      </div>

      {shown.length > 0 && (
        <p className="mt-1.5 text-[11px] text-indigo-700">
          {shown.join(", ")}
          {more > 0 ? ` +${more} more` : ""}
        </p>
      )}
    </div>
  );
};

/* =========================================================================
   REASON (DESCRIPTION) POPUP  -  smooth open / close animation
   - rendered in a portal, so card layout / hover never affects it
   - mounts first, then animates in (fade + scale + slide up)
   - animates out, then unmounts
   - Esc closes, background scroll is locked without layout jump
========================================================================= */

const ReasonModal = ({ open, text, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // mount -> animate in | animate out -> unmount
  useEffect(() => {
    if (open) {
      setMounted(true);

      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    const t = setTimeout(() => setMounted(false), MODAL_ANIM_MS);

    return () => clearTimeout(t);
  }, [open]);

  // lock background scroll (no layout shift)
  useEffect(() => {
    if (!mounted) return undefined;

    const body = document.body;
    const root = document.documentElement;

    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const prevLock = root.style.getPropertyValue("--lock-pad");

    const scrollbar = window.innerWidth - root.clientWidth;

    body.style.overflow = "hidden";

    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
      root.style.setProperty("--lock-pad", `${scrollbar}px`);
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;

      if (prevLock) root.style.setProperty("--lock-pad", prevLock);
      else root.style.removeProperty("--lock-pad");
    };
  }, [mounted]);

  // Esc to close
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6 transition-opacity ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${MODAL_ANIM_MS}ms` }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full max-w-lg transform-gpu overflow-hidden rounded-2xl bg-white shadow-2xl transition ease-out will-change-transform ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0"
        }`}
        style={{ transitionDuration: `${MODAL_ANIM_MS}ms` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-modal-title"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h3
              id="reason-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Session Description
            </h3>

            <p className="mt-0.5 text-xs text-slate-400">
              Complete description
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="Close description"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Full description */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {text}
            </p>
          </div>
        </div>

        {/* Modal footer */}
        <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* =========================================================================
   EMPLOYEE DETAILS POPUP  -  clean 3D "portfolio" style
   - hero card tilts in 3D with the mouse (layers float at different depths)
   - reviews slide continuously, each with the fresher's profile circle
     (pauses on hover / touch, stops for "reduce motion")
   - smooth open / close animation, Esc closes, background scroll locked
========================================================================= */

const DETAILS_ANIM_MS = 260;

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

const timeAgo = (value) => {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";

  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";

  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;

  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;

  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? "s" : ""} ago`;

  const y = Math.floor(mo / 12);
  return `${y} year${y > 1 ? "s" : ""} ago`;
};

// The API shape is not fixed, so read every common field name.
const normalizePerson = (raw) => {
  const root = raw || {};
  const p =
    root.counterpart ||
    root.person ||
    root.mentor ||
    root.employee ||
    root.user ||
    root.profile ||
    root;

  const rawReviews =
    p.reviews ||
    p.feedbacks ||
    p.feedback ||
    root.reviews ||
    root.feedbacks ||
    root.feedback ||
    [];

  const reviews = (Array.isArray(rawReviews) ? rawReviews : []).map(
    (r, i) => ({
      id: String(pick(r, ["_id", "id"]) || i),
      name:
        pick(r, [
          "fresherName",
          "reviewerName",
          "userName",
          "name",
          "author",
        ]) ||
        pick(r?.fresher, ["name"]) ||
        pick(r?.user, ["name"]) ||
        "Fresher",
      image:
        pick(r, ["fresherImage", "profilePic", "image", "avatar"]) ||
        pick(r?.fresher, ["profilePic", "image"]) ||
        pick(r?.user, ["profilePic", "image"]),
      rating: Number(pick(r, ["rating", "stars", "score"])) || 0,
      tag: pick(r, ["topic", "tag", "sessionType", "category"]),
      text: pick(r, ["comment", "text", "message", "review", "feedback"]),
      at: pick(r, ["createdAt", "date", "time"]),
    }),
  );

  const rated = reviews.filter((r) => r.rating > 0);
  const avg = rated.length
    ? rated.reduce((a, r) => a + r.rating, 0) / rated.length
    : Number(pick(p, ["rating", "averageRating", "avgRating"])) || 0;

  const skills = pick(p, ["skills", "expertise", "topics"]);

  return {
    name: pick(p, ["name", "fullName"]) || "MNC Employee",
    image: pick(p, ["profilePic", "image", "avatar", "photo"]),
    role: pick(p, ["designation", "role", "jobTitle", "position"]),
    company: pick(p, ["companyName", "company", "organization"]),
    experience: pick(p, ["experience", "yearsOfExperience", "exp"]),
    sessions: pick(p, ["sessionsCompleted", "totalSessions", "sessions"]),
    about: pick(p, ["about", "bio", "description", "summary"]),
    skills: Array.isArray(skills)
      ? skills
          .map((s) => (typeof s === "string" ? s : s?.name))
          .filter(Boolean)
      : String(skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    reviews,
    avg,
    reviewCount: reviews.length || Number(pick(p, ["reviewCount"])) || 0,
  };
};

const Avatar = ({
  src,
  name,
  size = 40,
  ring = false,
  eager = false,
  className = "",
}) => {
  const [broken, setBroken] = useState(false);
  const letter = String(name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 font-bold text-indigo-700 ${
        ring ? "ring-4 ring-white" : "ring-2 ring-white"
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
};

const Stars = ({ value, size = 14 }) => (
  <span
    className="inline-flex items-center gap-0.5"
    aria-label={`${value} out of 5`}
  >
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={
          n <= Math.round(value)
            ? "fill-amber-400 text-amber-400"
            : "fill-slate-200 text-slate-200"
        }
      />
    ))}
  </span>
);

const ReviewCard = React.memo(function ReviewCard({ r }) {
  return (
    <article
      className="mr-4 flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:w-80"
      style={{ boxShadow: "0 6px 16px -10px rgba(49,46,129,.3)" }}
    >
      <div className="flex items-start gap-3">
        <Avatar src={r.image} name={r.name} size={44} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-400">Fresher</p>
        </div>

        {r.at && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
            <Clock3 size={11} />
            {timeAgo(r.at)}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Stars value={r.rating} />
        {r.tag && (
          <span className="max-w-full truncate rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
            {r.tag}
          </span>
        )}
      </div>

      {r.text && (
        <p className="mt-2.5 line-clamp-3 break-words text-sm leading-relaxed text-slate-600">
          “{r.text}”
        </p>
      )}
    </article>
  );
});

/* Reviews that slide on their own (transform only = GPU, no repaint).
   Edge fade uses two static overlays instead of mask-image.
   Pauses while the popup is being scrolled. */
const ReviewsSlider = ({ reviews }) => {
  const moving = reviews.length > 1;

  const base = useMemo(() => {
    if (!moving) return reviews;
    const out = [];
    while (out.length < 3) out.push(...reviews);
    return out;
  }, [reviews, moving]);

  if (!moving) {
    return (
      <div className="px-5 pb-2 sm:px-6">
        <ReviewCard r={reviews[0]} />
      </div>
    );
  }

  const seconds = Math.max(20, base.length * 7);

  return (
    <div className="pdm-marquee relative overflow-hidden py-2">
      <div
        className="pdm-track flex w-max"
        style={{ animationDuration: `${seconds}s` }}
      >
        {[...base, ...base].map((r, i) => (
          <ReviewCard key={`${r.id}-${i}`} r={r} />
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-50 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 to-transparent"
      />
    </div>
  );
};

const Stat = ({ icon: Icon, value, label, depth }) => (
  <div
    className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-center"
    style={{
      transform: depth ? `translateZ(${depth}px)` : undefined,
      boxShadow: "0 8px 18px -12px rgba(49,46,129,.4)",
    }}
  >
    <p className="flex items-center justify-center gap-1 text-base font-extrabold text-slate-900">
      <Icon size={14} className="text-indigo-500" />
      {value}
    </p>
    <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
  </div>
);

const canTilt = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const EmployeeDetailsModal = ({ title = "Details", fetcher, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false); // open animation finished
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const scrollRef = useRef(null);
  const tiltRef = useRef(null);
  const closingRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  const scrollTimer = useRef(0);
  const rafRef = useRef(0);
  const pointRef = useRef({ x: 0, y: 0 });
  const tilt = useMemo(canTilt, []);

  fetcherRef.current = fetcher;

  // Lock page scroll BEFORE first paint (no layout jump during the animation)
  useLayoutEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const prevLock = root.style.getPropertyValue("--lock-pad");
    const bar = window.innerWidth - root.clientWidth;

    body.style.overflow = "hidden";

    if (bar > 0) {
      body.style.paddingRight = `${bar}px`;
      root.style.setProperty("--lock-pad", `${bar}px`);
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;

      if (prevLock) root.style.setProperty("--lock-pad", prevLock);
      else root.style.removeProperty("--lock-pad");
    };
  }, []);

  // open: animate in, and only put the heavy content in AFTER the animation
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setVisible(true));
    });
    const t = setTimeout(() => setReady(true), DETAILS_ANIM_MS + 40);

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
      clearTimeout(scrollTimer.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // close animation, then tell the parent
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(() => onClose?.(), DETAILS_ANIM_MS);
  };

  // load data (starts immediately, shown after the animation)
  useEffect(() => {
    let alive = true;

    Promise.resolve()
      .then(() => fetcherRef.current())
      .then(
        (d) =>
          alive &&
          setState({ loading: false, error: "", data: normalizePerson(d) }),
      )
      .catch(
        (e) =>
          alive &&
          setState({
            loading: false,
            error: e?.message || "Could not load details",
            data: null,
          }),
      );

    return () => {
      alive = false;
    };
  }, []);

  // Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // while scrolling: pause marquee + ignore tilt (class toggle, no re-render)
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    el.classList.add("pdm-scrolling");
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(
      () => el.classList.remove("pdm-scrolling"),
      160,
    );
  };

  // 3D tilt: mouse devices only, one write per animation frame
  const applyTilt = () => {
    rafRef.current = 0;

    const el = tiltRef.current;
    const sc = scrollRef.current;
    if (!el || (sc && sc.classList.contains("pdm-scrolling"))) return;

    const rect = el.getBoundingClientRect();
    const x = (pointRef.current.x - rect.left) / rect.width - 0.5;
    const y = (pointRef.current.y - rect.top) / rect.height - 0.5;

    el.style.transition = "none";
    el.style.transform = `perspective(1000px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
  };

  const onMove = (e) => {
    if (!tilt) return;
    pointRef.current = { x: e.clientX, y: e.clientY };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyTilt);
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el || !tilt) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    el.style.transition = "transform 420ms cubic-bezier(.22,1,.36,1)";
    el.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
  };

  const d = ready ? state.data : null;
  const showLoader = !ready || state.loading;
  const depth = (n) => (tilt ? n : 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 px-4 py-6"
      style={{
        opacity: visible ? 1 : 0,
        transitionProperty: "opacity",
        transitionDuration: `${DETAILS_ANIM_MS}ms`,
        transitionTimingFunction: "ease-out",
      }}
      onClick={close}
      role="presentation"
    >
      <style>{`
        @keyframes pdm-slide { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
        @keyframes pdm-fade { from { opacity: 0; } to { opacity: 1; } }
        .pdm-track { animation: pdm-slide linear infinite; will-change: transform; backface-visibility: hidden; }
        .pdm-marquee:hover .pdm-track, .pdm-marquee:active .pdm-track,
        .pdm-scrolling .pdm-track { animation-play-state: paused; }
        .pdm-in { animation: pdm-fade 220ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .pdm-track { animation: none; }
          .pdm-marquee { overflow-x: auto; }
          .pdm-in { animation: none; }
        }
      `}</style>

      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-50"
        style={{
          transform: visible
            ? "translate3d(0,0,0) scale(1)"
            : "translate3d(0,22px,0) scale(.97)",
          opacity: visible ? 1 : 0,
          transitionProperty: "transform, opacity",
          transitionDuration: `${DETAILS_ANIM_MS}ms`,
          transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
          willChange: "transform, opacity",
          boxShadow: "0 24px 60px -28px rgba(15,23,42,.55)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[88vh] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* ---------- cover ---------- */}
          <div className="relative h-36 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
                backgroundSize: "18px 18px",
              }}
            />
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10"
            />

            <p className="absolute left-5 top-4 text-sm font-semibold text-white/90 sm:left-6">
              {title}
            </p>

            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/35"
            >
              <X size={18} />
            </button>
          </div>

          {/* ---------- body ---------- */}
          <div className="relative -mt-16 px-4 pb-6 sm:px-6">
            {showLoader && (
              <div className="flex h-56 items-center justify-center rounded-3xl bg-white shadow-sm">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              </div>
            )}

            {ready && state.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {state.error}
              </div>
            )}

            {d && (
              <div className="pdm-in">
                {/* hero card */}
                <div
                  ref={tiltRef}
                  onPointerMove={onMove}
                  onPointerLeave={onLeave}
                  className="relative rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
                  style={{
                    transformStyle: tilt ? "preserve-3d" : undefined,
                    transform: tilt ? "perspective(1000px)" : undefined,
                    boxShadow: "0 18px 36px -24px rgba(49,46,129,.45)",
                  }}
                >
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                    <div
                      style={{
                        transform: depth(60)
                          ? `translateZ(${depth(60)}px)`
                          : undefined,
                      }}
                    >
                      <Avatar
                        src={d.image}
                        name={d.name}
                        size={92}
                        ring
                        eager
                        className="shadow-lg"
                      />
                    </div>

                    <div
                      className="min-w-0 flex-1"
                      style={{
                        transform: depth(35)
                          ? `translateZ(${depth(35)}px)`
                          : undefined,
                      }}
                    >
                      <h2 className="truncate text-xl font-extrabold text-slate-900 sm:text-2xl">
                        {d.name}
                      </h2>

                      {d.role && (
                        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 sm:justify-start">
                          <Briefcase
                            size={14}
                            className="shrink-0 text-indigo-500"
                          />
                          <span className="truncate">{d.role}</span>
                        </p>
                      )}

                      {d.company && (
                        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500 sm:justify-start">
                          <Building2
                            size={14}
                            className="shrink-0 text-slate-400"
                          />
                          <span className="truncate">{d.company}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-5 grid grid-cols-3 gap-3"
                    style={{ transformStyle: tilt ? "preserve-3d" : undefined }}
                  >
                    <Stat
                      icon={Star}
                      value={d.avg ? d.avg.toFixed(1) : "–"}
                      label={`${d.reviewCount} review${
                        d.reviewCount === 1 ? "" : "s"
                      }`}
                      depth={depth(25)}
                    />
                    <Stat
                      icon={Users}
                      value={d.sessions || "–"}
                      label="Sessions"
                      depth={depth(40)}
                    />
                    <Stat
                      icon={Award}
                      value={d.experience || "–"}
                      label="Experience"
                      depth={depth(25)}
                    />
                  </div>
                </div>

                {/* about + skills */}
                {(d.about || d.skills.length > 0) && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                    {d.about && (
                      <>
                        <h3 className="text-sm font-bold text-slate-900">
                          About
                        </h3>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                          {d.about}
                        </p>
                      </>
                    )}

                    {d.skills.length > 0 && (
                      <div className={d.about ? "mt-4" : ""}>
                        <h3 className="text-sm font-bold text-slate-900">
                          Can help with
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {d.skills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* feedback */}
                <section className="-mx-4 mt-5 sm:-mx-6">
                  <div className="mb-2 flex items-center gap-2 px-5 sm:px-6">
                    <Quote size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-900">
                      What freshers say
                    </h3>
                  </div>

                  {d.reviews.length > 0 ? (
                    <ReviewsSlider reviews={d.reviews} />
                  ) : (
                    <p className="px-5 text-sm text-slate-400 sm:px-6">
                      No feedback yet.
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* =========================================================================
   BOOKING CARD
========================================================================= */

const BookingCard = React.memo(function BookingCard({
  b,
  v,
  me,
  unread,
  onOpenChat,
  onOpenDetails,
}) {
  // Description popup state
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const closeReason = useCallback(() => setReasonModalOpen(false), []);

  const startMs = new Date(b.startsAt).getTime();
  const endMs = new Date(b.endsAt).getTime();

  const range =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
      : b.time;

  const canChat = Boolean(b.mentor) && v.key !== "pending";
  const canSeeMentor = Boolean(b.mentor?.id) && v.key !== "pending";

  const reason = String(b.reason || "").trim();

  // Measures how much text fits in 2 lines together with "… See more".
  // cut === null means the text fits and no "See more" is needed.
  const wrapRef = useRef(null);
  const measRef = useRef(null);
  const [cut, setCut] = useState(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const m = measRef.current;

    if (!wrap || !m || !reason) {
      setCut(null);
      return undefined;
    }

    const full = `"${reason}"`;

    const check = () => {
      const lh = parseFloat(getComputedStyle(m).lineHeight) || 23;

      // 1 line only -> no See more
      m.textContent = full;
      if (m.scrollHeight <= lh * 1.5) {
        setCut(null);
        return;
      }

      const fits = (n) => {
        m.textContent = "";
        m.append(document.createTextNode(full.slice(0, n).trimEnd()));

        const s = document.createElement("span");
        s.className = "font-semibold";
        s.textContent = "… See more";
        m.append(s);

        return m.scrollHeight <= lh * 2 + 2;
      };

      let lo = 0;
      let hi = full.length;

      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(mid)) lo = mid;
        else hi = mid - 1;
      }

      setCut(full.slice(0, lo).trimEnd());
    };

    check();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }

    const ro = new ResizeObserver(check);
    ro.observe(wrap);

    return () => ro.disconnect();
  }, [reason]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            {b.mode === "group" ? (
              <Users className="h-7 w-7 text-blue-600" />
            ) : (
              <Video className="h-7 w-7 text-blue-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-900">
                {b.sessionType || "Mentoring session"}
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${TONES[v.tone]}`}
              >
                {v.label}
              </span>

              {b.mode === "group" && (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  Group
                </span>
              )}
            </div>

            {/* Booking information */}
            <div className="grid gap-x-6 gap-y-2 text-sm text-slate-500 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{b.companyName}</span>
              </span>

              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  {b.mentor?.name || "Waiting for an employee"}
                </span>
              </span>

              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="truncate font-bold text-[indigo]">
                  {b.date}
                </span>
              </span>

              <span className="flex min-w-0 items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-indigo-500" />

                <span className="flex min-w-0 items-center gap-2">
                  <b className="truncate font-bold text-[indigo]">
                    {range}
                  </b>

                  <span className="shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
                    {durationLabel(b.durationMinutes)}
                  </span>
                </span>
              </span>
            </div>

            {/* =====================================================
                SESSION DESCRIPTION
                2 lines max, "… See more" sits at the END of line 2
            ====================================================== */}

            {reason && (
              <div className="mt-3 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div ref={wrapRef} className="relative">
                  {/* hidden measurer (same width, same font) */}
                  <p
                    ref={measRef}
                    aria-hidden="true"
                    className="pointer-events-none invisible absolute inset-x-0 top-0 break-words text-sm leading-relaxed"
                  />

                  <p className="break-words text-sm leading-relaxed text-slate-500">
                    {cut === null ? (
                      `"${reason}"`
                    ) : (
                      <>
                        {cut}
                        <button
                          type="button"
                          onClick={() => setReasonModalOpen(true)}
                          className="font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
                        >
                          … See more
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-56">
          {v.key === "confirmed" && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-xs text-emerald-700">
              Room opens in{" "}
              <b className="font-mono text-sm">
                <LiveClock target={v.opens} />
              </b>
            </div>
          )}

          {v.key === "pending" && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-700">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting...
              </div>

              {Number.isFinite(v.expires) && (
                <p className="mt-1.5 text-[11px] font-normal text-amber-700">
                  Auto-cancels at{" "}
                  <b className="font-semibold">{fmtTimeIST(v.expires)}</b> if no
                  one accepts · refund goes to your wallet
                </p>
              )}
            </div>
          )}

          {canSeeMentor && (
            <button
              type="button"
              onClick={() => onOpenDetails(b)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4" />
              MncEmployee details
            </button>
          )}

          {canChat && (
            <button
              type="button"
              onClick={() => onOpenChat(b)}
              className="relative flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MessageSquare className="h-4 w-4" />
              Message

              {unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* GROUP INFO */}
      <GroupInfo b={b} me={me} />

      {/* BOOKING PROGRESS */}
      <div className="mx-3 mb-4 sm:mx-6">
        <BookingStepper b={b} v={v} />
      </div>

      {/* CARD FOOTER */}
      <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
        <span>
          Booking ID: <b className="text-slate-700">{b.requestGroupId}</b>
        </span>

        <span className="font-semibold text-slate-700">
          {inr(b.amount)}
          {b.mode === "group" ? " / person" : ""}
        </span>
      </div>

      {/* FULL DESCRIPTION POPUP (smooth animated, portal) */}
      <ReasonModal
        open={reasonModalOpen}
        text={reason}
        onClose={closeReason}
      />
    </div>
  );
});

/* =========================================================================
   MY BOOKINGS PAGE
========================================================================= */

const MyBookings = () => {
  useChatNotificationSound("fresher");

  const navigate = useNavigate();
  const location = useLocation();
  const userId = useMemo(() => getUserId(), []);

  const [now, setNow] = useState(Date.now());

  // chat
  const [chatFor, setChatFor] = useState(null);

  // MncEmployee details modal
  const [detailsFor, setDetailsFor] = useState(null);

  // unread chat messages
  const [unreadCounts, setUnreadCounts] = useState({});
  const openChatId = useRef(null);
  const seenMessageIds = useRef(new Set());

  const { data, loading, error, connected, reload } = useLive({
    fetcher: () => api(ENDPOINTS.myBookings),
    events: [EVENTS.booking, EVENTS.reminder],
    pollMs: 10000,
    userId,
  });

  // Keep the old array when content is identical.
  const bookingsSig = useMemo(
    () => JSON.stringify(data?.bookings || []),
    [data],
  );

  const bookings = useMemo(() => JSON.parse(bookingsSig), [bookingsSig]);

  const showSkeleton = loading && !data;

  /* ---------- CLOCK ---------- */

  const boundaries = useMemo(() => {
    const list = [];

    bookings.forEach((b) => {
      const s = new Date(b.startsAt).getTime();
      const e = new Date(b.endsAt).getTime();
      const x = new Date(b.expiresAt).getTime();

      if (Number.isFinite(s)) list.push(s - OPEN_BEFORE_MS);
      if (Number.isFinite(e)) list.push(e);
      if (Number.isFinite(x)) list.push(x);
    });

    return list;
  }, [bookings]);

  useEffect(() => {
    const t = Date.now();
    let next = Infinity;

    for (const v of boundaries) {
      if (v > t && v < next) next = v;
    }

    if (next === Infinity) return undefined;

    const id = setTimeout(
      () => setNow(Date.now()),
      Math.min(next - t, 3600000) + 50,
    );

    return () => clearTimeout(id);
  }, [boundaries, now]);

  useEffect(() => {
    setNow(Date.now());
  }, [bookings]);

  /* ---------- UNREAD CHAT BADGE ---------- */

  const loadUnread = useCallback(() => {
    api("/chat/unread")
      .then((d) => {
        if (!d?.counts) return;

        const counts = { ...d.counts };

        if (openChatId.current) {
          counts[openChatId.current] = 0;
        }

        setUnreadCounts(counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    const onFocus = () =>
      document.visibilityState === "visible" && loadUnread();

    socket.on("connect", loadUnread);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      socket.off("connect", loadUnread);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadUnread]);

  useEffect(() => {
    const onChatMessage = (message) => {
      const sid = String(message.senderId || "").split(":").pop();

      if (sid ? sid === String(userId) : message.senderRole === "fresher") {
        return;
      }

      const messageId = String(message._id || message.id || "");

      if (messageId) {
        if (seenMessageIds.current.has(messageId)) return;
        seenMessageIds.current.add(messageId);
      }

      const id = String(message.requestGroupId || message.bookingId || "");

      if (!id) return;
      if (openChatId.current === id) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [id]: (prev[id] || 0) + 1,
      }));
    };

    socket.on("chat:message", onChatMessage);

    return () => socket.off("chat:message", onChatMessage);
  }, [userId]);

  const openChat = useCallback((b) => {
    const id = String(b.requestGroupId);

    openChatId.current = id;

    setUnreadCounts((prev) => ({
      ...prev,
      [id]: 0,
    }));

    setChatFor(b);
  }, []);

  const closeChat = () => {
    openChatId.current = null;
    setChatFor(null);
    loadUnread();
  };

  const openDetails = useCallback((b) => setDetailsFor(b), []);
  const closeDetails = useCallback(() => setDetailsFor(null), []);

  // Open chat from global message alert.
  useEffect(() => {
    const id = location.state?.openChatId;

    if (!id || !bookings.length) return;

    const b = bookings.find(
      (x) => String(x.requestGroupId) === String(id),
    );

    if (!b) return;

    openChat(b);

    navigate(location.pathname, {
      replace: true,
      state: null,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, location.state]);

  /* ---------- BOOKING STATUS ---------- */

  const decorated = useMemo(() => {
    const view = (b) => {
      const starts = new Date(b.startsAt).getTime();
      const ends = new Date(b.endsAt).getTime();
      const opens = starts - OPEN_BEFORE_MS;

      if (PAST_STATUSES.includes(b.status)) {
        return { key: "past" };
      }

      if (b.status === "pending") {
        return {
          key: "pending",
          label: b.direct
            ? "Waiting for your mentor"
            : "Waiting for an employee",
          tone: "amber",
          expires: new Date(b.expiresAt).getTime(),
          starts,
        };
      }

      if (now >= ends) {
        return { key: "past" };
      }

      if (now >= opens) {
        return { key: "open" };
      }

      return {
        key: "confirmed",
        label: "Confirmed",
        tone: "green",
        opens,
        starts,
      };
    };

    return bookings.map((b) => ({
      b,
      v: view(b),
    }));
  }, [bookings, now]);

  /* ---------- UPCOMING BOOKINGS ---------- */

  const upcoming = useMemo(() => {
    const rank = (v) => (v.key === "pending" ? 0 : 1);
    const time = (v) => (Number.isFinite(v.starts) ? v.starts : Infinity);

    return decorated
      .filter(
        ({ v }) => v.key === "pending" || v.key === "confirmed",
      )
      .sort((x, y) => {
        const r = rank(x.v) - rank(y.v);

        if (r !== 0) return r;

        const t = time(x.v) - time(y.v);

        if (t !== 0 && !Number.isNaN(t)) return t;

        return String(x.b.requestGroupId).localeCompare(
          String(y.b.requestGroupId),
        );
      });
  }, [decorated]);

  const liveCount = useMemo(
    () => decorated.filter(({ v }) => v.key === "open").length,
    [decorated],
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-6 sm:px-6 lg:px-8">
      {/* FIXED TITLE BAR */}

      <div
        className="fixed inset-x-0 z-40 transform-gpu bg-slate-50"
        style={{
          top: HEADER_H,
          height: BAR_H,
          paddingRight: "var(--lock-pad, 0px)",
        }}
      >
        <div className="h-full px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <CalendarDays
                size={16}
                className="shrink-0 text-indigo-500"
              />

              <span className="truncate">Booking sessions</span>

              <span
                aria-hidden="true"
                className="h-4 w-px bg-slate-200"
              />

              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                  connected ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                <Radio size={12} />
                {connected ? "Live" : "Reconnecting..."}
              </span>
            </div>

            <span className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              {showSkeleton
                ? "Upcoming"
                : `Upcoming (${upcoming.length})`}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-slate-50 to-transparent"
        />
      </div>

      <div className="mx-auto max-w-6xl">
        <div
          aria-hidden="true"
          style={{ height: BAR_H + 8 }}
        />

        {liveCount > 0 && (
          <Link
            to="/Home/my-meetings"
            className="mb-4 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 hover:bg-green-100"
          >
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              {liveCount} meeting
              {liveCount > 1 ? "s are" : " is"} open now
            </span>

            <span className="flex items-center gap-1">
              Go to Meetings
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button
              onClick={reload}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {showSkeleton ? (
          <BookingsSkeleton count={3} />
        ) : upcoming.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-8 w-8 text-slate-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-800">
              No upcoming sessions
            </h2>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Pick a company, choose a time and an employee will accept your
              request.
            </p>

            <button
              onClick={() => navigate("/Home")}
              className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Browse companies
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {upcoming.map(({ b, v }) => (
              <BookingCard
                key={b.requestGroupId}
                b={b}
                v={v}
                me={userId}
                unread={
                  unreadCounts[String(b.requestGroupId)] || 0
                }
                onOpenChat={openChat}
                onOpenDetails={openDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* CHAT MODAL */}

      {chatFor && (
        <ChatPanel
          variant="modal"
          bookingId={chatFor.requestGroupId}
          role="fresher"
          group={chatFor.mode === "group"}
          myUserId={userId}
          peerImage={
            chatFor.mentor?.profilePic ||
            chatFor.mentor?.image ||
            ""
          }
          images={Object.fromEntries(
            (chatFor.members || [])
              .map((m) => [
                String(m.id || m._id || m.userId || "")
                  .split(":")
                  .pop(),
                m.profilePic || m.image || "",
              ])
              .filter(([k, img]) => k && img),
          )}
          names={Object.fromEntries(
            (chatFor.members || [])
              .map((m) => [
                String(m.id || m._id || m.userId || "")
                  .split(":")
                  .pop(),
                m.name,
              ])
              .filter(([k, n]) => k && n),
          )}
          title={
            chatFor.mode === "group"
              ? "Group chat"
              : `Chat with ${chatFor.mentor?.name || "employee"}`
          }
          onClose={closeChat}
        />
      )}

      {/* EMPLOYEE DETAILS MODAL (3D portfolio style, defined above) */}

      {detailsFor && (
        <EmployeeDetailsModal
          key={detailsFor.requestGroupId}
          title="MncEmployee details"
          fetcher={() =>
            api(
              `${ENDPOINTS.booking(detailsFor.requestGroupId)}/counterpart`,
            )
          }
          onClose={closeDetails}
        />
      )}
    </div>
  );
};

export default MyBookings;