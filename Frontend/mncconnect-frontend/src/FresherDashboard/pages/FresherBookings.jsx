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
  ArrowLeft,
  MessageSquare,
  Send,
  Star,
  UserCheck,
  Check,
  Users,
  Copy,
  X,
  Share2,
  Mail,
  MessageCircle,
  Languages,
  Atom,
  Coffee,
  Code2,
  Globe,
  Target,
  Palette,
  Database,
  Terminal,
} from "lucide-react";

import useLive from "../../hooks/useLive";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import { socket } from "../../utils/socket";
import { JOIN_OPEN_MS } from "../../utils/sessionTiming";
import LiveClock from "../../utils/LiveClock";
import {
  api,
  ENDPOINTS,
  EVENTS,
  getUserId,
  durationLabel,
  inr,
} from "../../services/fresherApi";

// same room-open time as the employee side (shared constant)
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
                className={`absolute left-1/2 top-3.5 h-[2px] w-full -translate-y-1/2 rounded-full ${i < active ? solid : lineOff
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
   GROUP INFO  +  INVITE FRIENDS (professional share popup)
   - isHost comes from the SERVER (b.isHost). The id compare is only a fallback.
========================================================================= */

const NAMES_SHOWN = 8;

const inviteMessage = (b, link, spotsLeft, hostName) => {
  const startMs = new Date(b.startsAt).getTime();
  const at = Number.isFinite(startMs)
    ? `${b.date} at ${fmtTimeIST(startMs)} IST`
    : `${b.date} at ${b.time}`;

  return (
    `Hi,\n\n` +
    `I have scheduled a group mentoring session on MNCConnect and would like you to join.\n\n` +
    `Topic: ${b.sessionType || "Mentoring session"}\n` +
    `Company: ${b.companyName}\n` +
    `Date & time: ${at}\n` +
    `Duration: ${durationLabel(b.durationMinutes)}\n` +
    `Your share: ${inr(b.perPersonAmount || b.amount)}\n\n` +
    `Join here: ${link}\n\n` +
    `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left, so please join before the session starts.\n\n` +
    `Regards,\n${hostName}`
  );
};

const InviteModal = ({ message, link, onClose }) => {
  const [copied, setCopied] = useState(null); // "msg" | "link"

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.Text(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this text", text);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: "Join my MNCConnect group session",
        text: message,
      });
    } catch {
      /* user cancelled */
    }
  };

  const option =
    "flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invite friends"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Invite your friends
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Each friend opens the link and pays their own share.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-sans text-xs leading-5 text-slate-600">
            {message}
          </pre>

          <div className="mt-4 space-y-2">
            <a
              className={option}
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            >
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Share on WhatsApp
            </a>

            <a
              className={option}
              href={`mailto:?subject=${encodeURIComponent(
                "Invitation: group mentoring session on MNCConnect",
              )}&body=${encodeURIComponent(message)}`}
            >
              <Mail className="h-5 w-5 text-blue-600" />
              Share by email
            </a>

            {typeof navigator !== "undefined" && navigator.share && (
              <button type="button" onClick={nativeShare} className={option}>
                <Share2 className="h-5 w-5 text-indigo-600" />
                More apps
              </button>
            )}

            <button
              type="button"
              onClick={() => copy(message, "msg")}
              className={option}
            >
              {copied === "msg" ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <Copy className="h-5 w-5 text-slate-500" />
              )}
              {copied === "msg" ? "Message copied" : "Copy invitation message"}
            </button>

            <button
              type="button"
              onClick={() => copy(link, "link")}
              className={option}
            >
              {copied === "link" ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <Copy className="h-5 w-5 text-slate-500" />
              )}
              {copied === "link" ? "Link copied" : "Copy link only"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const GroupInfo = ({ b, me }) => {
  const [open, setOpen] = useState(false);
  const closeInvite = useCallback(() => setOpen(false), []);

  if (b.mode !== "group") return null;

  // The server tells us if I am the host (b.isHost). The id compare is only a fallback.
  const isHost =
    typeof b.isHost === "boolean"
      ? b.isHost
      : Boolean(me) && String(b.hostId) === String(me);

  const members = b.members || [];
  const joined = members.length || 1;
  const spotsLeft = Math.max(0, (b.maxMembers || 0) - joined);

  const canInvite =
    isHost &&
    Boolean(b.inviteCode) &&
    ["pending", "accepted"].includes(b.status) &&
    spotsLeft > 0;

  const link = `${window.location.origin}/Home/join/${b.inviteCode}`;
  const hostName =
    members.find((m) => m.id === b.hostId)?.name || "Your friend";

  const shown = members.slice(0, NAMES_SHOWN).map((m) => m.name);
  const more = Math.max(0, members.length - NAMES_SHOWN);

  return (
    <div className="mx-5 mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:mx-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
          <Users className="h-4 w-4" />
          Group session · {joined}/{b.maxMembers} joined
          {isHost ? " · you are the host" : ""}
        </p>

        {canInvite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Share2 className="h-3.5 w-3.5" />
            Invite friends ({spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left)
          </button>
        )}
      </div>

      {shown.length > 0 && (
        <p className="mt-1.5 text-[11px] text-indigo-700">
          {shown.join(", ")}
          {more > 0 ? ` +${more} more` : ""}
        </p>
      )}

      {open && (
        <InviteModal
          message={inviteMessage(b, link, spotsLeft, hostName)}
          link={link}
          onClose={closeInvite}
        />
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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6 transition-opacity ease-out ${visible ? "opacity-100" : "opacity-0"
        }`}
      style={{ transitionDuration: `${MODAL_ANIM_MS}ms` }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full max-w-lg transform-gpu overflow-hidden rounded-2xl bg-white shadow-2xl transition ease-out will-change-transform ${visible
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
   EMPLOYEE DETAILS POPUP  -  FLIP CARD
   - FRONT: photo, verified badge, name, role • company, skills,
            rating, sessions, availability and a "View" button
   - BACK : (no name) role, company, rating / sessions / experience strip,
            about, skills, languages
   - flip uses transform only (GPU) -> smooth, no repaint
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

// array OR comma separated string -> clean string array
const toList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((s) =>
        typeof s === "string"
          ? s
          : s?.name || s?.skillName || s?.title || s?.label || "",
      )
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

  const ratings = (Array.isArray(rawReviews) ? rawReviews : [])
    .map((r) => Number(pick(r, ["rating", "stars", "score"])) || 0)
    .filter((n) => n > 0);

  const avg = ratings.length
    ? ratings.reduce((a, n) => a + n, 0) / ratings.length
    : Number(pick(p, ["rating", "averageRating", "avgRating"])) || 0;

  return {
    name: pick(p, ["name", "fullName"]) || "MNC Employee",
    image: pick(p, ["profilePic", "image", "avatar", "photo"]),
    role: pick(p, ["designation", "role", "jobTitle", "position"]),
    company: pick(p, ["companyName", "company", "organization"]),
    experience: pick(p, ["experience", "yearsOfExperience", "exp"]),
    sessions: pick(p, [
      "sessionsCompleted",
      "sessionsAttended",
      "totalSessions",
      "sessions",
    ]),
    about: pick(p, ["about", "bio", "description", "summary"]),
    skills: toList(pick(p, ["skills", "expertise", "topics"])),
    languages: toList(pick(p, ["languages", "language", "knownLanguages"])),
    avg,
  };
};

const fmtExperience = (exp) => {
  if (exp === "" || exp === null || exp === undefined) return "–";
  return /^\d+(\.\d+)?$/.test(String(exp).trim()) ? `${exp} yrs` : String(exp);
};

// common short names -> real slug used by the icon libraries
const SKILL_ALIAS = {
  html: "html5",
  css: "css3",
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  reactjs: "react",
  reactnative: "react",
  vuejs: "vuejs",
  mongo: "mongodb",
  postgres: "postgresql",
  k8s: "kubernetes",
  aws: "amazonwebservices",
  gcp: "googlecloud",
  golang: "go",
  dotnet: "dotnetcore",
  ml: "tensorflow",
  msexcel: "excel",
  powerbi: "powerbi",
};

const skillSlug = (name) => {
  const s = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/c\+\+/g, "cplusplus")
    .replace(/c#/g, "csharp")
    .replace(/\.net/g, "dotnet")
    .replace(/[^a-z0-9]/g, "");

  return SKILL_ALIAS[s] || s;
};

// Pick a sensible Lucide fallback for skills that do not have a brand logo.
// This also prevents the Skills section from crashing when a skill is unknown.
const skillStyle = (name) => {
  const value = String(name || "").toLowerCase();
  const icon =
    /react|angular|vue|frontend|front.end|html|css|javascript|typescript|ui|ux/.test(value)
      ? Code2
      : /python|java|c\+\+|c#|node|backend|programming|developer/.test(value)
        ? Terminal
        : /data|sql|database|mongo|postgres|analytics|power bi|excel/.test(value)
          ? Database
          : /cloud|aws|azure|gcp|devops|kubernetes/.test(value)
            ? Globe
            : /machine learning|\bml\b|ai|artificial intelligence|deep learning/.test(value)
              ? Atom
              : /communication|language|english|tamil|hindi/.test(value)
                ? Languages
                : /design|photoshop|figma|creative|graphic/.test(value)
                  ? Palette
                  : /leadership|management|team|strategy|problem solving|critical thinking/.test(value)
                    ? Target
                    : /award|certification|certified/.test(value)
                      ? Award
                      : /training|teaching|mentoring|coaching/.test(value)
                        ? UserCheck
                        : /hospitality|customer service|support/.test(value)
                          ? Coffee
                          : Code2;

  return {
    icon,
    ic: "text-slate-600",
    chip: "border-slate-200 text-slate-700",
  };
};

const SkillLogo = React.memo(function SkillLogo({ name, st }) {
  const slug = useMemo(() => skillSlug(name), [name]);
  const [stage, setStage] = useState(0);

  useEffect(() => setStage(0), [slug]);

  const urls = [
    `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`,
    `https://cdn.simpleicons.org/${slug}`,
  ];

  const FallbackIcon = st.icon;

  // no logo found anywhere -> use the lucide icon
  if (!slug || stage >= urls.length) {
    return <FallbackIcon size={13} className={st.ic} />;
  }

  return (
    <img
      src={urls[stage]}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      decoding="async"
      className="h-3.5 w-3.5 shrink-0 object-contain"
      onError={() => setStage((n) => n + 1)}
    />
  );
});
const EmployeeFlipCard = ({ d, onClose }) => {
  const [flipped, setFlipped] = useState(false);
  const [broken, setBroken] = useState(false);

  const letter = String(d.name || "?").trim().charAt(0).toUpperCase() || "?";
  const subtitle = [d.role, d.company].filter(Boolean).join(" • ");

  return (
    <div className="emp-scene h-[470px] w-full">
      <div className={`emp-flip ${flipped ? "is-flipped" : ""}`}>
        {/* ======================= FRONT ======================= */}
        <div
          className="emp-face flex flex-col overflow-hidden rounded-[28px] border-[3px] border-green-800 bg-white"
          style={{
            pointerEvents: flipped ? "none" : "auto",
            boxShadow: "0 24px 50px -24px rgba(15,23,42,.55)",
          }}
          aria-hidden={flipped}
        >
          {/* photo */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500">
            {d.image && !broken ? (
              <img
                src={d.image}
                alt={d.name}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setBroken(true)}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-8xl font-extrabold text-white/80">
                {letter}
              </span>
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg transition-colors hover:text-slate-900 active:scale-95"
            >
              <X size={18} />
            </button>

            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
              <Check size={12} className="text-emerald-600" />
              Verified employee
            </span>

            <div
              className="absolute inset-x-0 bottom-0 p-5"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,.7)" }}
            >
              <h2 className="truncate text-3xl font-extrabold text-white">
                {d.name}
              </h2>

              {subtitle && (
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {subtitle}
                </p>
              )}


            </div>
          </div>

          {/* bottom bar */}
          <div className="shrink-0 px-5 pb-5 pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xl font-extrabold text-amber-500">
                <Star size={18} className="fill-amber-400 text-amber-400" />
                {d.avg ? d.avg.toFixed(1) : "–"}
              </span>

              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {d.sessions || 0} sessions
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Available for 1:1
              </span>

              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-6 py-3 text-base font-bold text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-[0.97]"
              >
                View
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>


        {/* ======================= BACK ======================= */}
        <div
          className="emp-face emp-back flex flex-col overflow-hidden rounded-[28px] border-[3px] border-green-800 bg-gradient-to-b from-emerald-100/70 via-emerald-50 to-white"
          style={{
            pointerEvents: flipped ? "auto" : "none",
            boxShadow: "0 24px 50px -24px rgba(15,23,42,.45)",
          }}
          aria-hidden={!flipped}
        >
          {/* ---------- HEADER ---------- */}
          <div className="relative shrink-0 overflow-hidden px-5 pb-3 pt-4">
            <Building2
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-12 h-24 w-24 text-emerald-200/70"
              strokeWidth={1.1}
            />

            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-emerald-600/30">
                <Check size={12} />
                Verified employee
              </span>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm ring-1 ring-emerald-100 backdrop-blur transition-colors hover:bg-white hover:text-slate-900 active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-4 pr-16">
              <h3 className="truncate text-[28px] font-extrabold leading-tight text-slate-900">
                {d.name}
              </h3>

              {d.role && (
                <p className="mt-0.5 truncate text-sm font-medium capitalize text-slate-500">
                  {d.role}
                </p>
              )}

              {d.company && (
                <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <Building2 size={13} className="shrink-0 text-emerald-700" />
                  <span className="truncate">{d.company}</span>
                </p>
              )}
            </div>
          </div>

          {/* ---------- STATS (glass) ---------- */}
          <div className="shrink-0 px-4">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/80 bg-white/50 p-2 shadow-sm backdrop-blur">
              <div className="flex flex-col items-center rounded-xl bg-white py-2.5 shadow-sm">
                <span className="flex items-center gap-1 text-base font-extrabold text-slate-900">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {d.avg ? d.avg.toFixed(1) : "–"}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Rating
                </span>
              </div>

              <div className="flex flex-col items-center rounded-xl bg-white py-2.5 shadow-sm">
                <span className="text-base font-extrabold text-slate-900">
                  {d.sessions || 0}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Sessions
                </span>
              </div>

              <div className="flex flex-col items-center rounded-xl bg-white py-2.5 shadow-sm">
                <span className="text-base font-extrabold text-slate-900">
                  {fmtExperience(d.experience)}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Experience
                </span>
              </div>
            </div>
          </div>

          {/* ---------- CONTENT ---------- */}
          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* About */}
            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">
                <span className="h-4 w-1 rounded-full bg-emerald-600" />
                <Target size={13} className="text-emerald-700" />
                About
              </h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                {d.about || "No description added yet."}
              </p>
            </section>

            {/* Skills */}
            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">
                <span className="h-4 w-1 rounded-full bg-emerald-600" />
                Skills
              </h4>

              {d.skills.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {d.skills.map((s) => {
                    const st = skillStyle(s);

                    return (
                      <span
                        key={s}
                        className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm ${st.chip}`}
                      >
                        <SkillLogo name={s} st={st} />
                        {s}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No skills added yet.</p>
              )}
            </section>

            {/* Languages */}
            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">
                <span className="h-4 w-1 rounded-full bg-emerald-600" />
                Languages
              </h4>

              {d.languages.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {d.languages.map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      <Globe size={13} className="text-slate-400" />
                      {l}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">–</p>
              )}
            </section>
          </div>

          {/* ---------- FOOTER ---------- */}
          <div className="shrink-0 px-4 pb-4 pt-2">
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-3.5 text-sm font-bold text-white transition hover:brightness-105 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #0f9d78 0%, #1db38d 50%, #0b8a68 100%)",
                boxShadow:
                  "0 12px 24px -8px rgba(11,138,104,.65), inset 0 0 0 1.5px rgba(255,255,255,.45), inset 0 2px 6px rgba(255,255,255,.35), inset 0 -8px 14px rgba(0,70,50,.28)",
              }}
            >
              {/* top gloss */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/40 to-transparent"
              />
              {/* diagonal streak */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[18%] top-0 h-full w-8 -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
              />
              {/* corner glint */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -right-3 h-9 w-9 rotate-45 bg-white/35 blur-[3px]"
              />

              <ArrowLeft size={18} className="relative" />
              <span className="relative" style={{ textShadow: "0 1px 2px rgba(0,60,40,.45)" }}>
                Back
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmployeeDetailsModal = ({ title = "Details", fetcher, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false); // open animation finished
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const closingRef = useRef(false);
  const fetcherRef = useRef(fetcher);

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

  const d = ready ? state.data : null;
  const showLoader = !ready || state.loading;

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
        .emp-scene { perspective: 1400px; position: relative; }
        .emp-flip {
          position: relative; width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform 650ms cubic-bezier(.4, .15, .2, 1);
          will-change: transform;
        }
        .emp-flip.is-flipped { transform: rotateY(180deg); }
        .emp-face {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .emp-back { transform: rotateY(180deg); }
        .emp-in { animation: emp-fade 220ms ease-out both; }
        @keyframes emp-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .emp-flip { transition-duration: 1ms; }
          .emp-in { animation: none; }
        }
      `}</style>

      <div
        className="relative w-full max-w-[350px]"
        style={{
          transform: visible
            ? "translate3d(0,0,0) scale(1)"
            : "translate3d(0,22px,0) scale(.97)",
          transitionProperty: "transform",
          transitionDuration: `${DETAILS_ANIM_MS}ms`,
          transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
          willChange: "transform",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {showLoader && (
          <div className="flex h-[470px] items-center justify-center rounded-[28px] bg-white shadow-2xl">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          </div>
        )}

        {ready && state.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-2xl">
            {state.error}
          </div>
        )}

        {d && (
          <div className="emp-in relative">
            <EmployeeFlipCard d={d} onClose={close} />
          </div>
        )}
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
                  <b className="truncate font-bold text-[indigo]">{range}</b>

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
      <ReasonModal open={reasonModalOpen} text={reason} onClose={closeReason} />
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
      .catch(() => { });
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

    const b = bookings.find((x) => String(x.requestGroupId) === String(id));

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
            ? "Waiting for your employee"
            : "Waiting for an employee",
          tone: "amber",
          expires: new Date(b.expiresAt).getTime(),
          starts,
        };
      }

      // Invalid/missing schedule data must not be shown as a joinable session.
      if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts) {
        return { key: "past" };
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
      .filter(({ v }) => v.key === "pending" || v.key === "confirmed")
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
  const shouldScroll = upcoming.length > 1;
  const liveCount = useMemo(
    () => decorated.filter(({ v }) => v.key === "open").length,
    [decorated],
  );
  useEffect(() => {
  const shouldLockScroll = upcoming.length <= 1;

  const html = document.documentElement;
  const body = document.body;

  const previousHtmlOverflow = html.style.overflow;
  const previousBodyOverflow = body.style.overflow;

  if (shouldLockScroll) {
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
  }

  return () => {
    html.style.overflow = previousHtmlOverflow;
    body.style.overflow = previousBodyOverflow;
  };
}, [upcoming.length]);

  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 pb-6 sm:px-6 lg:px-8 ${shouldScroll ? "" : "overflow-hidden"
        }`}
    >
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
              <CalendarDays size={16} className="shrink-0 text-indigo-500" />

              <span className="truncate">Booking sessions</span>

              <span aria-hidden="true" className="h-4 w-px bg-slate-200" />

              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"
                  }`}
              >
                <Radio size={12} />
                {connected ? "Live" : "Reconnecting..."}
              </span>
            </div>

            <span className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              {showSkeleton ? "Upcoming" : `Upcoming (${upcoming.length})`}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-slate-50 to-transparent"
        />
      </div>

      <div className="mx-auto max-w-6xl">
        <div aria-hidden="true" style={{ height: BAR_H + 8 }} />

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
            <button onClick={reload} className="ml-2 font-semibold underline">
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
          <div
            className={`space-y-5 ${shouldScroll ? "" : "overflow-hidden"
              }`}
          >
            {upcoming.map(({ b, v }) => (
              <BookingCard
                key={b.requestGroupId}
                b={b}
                v={v}
                me={userId}
                unread={unreadCounts[String(b.requestGroupId)] || 0}
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
            chatFor.mentor?.profilePic || chatFor.mentor?.image || ""
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

      {/* EMPLOYEE DETAILS MODAL (flip card, defined above) */}

      {detailsFor && (
        <EmployeeDetailsModal
          key={detailsFor.requestGroupId}
          title="MncEmployee details"
          fetcher={() =>
            api(`${ENDPOINTS.booking(detailsFor.requestGroupId)}/counterpart`)
          }
          onClose={closeDetails}
        />
      )}
    </div>
  );
};

export default MyBookings;

// Shared employee flip-card popup used by the Meetings page.
export { EmployeeDetailsModal };
