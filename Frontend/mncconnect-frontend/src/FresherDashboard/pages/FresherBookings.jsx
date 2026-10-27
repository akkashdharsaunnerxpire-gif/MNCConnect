import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import useLive from "../../hooks/useLive";
import ReviewModal from "../pages/Reviewmodal";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import {socket} from "../../utils/socket";
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

const MyBookings = () => {
  const navigate = useNavigate();
  const [unreadCounts, setUnreadCounts] = useState({});
  const userId = useMemo(() => getUserId(), []);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("upcoming");
  const [dismissedReview, setDismissedReview] = useState(null);

  // chat
  const [chatFor, setChatFor] = useState(null);
  const token = localStorage.getItem("fresher_token") || "";

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

  // mark a meeting as finished (moves it to Past) + refresh from server
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

  // Unread badge.
  const seenMessageIds = useRef(new Set());
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

      if (String(chatFor?.requestGroupId || "") === id) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [id]: (prev[id] || 0) + 1,
      }));
    };

    socket.on("chat:message", onChatMessage);

    return () => {
      socket.off("chat:message", onChatMessage);
    };
  }, [chatFor]);

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

  // ids of bookings that can have a live meeting
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

              // server says meeting is over
              if (DONE_STATUSES.includes(d.booking.status)) {
                justFinished.push(id);
              }
              // timer was running before and now it is stopped / reached 0
              else if (
                wasRunningRef.current[id] &&
                (!running ||
                  (typeof remaining === "number" && remaining <= 0))
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

      // timer stopped / hit 0 after it had been running
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

  // raw countdown (ignores finished flag)
  const rawLeft = (b) => {
    const t = timers[b.requestGroupId];
    if (!t?.running || typeof t.remainingMs !== "number") return null;
    return Math.max(0, t.remainingMs - (now - t.at));
  };

  // countdown shown in UI -> null once the meeting is finished
  const timerOf = (b) => {
    if (finishedIds[b.requestGroupId]) return null;
    return rawLeft(b);
  };

  // Every second: if a running timer reached 0 -> meeting finished -> move to Past
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
    const opens = starts - 5 * 60000;
    const left = timerOf(b);
    const finished = Boolean(finishedIds[b.requestGroupId]);

    if (DONE_STATUSES.includes(b.status)) {
      if (b.reviewed)
        return { key: "done", label: "Completed", tone: "emerald" };
      if (b.status === "disputed")
        return { key: "refunded", label: "Refunded", tone: "slate" };
      return { key: "review", label: "Review required", tone: "red" };
    }

    if (b.status === "pending")
      return {
        key: "pending",
        label: b.direct ? "Waiting for your mentor" : "Waiting for an employee",
        tone: "amber",
      };
    if (b.status === "expired" || b.status === "missed")
      return { key: "refunded", label: "Refunded", tone: "slate" };

    // live meeting timer running
    if (left !== null && left > 0)
      return {
        key: "open",
        label: "In progress",
        tone: "green",
        opens,
        starts,
      };

    // meeting finished (timer hit 0) -> move to Past right away,
    // even if the server status has not changed yet
    if (finished) {
      if (b.reviewed)
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
              const canChat =
                Boolean(b.mentor) &&
                !NO_CHAT_STATUSES.includes(b.status) &&
                v.key !== "pending";
              // past + session really happened + we know the mentor
              const sessionHappened =
                ["completed", "awaiting_confirmation"].includes(b.status) ||
                Boolean(finishedIds[b.requestGroupId]);
              const canRebook =
                tab === "past" && sessionHappened && Boolean(b.mentor?.id);

              return (
                <div
                  key={b.requestGroupId}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                        <Video className="h-7 w-7 text-blue-600" />
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
                        </div>
                        <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            {b.companyName}
                          </span>
                          <span className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            {b.mentor?.name || "Waiting for an employee"}
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
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                          <Loader2 className="h-4 w-4 animate-spin" /> Waiting...
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
                              ? "refunded"
                              : "amount held"}
                        </div>
                      )}

                      {/* BOOK AGAIN with the same mentor -> opens the booking form directly */}
                      {canRebook && (
                        <button
                          type="button"
                          onClick={() => bookAgain(b)}
                          className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <RotateCcw className="h-4 w-4" /> Book again
                        </button>
                      )}

                      {/* MESSAGE (only after an employee accepted) */}
                      {canChat && (
                        <button
                          type="button"
                          onClick={() => {
                            setUnreadCounts((prev) => ({
                              ...prev,
                              [b.requestGroupId]: 0,
                            }));

                            setChatFor(b);
                          }}
                          className="relative flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="relative inline-flex">
                            <MessageSquare className="h-4 w-4" />

                            {(unreadCounts[b.requestGroupId] || 0) > 0 && (
                              <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                {unreadCounts[b.requestGroupId] > 99
                                  ? "99+"
                                  : unreadCounts[b.requestGroupId]}
                              </span>
                            )}
                          </span>
                          Message
                        </button>
                      )}
                    </div>
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
          token={token}
          role="fresher"
          title={`Chat with ${chatFor.mentor?.name || "employee"}`}
          onClose={() => setChatFor(null)}
        />
      )}
    </div>
  );
};

export default MyBookings;