// src/MncEmployee/pages/MentorSessions.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import useChatNotificationSound from "../../hooks/useChatNotificationSound";
import { createPortal } from "react-dom";
import {
  JOIN_OPEN_MS,
  FINAL_WARNING_MS,
  TIMER_POLL_MS,
  hasTimerFinished,
  isPollWindow,
} from "../../utils/sessionTiming";
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
import { fixUrl, findImage } from "../../utils/imageUrl";
import ChatPanel from "../../Commoncomponents/Chatpanel";
import PersonDetailsModal from "../../Commoncomponents/Persondetailsmodal";

const INDIA_TIMEZONE = "Asia/Kolkata";
const TABS = ["Upcoming", "Awaiting Confirmation", "Completed", "Cancelled"];

const STATUS_RANK = {
  Upcoming: 0,
  awaiting_confirmation: 1,
  Completed: 2,
  Cancelled: 2,
};

const mapBookingStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "awaiting_confirmation":
      return "awaiting_confirmation";
    case "completed":
      return "Completed";
    case "canceled":
    case "missed":
    case "expired":
    case "disputed":
      return "Cancelled";
    default:
      return null;
  }
};

// group or single? (several freshers, mode "group", or type "Group Video Call")
const isGroupSession = (s) =>
  (Number(s?.members) || 1) > 1 ||
  s?.mode === "group" ||
  /group/i.test(String(s?.type || ""));

const imageOfPerson = (p) => findImage(p);

const photoCache = new Map(); // sessionId -> Promise<string>

const loadPersonImage = (id) => {
  const key = String(id);

  if (!photoCache.has(key)) {
    const promise = api(`${ENDPOINTS.booking(key)}/counterpart`)
      .then((d) => {
        // Try every possible structure the backend might return
        return imageOfPerson(
          d?.person ||
            d?.fresher ||
            d?.user ||
            d?.counterpart ||
            d?.people?.[0] ||
            d,
        );
      })
      .catch(() => {
        photoCache.delete(key); // allow a retry next time
        return "";
      });
    photoCache.set(key, promise);
  }

  return photoCache.get(key);
};

const usePersonImage = (id, existing, enabled) => {
  const [loaded, setLoaded] = useState("");

  useEffect(() => {
    if (!enabled || !id) {
      setLoaded("");
      return undefined;
    }

    // Check if we already have a valid image directly from the session object
    if (existing && existing.trim() !== "") {
      return undefined;
    }

    let alive = true;
    loadPersonImage(id).then((url) => {
      if (alive) setLoaded(url);
    });

    return () => {
      alive = false;
    };
  }, [id, existing, enabled]);

  return existing || loaded;
};

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

    if ((STATUS_RANK[s.status] ?? 0) > (STATUS_RANK[prev.status] ?? 0)) {
      prev.status = s.status;
    }
  });

  return [...map.values()];
};

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

const getJoinStatus = (session, nowMs) => {
  if (!session.startsAt || !session.endsAt) {
    return {
      isLive: false,
      isJoinWindow: false,
      hasEnded: false,
      joinOpenAt: null,
      sessionEndAt: null,
      msUntilStart: 0,
      msUntilOpen: 0,
    };
  }
  const joinOpen = session.startsAt - JOIN_OPEN_MS;
  return {
    isLive: nowMs >= session.startsAt && nowMs < session.endsAt,
    isJoinWindow: nowMs >= joinOpen && nowMs < session.startsAt,
    hasEnded: nowMs >= session.endsAt,
    joinOpenAt: new Date(joinOpen),
    sessionEndAt: new Date(session.endsAt),
    msUntilStart: Math.max(0, session.startsAt - nowMs),
    msUntilOpen: Math.max(0, joinOpen - nowMs),
  };
};

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

const Avatar = ({
  p,
  size = "h-10 w-10",
  text = "text-sm",
  className = "",
}) => {
  const [failed, setFailed] = useState(false);
  const src = fixUrl(p.image) || fixUrl(p.avatar) || findImage(p);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return src && !failed ? (
    <img
      src={src}
      alt={p.name}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      className={`${size} shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600 border border-blue-100 ${className}`}
    >
      {(p.name || "?").charAt(0).toUpperCase()}
    </div>
  );
};

