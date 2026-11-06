// src/MncEmployee/pages/MentorSessions.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import useChatNotificationSound from "../../hooks/useChatNotificationSound";
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
  UserRound,
  Users,
  Mail,
  X,
  MapPin,
  GraduationCap,
} from "lucide-react";
import useMentorSessions from "../../hooks/useMentorSessions";
import { inr, api, ENDPOINTS, EVENTS } from "../../services/mentorApi";
import { socket } from "../../utils/socket";
import { notifySessionsChanged } from "../../utils/sessionEvents";
import {
  JOIN_OPEN_MS,
  FINAL_WARNING_MS,
  TIMER_POLL_MS,
  hasTimerFinished,
} from "../../utils/sessionTiming";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import PersonDetailsModal from "../../Commoncomponents/Persondetailsmodal";

const INDIA_TIMEZONE = "Asia/Kolkata";
const TABS = ["Upcoming", "Awaiting Confirmation", "Completed", "Cancelled"];

// Status only moves forward: Upcoming -> awaiting_confirmation -> Completed/Cancelled
const STATUS_RANK = {
  Upcoming: 0,
  awaiting_confirmation: 1,
  Completed: 2,
  Cancelled: 2,
};

// booking.status (backend) -> status used by this page
const mapBookingStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "awaiting_confirmation":
      return "awaiting_confirmation";
    case "completed":
      return "Completed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ */
/* GROUP FIX                                                           */
/* The backend returns one row per PAYMENT (host + every friend), all  */
/* with the SAME session id (= requestGroupId). That showed 2 cards    */
/* for ONE meeting. Here we merge rows with the same id into ONE card: */
/*   - members      : how many freshers paid                           */
/*   - memberNames  : their names (no duplicates)                      */
/*   - earning      : total of every member's earning                  */
/* ------------------------------------------------------------------ */
const mergeGroupSessions = (list) => {
  const map = new Map();

  list.forEach((s) => {
    const key = String(s.id);
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        ...s,
        members: 1,
        memberNames: s.name ? [s.name] : [],
      });
      return;
    }

    prev.members += 1;
    if (s.name && !prev.memberNames.includes(s.name)) {
      prev.memberNames.push(s.name);
    }
    prev.earning = (Number(prev.earning) || 0) + (Number(s.earning) || 0);

    // keep the furthest status if rows disagree (status only moves forward)
    if ((STATUS_RANK[s.status] ?? 0) > (STATUS_RANK[prev.status] ?? 0)) {
      prev.status = s.status;
    }
  });

  return [...map.values()];
};

