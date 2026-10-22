import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, Video, Building2, UserRound, Inbox, Loader2, Radio, Star, ArrowRight, IndianRupee } from "lucide-react";
import useLive from "../../hooks/useLive";
import ReviewModal from "../pages/Reviewmodal";
import socket from "../../socket";
import { api, ENDPOINTS, EVENTS, getUserId, durationLabel, fmtClock, inr } from "../../services/fresherApi";

const FINAL_WARNING_MS = 5 * 60 * 1000;
const TIMER_POLL_MS = 3000;
const IST = "Asia/Kolkata";

const fmtTimeIST = (ms) =>
  Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true })
    : "";

const NO_TIMER_STATUSES = ["completed", "awaiting_confirmation", "disputed", "pending", "expired", "missed", "cancelled"];

const MyBookings = () => {
  const navigate = useNavigate();
  const userId = useMemo(() => getUserId(), []);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("upcoming");
  const [dismissedReview, setDismissedReview] = useState(null);

  // requestGroupId -> { remainingMs, running, at }
  const [timers, setTimers] = useState({});

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

  // Timer values that come with the list (if backend sends them)
  useEffect(() => {
    const fromList = {};
    bookings.forEach((b) => {
      if (typeof b.remainingMs === "number") {
        fromList[b.requestGroupId] = {
          remainingMs: b.remainingMs,
          running: Boolean(b.timerRunning),
          at: Date.now(),
        };
      }
    });
    if (Object.keys(fromList).length) setTimers((prev) => ({ ...prev, ...fromList }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ids of bookings that can have a live meeting
  const activeIds = useMemo(
    () =>
      bookings
        .filter((b) => !NO_TIMER_STATUSES.includes(b.status))
        .map((b) => b.requestGroupId)
        .join(","),
    [bookings]
  );

  // Poll each active booking -> same timer as inside the meeting room
  useEffect(() => {
    if (!activeIds) return undefined;
    const ids = activeIds.split(",");
    let cancelled = false;

    const fetchTimers = async () => {
      const results = {};
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
              // meeting finished on the server -> refresh the list
              if (["awaiting_confirmation", "completed"].includes(d.booking.status)) reload();
            }
          } catch {
            /* ignore single failure */
          }
        })
      );
      if (!cancelled) setTimers((prev) => ({ ...prev, ...results }));
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

  const timerOf = (b) => {
    const t = timers[b.requestGroupId];
    if (!t?.running || typeof t.remainingMs !== "number") return null;
    return Math.max(0, t.remainingMs - (now - t.at));
  };

  const view = (b) => {
    const starts = new Date(b.startsAt).getTime();
    const ends = new Date(b.endsAt).getTime();
    const opens = starts - 5 * 60000;
    const left = timerOf(b);

    if (["completed", "awaiting_confirmation", "disputed"].includes(b.status)) {
      if (b.reviewed) return { key: "done", label: "Completed", tone: "emerald" };
      if (b.status === "disputed") return { key: "refunded", label: "Refunded", tone: "slate" };
      return { key: "review", label: "Review required", tone: "red" };
    }

    if (b.status === "pending") return { key: "pending", label: "Waiting for an employee", tone: "amber" };
    if (b.status === "expired" || b.status === "missed") return { key: "refunded", label: "Refunded", tone: "slate" };

    // live meeting timer running
    if (left !== null && left > 0) return { key: "open", label: "In progress", tone: "green", opens, starts };

    // timer reached 0 -> server is moving it to confirmation, keep it in upcoming until status changes
    if (left !== null && left <= 0) return { key: "open", label: "Finishing…", tone: "amber", opens, starts };

    if (now >= ends) return { key: "ended", label: "Meeting ended", tone: "slate" };
    if (now >= opens && now < ends) return { key: "open", label: "Meeting open", tone: "green", opens, starts };

    return { key: "confirmed", label: "Confirmed", tone: "blue", opens, starts };
  };

  const decorated = useMemo(() => bookings.map((b) => ({ b, v: view(b) })), [bookings, now, timers]); // eslint-disable-line

  const upcoming = decorated.filter(({ v }) => ["pending", "confirmed", "open"].includes(v.key));
  const past = decorated.filter(({ v }) => ["done", "refunded", "review", "ended"].includes(v.key));
  const list = tab === "upcoming" ? upcoming : past;

  const needsReview = decorated.find(({ v, b }) => v.key === "review" && b.requestGroupId !== dismissedReview)?.b;

  const tones = {
    amber: "bg-amber-50 text-amber-700", slate: "bg-slate-100 text-slate-600", emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700", green: "bg-green-50 text-green-700", blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-600">MNCConnect</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">My Bookings</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              Updates live.
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}>
                <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
              </span>
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[["upcoming", `Upcoming (${upcoming.length})`], ["past", `Past (${past.length})`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error} <button onClick={reload} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : list.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100"><Inbox className="h-8 w-8 text-slate-400" /></div>
            <h2 className="text-xl font-bold text-slate-800">{tab === "upcoming" ? "No upcoming sessions" : "No past sessions"}</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">Pick a company, choose a time and an employee will accept your request.</p>
            <button onClick={() => navigate("/Home")} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Browse companies</button>
          </div>
        ) : (
          <div className="space-y-5">
            {list.map(({ b, v }) => {
              const left = timerOf(b);
              const warn = left !== null && left <= FINAL_WARNING_MS;
              const startMs = new Date(b.startsAt).getTime();
              const endMs = new Date(b.endsAt).getTime();
              const range = Number.isFinite(startMs) && Number.isFinite(endMs)
                ? `${fmtTimeIST(startMs)} → ${fmtTimeIST(endMs)}`
                : b.time;

              return (
                <div key={b.requestGroupId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50"><Video className="h-7 w-7 text-blue-600" /></div>
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-bold text-slate-900">{b.sessionType || "Mentoring session"}</h2>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[v.tone]}`}>{v.label}</span>
                        </div>
                        <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" />{b.companyName}</span>
                          <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{b.mentor?.name || "Waiting for an employee"}</span>
                          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{b.date}</span>
                          <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{range} · {durationLabel(b.durationMinutes)}</span>
                        </div>
                        {b.reason && <p className="mt-3 line-clamp-2 text-sm text-slate-500">"{b.reason}"</p>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                      {v.key === "open" && (
                        <Link to={`/Home/meeting/${b.requestGroupId}`} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700">
                          <Video className="h-4 w-4" /> {left !== null ? "Rejoin meeting" : "Join meeting"} <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                      {v.key === "confirmed" && (
                        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center text-xs text-blue-700">
                          Room opens in <b className="font-mono text-sm">{fmtClock(v.opens - now)}</b>
                        </div>
                      )}
                      {v.key === "pending" && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                          <Loader2 className="h-4 w-4 animate-spin" /> Waiting…
                        </div>
                      )}
                      {v.key === "review" && (
                        <button type="button" onClick={() => setDismissedReview(null)} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700">
                          <Star className="h-4 w-4" /> Write review
                        </button>
                      )}
                      {v.key === "done" && <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Completed</div>}
                      {(v.key === "refunded" || v.key === "ended") && (
                        <div className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-600">
                          <IndianRupee className="h-3.5 w-3.5" /> {inr(b.amount)} {b.refundStatus === "failed" ? "refund processing" : b.refundStatus === "refunded" ? "refunded" : "amount held"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LIVE TIMER - same value as inside the meeting room */}
                  {left !== null && (
                    <div className={`mx-5 mb-4 flex items-center justify-between gap-4 rounded-xl border p-3 sm:mx-6 ${warn ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div>
                        <p className={`text-xs font-semibold ${warn ? "text-amber-800" : "text-emerald-800"}`}>
                          {warn ? "Final 5 minutes" : "Session in progress"}
                        </p>
                        <p className={`text-[11px] ${warn ? "text-amber-700" : "text-emerald-600"}`}>
                          Time left · {range}
                        </p>
                      </div>
                      <div className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums ${warn ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"}`}>
                        {fmtClock(left)}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
                    <span>Booking ID: <b className="text-slate-700">{b.requestGroupId}</b></span>
                    <span className="font-semibold text-slate-700">{inr(b.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {needsReview && <ReviewModal booking={needsReview} onDone={() => { setDismissedReview(needsReview.requestGroupId); reload(); }} />}
    </div>
  );
};

export default MyBookings;