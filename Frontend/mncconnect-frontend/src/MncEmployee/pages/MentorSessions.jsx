// src/MncEmployee/pages/MentorSessions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Video,
  Search,
  MessageSquare,
  Star,
  XCircle,
  Loader2,
  Radio,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import useMentorSessions from "../../hooks/useMentorSessions";
import { inr, api, ENDPOINTS, EVENTS } from "../../services/mentorApi";
import socket from "../../socket";

const INDIA_TIMEZONE = "Asia/Kolkata";
const JOIN_WINDOW_MINUTES = 5;
const FINAL_WARNING_MS = 5 * 60 * 1000;
const TIMER_POLL_MS = 3000;
const TABS = ["Upcoming", "Awaiting Confirmation", "Completed", "Cancelled"];

const fmtDateTime = (d) =>
  d?.toLocaleString("en-IN", {
    timeZone: INDIA_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) || "";

const fmtTime = (d) =>
  d?.toLocaleTimeString("en-IN", {
    timeZone: INDIA_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) || "";

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
};

const countdownParts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
};

const getJoinStatus = (session, nowMs) => {
  if (!session.startsAt || !session.endsAt) {
    return {
      isLive: false,
      isJoinWindow: false,
      hasEnded: false,
      joinOpenAt: null,
      sessionEndAt: null,
      msUntilStart: 0,
    };
  }
  const joinOpen = session.startsAt - JOIN_WINDOW_MINUTES * 60000;
  return {
    isLive: nowMs >= session.startsAt && nowMs < session.endsAt,
    isJoinWindow: nowMs >= joinOpen && nowMs < session.startsAt,
    hasEnded: nowMs >= session.endsAt,
    joinOpenAt: new Date(joinOpen),
    sessionEndAt: new Date(session.endsAt),
    msUntilStart: Math.max(0, session.startsAt - nowMs),
  };
};