/* ------------------------------------------------------------------ */
/* Circular loader with label (MUI) – shown until the session becomes */
/* Completed. Spinner is indeterminate (confirmation time is unknown),*/
/* the label in the middle shows how long we have been waiting.       */
/* ------------------------------------------------------------------ */
const CircularProgressWithLabel = ({ label, size = 54, color = "#D97706" }) => (
  <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
    <CircularProgress
      variant="indeterminate"
      size={size}
      thickness={4}
      aria-label="Waiting for session to complete"
      sx={{ color }}
    />
    <Box
      sx={{
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography
        variant="caption"
        component="div"
        sx={{
          color: "#92400E",
          fontSize: "10px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {label}
      </Typography>
    </Box>
  </Box>
);

const SessionFinalizingIndicator = ({
  elapsedMs = 0,
  title = "Session finished — finalizing",
  description = "Waiting for the fresher to confirm. Once confirmed, your session will move to Completed and your earnings will be released. If there is no response before the confirmation deadline, the system will finalize it automatically according to the platform policy.",
}) => {
  const s = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const label = h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(sec)}`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
        border: "1px solid",
        borderColor: "#FDE68A",
        borderRadius: "12px",
        backgroundColor: "#FFFBEB",
        padding: 2,
      }}
      role="status"
      aria-live="polite"
    >
      <CircularProgressWithLabel label={label} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{ color: "#92400E", fontSize: "13px", fontWeight: 700 }}
        >
          {title}
        </Typography>
        <Typography
          component="p"
          sx={{ color: "#A16207", fontSize: "12px", lineHeight: 1.5 }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  );
};

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
  // same window as the fresher side (shared constant)
  const joinOpen = session.startsAt - JOIN_OPEN_MS;
  return {
    isLive: nowMs >= session.startsAt && nowMs < session.endsAt,
    isJoinWindow: nowMs >= joinOpen && nowMs < session.startsAt,
    hasEnded: nowMs >= session.endsAt,
    joinOpenAt: new Date(joinOpen),
    sessionEndAt: new Date(session.endsAt),
    msUntilStart: Math.max(0, session.startsAt - nowMs),
  };
};

/* ------------------------------------------------------------------ */
/* GROUP details modal                                                 */
/* LEFT  : every fresher of the group (host first)                     */
/* RIGHT : full details of the selected fresher                        */
/* A field is shown only when the fresher has a value for it.          */
/* ------------------------------------------------------------------ */
const eduText = (e) => {
  if (!e) return "";
  if (typeof e === "string") return e;
  return Object.values(e)
    .filter(
      (v) =>
        (typeof v === "string" || typeof v === "number") && String(v).trim(),
    )
    .join(" · ");
};

const Avatar = ({ p, size = "h-10 w-10", text = "text-sm" }) =>
  p.image ? (
    <img
      src={p.image}
      alt={p.name}
      className={`${size} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700`}
    >
      {(p.name || "?").charAt(0).toUpperCase()}
    </div>
  );

const Chips = ({ items, tone = "blue" }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((x) => (
      <span
        key={x}
        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
          tone === "blue"
            ? "bg-blue-50 text-blue-700"
            : "bg-indigo-50 text-indigo-700"
        }`}
      >
        {x}
      </span>
    ))}
  </div>
);

const Section = ({ title, children }) => (
  <div className="mt-4">
    <p className="mb-1.5 text-[11px] font-semibold text-slate-400">{title}</p>
    {children}
  </div>
);

