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
import {socket} from "../../utils/socket";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import SessionDetailsModal from "../../Commoncomponents/SessionDetailsModal";

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
    [sessions],
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
              if (
                ["awaiting_confirmation", "completed"].includes(
                  d.booking.status,
                )
              )
                finished = true;
            }
          } catch {
            /* ignore single failure */
          }
        }),
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
        [id]: {
          remainingMs: p.remainingMs,
          running: Boolean(p.running),
          at: Date.now(),
        },
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
            if (t === "Awaiting Confirmation")
              return s.status === "awaiting_confirmation";
            return s.status === t;
          }).length,
        ]),
      ),
    [sessions],
  );

  const filtered = useMemo(() => {
    const kw = search.toLowerCase().trim();
    const targetStatus =
      activeTab === "Awaiting Confirmation"
        ? "awaiting_confirmation"
        : activeTab;

    const list = sessions.filter(
      (s) =>
        s.status === targetStatus &&
        (!kw ||
          `${s.name} ${s.role} ${s.topic} ${s.type}`
            .toLowerCase()
            .includes(kw)),
    );
    const dir = activeTab === "Upcoming" ? 1 : -1;
    return list.sort((a, b) => dir * ((a.startsAt || 0) - (b.startsAt || 0)));
  }, [sessions, activeTab, search]);

  const handleJoin = (session) =>
    navigate(`/mentor/meeting/${encodeURIComponent(session.id)}`);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <main className="relative z-10 mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* TABS - scroll sideways on small screens */}
          <div className="-mx-3 px-3 sm:mx-0 sm:px-0 lg:max-w-[70%]">
            <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 sm:py-2.5 sm:text-sm ${
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
          </div>

          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3 lg:w-auto">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}
            >
              <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
            </span>
            <div className="relative w-full sm:flex-1 lg:w-80 lg:flex-none">
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
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
            {error}{" "}
            <button onClick={reload} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
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
  // chat + details state lives HERE (inside the card)
  const [detailsFor, setDetailsFor] = useState(null);
  const [chatFor, setChatFor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const token = localStorage.getItem("mnc_mentor_token") || "";

  const chatBookingId =
    session.requestGroupId || session.bookingId || session.id;

  // Unread badge.
  // The server sends chat messages to the mentor's personal room,
  // so this works even though the chat window is closed.
  useEffect(() => {
    const myIds = [session.requestGroupId, session.bookingId, session.id]
      .filter(Boolean)
      .map(String);

    const onChatMessage = (message) => {
      if (message.senderRole === "mentor") return;

      // server sends both bookingId (_id) and requestGroupId
      const incoming = [message.bookingId, message.requestGroupId]
        .filter(Boolean)
        .map(String);

      if (!incoming.some((id) => myIds.includes(id))) return;

      // chat is open -> ChatPanel marks it read, no badge
      if (chatFor) return;

      setUnreadCount((count) => count + 1);
    };

    socket.on("chat:message", onChatMessage);

    return () => {
      socket.off("chat:message", onChatMessage);
    };
  }, [session.requestGroupId, session.bookingId, session.id, chatFor]);

  const openChat = () => {
    setUnreadCount(0);
    setChatFor(session);
  };

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
    typeof timer?.remainingMs === "number"
      ? timer.remainingMs
      : session.remainingMs;
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

  const secondaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:px-4";

  const UnreadBadge = () =>
    unreadCount > 0 ? (
      <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5">
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <img
              src={session.avatar}
              alt={session.name}
              className="h-11 w-11 shrink-0 rounded-full border-2 border-blue-100 object-cover sm:h-12 sm:w-12"
            />
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-slate-900">
                {session.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {session.role}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                {session.topic && (
                  <span className="max-w-full truncate rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
                    {session.topic}
                  </span>
                )}
                <span className="max-w-full truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                  {session.type}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 lg:w-[480px] xl:w-[560px]">
            <SessionInfo
              icon={<CalendarDays size={15} />}
              label="Date"
              value={session.date}
            />
            <SessionInfo
              icon={<Clock3 size={15} />}
              label="Start → End"
              value={timeRange}
            />
            <SessionInfo
              icon={<Video size={15} />}
              label="Duration"
              value={session.duration}
            />
            <SessionInfo
              icon={<Star size={15} />}
              label="You earn"
              value={inr(session.earning ?? 0)}
            />
          </div>
        </div>

        {/* LIVE TIMER BAR */}
        {timerRunning && (
          <div
            className={`mt-4 flex flex-col gap-3 rounded-xl border p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-4 ${
              isFinalWarning
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
              {isFinalWarning ? (
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-600 sm:mt-0"
                />
              ) : (
                <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0 sm:mt-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-semibold ${isFinalWarning ? "text-amber-800" : "text-emerald-800"}`}
                >
                  {isFinalWarning
                    ? "Final 5 minutes — start wrapping up"
                    : "Session in progress"}
                </p>
                <p
                  className={`break-words text-[10px] ${isFinalWarning ? "text-amber-700" : "text-emerald-600"}`}
                >
                  {isFinalWarning
                    ? "Ask the fresher to confirm the session went well"
                    : `Time left in the meeting · ${timeRange}`}
                </p>
              </div>
            </div>
            <div
              className={`self-start rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums sm:text-xl min-[420px]:self-auto ${
                isFinalWarning
                  ? "bg-amber-200 text-amber-900"
                  : "bg-emerald-200 text-emerald-900"
              }`}
            >
              {fmtClock(remaining)}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:mt-5 sm:pt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {isUpcoming && !hasEnded && (
              <>
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-600">
                  {timerRunning ? "Session in progress" : "Upcoming Session"}
                </span>
              </>
            )}
            {isUpcoming && hasEnded && (
              <>
                <Clock3 size={16} className="shrink-0 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">
                  Session ended · updating status…
                </span>
              </>
            )}
            {isAwaitingConfirmation && (
              <>
                <ShieldCheck size={16} className="shrink-0 text-amber-500" />
                <span className="text-xs font-medium text-amber-700">
                  Waiting for fresher to confirm
                </span>
              </>
            )}
            {isCompleted && (
              <>
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-emerald-500"
                />
                <span className="text-xs font-medium text-emerald-600">
                  Completed · Earnings released
                </span>
              </>
            )}
            {isCancelled && (
              <>
                <XCircle size={16} className="shrink-0 text-red-500" />
                <span className="text-xs font-medium text-red-500">
                  Cancelled
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {/* UPCOMING: Details + Message + Join */}
            {isUpcoming && !hasEnded && (
              <>
                <button
                  type="button"
                  onClick={() => setDetailsFor(session)}
                  className={secondaryBtn}
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={openChat}
                  className={`${secondaryBtn} relative`}
                >
                  <span className="relative inline-flex">
                    <MessageSquare size={15} />
                    <UnreadBadge />
                  </span>
                  Message
                </button>

                <button
                  type="button"
                  disabled={!joinable}
                  onClick={() => joinable && onJoin(session)}
                  className={`col-span-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:col-span-1 sm:w-auto sm:min-w-[150px] ${btnStyle}`}
                >
                  {btnContent}
                </button>
              </>
            )}

            {/* AWAITING / COMPLETED / CANCELLED: Message + View Details */}
            {(isCompleted || isCancelled || isAwaitingConfirmation) && (
              <>
                <button
                  type="button"
                  onClick={openChat}
                  className={`${secondaryBtn} relative`}
                >
                  <span className="relative inline-flex">
                    <MessageSquare size={15} />
                    <UnreadBadge />
                  </span>
                  Message
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsFor(session)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 sm:w-auto sm:px-4"
                >
                  View Details
                </button>
              </>
            )}
          </div>
        </div>

        {isUpcoming && !hasEnded && !isLive && !isJoinWindow && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-600">
            <Clock3 size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">
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
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-medium text-yellow-700">
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-yellow-500" />
            <span className="min-w-0">
              The meeting room is open. Click "Join Now". The timer starts when
              you and the fresher are both inside.
            </span>
          </div>
        )}
        {isUpcoming && isLive && !timerRunning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-green-600">
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
            <span className="min-w-0">
              Session time reached. The timer starts when you and the fresher
              are both inside.
            </span>
          </div>
        )}
        {isAwaitingConfirmation && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              The timer has ended. Waiting for the fresher to confirm the
              session. Once they click "Yes", your earnings will be released.
            </span>
          </div>
        )}
      </div>

      {detailsFor && (
        <SessionDetailsModal
          session={detailsFor}
          onClose={() => setDetailsFor(null)}
          onMessage={(s) => {
            setDetailsFor(null);
            setUnreadCount(0);
            setChatFor(s);
          }}
        />
      )}
      {chatFor && (
        <ChatPanel
          variant="modal"
          bookingId={chatBookingId}
          token={token}
          role="mentor"
          title={`Chat with ${chatFor.name}`}
          onClose={() => setChatFor(null)}
        />
      )}
    </>
  );
};

const SessionInfo = ({ icon, label, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:p-3">
    <div className="flex items-center gap-1.5 text-slate-400">
      <span className="shrink-0">{icon}</span>
      <span className="truncate text-[10px]">{label}</span>
    </div>
    <p className="mt-1.5 break-words text-[11px] font-semibold text-slate-700 sm:text-xs">
      {value}
    </p>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center shadow-sm sm:py-20">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
      <CalendarDays size={25} className="text-blue-500" />
    </div>
    <h3 className="mt-5 text-base font-semibold text-slate-900 sm:text-lg">
      {title}
    </h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
      {description}
    </p>
  </div>
);

export default MentorSessions;