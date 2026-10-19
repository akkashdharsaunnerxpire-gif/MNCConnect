import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, Video, Search, MessageSquare, Star, XCircle, Loader2, Radio } from "lucide-react";
import useMentorSessions from "../../hooks/useMentorSessions";
import { inr } from "../../services/mentorApi";

const INDIA_TIMEZONE = "Asia/Kolkata";
const JOIN_WINDOW_MINUTES = 5; // the meeting room opens 5 minutes before the start time
const TABS = ["Upcoming", "Completed", "Cancelled"];

const fmtDateTime = (d) =>
  d?.toLocaleString("en-IN", {
    timeZone: INDIA_TIMEZONE, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }) || "";

const fmtTime = (d) =>
  d?.toLocaleTimeString("en-IN", { timeZone: INDIA_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true }) || "";

const countdownParts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
};

// Join state comes straight from the server times (startsAt / endsAt)
//   isLive       -> session has started and not ended yet
//   isJoinWindow -> starts within JOIN_WINDOW_MINUTES (early join allowed)
const getJoinStatus = (session, nowMs) => {
  if (!session.startsAt || !session.endsAt) {
    return { isLive: false, isJoinWindow: false, hasEnded: false, joinOpenAt: null, sessionEndAt: null, msUntilStart: 0 };
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
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, sessions.filter((s) => s.status === t).length])),
    [sessions]
  );

  const filtered = useMemo(() => {
    const kw = search.toLowerCase().trim();
    const list = sessions.filter(
      (s) =>
        s.status === activeTab &&
        (!kw || `${s.name} ${s.role} ${s.topic} ${s.type}`.toLowerCase().includes(kw))
    );
    // Upcoming: soonest first. Completed / Cancelled: most recent first.
    const dir = activeTab === "Upcoming" ? 1 : -1;
    return list.sort((a, b) => dir * ((a.startsAt || 0) - (b.startsAt || 0)));
  }, [sessions, activeTab, search]);

  // session.id is the requestGroupId, the same id the fresher joins with.
  const handleJoin = (session) => navigate(`/mentor/meeting/${encodeURIComponent(session.id)}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {tab}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}>
              <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
            </span>
            <div className="relative w-full lg:w-80">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error} <button onClick={reload} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title={`No ${activeTab.toLowerCase()} sessions`} description="Accepted sessions appear here automatically." />
          ) : (
            filtered.map((s) => <SessionCard key={s.id} session={s} nowMs={nowMs} onJoin={handleJoin} />)
          )}
        </div>
      </main>
    </div>
  );
};

const SessionCard = ({ session, nowMs, onJoin }) => {
  const isUpcoming = session.status === "Upcoming";
  const isCompleted = session.status === "Completed";
  const isCancelled = session.status === "Cancelled";

  const { isLive, isJoinWindow, hasEnded, joinOpenAt, sessionEndAt, msUntilStart } = getJoinStatus(session, nowMs);
  const c = countdownParts(msUntilStart);
  const pad = (n) => String(n).padStart(2, "0");
  const joinable = isUpcoming && (isLive || isJoinWindow);

  const btnStyle = isLive
    ? "bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 cursor-pointer"
    : isJoinWindow
    ? "bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-200 cursor-pointer"
    : "bg-blue-600 text-white cursor-not-allowed";

  const btnContent = isLive ? (
    <><Video size={14} /><span>Join Session</span></>
  ) : isJoinWindow ? (
    <><Video size={14} /><span>Join Now</span></>
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
          <img src={session.avatar} alt={session.name} className="h-12 w-12 rounded-full border-2 border-blue-100 object-cover" />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{session.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{session.role}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.topic && <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">{session.topic}</span>}
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">{session.type}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[500px]">
          <SessionInfo icon={<CalendarDays size={15} />} label="Date" value={session.date} />
          <SessionInfo icon={<Clock3 size={15} />} label="Time" value={session.time} />
          <SessionInfo icon={<Video size={15} />} label="Duration" value={session.duration} />
          <SessionInfo icon={<Star size={15} />} label="You earn" value={inr(session.earning ?? 0)} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {isUpcoming && !hasEnded && (<><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><span className="text-xs font-medium text-emerald-600">Upcoming Session</span></>)}
          {/* time is over but the server hasn't marked it completed yet -> don't leave the card blank */}
          {isUpcoming && hasEnded && (<><Clock3 size={16} className="text-slate-400" /><span className="text-xs font-medium text-slate-500">Session ended · updating status…</span></>)}
          {isCompleted && (<><CheckCircle2 size={16} className="text-emerald-500" /><span className="text-xs font-medium text-emerald-600">Completed</span></>)}
          {isCancelled && (<><XCircle size={16} className="text-red-500" /><span className="text-xs font-medium text-red-500">Cancelled</span></>)}
        </div>

        <div className="flex gap-2">
          {isUpcoming && !hasEnded && (
            <>
              <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                <MessageSquare size={15} /> Message
              </button>
              <button
                type="button" disabled={!joinable} onClick={() => joinable && onJoin(session)}
                className={`flex min-w-[150px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${btnStyle}`}
              >
                {btnContent}
              </button>
            </>
          )}
          {(isCompleted || isCancelled) && (
            <button type="button" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100">
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
            {sessionEndAt && <> · Ends at <strong>{fmtTime(sessionEndAt)}</strong></>}
          </span>
        </div>
      )}
      {isUpcoming && isJoinWindow && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-medium text-yellow-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          <span>The meeting room is open. Click "Join Now". The timer starts when you and the fresher are both inside.</span>
        </div>
      )}
      {isUpcoming && isLive && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-green-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span>Session is live! Click "Join Session" to enter.</span>
        </div>
      )}
    </div>
  );
};

const SessionInfo = ({ icon, label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
    <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-[10px]">{label}</span></div>
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