const PersonDetail = ({ p }) => {
  const skills = (p.skills || []).filter(Boolean);
  const interests = (p.interests || []).filter(Boolean);
  const education = (p.education || []).map(eduText).filter(Boolean);
  const place = [p.location, p.nationality].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar p={p} size="h-16 w-16" text="text-xl" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
            {p.name}
            {p.isHost && (
              <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                Host
              </span>
            )}
          </p>
          {p.email && (
            <p className="mt-0.5 flex items-center gap-1.5 break-all text-xs text-slate-500">
              <Mail size={12} /> {p.email}
            </p>
          )}
          {place && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin size={12} /> {place}
            </p>
          )}
          {p.gender && (
            <p className="mt-0.5 text-xs capitalize text-slate-400">
              {p.gender}
            </p>
          )}
        </div>
      </div>

      {p.bio && (
        <Section title="About">
          <p className="text-sm leading-6 text-slate-600">{p.bio}</p>
        </Section>
      )}
      {education.length > 0 && (
        <Section title="Education">
          <ul className="space-y-1">
            {education.map((e) => (
              <li
                key={e}
                className="flex items-start gap-2 text-sm text-slate-600"
              >
                <GraduationCap
                  size={14}
                  className="mt-1 shrink-0 text-slate-400"
                />
                {e}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {skills.length > 0 && (
        <Section title="Skills">
          <Chips items={skills} />
        </Section>
      )}
      {interests.length > 0 && (
        <Section title="Interests">
          <Chips items={interests} tone="indigo" />
        </Section>
      )}
    </div>
  );
};

const GroupDetailsModal = ({ bookingId, onClose }) => {
  const [people, setPeople] = useState(null);
  const [selected, setSelected] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    api(`${ENDPOINTS.booking(bookingId)}/counterpart`)
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.people) && d.people.length) {
          setPeople(d.people);
          return;
        }
        // fallback (old backend): host + names of the others
        const host = d?.person ? [{ ...d.person, isHost: true }] : [];
        const others = (d?.session?.members || [])
          .filter((n) => n && n !== d?.person?.name)
          .map((n, i) => ({ id: `m${i}`, name: n }));
        setPeople([...host, ...others]);
      })
      .catch(
        (e) => !cancelled && setErr(e.message || "Could not load details"),
      );
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const current = people?.[selected] || null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users size={18} className="text-indigo-600" /> Group details
            {people ? ` (${people.length})` : ""}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {err ? (
          <p className="p-5 text-sm text-red-600">{err}</p>
        ) : !people ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* LEFT: users */}
            <ul className="max-h-40 shrink-0 space-y-1 overflow-y-auto border-b border-slate-100 p-3 sm:max-h-none sm:w-60 sm:border-b-0 sm:border-r">
              {people.map((p, i) => (
                <li key={p.id || p.name}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                      i === selected
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <Avatar p={p} size="h-9 w-9" text="text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {p.name}
                      </span>
                      {p.isHost && (
                        <span className="text-[10px] font-medium text-indigo-600">
                          Host
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* RIGHT: selected user's details */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {current && <PersonDetail p={current} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MentorSessions = () => {
  const navigate = useNavigate();
  useChatNotificationSound("mentor");

  const {
    sessions: serverSessions,
    loading,
    error,
    connected,
    reload,
  } = useMentorSessions();

  // id -> { remainingMs, running, at }
  const [timers, setTimers] = useState({});
  // id -> status seen from live booking data (moves the card instantly,
  // without waiting for the sessions list to reload)
  const [statusOverrides, setStatusOverrides] = useState({});

  const [activeTab, setActiveTab] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  // ---- unread chat messages: requestGroupId -> count ----
  const [unreadCounts, setUnreadCounts] = useState({});
  const openChatId = useRef(null);
  const seenMessageIds = useRef(new Set());

  // id -> true when the meeting timer was running at least once
  // (same idea as the fresher My Bookings page -> both sides finish together)
  const wasRunningRef = useRef({});

  // id -> last status we told the header about (avoid spamming it every poll)
  const notifiedStatusRef = useRef({});

  // keep latest reload without re-creating effects
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  // the header owns a separate copy of the sessions -> tell it when a status moved
  const notifyStatus = useCallback((id, status) => {
    const key = String(id);
    if (notifiedStatusRef.current[key] === status) return;
    notifiedStatusRef.current[key] = status;
    notifySessionsChanged(key);
  }, []);

  // GROUP FIX: one booking = one card (merge duplicate rows with the same id)
  const mergedServer = useMemo(
    () => mergeGroupSessions(serverSessions || []),
    [serverSessions],
  );

  // Apply status overrides on top of server data (status only moves forward)
  const sessions = useMemo(
    () =>
      mergedServer.map((s) => {
        const o = statusOverrides[String(s.id)];
        if (!o) return s;
        const serverRank = STATUS_RANK[s.status] ?? 0;
        const overrideRank = STATUS_RANK[o] ?? 0;
        return overrideRank > serverRank ? { ...s, status: o } : s;
      }),
    [mergedServer, statusOverrides],
  );

  const setOverride = useCallback(
    (id, status) => {
      if (!id || !status) return;
      const key = String(id);
      setStatusOverrides((prev) => {
        // status only moves forward
        if ((STATUS_RANK[prev[key]] ?? -1) >= (STATUS_RANK[status] ?? 0))
          return prev;
        return { ...prev, [key]: status };
      });
      notifyStatus(key, status);
    },
    [notifyStatus],
  );

  // 1-second clock
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Refresh the list when the user comes back to this tab / page
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reloadRef.current?.();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // unread counts that are already saved on the server (survives refresh)
  useEffect(() => {
    let cancelled = false;
    api("/chat/unread")
      .then((d) => {
        if (!cancelled && d?.counts) setUnreadCounts(d.counts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // new message from the fresher -> +1 (unless that chat is open right now)
  useEffect(() => {
    const onChatMessage = (message) => {
      if (message.senderRole === "mentor") return;

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

  const handleChatOpen = useCallback((id) => {
    const key = String(id);
    openChatId.current = key;
    setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
  }, []);

  const handleChatClose = useCallback(() => {
    openChatId.current = null;
  }, []);

  // ids of sessions that can still change (stops polling once Completed)
  const activeIds = useMemo(
    () =>
      sessions
        .filter((s) => ["Upcoming", "awaiting_confirmation"].includes(s.status))
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
      const timerResults = {};
      const statusResults = {};
      let changed = false;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await api(ENDPOINTS.booking(id));
            if (d?.booking) {
              const running = Boolean(d.booking.timerRunning);
              const remaining = d.booking.remainingMs;

              if (running) wasRunningRef.current[id] = true;

              timerResults[id] = {
                remainingMs: remaining,
                running,
                at: Date.now(),
              };

              const mapped = mapBookingStatus(d.booking.status);
              if (mapped) {
                statusResults[id] = mapped;
                changed = true;
              } else if (hasTimerFinished(wasRunningRef.current[id], running, remaining)) {
                // timer ran and stopped -> same moment the fresher sees it finish
                statusResults[id] = "awaiting_confirmation";
                changed = true;
              }
            }
          } catch {
            /* ignore single failure */
          }
        }),
      );
      if (cancelled) return;

      setTimers((prev) => ({ ...prev, ...timerResults }));

      if (changed) {
        // move cards to the right tab immediately
        setStatusOverrides((prev) => {
          const next = { ...prev };
          let diff = false;
          Object.entries(statusResults).forEach(([id, st]) => {
            const cur = STATUS_RANK[next[id]] ?? -1;
            if ((STATUS_RANK[st] ?? 0) > cur) {
              next[id] = st;
              diff = true;
            }
          });
          return diff ? next : prev;
        });

        // tell the header (only once per status change)
        Object.entries(statusResults).forEach(([id, st]) => {
          if (st !== "Upcoming") notifyStatus(id, st);
        });

        // and sync the real list from the server
        const moved = Object.values(statusResults).some(
          (st) => st !== "Upcoming",
        );
        if (moved) reloadRef.current?.();
      }
    };

    fetchTimers();
    const t = setInterval(fetchTimers, TIMER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeIds, notifyStatus]);

  // Socket updates (instant when server sends them to this user)
  useEffect(() => {
    const onTimer = (p) => {
      const id = p?.requestGroupId || p?.bookingId;
      if (!id) return;

      const mapped = mapBookingStatus(p.status);
      if (mapped) {
        setOverride(id, mapped);
        reloadRef.current?.();
      }

      if (typeof p.remainingMs !== "number") return;

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

      // timer ended -> move the card right away (same as the fresher page)
      if (!mapped && hasTimerFinished(wasRunningRef.current[id], running, p.remainingMs)) {
        setOverride(id, "awaiting_confirmation");
        reloadRef.current?.();
      }
    };
    socket.on("meeting:timer", onTimer);
    socket.on("meeting:state", onTimer);
    return () => {
      socket.off("meeting:timer", onTimer);
      socket.off("meeting:state", onTimer);
    };
  }, [setOverride]);

  // booking updated -> refresh list
  useEffect(() => {
    const onUpdated = (p) => {
      const id = p?.requestGroupId || p?.bookingId || p?.id;
      const mapped = mapBookingStatus(p?.status);
      if (id && mapped) setOverride(id, mapped);
      reloadRef.current?.();
    };
    const evt = EVENTS?.booking || "booking:updated";
    socket.on(evt, onUpdated);
    return () => socket.off(evt, onUpdated);
  }, [setOverride]);

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
          `${s.name} ${(s.memberNames || []).join(" ")} ${s.role} ${s.topic} ${s.type}`
            .toLowerCase()
            .includes(kw)),
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
          {loading && serverSessions.length === 0 ? (
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
                unread={unreadCounts[String(s.id)] || 0}
                onJoin={handleJoin}
                onChatOpen={handleChatOpen}
                onChatClose={handleChatClose}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

/* Message button with the unread badge (same look as the fresher My Bookings page) */
const MessageButton = ({ unread, onClick, className }) => (
  <button type="button" onClick={onClick} className={className}>
    <MessageSquare size={15} />
    Message
    {unread > 0 && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
        {unread > 99 ? "99+" : unread}
      </span>
    )}
  </button>
);

const SessionCard = ({
  session,
  nowMs,
  timer,
  unread,
  onJoin,
  onChatOpen,
  onChatClose,
}) => {
  const [chatFor, setChatFor] = useState(null);
  // fresher details modal
  const [showFresher, setShowFresher] = useState(false);
  const closeFresher = useCallback(() => setShowFresher(false), []);

  const openChat = (s) => {
    onChatOpen(s.id);
    setChatFor(s);
  };
  const closeChat = () => {
    onChatClose();
    setChatFor(null);
  };

  const isUpcoming = session.status === "Upcoming";
  const isAwaitingConfirmation = session.status === "awaiting_confirmation";
  const isCompleted = session.status === "Completed";
  const isCancelled = session.status === "Cancelled";

  // GROUP: several freshers inside ONE meeting
  const memberCount = session.members || 1;
  const isGroup = memberCount > 1 || session.mode === "group";
  const names =
    session.memberNames && session.memberNames.length
      ? session.memberNames
      : [session.name];
  const NAMES_SHOWN = 4;
  const namesText =
    names.slice(0, NAMES_SHOWN).join(", ") +
    (names.length > NAMES_SHOWN ? ` +${names.length - NAMES_SHOWN} more` : "");

  const base = getJoinStatus(session, nowMs);
  const c = countdownParts(base.msUntilStart);
  const pad = (n) => String(n).padStart(2, "0");

  const timeRange =
    session.startsAt && session.endsAt
      ? `${fmtTime(new Date(session.startsAt))} → ${fmtTime(new Date(session.endsAt))}`
      : session.time;

  // ---- LIVE MEETING TIMER (same value + same rules as the fresher side) ----
  const timerActive = isUpcoming && Boolean(timer?.running);
  const baseRemaining =
    typeof timer?.remainingMs === "number"
      ? timer.remainingMs
      : session.remainingMs;
  const remaining =
    timerActive && typeof baseRemaining === "number"
      ? Math.max(0, baseRemaining - (nowMs - (timer?.at || nowMs)))
      : 0;
  // when the clock reaches 0 the meeting is over (do not wait for the server)
  const timerRunning =
    timerActive && (typeof baseRemaining !== "number" || remaining > 0);
  const isFinalWarning = timerRunning && remaining <= FINAL_WARNING_MS;

  const isLive = base.isLive || timerRunning;
  const isJoinWindow = base.isJoinWindow && !timerRunning;
  const hasEnded = base.hasEnded && !timerRunning;
  const { joinOpenAt, sessionEndAt } = base;
  const joinable = isUpcoming && (isLive || isJoinWindow);

  // time since the session ended (used by the loader label)
  const elapsedSinceEnd = session.endsAt ? nowMs - session.endsAt : 0;

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
    "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50";

  // Fresher details button (same on every tab)
  const fresherBtn = (
    <button
      type="button"
      onClick={() => setShowFresher(true)}
      className={secondaryBtn}
    >
      <UserRound size={15} />
      {isGroup ? "Group details" : "Fresher details"}
    </button>
  );

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-4">
            {isGroup ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-indigo-100 bg-indigo-50 text-indigo-600">
                <Users size={22} />
              </div>
            ) : (
              <img
                src={session.avatar}
                alt={session.name}
                className="h-12 w-12 rounded-full border-2 border-blue-100 object-cover"
              />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                {isGroup ? namesText : session.name}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isGroup
                  ? `Group session · ${memberCount} freshers joined`
                  : session.role}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {isGroup && (
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
                    Group · {memberCount}
                    {session.maxMembers ? `/${session.maxMembers}` : ""} members
                  </span>
                )}
                {session.topic && (
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
                    {session.topic}
                  </span>
                )}
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                  {isGroup ? "Group Video Call" : session.type}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
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
              label={isGroup ? "You earn (total)" : "You earn"}
              value={inr(session.earning ?? 0)}
            />
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
                <p
                  className={`text-[11px] font-semibold ${isFinalWarning ? "text-amber-800" : "text-emerald-800"}`}
                >
                  {isFinalWarning
                    ? "Final 5 minutes — start wrapping up"
                    : "Session in progress"}
                </p>
                <p
                  className={`text-[10px] ${isFinalWarning ? "text-amber-700" : "text-emerald-600"}`}
                >
                  {isFinalWarning
                    ? isGroup
                      ? "Ask the host to confirm the session went well"
                      : "Ask the fresher to confirm the session went well"
                    : `Time left in the meeting · ${timeRange}`}
                </p>
              </div>
            </div>
            <div
              className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums ${
                isFinalWarning
                  ? "bg-amber-200 text-amber-900"
                  : "bg-emerald-200 text-emerald-900"
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
                <span className="text-xs font-medium text-amber-700">
                  Waiting for {isGroup ? "host" : "fresher"} to confirm
                </span>
              </>
            )}
            {isCompleted && (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600">
                  Completed · Earnings released
                </span>
              </>
            )}
            {isCancelled && (
              <>
                <XCircle size={16} className="text-red-500" />
                <span className="text-xs font-medium text-red-500">
                  Cancelled
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* UPCOMING: Fresher details + Message + Join */}
            {isUpcoming && !hasEnded && (
              <>
                {fresherBtn}
                <MessageButton
                  unread={unread}
                  onClick={() => openChat(session)}
                  className={secondaryBtn}
                />
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

            {/* AWAITING / COMPLETED / CANCELLED: Fresher details + Message */}
            {(isCompleted || isCancelled || isAwaitingConfirmation) && (
              <>
                {fresherBtn}
                <MessageButton
                  unread={unread}
                  onClick={() => openChat(session)}
                  className={secondaryBtn}
                />
              </>
            )}

            {/* Upcoming but already ended (status is still updating) */}
            {isUpcoming && hasEnded && fresherBtn}
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
              The meeting room is open. Click "Join Now". The timer starts when
              you and the {isGroup ? "host" : "fresher"} are both inside.
            </span>
          </div>
        )}
        {isUpcoming && isLive && !timerRunning && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-green-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span>
              Session time reached. The timer starts when you and the{" "}
              {isGroup ? "host" : "fresher"} are both inside.
            </span>
          </div>
        )}

        {/* Loader: shown from the moment the meeting ends until it is Completed */}
        {isUpcoming && hasEnded && (
          <div className="mt-4">
            <SessionFinalizingIndicator
              elapsedMs={elapsedSinceEnd}
              title="Session ended — updating status"
              description="Checking the final status of this session. It will move to Awaiting Confirmation or Completed automatically."
            />
          </div>
        )}
        {isAwaitingConfirmation && (
          <div className="mt-4">
            <SessionFinalizingIndicator elapsedMs={elapsedSinceEnd} />
          </div>
        )}
      </div>

      {chatFor && (
        <ChatPanel
          variant="modal"
          bookingId={chatFor.id}
          role="mentor"
          group={isGroup}
          title={isGroup ? "Group chat" : `Chat with ${chatFor.name}`}
          onClose={closeChat}
        />
      )}
      {showFresher &&
        (isGroup ? (
          <GroupDetailsModal bookingId={session.id} onClose={closeFresher} />
        ) : (
          <PersonDetailsModal
            title="Fresher details"
            fetcher={() => api(`${ENDPOINTS.booking(session.id)}/counterpart`)}
            onClose={closeFresher}
          />
        ))}
    </>
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