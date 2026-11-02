// src/FresherDashboard/pages/MyBookings.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import useChatNotificationSound from "../../hooks/useChatNotificationSound";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Video,
  Building2,
  UserRound,
  Inbox,
  Loader2,
  Radio,
  Star,
  ArrowRight,
  IndianRupee,
  MessageSquare,
  RotateCcw,
  Send,
  UserCheck,
  Check,
  X,
  Users,
  Copy,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import ReviewModal from "../pages/Reviewmodal";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import PersonDetailsModal from "../../Commoncomponents/Persondetailsmodal";
import { socket } from "../../utils/socket";
import {
  api,
  ENDPOINTS,
  EVENTS,
  getUserId,
  durationLabel,
  fmtClock,
  inr,
} from "../../services/fresherApi";

const FINAL_WARNING_MS = 5 * 60 * 1000;
const TIMER_POLL_MS = 3000;
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

const NO_TIMER_STATUSES = [
  "completed",
  "awaiting_confirmation",
  "disputed",
  "pending",
  "expired",
  "missed",
  "cancelled",
];
const NO_CHAT_STATUSES = ["pending", "expired", "missed", "cancelled"];
const DONE_STATUSES = ["completed", "awaiting_confirmation", "disputed"];

// group: a friend who joined with the invite link (NOT the one who booked)
const isGroupFriendOf = (b, userId) =>
  b.mode === "group" && String(b.hostId) !== String(userId);

/* =========================================================================
   BOOKING STEPPER  (Requested -> Accepted -> Session -> Completed)
   Theme: BLUE + WHITE   |   COMPACT size
========================================================================= */

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
    case "pending":
      return { active: 1 };
    case "confirmed":
      return { active: 2 };
    case "open":
      return { active: 2, live: true };
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

const subOf = (i, b, v, left, now, failAt) => {
  if (failAt === i) {
    if (b.refundStatus === "refunded") return "Refunded";
    if (b.refundStatus === "failed") return "Refund processing";
    return "Refunding…";
  }

  if (i === 0) return `Paid ${inr(b.amount)}`;

  if (i === 1) {
    if (v.key === "pending") {
      return v.expires
        ? `Auto-refund in ${fmtClock(Math.max(0, v.expires - now))}`
        : b.direct
          ? "Waiting for mentor…"
          : "Waiting…";
    }
    return b.mentor?.name || "Accepted";
  }

  if (i === 2) {
    if (v.key === "confirmed")
      return `Opens in ${fmtClock(Math.max(0, v.opens - now))}`;
    if (v.key === "open")
      return left !== null ? `${fmtClock(left)} left` : "Room open";
    if (["ended", "review", "done"].includes(v.key)) return "Finished";
    return "";
  }

  if (i === 3) {
    if (v.key === "review") return "Review required";
    if (v.key === "done") return "Completed";
    if (v.key === "ended") return "Confirming…";
    return "";
  }

  return "";
};

