// src/FresherDashboard/pages/Fresher_mettings.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Video,
  Building2,
  UserRound,
  CalendarDays,
  Clock3,
  ArrowRight,
  Radio,
  Inbox,
  CheckCircle2,
  Star,
  RotateCcw,
  Send,
  UserCheck,
  Check,
  X,
  Users,
  Copy,
  Loader2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Headset,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import ReviewModal from "./Reviewmodal";
import { EmployeeDetailsModal } from "./FresherBookings";
import { socket } from "../../utils/socket";
import {
  JOIN_OPEN_MS,
  FINAL_WARNING_MS,
  TIMER_POLL_MS,
  liveRemaining,
  hasTimerFinished,
  isPollWindow,
} from "../../utils/sessionTiming";
import {
  api,
  ENDPOINTS,
  EVENTS,
  getUserId,
  durationLabel,
  fmtClock,
  inr,
} from "../../services/fresherApi";

const IST = "Asia/Kolkata";
const CLOSED_REBOOK_MS = 24 * 60 * 60 * 1000;

// Height of your top navbar in px. Check it in DevTools and change if needed.
// The page fills exactly (screen height - NAV_H), so there is no gap at the bottom.
const NAV_H = 68;

// Tabs allowed in the URL (?tab=live | cancelled | completed)
const VALID_TABS = ["live", "cancelled", "completed"];

const fmtTimeIST = (ms) =>
  Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString("en-IN", {
        timeZone: IST,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

/* ---------- IST date-key helpers ("YYYY-MM-DD") ---------- */
const pad = (n) => String(n).padStart(2, "0");
const istKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: IST });
};
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const SKIP_STATUSES = [
  "completed",
  "awaiting_confirmation",
  "disputed",
  "pending",
  "expired",
  "missed",
  "cancelled",
];
const DONE_STATUSES = ["completed", "awaiting_confirmation", "disputed"];
const REFUND_STATUSES = ["disputed", "expired", "missed", "cancelled"];

const CANCEL_LABEL = {
  missed: "Missed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
};

const isGroupFriendOf = (b, userId) =>
  b.mode === "group" && String(b.hostId) !== String(userId);