/* ---------- session type badge (Group / 1:1) ---------- */

const SessionBadge = ({ group, members, maxMembers }) =>
  group ? (
    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
      <Users size={12} /> Group session
      {maxMembers
        ? ` · ${members}/${maxMembers} joined`
        : members > 1
          ? ` · ${members} joined`
          : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
      <Video size={12} /> 1:1 Session
    </span>
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

  return createPortal(
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

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {current && <PersonDetail p={current} />}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
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

  const [timers, setTimers] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});

  const [activeTab, setActiveTab] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const [unreadCounts, setUnreadCounts] = useState({});
  const openChatId = useRef(null);
  const seenMessageIds = useRef(new Set());
  const wasRunningRef = useRef({});
  const notifiedStatusRef = useRef({});

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const notifyStatus = useCallback((id, status) => {
    const key = String(id);
    if (notifiedStatusRef.current[key] === status) return;
    notifiedStatusRef.current[key] = status;
    notifySessionsChanged(key);
  }, []);

  const mergedServer = useMemo(
    () => mergeGroupSessions(serverSessions || []),
    [serverSessions],
  );

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

  const sessionsRef = useRef([]);
  sessionsRef.current = sessions;

  const initialLoading = loading && (serverSessions || []).length === 0;

  const setOverride = useCallback(
    (id, status) => {
      if (!id || !status) return;
      const key = String(id);
      setStatusOverrides((prev) => {
        if ((STATUS_RANK[prev[key]] ?? -1) >= (STATUS_RANK[status] ?? 0))
          return prev;
        return { ...prev, [key]: status };
      });
      notifyStatus(key, status);
    },
    [notifyStatus],
  );

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const activeIds = useMemo(
    () =>
      sessions
        .filter((s) => ["Upcoming", "awaiting_confirmation"].includes(s.status))
        .map((s) => s.id)
        .join(","),
    [sessions],
  );

  useEffect(() => {
    if (!activeIds) return undefined;
    const ids = activeIds.split(",");
    let cancelled = false;

    const fetchTimers = async () => {
      const nowTs = Date.now();
      const due = ids.filter((id) => {
        const s = sessionsRef.current.find((x) => String(x.id) === String(id));
        return (
          s &&
          (s.status === "awaiting_confirmation" ||
            isPollWindow(s.startsAt, s.endsAt, nowTs))
        );
      });
      if (!due.length) return;

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
              } else if (
                hasTimerFinished(wasRunningRef.current[id], running, remaining)
              ) {
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

        Object.entries(statusResults).forEach(([id, st]) => {
          if (st !== "Upcoming") notifyStatus(id, st);
        });

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

      if (
        !mapped &&
        hasTimerFinished(wasRunningRef.current[id], running, p.remainingMs)
      ) {
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

  const location = useLocation();
  const [autoOpenId, setAutoOpenId] = useState(null);

  useEffect(() => {
    const id = location.state?.openChatId;
    if (!id) return;
    setAutoOpenId(String(id));
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (!autoOpenId) return;
    const s = sessions.find((x) => String(x.id) === autoOpenId);
    if (!s) return;
    setActiveTab(
      s.status === "awaiting_confirmation" ? "Awaiting Confirmation" : s.status,
    );
  }, [autoOpenId, sessions]);

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
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-sm font-medium text-blue-600">Mentor workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Your Sessions
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            Join, chat and track every session in one place.
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}
            >
              <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
            </span>
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
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
                    {initialLoading ? "–" : counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>

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

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button onClick={reload} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <div className="space-y-4">
          {initialLoading ? (
            <div
              role="status"
              aria-label="Loading sessions"
              className="space-y-4"
            >
              {[0, 1, 2].map((i) => (
                <SessionCardSkeleton key={i} />
              ))}
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
                autoOpen={autoOpenId === String(s.id)}
                onAutoOpened={() => setAutoOpenId(null)}
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
  autoOpen = false,
  onAutoOpened,
}) => {
  const [chatFor, setChatFor] = useState(null);
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
  useEffect(() => {
    if (!autoOpen) return;
    openChat(session);
    onAutoOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const isUpcoming = session.status === "Upcoming";
  const isAwaitingConfirmation = session.status === "awaiting_confirmation";
  const isCompleted = session.status === "Completed";
  const isCancelled = session.status === "Cancelled";

  const memberCount = session.members || 1;
  const isGroup = isGroupSession(session);
  const names =
    session.memberNames && session.memberNames.length
      ? session.memberNames
      : [session.name];
  const NAMES_SHOWN = 4;
  const namesText =
    names.slice(0, NAMES_SHOWN).join(", ") +
    (names.length > NAMES_SHOWN ? ` +${names.length - NAMES_SHOWN} more` : "");

  // Ensure we find an image in the session object, or fallback to the dedicated endpoint
  const initialImage =
    fixUrl(session.avatar) || fixUrl(session.image) || findImage(session);

  const fresherPhoto = usePersonImage(session.id, initialImage, true);

  const base = getJoinStatus(session, nowMs);

  const timeRange =
    session.startsAt && session.endsAt
      ? `${fmtTime(new Date(session.startsAt))} → ${fmtTime(new Date(session.endsAt))}`
      : session.time;

  const timerActive = isUpcoming && Boolean(timer?.running);
  const baseRemaining =
    typeof timer?.remainingMs === "number"
      ? timer.remainingMs
      : session.remainingMs;
  const remaining =
    timerActive && typeof baseRemaining === "number"
      ? Math.max(0, baseRemaining - (nowMs - (timer?.at || nowMs)))
      : 0;
  const timerRunning =
    timerActive && (typeof baseRemaining !== "number" || remaining > 0);
  const isFinalWarning = timerRunning && remaining <= FINAL_WARNING_MS;

  const isLive = base.isLive || timerRunning;
  const isJoinWindow = base.isJoinWindow && !timerRunning;
  const hasEnded = base.hasEnded && !timerRunning;
  const { joinOpenAt, sessionEndAt } = base;
  const joinable = isUpcoming && (isLive || isJoinWindow);

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
        Opens in {fmtClock(base.msUntilOpen)}
      </span>
    </>
  );

  const secondaryBtn =
    "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50";

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
              <Avatar
                p={{
                  name: session.name,
                  image: fresherPhoto,
                }}
                size="h-12 w-12"
                text="text-sm"
                className="border border-blue-100"
              />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                {isGroup ? namesText : session.name}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isGroup
                  ? `${memberCount}${session.maxMembers ? `/${session.maxMembers}` : ""} freshers joined`
                  : session.role}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SessionBadge
                  group={isGroup}
                  members={memberCount}
                  maxMembers={session.maxMembers}
                />
                {session.topic && (
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600">
                    {session.topic}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[580px]">
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
            {/* "You earn" box */}
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Star size={15} />
                <span className="text-[10px] font-medium">
                  {isGroup ? "You earn (total)" : "You earn"}
                </span>
              </div>
              <p className="mt-1.5 text-base font-bold text-slate-800">
                {inr(session.earning ?? 0)}
              </p>
            </div>
          </div>
        </div>

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
          peerImage={isGroup ? "" : fresherPhoto || ""}
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
  <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
    <div className="flex items-center gap-1.5 whitespace-nowrap text-slate-400">
      {icon}
      <span className="text-[10px]">{label}</span>
    </div>

    <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold leading-5 tracking-tight text-slate-700">
      {value}
    </p>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
      <CalendarDays size={25} className="text-blue-500" />
    </div>
    <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);

const Bone = ({ className = "" }) => (
  <div className={`rounded-md bg-slate-200 ${className}`} />
);

const SessionCardSkeleton = () => (
  <div
    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    aria-hidden="true"
  >
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="flex flex-1 items-center gap-4">
        <Bone className="h-12 w-12 shrink-0 !rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-28" />
          <div className="flex gap-2 pt-1">
            <Bone className="h-5 w-20 !rounded-lg" />
            <Bone className="h-5 w-24 !rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-100 bg-slate-50 p-3"
          >
            <Bone className="h-2.5 w-14" />
            <Bone className="mt-2.5 h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>

    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <Bone className="h-3 w-32" />
      <div className="flex gap-2">
        <Bone className="h-9 w-28 !rounded-xl" />
        <Bone className="h-9 w-24 !rounded-xl" />
        <Bone className="h-9 w-36 !rounded-xl" />
      </div>
    </div>
  </div>
);

export default MentorSessions;