const BookingStepper = ({ b, v, left, now }) => {
  const { active, live, attention, failAt } = progressOf(b, v);
  const failed = failAt !== undefined;
  const reached = failed ? failAt : active;

  return (
    <div
      className="mx-auto flex max-w-2xl"
      role="list"
      aria-label="Booking progress"
    >
      {STEPS.map((step, i) => {
        const Icon = step.icon;

        const isFailed = failed && i === failAt;
        const isDone = failed ? i < failAt : i < active;
        const isCurrent = !failed && i === active && active < STEPS.length;

        const circle = isFailed
          ? "bg-red-500 text-white ring-2 ring-red-100"
          : isDone
            ? "bg-blue-600 text-white"
            : isCurrent
              ? attention
                ? "bg-red-500 text-white shadow ring-2 ring-red-100"
                : "bg-blue-600 text-white shadow ring-2 ring-blue-100"
              : "bg-white text-blue-300 border-2 border-blue-200";

        const labelCls = isFailed
          ? "text-red-600"
          : isDone || isCurrent
            ? "text-slate-900"
            : "text-slate-400";

        const subCls = isFailed
          ? "text-red-500"
          : isCurrent
            ? attention
              ? "text-red-600"
              : "text-blue-700"
            : "text-slate-400";

        const label = isFailed ? FAIL_LABEL[i] || step.label : step.label;
        const sub = subOf(i, b, v, left, now, failAt);

        return (
          <div
            key={step.label}
            role="listitem"
            className="relative flex min-w-0 flex-1 flex-col items-center"
          >
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-3.5 h-[2px] w-full -translate-y-1/2 rounded-full transition-colors duration-500 ${
                  i < reached ? "bg-blue-600" : "bg-blue-100"
                }`}
              />
            )}

            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-500 ${circle}`}
            >
              {isCurrent && live && (
                <span className="absolute inset-0 rounded-full bg-blue-400/60 motion-safe:animate-ping" />
              )}
              {isFailed ? (
                <X className="relative h-3.5 w-3.5" />
              ) : isDone ? (
                <Check className="relative h-3.5 w-3.5" />
              ) : (
                <Icon className="relative h-3.5 w-3.5" />
              )}
            </span>

            <p
              className={`mt-1.5 text-center text-[11px] font-semibold transition-colors ${labelCls}`}
            >
              {label}
            </p>
            <p
              className={`mt-0.5 max-w-[84px] truncate text-center text-[10px] tabular-nums sm:max-w-[130px] ${subCls}`}
              title={sub}
            >
              {sub || "\u00A0"}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- GROUP badge: joined count + invite link (host only) ---------- */
const NAMES_SHOWN = 8; // a 60-student group must not print 60 names

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

/* ========================================================================= */

const MyBookings = () => {
  useChatNotificationSound("fresher");
  const navigate = useNavigate();
  const userId = useMemo(() => getUserId(), []);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("upcoming");
  const [dismissedReview, setDismissedReview] = useState(null);

  // chat
  const [chatFor, setChatFor] = useState(null);

  // MncEmployee (mentor) details modal
  const [detailsFor, setDetailsFor] = useState(null);

  // unread chat messages: requestGroupId -> count
  const [unreadCounts, setUnreadCounts] = useState({});
  const openChatId = useRef(null);
  const seenMessageIds = useRef(new Set());

  // requestGroupId -> { remainingMs, running, at }
  const [timers, setTimers] = useState({});

  // requestGroupId -> true  (meeting timer finished -> move to past immediately)
  const [finishedIds, setFinishedIds] = useState({});
  // requestGroupId -> true  (timer was running at least once)
  const wasRunningRef = useRef({});

  const { data, loading, error, connected, reload } = useLive({
    fetcher: () => api(ENDPOINTS.myBookings),
    events: [EVENTS.booking, EVENTS.reminder],
    pollMs: 10000,
    userId,
  });

  // 1s clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bookings = data?.bookings || [];

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
    reload();
    setTimeout(reload, 2000);
  };

  /* ---------- unread chat badge ---------- */

  const loadUnread = useCallback(() => {
    api("/chat/unread")
      .then((d) => {
        if (!d?.counts) return;
        const counts = { ...d.counts };
        if (openChatId.current) counts[openChatId.current] = 0;
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
      if (message.senderRole === "fresher") return;

      const messageId = String(message._id || message.id || "");
      if (messageId) {
        if (seenMessageIds.current.has(messageId)) return;
        seenMessageIds.current.add(messageId);
      }

      const id = String(message.requestGroupId || message.bookingId || "");
      if (!id) return;
      if (openChatId.current === id) return;

      setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    socket.on("chat:message", onChatMessage);
    return () => socket.off("chat:message", onChatMessage);
  }, []);

  const openChat = (b) => {
    const id = String(b.requestGroupId);
    openChatId.current = id;
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
    setChatFor(b);
  };

  const closeChat = () => {
    openChatId.current = null;
    setChatFor(null);
    loadUnread();
  };

  const closeDetails = useCallback(() => setDetailsFor(null), []);

  // Timer values that come with the list (if backend sends them)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const activeIds = useMemo(
    () =>
      bookings
        .filter((b) => !NO_TIMER_STATUSES.includes(b.status))
        .map((b) => b.requestGroupId)
        .join(","),
    [bookings],
  );

  // Poll each active booking -> same timer as inside the meeting room
  useEffect(() => {
    if (!activeIds) return undefined;
    const ids = activeIds.split(",");
    let cancelled = false;

    const fetchTimers = async () => {
      const results = {};
      const justFinished = [];

      await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await api(ENDPOINTS.booking(id));
            if (d?.booking) {
              const running = Boolean(d.booking.timerRunning);
              const remaining = d.booking.remainingMs;

              if (running) wasRunningRef.current[id] = true;

              results[id] = {
                remainingMs: remaining,
                running,
                at: Date.now(),
              };

              if (DONE_STATUSES.includes(d.booking.status)) {
                justFinished.push(id);
              } else if (
                wasRunningRef.current[id] &&
                (!running || (typeof remaining === "number" && remaining <= 0))
              ) {
                justFinished.push(id);
              }
            }
          } catch {
            /* ignore single failure */
          }
        }),
      );

      if (cancelled) return;
      setTimers((prev) => ({ ...prev, ...results }));
      if (justFinished.length) markFinished(justFinished);
    };

    fetchTimers();
    const t = setInterval(fetchTimers, TIMER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds]);

  // Socket (works when the server sends it to the user's room)
  useEffect(() => {
    const onTimer = (p) => {
      const id = p?.requestGroupId || p?.bookingId;
      if (!id || typeof p.remainingMs !== "number") return;

      const running = Boolean(p.running);
      if (running) wasRunningRef.current[id] = true;

      setTimers((prev) => ({
        ...prev,
        [id]: {
          remainingMs: p.remainingMs,
          running,
          at: Date.now(),
        },
      }));

      if (wasRunningRef.current[id] && (!running || p.remainingMs <= 0)) {
        markFinished(id);
      }
    };
    socket.on("meeting:timer", onTimer);
    socket.on("meeting:state", onTimer);
    return () => {
      socket.off("meeting:timer", onTimer);
      socket.off("meeting:state", onTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rawLeft = (b) => {
    const t = timers[b.requestGroupId];
    if (!t?.running || typeof t.remainingMs !== "number") return null;
    return Math.max(0, t.remainingMs - (now - t.at));
  };

  const timerOf = (b) => {
    if (finishedIds[b.requestGroupId]) return null;
    return rawLeft(b);
  };

  useEffect(() => {
    const newly = [];
    bookings.forEach((b) => {
      const id = b.requestGroupId;
      if (finishedIds[id]) return;
      if (NO_TIMER_STATUSES.includes(b.status)) return;
      const l = rawLeft(b);
      if (l !== null && l <= 0) newly.push(id);
    });
    if (newly.length) markFinished(newly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const view = (b) => {
    const starts = new Date(b.startsAt).getTime();
    const ends = new Date(b.endsAt).getTime();
    const opens = starts - 2 * 60000;
    const left = timerOf(b);
    const finished = Boolean(finishedIds[b.requestGroupId]);

    // group friends never write the review (only the host does) -> they go straight to "Completed"
    const noReviewNeeded = b.reviewed || isGroupFriendOf(b, userId);

    // money went back to the fresher -> always "Refunded" (even if a review was written)
    if (["disputed", "expired", "missed", "cancelled"].includes(b.status))
      return { key: "refunded", label: "Refunded", tone: "slate" };

    if (DONE_STATUSES.includes(b.status)) {
      if (noReviewNeeded)
        return { key: "done", label: "Completed", tone: "emerald" };
      return { key: "review", label: "Review required", tone: "red" };
    }

    if (b.status === "pending")
      return {
        key: "pending",
        label: b.direct ? "Waiting for your mentor" : "Waiting for an employee",
        tone: "amber",
        expires: new Date(b.expiresAt).getTime(),
      };

    // live meeting timer running
    if (left !== null && left > 0)
      return {
        key: "open",
        label: "In progress",
        tone: "green",
        opens,
        starts,
      };

    // meeting finished (timer hit 0) -> move to Past right away
    if (finished) {
      if (noReviewNeeded)
        return { key: "done", label: "Completed", tone: "emerald" };
      return { key: "review", label: "Review required", tone: "red" };
    }

    if (now >= ends)
      return { key: "ended", label: "Meeting ended", tone: "slate" };
    if (now >= opens && now < ends)
      return {
        key: "open",
        label: "Meeting open",
        tone: "green",
        opens,
        starts,
      };

    return {
      key: "confirmed",
      label: "Confirmed",
      tone: "blue",
      opens,
      starts,
    };
  };

  const decorated = useMemo(
    () => bookings.map((b) => ({ b, v: view(b) })),
    [bookings, now, timers, finishedIds],
  ); // eslint-disable-line

  const upcoming = decorated.filter(({ v }) =>
    ["pending", "confirmed", "open"].includes(v.key),
  );
  const past = decorated.filter(({ v }) =>
    ["done", "refunded", "review", "ended"].includes(v.key),
  );
  const list = tab === "upcoming" ? upcoming : past;

  // (a friend never reaches v.key === "review", so only the host / single bookings come here)
  const needsReview = decorated.find(
    ({ v, b }) => v.key === "review" && b.requestGroupId !== dismissedReview,
  )?.b;

  const tones = {
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
  };

  // Book again -> straight to the booking form (SessionBoard) with the same mentor locked in.
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-600">MNCConnect</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              My Bookings
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              Updates live.
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}
              >
                <Radio size={12} /> {connected ? "Live" : "Reconnecting..."}
              </span>
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              ["upcoming", `Upcoming (${upcoming.length})`],
              ["past", `Past (${past.length})`],
            ].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button onClick={reload} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-blue-600" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              {tab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
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
            {list.map(({ b, v }) => {
              const left = timerOf(b);
              const warn = left !== null && left <= FINAL_WARNING_MS;
              const startMs = new Date(b.startsAt).getTime();
              const endMs = new Date(b.endsAt).getTime();
              const range =
                Number.isFinite(startMs) && Number.isFinite(endMs)
                  ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
                  : b.time;

              // group friends have no chat (chat is host <-> employee only)
              const canChat =
                Boolean(b.mentor) &&
                !isGroupFriendOf(b, userId) &&
                !NO_CHAT_STATUSES.includes(b.status) &&
                v.key !== "pending";
              const canSeeMentor =
                Boolean(b.mentor?.id) &&
                b.status !== "pending" &&
                v.key !== "pending";
              const sessionHappened =
                ["completed", "awaiting_confirmation"].includes(b.status) ||
                Boolean(finishedIds[b.requestGroupId]);
              const canRebook =
                tab === "past" && sessionHappened && Boolean(b.mentor?.id);
              const unread = unreadCounts[String(b.requestGroupId)] || 0;

              return (
                <div
                  key={b.requestGroupId}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                        {b.mode === "group" ? (
                          <Users className="h-7 w-7 text-blue-600" />
                        ) : (
                          <Video className="h-7 w-7 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-bold text-slate-900">
                            {b.sessionType || "Mentoring session"}
                          </h2>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[v.tone]}`}
                          >
                            {v.label}
                          </span>
                          {b.mode === "group" && (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              Group
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
                            {b.mentor?.name ||
                              (v.key === "refunded"
                                ? "No employee assigned"
                                : "Waiting for an employee")}
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
                        {b.reason && (
                          <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                            "{b.reason}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                      {v.key === "open" && (
                        <Link
                          to={`/Home/meeting/${b.requestGroupId}`}
                          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          <Video className="h-4 w-4" />{" "}
                          {left !== null ? "Rejoin meeting" : "Join meeting"}{" "}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                      {v.key === "confirmed" && (
                        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center text-xs text-blue-700">
                          Room opens in{" "}
                          <b className="font-mono text-sm">
                            {fmtClock(v.opens - now)}
                          </b>
                        </div>
                      )}
                      {v.key === "pending" && (
                        <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-700">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Waiting...
                          </div>
                          {Number.isFinite(v.expires) && (
                            <p className="mt-1.5 text-[11px] font-normal text-amber-700">
                              Auto-cancels at{" "}
                              <b className="font-semibold">
                                {fmtTimeIST(v.expires)}
                              </b>{" "}
                              if no one accepts · refund goes to your wallet
                            </p>
                          )}
                        </div>
                      )}
                      {v.key === "review" && (
                        <button
                          type="button"
                          onClick={() => setDismissedReview(null)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          <Star className="h-4 w-4" /> Write review
                        </button>
                      )}
                      {v.key === "done" && (
                        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Completed
                        </div>
                      )}
                      {(v.key === "refunded" || v.key === "ended") && (
                        <div className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-600">
                          <IndianRupee className="h-3.5 w-3.5" />{" "}
                          {inr(b.amount)}{" "}
                          {b.refundStatus === "failed"
                            ? "refund processing"
                            : b.refundStatus === "refunded"
                              ? b.status === "expired" ||
                                b.status === "disputed"
                                ? "refunded to wallet"
                                : "refunded"
                              : "amount held"}
                        </div>
                      )}

                      {canRebook && (
                        <button
                          type="button"
                          onClick={() => bookAgain(b)}
                          className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <RotateCcw className="h-4 w-4" /> Book again
                        </button>
                      )}

                      {canSeeMentor && (
                        <button
                          type="button"
                          onClick={() => setDetailsFor(b)}
                          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <UserRound className="h-4 w-4" />
                          MncEmployee details
                        </button>
                      )}

                      {canChat && (
                        <button
                          type="button"
                          onClick={() => openChat(b)}
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
                  <GroupInfo b={b} me={userId} />

                  {/* LIVE BOOKING PROGRESS (stepper) */}
                  <div className="mx-3 mb-4 sm:mx-6">
                    <BookingStepper b={b} v={v} left={left} now={now} />
                  </div>

                  {/* LIVE TIMER - same value as inside the meeting room */}
                  {left !== null && (
                    <div
                      className={`mx-5 mb-4 flex items-center justify-between gap-4 rounded-xl border p-3 sm:mx-6 ${warn ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                    >
                      <div>
                        <p
                          className={`text-xs font-semibold ${warn ? "text-amber-800" : "text-emerald-800"}`}
                        >
                          {warn ? "Final 5 minutes" : "Session in progress"}
                        </p>
                        <p
                          className={`text-[11px] ${warn ? "text-amber-700" : "text-emerald-600"}`}
                        >
                          Time left · {range}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums ${warn ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"}`}
                      >
                        {fmtClock(left)}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
                    <span>
                      Booking ID:{" "}
                      <b className="text-slate-700">{b.requestGroupId}</b>
                    </span>
                    <span className="font-semibold text-slate-700">
                      {inr(b.amount)}
                      {b.mode === "group" ? " / person" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {needsReview && (
        <ReviewModal
          booking={needsReview}
          onDone={() => {
            setDismissedReview(needsReview.requestGroupId);
            reload();
          }}
        />
      )}

      {chatFor && (
        <ChatPanel
          variant="modal"
          bookingId={chatFor.requestGroupId}
          role="fresher"
          title={`Chat with ${chatFor.mentor?.name || "employee"}`}
          onClose={closeChat}
        />
      )}

      {detailsFor && (
        <PersonDetailsModal
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