const TONES = {
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

// Rebook / details permissions (shared by Completed popup and Cancelled cards)
const rebookInfo = (b, v) => {
  const sessionHappened =
    ["completed", "awaiting_confirmation"].includes(b.status) ||
    v.key === "done";
  const closedRebook =
    ["missed", "cancelled"].includes(b.status) &&
    Boolean(b.mentor?.id) &&
    (!b.closedAt ||
      Date.now() - new Date(b.closedAt).getTime() < CLOSED_REBOOK_MS);
  return {
    canRebook: Boolean(b.mentor?.id) && (sessionHappened || closedRebook),
    canSeeMentor: Boolean(b.mentor?.id),
  };
};

// What to show about the money for a missed / cancelled / expired / disputed meeting
const refundBadge = (b) => {
  if (b.refundStatus === "review")
    return {
      tone: "amber",
      spin: true,
      text: "Under review. Money is on hold",
    };
  if (b.refundStatus === "refunded")
    return b.noShowBy === "fresher"
      ? {
          tone: "emerald",
          text: "Settled: no-show fee charged, rest added to wallet",
        }
      : { tone: "emerald", text: "Refunded to your wallet" };
  if (b.refundStatus === "failed")
    return { tone: "amber", spin: true, text: "Refund retrying..." };
  return { tone: "amber", spin: true, text: "Refund processing..." };
};

const BADGE_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

/* ---------- BOOKING STEPPER (vertical, used in Completed popup) ---------- */
const STEPS = [
  { label: "Requested", icon: Send },
  { label: "Accepted", icon: UserCheck },
  { label: "Session", icon: Video },
  { label: "Completed", icon: CheckCircle2 },
];

const FAIL_LABEL = { 1: "Not accepted", 2: "Missed", 3: "Disputed" };

const failIndex = (b) => {
  if (b.status === "disputed") return 3;
  if (b.status === "missed") return 2;
  if (!b.mentor?.id) return 1;
  return 2;
};

const progressOf = (b, v) => {
  switch (v.key) {
    case "ended":
      return { active: 3 };
    case "review":
      return { active: 3, attention: true };
    case "done":
      return { active: 4 };
    case "refunded":
      return { active: failIndex(b), failAt: failIndex(b) };
    default:
      return { active: 0 };
  }
};

const BookingStepper = ({ b, v, onReview }) => {
  const { active, attention, failAt } = progressOf(b, v);
  const failed = failAt !== undefined;

  const startMs = new Date(b.startsAt).getTime();
  const endMs = new Date(b.endsAt).getTime();
  const range =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
      : b.time;

  return (
    <div className="w-full max-w-2xl mx-auto py-2">
      <ol
        className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-2"
        aria-label="Booking progress"
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isFailed = failed && i === failAt;
          const isDone = failed ? i < failAt : i < active;
          const isCurrent = !failed && i === active && active < STEPS.length;

          const circle = isFailed
            ? "bg-red-500 text-white ring-4 ring-white"
            : isDone
              ? "bg-blue-600 text-white ring-4 ring-white"
              : isCurrent
                ? attention
                  ? "bg-red-500 text-white ring-4 ring-white shadow-md"
                  : "bg-blue-600 text-white ring-4 ring-white shadow-md"
                : "bg-white text-blue-300 border-2 border-blue-200 ring-4 ring-white";

          const labelCls = isFailed
            ? "text-red-600"
            : isDone || isCurrent
              ? "text-slate-900"
              : "text-slate-400";

          const label = isFailed ? FAIL_LABEL[i] || step.label : step.label;

          let rightContent = null;

          if (i === 0) {
            rightContent = (
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-800">
                  You
                </span>
                <span className="text-[11px] text-slate-500">
                  Paid {inr(b.amount)}
                </span>
              </div>
            );
          } else if (i === 1) {
            rightContent = b.mentor?.name ? (
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-slate-800">
                  {b.mentor.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  Accepted request
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Waiting to accept</span>
            );
          } else if (i === 2) {
            rightContent = (
              <div className="flex flex-col items-end gap-1 text-xs">
                {isDone || isCurrent ? (
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <Video className="h-3.5 w-3.5" /> Attended
                  </span>
                ) : (
                  <span className="text-slate-400">Not attended</span>
                )}
                <span className="text-[10px] text-slate-400">
                  {b.date} · {range}
                </span>
              </div>
            );
          } else if (i === 3) {
            rightContent = (
              <div className="flex flex-col items-end gap-2">
                {v.key === "done" && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                  </span>
                )}
                {v.key === "review" && (
                  <button
                    type="button"
                    onClick={() => onReview && onReview(b)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 shadow-sm transition-colors"
                  >
                    <Star className="h-3.5 w-3.5" /> Write review
                  </button>
                )}
                {v.key === "refunded" && (
                  <span
                    className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border shadow-sm ${
                      b.refundStatus === "refunded"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-amber-700 bg-amber-50 border-amber-200"
                    }`}
                  >
                    {b.refundStatus === "refunded" ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Refunded
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refund
                        processing...
                      </>
                    )}
                  </span>
                )}
                {v.key === "ended" && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Awaiting
                    confirmation
                  </span>
                )}
              </div>
            );
          }

          return (
            <li key={step.label} className="relative pl-8">
              <span
                className={`absolute -left-[17px] top-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circle}`}
              >
                {isFailed ? (
                  <X className="h-4 w-4" />
                ) : isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mt-1.5">
                <div className="shrink-0">
                  <span className={`text-sm font-semibold ${labelCls}`}>
                    {label}
                  </span>
                </div>
                <div className="flex flex-1 justify-end sm:text-right">
                  {rightContent}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/* ---------- HORIZONTAL STEPPER (used in Cancelled cards) ---------- */
const HorizontalStepper = ({ b, v }) => {
  const { active, failAt } = progressOf(b, v);
  const failed = failAt !== undefined;
  const reached = failed ? failAt : active;

  const failLabel = FAIL_LABEL[failAt];

  const subText = [
    `Paid ${inr(b.amount)}`,
    b.mentor?.name || "",
    failAt === 2
      ? CANCEL_LABEL[b.status] || "Not attended"
      : failAt === 3
        ? b.date
        : "",
    failAt === 3 ? "Under review" : "",
  ];

  return (
    <div className="flex w-full items-start" aria-label="Booking progress">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === STEPS.length - 1;
        const isFailed = failed && i === failAt;
        const isDone = i < reached;
        const isCurrent = !failed && i === reached;

        const circle = isFailed
          ? "bg-red-500 text-white ring-4 ring-white"
          : isDone
            ? "bg-blue-600 text-white ring-4 ring-white"
            : isCurrent
              ? "bg-blue-600 text-white ring-4 ring-white shadow-md"
              : "bg-white text-blue-300 border-2 border-blue-200 ring-4 ring-white";

        const labelCls = isFailed
          ? "text-red-600"
          : isDone || isCurrent
            ? "text-slate-900"
            : "text-slate-400";

        const label = isFailed ? failLabel || step.label : step.label;
        const sub = subText[i];

        return (
          <div
            key={step.label}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
          >
            {/* connector to next step */}
            {!isLast && (
              <span
                className={`absolute left-1/2 top-4 h-0.5 w-full ${i < reached ? "bg-blue-600" : "bg-slate-200"}`}
              />
            )}

            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${circle}`}
            >
              {isFailed ? (
                <X className="h-4 w-4" />
              ) : isDone ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>

            <span
              className={`mt-2 text-[11px] font-semibold sm:text-xs ${labelCls}`}
            >
              {label}
            </span>
            <span className="mt-0.5 min-h-[14px] max-w-full truncate px-1 text-[10px] text-slate-400">
              {sub}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- GROUP badge: joined count + invite link (host only) ---------- */
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
          <Users className="h-4 w-4" /> Group session · {members.length || 1}/
          {b.maxMembers} joined
          {isHost ? " · you are the host" : ""}
        </p>
        {canInvite && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Copy className="h-3.5 w-3.5" />{" "}
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

/* ---------- COMPLETED SESSIONS CALENDAR ---------- */
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PastCalendar = ({ meetingsByDate, selectedKey, onSelect }) => {
  const todayKey = istKey(Date.now());
  const [ty, tm] = todayKey.split("-").map(Number);

  const [view, setView] = useState({ year: ty, month: tm - 1 });
  const { year, month } = view;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const atCurrentMonth = year === ty && month === tm - 1;

  const monthTotal = Array.from({ length: daysInMonth }, (_, i) =>
    keyOf(year, month, i + 1),
  ).reduce((sum, k) => sum + (meetingsByDate[k]?.length || 0), 0);

  const goPrev = () =>
    setView(({ year: y, month: m }) =>
      m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 },
    );
  const goNext = () =>
    setView(({ year: y, month: m }) =>
      m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 },
    );

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">{monthLabel}</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {monthTotal} {monthTotal === 1 ? "session" : "sessions"} this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={atCurrentMonth}
            onClick={goNext}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs"
          >
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;

          const key = keyOf(year, month, day);
          const count = meetingsByDate[key]?.length || 0;
          const hasMeeting = count > 0;
          const isFuture = key > todayKey;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;

          let cls =
            "relative flex aspect-square w-full items-center justify-center rounded-2xl text-sm font-semibold transition sm:text-base ";

          if (isFuture) {
            cls += "cursor-not-allowed text-slate-300";
          } else if (hasMeeting) {
            cls += isSelected
              ? "bg-blue-700 text-white shadow-lg ring-4 ring-blue-200"
              : "bg-blue-600 text-white shadow-md hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg";
          } else {
            cls += "cursor-default bg-white/70 text-slate-600";
          }

          if (isToday && !hasMeeting)
            cls += " ring-2 ring-blue-500 text-blue-700";
          if (isToday && hasMeeting)
            cls += " ring-2 ring-offset-2 ring-blue-400";

          return (
            <button
              key={key}
              type="button"
              disabled={isFuture || !hasMeeting}
              onClick={() => onSelect(key)}
              className={cls}
            >
              {day}
              {hasMeeting && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-blue-700 shadow ring-1 ring-blue-200">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-md bg-blue-600" /> Has sessions
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-md ring-2 ring-blue-500" /> Today
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-md bg-slate-200" /> No sessions
        </span>
      </div>
    </div>
  );
};

/* ---------- Meeting card (vertical stepper) - used in Completed popup ---------- */
const MeetingCard = ({ b, v, me, onReview, onDetails, onRebook }) => {
  const startMs = new Date(b.startsAt).getTime();
  const endMs = new Date(b.endsAt).getTime();
  const range =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
      : b.time;
  const { canRebook, canSeeMentor } = rebookInfo(b, v);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            {b.mode === "group" ? (
              <Users className="h-6 w-6 text-blue-600" />
            ) : (
              <Video className="h-6 w-6 text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[v.tone]}`}
              >
                {v.label}
              </span>
              {b.mode === "group" ? (
                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Group session
                </span>
              ) : (
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                  1:1 Session
                </span>
              )}
            </div>
            <div className="mt-1 grid gap-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {b.companyName}
              </span>
              <span className="flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                {b.mentor?.name || "Employee"}
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {b.date}
              </span>
              <span className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                {range} · {durationLabel(b.durationMinutes)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <GroupInfo b={b} me={me} />

      <div className="mx-3 mb-4 mt-auto px-2">
        <BookingStepper b={b} v={v} onReview={onReview} />
      </div>

      <div className="mb-4 flex w-full flex-col gap-2 px-5">
        {canSeeMentor && (
          <button
            type="button"
            onClick={() => onDetails(b)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <UserRound className="h-3.5 w-3.5" /> Employee Profile
          </button>
        )}
        {canRebook && (
          <button
            type="button"
            onClick={() => onRebook(b)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Book again
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------- CANCELLED CARD (rectangle, horizontal stepper) ---------- */
const CancelledCard = ({ b, v, me, onDetails, onRebook }) => {
  const startMs = new Date(b.startsAt).getTime();
  const endMs = new Date(b.endsAt).getTime();
  const range =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
      : b.time;
  const { canRebook, canSeeMentor } = rebookInfo(b, v);
  const refund = refundBadge(b);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Top info row */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            {b.mode === "group" ? (
              <Users className="h-5 w-5 text-blue-600" />
            ) : (
              <Video className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{b.companyName}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {b.mentor?.name || "No employee assigned"}
              </span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {b.date} · {range}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
            {CANCEL_LABEL[b.status] || "Cancelled"}
          </span>
          {b.mode === "group" ? (
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Group session
            </span>
          ) : (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
              1:1 Session
            </span>
          )}
        </div>
      </div>

      {/* Group info (only for group sessions) */}
      {b.mode === "group" && (
        <div className="pt-4">
          <GroupInfo b={b} me={me} />
        </div>
      )}

      {/* Horizontal stepper */}
      <div className="px-4 pb-2 pt-5">
        <HorizontalStepper b={b} v={v} />
      </div>

      {/* Footer: refund status + actions */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${BADGE_TONES[refund.tone]}`}
        >
          {refund.spin ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {refund.text}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {canSeeMentor && (
            <button
              type="button"
              onClick={() => onDetails(b)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <UserRound className="h-3.5 w-3.5" /> Employee Profile
            </button>
          )}
          {canRebook && (
            <button
              type="button"
              onClick={() => onRebook(b)}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Book again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- COMPLETED MEETINGS MODAL (calendar date popup) ---------- */
const PastMeetingsModal = ({
  isOpen,
  onClose,
  date,
  meetings,
  me,
  onReview,
  onDetails,
  onRebook,
}) => {
  if (!isOpen || !date) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Completed Meetings
            </h2>
            <p className="mt-0.5 text-sm font-medium text-blue-600">
              {date.toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {meetings.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <Inbox className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-500">
                No meetings found on this date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {meetings.map(({ b, v }) => (
                <MeetingCard
                  key={b.requestGroupId}
                  b={b}
                  v={v}
                  me={me}
                  onReview={onReview}
                  onDetails={onDetails}
                  onRebook={onRebook}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- PAGE ---------- */
const FresherMeetings = () => {
  const navigate = useNavigate();
  const userId = useMemo(() => getUserId(), []);
  const [now, setNow] = useState(Date.now());

  // Active tab lives in the URL (?tab=live|cancelled|completed) so a refresh keeps it
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const tab = VALID_TABS.includes(urlTab) ? urlTab : "live";

  const setTab = (k) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", k);
        return next;
      },
      { replace: true },
    );
  };

  const [timers, setTimers] = useState({});
  const [finishedIds, setFinishedIds] = useState({});
  const [justFinished, setJustFinished] = useState(0);
  const [dismissedReview, setDismissedReview] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [detailsFor, setDetailsFor] = useState(null);

  const [selectedKey, setSelectedKey] = useState(null);
  const [isPastModalOpen, setIsPastModalOpen] = useState(false);

  const wasRunningRef = useRef({});

  // Lock the PAGE scroll on this screen. Only the lists inside scroll.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const { data, loading, error, connected, reload } = useLive({
    fetcher: () => api(ENDPOINTS.myBookings),
    events: [EVENTS.booking, EVENTS.reminder],
    pollMs: 10000,
    userId,
  });

  const bookings = data?.bookings || [];
  const bookingsRef = useRef([]);
  bookingsRef.current = bookings;
  const showSkeleton = loading && !data;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const markFinished = (ids) => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length) return;
    setFinishedIds((prev) => {
      const next = { ...prev };
      let changed = false;
      list.forEach((id) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setJustFinished((n) => n + list.length);
    reload();
    setTimeout(reload, 2000);
  };

  useEffect(() => {
    const fromList = {};
    bookings.forEach((b) => {
      if (typeof b.remainingMs === "number") {
        const running = Boolean(b.timerRunning);
        if (running) wasRunningRef.current[b.requestGroupId] = true;
        fromList[b.requestGroupId] = {
          remainingMs: b.remainingMs,
          running,
          at: Date.now(),
        };
      }
    });
    if (Object.keys(fromList).length)
      setTimers((prev) => ({ ...prev, ...fromList }));
  }, [data]);

  const activeIds = useMemo(
    () =>
      bookings
        .filter((b) => !SKIP_STATUSES.includes(b.status))
        .map((b) => b.requestGroupId)
        .join(","),
    [bookings],
  );

  useEffect(() => {
    if (!activeIds) return undefined;
    const ids = activeIds.split(",");
    let cancelled = false;

    const fetchTimers = async () => {
      const nowTs = Date.now();
      const due = ids.filter((id) => {
        const b = bookingsRef.current.find((x) => x.requestGroupId === id);
        return b && isPollWindow(b.startsAt, b.endsAt, nowTs);
      });
      if (!due.length) return;

      const results = {};
      const done = [];

      await Promise.all(
        due.map(async (id) => {
          try {
            const d = await api(ENDPOINTS.booking(id));
            if (!d?.booking) return;
            const running = Boolean(d.booking.timerRunning);
            const remaining = d.booking.remainingMs;
            if (running) wasRunningRef.current[id] = true;
            results[id] = { remainingMs: remaining, running, at: Date.now() };
            if (
              DONE_STATUSES.includes(d.booking.status) ||
              hasTimerFinished(wasRunningRef.current[id], running, remaining)
            ) {
              done.push(id);
            }
          } catch {}
        }),
      );

      if (cancelled) return;
      setTimers((prev) => ({ ...prev, ...results }));
      if (done.length) markFinished(done);
    };

    fetchTimers();
    const t = setInterval(fetchTimers, TIMER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeIds]);

  useEffect(() => {
    const onTimer = (p) => {
      const id = p?.requestGroupId || p?.bookingId;
      if (!id || typeof p.remainingMs !== "number") return;
      const running = Boolean(p.running);
      if (running) wasRunningRef.current[id] = true;
      setTimers((prev) => ({
        ...prev,
        [id]: { remainingMs: p.remainingMs, running, at: Date.now() },
      }));
      if (
        hasTimerFinished(wasRunningRef.current[id], running, p.remainingMs)
      ) {
        markFinished(id);
      }
    };
    socket.on("meeting:timer", onTimer);
    socket.on("meeting:state", onTimer);
    return () => {
      socket.off("meeting:timer", onTimer);
      socket.off("meeting:state", onTimer);
    };
  }, []);

  const leftOf = (b) =>
    finishedIds[b.requestGroupId]
      ? null
      : liveRemaining(timers[b.requestGroupId], now);

  useEffect(() => {
    const newly = [];
    bookings.forEach((b) => {
      const id = b.requestGroupId;
      if (finishedIds[id] || SKIP_STATUSES.includes(b.status)) return;
      const l = liveRemaining(timers[id], now);
      if (l !== null && l <= 0) newly.push(id);
    });
    if (newly.length) markFinished(newly);
  }, [now]);

  const isLive = (b) => {
    if (SKIP_STATUSES.includes(b.status)) return false;
    if (finishedIds[b.requestGroupId]) return false;
    const starts = new Date(b.startsAt).getTime();
    const ends = new Date(b.endsAt).getTime();
    const left = liveRemaining(timers[b.requestGroupId], now);
    if (left !== null && left > 0) return true;
    return now >= starts - JOIN_OPEN_MS && now < ends;
  };

  const pastView = (b) => {
    const ends = new Date(b.endsAt).getTime();
    const noReviewNeeded = b.reviewed || isGroupFriendOf(b, userId);

    if (REFUND_STATUSES.includes(b.status))
      return { key: "refunded", label: "Refunded", tone: "slate" };
    if (DONE_STATUSES.includes(b.status) || finishedIds[b.requestGroupId]) {
      return noReviewNeeded
        ? { key: "done", label: "Completed", tone: "emerald" }
        : { key: "review", label: "Review required", tone: "red" };
    }
    if (b.status === "pending") return null;
    if (Number.isFinite(ends) && now >= ends)
      return { key: "ended", label: "Meeting ended", tone: "slate" };
    return null;
  };

  const meetings = useMemo(
    () =>
      bookings
        .filter(isLive)
        .sort(
          (a, c) =>
            new Date(a.startsAt).getTime() - new Date(c.startsAt).getTime(),
        ),
    [bookings, now, timers, finishedIds],
  );

  const past = useMemo(
    () =>
      bookings
        .filter((b) => !isLive(b))
        .map((b) => ({ b, v: pastView(b) }))
        .filter(({ v }) => v)
        .sort(
          (x, y) =>
            new Date(y.b.startsAt).getTime() - new Date(x.b.startsAt).getTime(),
        ),
    [bookings, now, timers, finishedIds],
  );

  // COMPLETED tab -> everything that is not a refund case (shown in calendar)
  const completed = useMemo(
    () => past.filter(({ v }) => v.key !== "refunded"),
    [past],
  );

  // CANCELLED tab -> EVERY missed / cancelled / expired / disputed meeting.
  // (Refunded ones stay here too, with a "Refunded" badge. They are cleaned up
  //  by the server after CLOSED_RETENTION_HOURS.)
  const cancelled = useMemo(
    () => past.filter(({ v }) => v.key === "refunded"),
    [past],
  );

  const refundPendingCount = cancelled.filter(
    ({ b }) => b.refundStatus !== "refunded",
  ).length;

  const needsReview = past.find(
    ({ v, b }) => v.key === "review" && b.requestGroupId !== dismissedReview,
  )?.b;

  // Group COMPLETED meetings by IST date key ("YYYY-MM-DD")
  const meetingsByDate = useMemo(() => {
    const map = {};
    completed.forEach((item) => {
      const key = istKey(item.b.startsAt);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [completed]);

  const selectedMeetings = selectedKey ? meetingsByDate[selectedKey] || [] : [];

  const bookAgain = (b) => {
    const company = b.companyName || b.mentor?.company;
    if (!company || !b.mentor?.id) return;
    navigate(`/Home/sessionboard/${encodeURIComponent(company)}`, {
      state: {
        rebook: {
          mentorId: b.mentor.id,
          mentorName: b.mentor.name,
          companyName: company,
        },
      },
    });
  };

  // "Write review" click -> close popup, open ReviewModal for that booking
  const handleReviewClick = (b) => {
    setIsPastModalOpen(false);
    setReviewTarget(b);
  };

  const handleDateSelect = (key) => {
    setSelectedKey(key);
    setIsPastModalOpen(true);
  };

  const reviewBooking = reviewTarget || needsReview;

  const tabs = [
    ["live", `Meetings (${meetings.length})`],
    ["cancelled", `Cancelled (${cancelled.length})`],
    ["completed", `Completed (${completed.length})`],
  ];

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
      style={{ height: `calc(100dvh - ${NAV_H}px)` }}
    >
      {/* Width is ALWAYS max-w-7xl so the header never moves between tabs */}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
        {/* ===== FIXED HEADER (never changes) ===== */}
        <div className="relative z-40 mb-2 flex shrink-0 flex-wrap items-end justify-between gap-3 bg-slate-50 pb-4 pt-3 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-4 after:h-4 after:bg-gradient-to-b after:from-slate-50 after:to-transparent">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Headset size={16} className="shrink-0 text-indigo-500" />

            <span className="truncate text-sm font-medium text-slate-700">
              Meetings
            </span>

            <span className="mx-1 h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              <Radio
                size={12}
                className={`shrink-0 ${connected ? "text-emerald-500" : "text-amber-500"}`}
              />
              <span
                className={`text-xs font-medium ${
                  connected ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {connected ? "Live" : "Reconnecting..."}
              </span>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {/* One sliding active pill: no remount or page reload on tab clicks. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-lg bg-blue-600 shadow-sm transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                transform: `translateX(${Math.max(0, VALID_TABS.indexOf(tab)) * 100}%)`,
              }}
            />
            {tabs.map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => {
                  if (tab !== k) setTab(k);
                }}
                className={`relative z-10 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 sm:px-4 motion-reduce:transition-none ${
                  tab === k
                    ? "text-white"
                    : "text-slate-600 hover:bg-slate-100/80"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes meetingsTabEnter {
            from { opacity: 0; transform: translate3d(0, 8px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          .meetings-tab-enter {
            animation: meetingsTabEnter 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
            will-change: opacity, transform;
          }
          .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
          .no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
          @media (prefers-reduced-motion: reduce) {
            .meetings-tab-enter { animation: none; }
          }
        `}</style>

        {/* ===== ONLY THIS AREA CHANGES BETWEEN TABS (fills all remaining height) ===== */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {error && (
            <div className="mb-4 shrink-0 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}{" "}
              <button onClick={reload} className="ml-2 font-semibold underline">
                Retry
              </button>
            </div>
          )}

          <div
            key={tab}
            className="meetings-tab-enter flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {justFinished > 0 && tab === "live" && (
              <button
                type="button"
                onClick={() => {
                  setTab("completed");
                  setJustFinished(0);
                }}
                className="mb-4 flex w-full shrink-0 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Session finished. See it
                  in Completed
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {showSkeleton ? (
              <div className="h-40 shrink-0 animate-pulse rounded-3xl bg-slate-200" />
            ) : tab === "live" ? (
              /* ============== MEETINGS TAB ============== */
              meetings.length === 0 ? (
                <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <Inbox className="h-8 w-8 text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">
                    No meetings open right now
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Your session shows here 20 minutes before it starts.
                  </p>
                  <Link
                    to="/Home/my-bookings"
                    className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Go to My Bookings
                  </Link>
                </div>
              ) : (
                <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4">
                  {meetings.map((b) => {
                    const left = leftOf(b);
                    const live = left !== null && left > 0;
                    const warn = live && left <= FINAL_WARNING_MS;
                    const startMs = new Date(b.startsAt).getTime();
                    const endMs = new Date(b.endsAt).getTime();
                    const range = `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`;

                    return (
                      <div
                        key={b.requestGroupId}
                        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-lg font-bold text-slate-900">
                                {b.sessionType || "Mentoring session"}
                              </h2>
                              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                {live ? "In progress" : "Meeting open"}
                              </span>
                              {b.mode === "group" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                                  <Users className="h-3.5 w-3.5" /> Group session
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                  <Video className="h-3.5 w-3.5" /> 1:1 Session
                                </span>
                              )}
                            </div>
                            <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                              <span className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-400" />
                                {b.companyName}
                              </span>
                              <span className="flex items-center gap-2">
                                <UserRound className="h-4 w-4 text-slate-400" />
                                {b.mentor?.name || "Employee"}
                              </span>
                              <span className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                {b.date}
                              </span>
                              <span className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-slate-400" />
                                {range} · {durationLabel(b.durationMinutes)}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-auto">
                            {b.mentor?.id && (
                              <button
                                type="button"
                                onClick={() => setDetailsFor(b)}
                                className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                              >
                                <UserRound className="h-4 w-4" />
                                Employee Profile
                              </button>
                            )}

                            <Link
                              to={`/Home/meeting/${b.requestGroupId}`}
                              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 lg:w-56"
                            >
                              <Video className="h-4 w-4" />
                              {live ? "Rejoin meeting" : "Join meeting"}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>

                        <GroupInfo b={b} me={userId} />

                        <div
                          className={`mx-5 mb-5 flex items-center justify-between gap-4 rounded-xl border p-3 sm:mx-6 ${
                            live
                              ? warn
                                ? "border-amber-200 bg-amber-50"
                                : "border-emerald-200 bg-emerald-50"
                              : "border-blue-200 bg-blue-50"
                          }`}
                        >
                          <div>
                            <p
                              className={`text-xs font-semibold ${live ? (warn ? "text-amber-800" : "text-emerald-800") : "text-blue-800"}`}
                            >
                              {live
                                ? warn
                                  ? "Final 5 minutes"
                                  : "Session in progress"
                                : "Session starts soon"}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {live
                                ? `Time left · ${range}`
                                : `Starts at ${fmtTimeIST(startMs)}`}
                            </p>
                          </div>
                          <div
                            className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums ${
                              live
                                ? warn
                                  ? "bg-amber-200 text-amber-900"
                                  : "bg-emerald-200 text-emerald-900"
                                : "bg-blue-200 text-blue-900"
                            }`}
                          >
                            {live
                              ? fmtClock(left)
                              : fmtClock(Math.max(0, startMs - now))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : tab === "cancelled" ? (
              /* ============== CANCELLED TAB (all missed / cancelled / expired / disputed) ============== */
              cancelled.length === 0 ? (
                <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <Inbox className="h-8 w-8 text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">
                    No cancelled meetings
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Missed, cancelled, expired or reported meetings show here
                    with their refund status.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {refundPendingCount > 0 ? (
                    <div className="mb-4 flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      Refund is being processed for {refundPendingCount}{" "}
                      {refundPendingCount === 1 ? "meeting" : "meetings"}.
                    </div>
                  ) : (
                    <div className="mb-4 flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      All refunds are done. The money is in your wallet.
                    </div>
                  )}

                  {/* ROW FORMAT: 2 boxes per row. Takes ALL remaining height and scrolls inside. */}
                  <div className="no-scrollbar grid min-h-0 flex-1 grid-cols-1 content-start gap-5 overflow-y-auto overscroll-contain pb-4 md:grid-cols-2">
                    {cancelled.map(({ b, v }) => (
                      <CancelledCard
                        key={b.requestGroupId}
                        b={b}
                        v={v}
                        me={userId}
                        onDetails={setDetailsFor}
                        onRebook={bookAgain}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : (
              /* ============== COMPLETED TAB (CALENDAR) ============== */
              <div className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-8 text-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <CalendarDays className="h-6 w-6 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Completed Sessions Calendar
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a highlighted date to view completed meetings.
                  </p>
                </div>

                <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 shadow-inner sm:p-8">
                  <PastCalendar
                    meetingsByDate={meetingsByDate}
                    selectedKey={selectedKey}
                    onSelect={handleDateSelect}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPLETED MEETINGS POPUP MODAL */}
      <PastMeetingsModal
        isOpen={isPastModalOpen}
        onClose={() => setIsPastModalOpen(false)}
        date={selectedKey ? dateFromKey(selectedKey) : null}
        meetings={selectedMeetings}
        me={userId}
        onReview={handleReviewClick}
        onDetails={setDetailsFor}
        onRebook={bookAgain}
      />

      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onDone={() => {
            setDismissedReview(reviewBooking.requestGroupId);
            setReviewTarget(null);
            reload();
          }}
        />
      )}

      {detailsFor && (
        <EmployeeDetailsModal
          key={detailsFor.requestGroupId}
          title="Employee Profile"
          fetcher={() =>
            api(`${ENDPOINTS.booking(detailsFor.requestGroupId)}/counterpart`)
          }
          onClose={() => setDetailsFor(null)}
        />
      )}
    </div>
  );
};

export default FresherMeetings;