const MentorSessions = () => {
  const navigate = useNavigate();

  const { sessions, loading, error, connected, reload } = useMentorSessions();

  // id -> { remainingMs, running, at }
  const [timers, setTimers] = useState({});

  const [activeTab, setActiveTab] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  // 1-second clock
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ids of sessions that can have a live meeting
  const activeIds = useMemo(
    () =>
      sessions
        .filter((s) => ["Upcoming", "Awaiting Confirmation"].includes(s.status))
        .map((s) => s.id)
        .join(","),
    [sessions]
  );

  // Poll the same booking data the meeting room uses
  useEffect(() => {
    if (!activeIds) return undefined;
    const ids = activeIds.split(",");
    let cancelled = false;

    const fetchTimers = async () => {
      const results = {};
      let finished = false;
      await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await api(ENDPOINTS.booking(id));
            if (d?.booking) {
              results[id] = {
                remainingMs: d.booking.remainingMs,
                running: Boolean(d.booking.timerRunning),
                at: Date.now(),
              };
              if (["awaiting_confirmation", "completed"].includes(d.booking.status)) finished = true;
            }
          } catch {
            /* ignore single failure */
          }
        })
      );
      if (cancelled) return;
      setTimers((prev) => ({ ...prev, ...results }));
      if (finished) reload();
    };

    fetchTimers();
    const t = setInterval(fetchTimers, TIMER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds]);

  // Socket updates (instant when server sends them to this user)
  useEffect(() => {
    const onTimer = (p) => {
      const id = p?.requestGroupId || p?.bookingId;
      if (!id || typeof p.remainingMs !== "number") return;
      setTimers((prev) => ({
        ...prev,
        [id]: { remainingMs: p.remainingMs, running: Boolean(p.running), at: Date.now() },
      }));
    };
    socket.on("meeting:timer", onTimer);
    socket.on("meeting:state", onTimer);
    return () => {
      socket.off("meeting:timer", onTimer);
      socket.off("meeting:state", onTimer);
    };
  }, []);

  // booking updated -> refresh list
  useEffect(() => {
    const onUpdated = () => reload();
    socket.on(EVENTS.booking || "booking:updated", onUpdated);
    return () => socket.off(EVENTS.booking || "booking:updated", onUpdated);
  }, [reload]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [
          t,
          sessions.filter((s) => {
            if (t === "Awaiting Confirmation") return s.status === "awaiting_confirmation";
            return s.status === t;
          }).length,
        ])
      ),
    [sessions]
  );

  const filtered = useMemo(() => {
    const kw = search.toLowerCase().trim();
    const targetStatus =
      activeTab === "Awaiting Confirmation" ? "awaiting_confirmation" : activeTab;

    const list = sessions.filter(
      (s) =>
        s.status === targetStatus &&
        (!kw || `${s.name} ${s.role} ${s.topic} ${s.type}`.toLowerCase().includes(kw))
    );
    const dir = activeTab === "Upcoming" ? 1 : -1;
    return list.sort((a, b) => dir * ((a.startsAt || 0) - (b.startsAt || 0)));
  }, [sessions, activeTab, search]);

  const handleJoin = (session) =>
    navigate(`/mentor/meeting/${encodeURIComponent(session.id)}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {tab}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    {counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}
            >
              <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
            </span>
            <div className="relative w-full lg:w-80">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sessions..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400"
              />
            </div>
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

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={`No ${activeTab.toLowerCase()} sessions`}
              description={
                activeTab === "Awaiting Confirmation"
                  ? "Sessions where the timer ended but the fresher hasn't confirmed will appear here."
                  : "Accepted sessions appear here automatically."
              }
            />
          ) : (
            filtered.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                nowMs={nowMs}
                timer={timers[s.id]}
                onJoin={handleJoin}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

const SessionCard = ({ session, nowMs, timer, onJoin }) => {
  const isUpcoming = session.status === "Upcoming";
  const isAwaitingConfirmation = session.status === "awaiting_confirmation";
  const isCompleted = session.status === "Completed";
  const isCancelled = session.status === "Cancelled";

  const base = getJoinStatus(session, nowMs);
  const c = countdownParts(base.msUntilStart);
  const pad = (n) => String(n).padStart(2, "0");

  // start -> end range shown on the card
  const timeRange =
    session.startsAt && session.endsAt
      ? `${fmtTime(new Date(session.startsAt))} → ${fmtTime(new Date(session.endsAt))}`
      : session.time;

  // ---- LIVE MEETING TIMER (same value as inside the video call) ----
  const timerRunning = isUpcoming && Boolean(timer?.running);
  const baseRemaining =
    typeof timer?.remainingMs === "number" ? timer.remainingMs : session.remainingMs;
  const remaining =
    timerRunning && typeof baseRemaining === "number"
      ? Math.max(0, baseRemaining - (nowMs - (timer?.at || nowMs)))
      : 0;
  const isFinalWarning = timerRunning && remaining <= FINAL_WARNING_MS;

  const isLive = base.isLive || timerRunning;
  const isJoinWindow = base.isJoinWindow && !timerRunning;
  const hasEnded = base.hasEnded && !timerRunning;
  const { joinOpenAt, sessionEndAt } = base;
  const joinable = isUpcoming && (isLive || isJoinWindow);

  const btnStyle = isLive
    ? "bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 cursor-pointer"
    : isJoinWindow
      ? "bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-200 cursor-pointer"
      : "bg-blue-600 text-white cursor-not-allowed";

  const btnContent = isLive ? (
    <>
      <Video size={14} />
      <span>{timerRunning ? "Rejoin Session" : "Join Session"}</span>
    </>
  ) : isJoinWindow ? (
    <>
      <Video size={14} />
      <span>Join Now</span>
    </>
  ) : (
    <>
      <Clock3 size={13} />
      <span className="font-mono text-[10px] sm:text-[11px]">
        {c.days > 0 && <>{c.days}d : </>}
        {(c.days > 0 || c.hours > 0) && <>{pad(c.hours)}h : </>}
        {pad(c.minutes)}m : {pad(c.seconds)}s
      </span>
    </>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-4">
          <img
            src={session.avatar}
            alt={session.name}
            className="h-12 w-12 rounded-full border-2 border-blue-100 object-cover"
          />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{session.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{session.role}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.topic && (
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
                  {session.topic}
                </span>
              )}
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                {session.type}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
          <SessionInfo icon={<CalendarDays size={15} />} label="Date" value={session.date} />
          <SessionInfo icon={<Clock3 size={15} />} label="Start → End" value={timeRange} />
          <SessionInfo icon={<Video size={15} />} label="Duration" value={session.duration} />
          <SessionInfo icon={<Star size={15} />} label="You earn" value={inr(session.earning ?? 0)} />
        </div>
      </div>

      {/* LIVE TIMER BAR */}
      {timerRunning && (
        <div
          className={`mt-4 flex items-center justify-between gap-4 rounded-xl border p-3 ${
            isFinalWarning
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isFinalWarning ? (
              <AlertTriangle size={16} className="text-amber-600" />
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
            )}
            <div>
              <p className={`text-[11px] font-semibold ${isFinalWarning ? "text-amber-800" : "text-emerald-800"}`}>
                {isFinalWarning ? "Final 5 minutes — start wrapping up" : "Session in progress"}
              </p>
              <p className={`text-[10px] ${isFinalWarning ? "text-amber-700" : "text-emerald-600"}`}>
                {isFinalWarning
                  ? "Ask the fresher to confirm the session went well"
                  : `Time left in the meeting · ${timeRange}`}
              </p>
            </div>
          </div>
          <div
            className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums ${
              isFinalWarning ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
            }`}
          >
            {fmtClock(remaining)}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {isUpcoming && !hasEnded && (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                {timerRunning ? "Session in progress" : "Upcoming Session"}
              </span>
            </>
          )}
          {isUpcoming && hasEnded && (
            <>
              <Clock3 size={16} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-500">
                Session ended · updating status…
              </span>
            </>
          )}
          {isAwaitingConfirmation && (
            <>
              <ShieldCheck size={16} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">Waiting for fresher to confirm</span>
            </>
          )}
          {isCompleted && (
            <>
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Completed · Earnings released</span>
            </>
          )}
          {isCancelled && (
            <>
              <XCircle size={16} className="text-red-500" />
              <span className="text-xs font-medium text-red-500">Cancelled</span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {isUpcoming && !hasEnded && (
            <>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <MessageSquare size={15} /> Message
              </button>
              <button
                type="button"
                disabled={!joinable}
                onClick={() => joinable && onJoin(session)}
                className={`flex min-w-[150px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${btnStyle}`}
              >
                {btnContent}
              </button>
            </>
          )}
          {(isCompleted || isCancelled || isAwaitingConfirmation) && (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {isUpcoming && !hasEnded && !isLive && !isJoinWindow && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-600">
          <Clock3 size={14} />
          <span>
            Join opens at <strong>{fmtDateTime(joinOpenAt)}</strong>
            {sessionEndAt && (
              <>
                {" "}
                · Ends at <strong>{fmtTime(sessionEndAt)}</strong>
              </>
            )}
          </span>
        </div>
      )}
      {isUpcoming && isJoinWindow && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-medium text-yellow-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          <span>
            The meeting room is open. Click "Join Now". The timer starts when you and the fresher are both inside.
          </span>
        </div>
      )}
      {isUpcoming && isLive && !timerRunning && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-green-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span>Session time reached. The timer starts when you and the fresher are both inside.</span>
        </div>
      )}
      {isAwaitingConfirmation && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
          <ShieldCheck size={14} />
          <span>
            The timer has ended. Waiting for the fresher to confirm the session. Once they click "Yes", your earnings will be released.
          </span>
        </div>
      )}
    </div>
  );
};

const SessionInfo = ({ icon, label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
    <div className="flex items-center gap-1.5 text-slate-400">
      {icon}
      <span className="text-[10px]">{label}</span>
    </div>
    <p className="mt-1.5 text-xs font-semibold text-slate-700">{value}</p>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
      <CalendarDays size={25} className="text-blue-500" />
    </div>
    <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);

export default MentorSessions;