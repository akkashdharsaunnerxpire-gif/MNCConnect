import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  IndianRupee,
  Loader2,
  Star,
  Video,
  Volume2,
  VolumeX,
  Wallet,
  X,
  UserRound,
  Briefcase,
  Globe,
  Users,
  Timer,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {socket} from "../../utils/socket";
import useLive from "../../hooks/useLive";
import useMentorSessions from "../../hooks/useMentorSessions";
import { api, ENDPOINTS, EVENTS, inr, timeAgo } from "../../services/mentorApi";
import {
  assignPaymentToMentor,
  getConflictMessage,
  getDurationMinutes,
  getSessionConflict,
  normalizeSessionRequest,
  persistAcceptedSession,
  respondToSessionRequest,
} from "../../utils/sessionRequests";

const PLATFORM_FEE = 0.25;
const CLAIM_WINDOW_SECONDS = 120;
const CLAIM_WINDOW_MS = CLAIM_WINDOW_SECONDS * 1000;
const JOIN_READY_MS = 2 * 60 * 1000;
const SOUND_KEY = "mncconnect_request_sound";

// 🔴 Skip tracking: which requests this mentor has skipped (not to be shown again)
const SKIPPED_KEY = "mncconnect_skipped_requests";
const SKIPPED_MAX_KEEP = 100; // keep last 100 skipped ids
const SKIPPED_MAX_RETRY = 3; // after 3 skips on same id, permanently hide

// ============ SKIPPED STORAGE HELPERS ============

const readSkipped = () => {
  try {
    const raw = localStorage.getItem(SKIPPED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeSkipped = (map) => {
  try {
    // Keep the most recent SKIPPED_MAX_KEEP entries by timestamp
    const entries = Object.entries(map).sort((a, b) => b[1].t - a[1].t);
    const trimmed = Object.fromEntries(entries.slice(0, SKIPPED_MAX_KEEP));
    localStorage.setItem(SKIPPED_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full - ignore */
  }
};

const isSkippedPermanently = (id) => {
  const map = readSkipped();
  const entry = map[String(id)];
  return Boolean(entry && entry.c >= SKIPPED_MAX_RETRY);
};

const recordSkip = (id) => {
  const map = readSkipped();
  const key = String(id);
  const prev = map[key];
  map[key] = {
    c: (prev?.c || 0) + 1,
    t: Date.now(),
  };
  writeSkipped(map);
};

const clearSkip = (id) => {
  const map = readSkipped();
  delete map[String(id)];
  writeSkipped(map);
};

// ============ CONSTANTS ============

const QUICK_LINKS = [
  { to: "/mentor/requests", label: "Requests", icon: Inbox },
  { to: "/mentor/sessions", label: "Sessions", icon: CalendarDays },
  { to: "/mentor/earnings", label: "Earnings", icon: Wallet },
  { to: "/mentor/reviews", label: "Reviews", icon: Star },
];

const mentorShare = (amount) => Math.round(amount * (1 - PLATFORM_FEE));

const countdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`;
  return `${pad(m)}m ${pad(sec)}s`;
};

const greetingFor = (date) => {
  const h = date.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const playChime = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1175, t + 0.13);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    /* sound is optional */
  }
};

const useCountUp = (target, duration = 700) => {
  const [value, setValue] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    const to = Number(target) || 0;
    const from = last.current;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduce || from === to) {
      last.current = to;
      setValue(to);
      return undefined;
    }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else last.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
};

// ============ MAIN ============

const Home = () => {
  const navigate = useNavigate();
  const mentorName = localStorage.getItem("mentorName") || "Mentor";

  const [connected, setConnected] = useState(socket.connected);
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [claimingId, setClaimingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off"
  );

  // Confirm modal state
  const [confirmRequest, setConfirmRequest] = useState(null);

  // "Scanning" pulse — briefly true right after a skip to show the transition
  const [scanningBoost, setScanningBoost] = useState(false);

  const toastTimer = useRef(null);
  const soundRef = useRef(soundOn);
  const seenIds = useRef(new Set()); // chime only for requests not seen before
  const scanBoostTimer = useRef(null);

  /* ---------- live server data ---------- */
  const {
    sessions,
    wallet,
    loading: sessionsLoading,
    error: walletError,
    reload: reloadWallet,
  } = useMentorSessions();

  const { data: notifData } = useLive({
    fetcher: () => api(`${ENDPOINTS.notifications}?limit=5`),
    events: [EVENTS.notification],
  });

  const { data: reviewData } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
  });

  const rating = useMemo(() => {
    const list = reviewData?.reviews || [];
    if (!list.length) return { avg: "0.0", count: 0 };
    const avg =
      list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length;
    return { avg: avg.toFixed(1), count: list.length };
  }, [reviewData]);

  const activity = (notifData?.notifications || []).slice(0, 4);
  const unreadActivity = activity.filter((n) => !n.read).length;

  const serverUpcoming = useMemo(
    () => sessions.filter((s) => s.status === "Upcoming"),
    [sessions]
  );

  const upcomingSessions = useMemo(
    () =>
      serverUpcoming
        .filter((s) => !s.endsAt || s.endsAt > now)
        .sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0)),
    [serverUpcoming, now]
  );
  const nextSession = upcomingSessions[0];

  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(
      () => setToast(null),
      type === "error" ? 6000 : 3500
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => () => clearTimeout(scanBoostTimer.current), []);

  useEffect(() => {
    soundRef.current = soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = requests.length ? `(${requests.length}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [requests.length]);

  /* one clock for the whole page; drops requests whose claim window is over */
  useEffect(() => {
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      setRequests((prev) => {
        const next = prev.filter((r) => ts - r.receivedAt < CLAIM_WINDOW_MS);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- live request feed ---------- */
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onRequest = (incoming) => {
      const req = {
        ...normalizeSessionRequest(incoming),
        receivedAt: Date.now(),
      };
      if (!req.id) return;

      // 🔴 Never re-add a request the user has permanently skipped
      if (isSkippedPermanently(req.id)) return;

      if (!seenIds.current.has(String(req.id))) {
        seenIds.current.add(String(req.id));
        if (soundRef.current) playChime();
      }

      setRequests((prev) =>
        prev.some((p) => String(p.id) === String(req.id))
          ? prev
          : [req, ...prev]
      );
    };

    const onTaken = ({ id, requestGroupId } = {}) => {
      const key = String(id ?? requestGroupId ?? "");
      if (!key) return;
      setRequests((prev) =>
        prev.filter(
          (p) => String(p.id) !== key && String(p.requestGroupId) !== key
        )
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("session-request", onRequest);
    socket.on("session-request-taken", onTaken);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("session-request", onRequest);
      socket.off("session-request-taken", onTaken);
    };
  }, []);

  /* ---------- open confirm modal first ---------- */
  const openConfirm = useCallback(
    (req) => {
      if (claimingId) return;

      const serverReady = !sessionsLoading && !walletError;
      const conflict = getSessionConflict(
        req,
        serverReady ? serverUpcoming : null
      );
      if (conflict) {
        showToast("error", getConflictMessage(conflict));
        return;
      }

      setConfirmRequest(req);
    },
    [claimingId, sessionsLoading, walletError, serverUpcoming, showToast]
  );

  /* ---------- actual accept (called from modal) ---------- */
  const claim = useCallback(
    async (req) => {
      if (claimingId) return;

      setClaimingId(req.id);
      setConfirmRequest(null);

      try {
        const result = await respondToSessionRequest(req, "accepted");

        if (result.taken) {
          setRequests((p) =>
            p.filter((x) => String(x.id) !== String(req.id))
          );
          showToast(
            "error",
            "Another mentor accepted this request first."
          );
          return;
        }
        if (!result.ok)
          throw new Error(result.data.message || "Could not accept request");

        assignPaymentToMentor(result.requestGroupId);

        const session = { ...req, status: "Upcoming" };
        persistAcceptedSession(session);

        // Accept pannina, antha skip history clear pannu
        clearSkip(req.id);

        setRequests((p) => p.filter((x) => String(x.id) !== String(req.id)));
        reloadWallet();
        showToast("success", "Session accepted! Check Sessions page.");
        navigate("/mentor/sessions", { state: { acceptedSession: session } });
      } catch (e) {
        showToast("error", e.message || "Network error. Please try again.");
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, navigate, reloadWallet, showToast]
  );

  /* ---------- skip: remove + track + resume scanning ---------- */
  /* ---------- skip: notify backend + remove locally + resume scanning ---------- */
const skip = useCallback(
  async (id) => {
    if (!id || claimingId) return;

    // Find the full request object so we can send it to the backend
    const target = requests.find(
      (r) =>
        String(r.id) === String(id) ||
        String(r.requestGroupId) === String(id)
    );
    if (!target) return;

    // 1. Remove from UI instantly (optimistic)
    setRequests((prev) =>
      prev.filter(
        (r) =>
          String(r.id) !== String(id) &&
          String(r.requestGroupId) !== String(id)
      )
    );

    // 2. Show "restarting scan" feedback
    setScanningBoost(true);
    clearTimeout(scanBoostTimer.current);
    scanBoostTimer.current = setTimeout(
      () => setScanningBoost(false),
      1500
    );

    showToast("info", "Skipped. Scanning for new requests…");

    // 3. Tell backend this mentor declined — so it NEVER comes back
    try {
      await respondToSessionRequest(target, "rejected");
    } catch (e) {
      console.error("Skip (reject) failed:", e);
      // Put the request back if the call failed — user can retry
      setRequests((prev) =>
        prev.some((r) => String(r.id) === String(target.id))
          ? prev
          : [target, ...prev]
      );
      showToast("error", "Could not skip. Please try again.");
    }
  },
  [claimingId, requests, showToast]
);

  const msToNext = nextSession?.startsAt ? nextSession.startsAt - now : null;

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={{
        backgroundImage:
          "radial-gradient(900px circle at 50% -200px, rgba(37,99,235,0.06), transparent 70%)",
      }}
    >
      <style>{`
        @keyframes mc-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes mc-slide-in { from { opacity: 0; transform: translateX(-14px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes mc-modal-in { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
        .mc-fade-up { animation: mc-fade-up .5s cubic-bezier(.2,.7,.2,1) both; }
        .mc-slide-in { animation: mc-slide-in .45s cubic-bezier(.2,.7,.2,1) both; }
        .mc-modal-in { animation: mc-modal-in .28s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .mc-fade-up, .mc-slide-in, .mc-modal-in { animation: none; } }
      `}</style>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* header */}
        <header className="mc-fade-up flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              {greetingFor(new Date(now))}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Welcome back, {mentorName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Requests, earnings and reviews update the moment they happen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                connected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {connected && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}
                />
              </span>
              {connected ? "You're live" : "Reconnecting…"}
            </span>

            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-pressed={soundOn}
              title={soundOn ? "Sound alerts on" : "Sound alerts off"}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-90 ${
                soundOn
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
              }`}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="sr-only">Toggle sound alerts</span>
            </button>

            <Link
              to="/mentor/reviews"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 transition hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-md"
            >
              <Star
                size={16}
                className="fill-yellow-400 text-yellow-400 transition group-hover:rotate-12 group-hover:scale-110"
              />
              <span className="text-lg font-semibold">{rating.avg}</span>
              <span className="text-xs text-slate-500">
                {rating.count} review{rating.count !== 1 ? "s" : ""}
              </span>
            </Link>
          </div>
        </header>

        {/* quick links */}
        <nav
          className="mc-fade-up mt-6 flex gap-2 overflow-x-auto pb-1"
          style={{ animationDelay: "60ms" }}
          aria-label="Shortcuts"
        >
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group relative inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm active:scale-95"
            >
              <Icon size={15} className="transition group-hover:scale-110" />
              {label}
              {label === "Requests" && requests.length > 0 && (
                <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {requests.length}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {walletError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn't load your earnings.{" "}
            <button
              onClick={reloadWallet}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* next session */}
        {nextSession && msToNext !== null && (
          <Link
            to="/mentor/sessions"
            className={`mc-fade-up group mt-6 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${
              msToNext <= JOIN_READY_MS
                ? "border-green-200 bg-green-50"
                : "border-blue-100 bg-blue-50/60"
            }`}
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={nextSession.name} src={nextSession.avatar} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {msToNext <= JOIN_READY_MS
                    ? "Your session is ready to join"
                    : `Next session with ${nextSession.name}`}
                </p>
                <p className="text-xs text-slate-500">
                  {nextSession.date} at {nextSession.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-700">
                {msToNext > 0 ? `in ${countdown(msToNext)}` : "Live now"}
              </span>
              <ArrowRight
                size={16}
                className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
              />
            </div>
          </Link>
        )}

        {/* earnings */}
        <section
          onMouseMove={(e) => {
            const el = e.currentTarget;
            const r = el.getBoundingClientRect();
            el.style.setProperty(
              "--gx",
              `${((e.clientX - r.left) / r.width) * 100}%`
            );
            el.style.setProperty(
              "--gy",
              `${((e.clientY - r.top) / r.height) * 100}%`
            );
          }}
          className="mc-fade-up relative mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          style={{
            animationDelay: "140ms",
            backgroundImage:
              "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 0%), rgba(37,99,235,0.07), transparent 60%)",
          }}
        >
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Available to withdraw"
              amount={wallet.available}
              icon={Wallet}
              strong
            />
            <Stat
              label="Clearing after sessions"
              amount={wallet.pending}
              icon={Clock3}
            />
            <Stat
              label="Earned this week"
              amount={wallet.week}
              icon={IndianRupee}
            />
            <Stat label="Lifetime earnings" amount={wallet.lifetime} icon={Star} />
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              You keep {Math.round((1 - PLATFORM_FEE) * 100)}% of every
              session. Earnings are released when a session ends, and you can
              withdraw anytime above ₹500.
            </p>
            <Link
              to="/mentor/earnings"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <ArrowDownToLine size={16} /> Withdraw
            </Link>
          </div>
        </section>

        {/* requests + side panel */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section aria-live="polite">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                Live requests
                {requests.length > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {requests.length}
                  </span>
                )}
              </h2>
              <Link
                to="/mentor/requests"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                All requests
              </Link>
            </div>

            {requests.length === 0 ? (
              <Scanning connected={connected} boost={scanningBoost} />
            ) : (
              <div className="space-y-4">
                {requests.map((r) => (
                  <RequestCard
                    key={r.id}
                    req={r}
                    now={now}
                    busy={claimingId === r.id}
                    disabled={Boolean(claimingId)}
                    onClaim={() => openConfirm(r)}
                    onSkip={() => skip(r.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div
              role="tablist"
              aria-label="Sessions and activity"
              className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
            >
              {[
                {
                  id: "upcoming",
                  label: "Upcoming",
                  count: upcomingSessions.length,
                },
                { id: "activity", label: "Activity", count: unreadActivity },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition active:scale-95 ${
                    tab === t.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        tab === t.id
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div key={tab} className="mc-fade-up">
              {tab === "upcoming" ? (
                sessionsLoading ? (
                  <SkeletonList />
                ) : upcomingSessions.length === 0 ? (
                  <Empty
                    icon={CalendarDays}
                    title="No sessions booked"
                    text="Accepted requests show up here with their start time."
                  />
                ) : (
                  <>
                    <ul className="space-y-2">
                      {upcomingSessions.slice(0, 4).map((s) => {
                        const ms = s.startsAt ? s.startsAt - now : null;
                        const soon = ms !== null && ms <= JOIN_READY_MS;
                        return (
                          <li key={s.id}>
                            <Link
                              to="/mentor/sessions"
                              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                            >
                              <Avatar name={s.name} src={s.avatar} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {s.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {s.date} at {s.time}
                                </p>
                                {ms !== null && (
                                  <span
                                    className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${soon ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                                  >
                                    <Clock3 size={11} />
                                    {ms > 0 ? `in ${countdown(ms)}` : "Live now"}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-slate-700">
                                {inr(s.earning || mentorShare(s.amount))}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      to="/mentor/sessions"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      View all <ArrowRight size={14} />
                    </Link>
                  </>
                )
              ) : activity.length === 0 ? (
                <Empty
                  icon={Bell}
                  title="Nothing yet"
                  text="Bookings, payments and reviews will appear here live."
                />
              ) : (
                <>
                  <ul className="space-y-2">
                    {activity.map((n) => (
                      <li
                        key={n.id || n._id}
                        className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-blue-600"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {n.message}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-[11px] text-slate-400">
                          {timeAgo(n.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/mentor/notifications"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    All notifications <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* CONFIRMATION MODAL */}
      {confirmRequest && (
        <ConfirmAcceptModal
          req={confirmRequest}
          busy={claimingId === confirmRequest.id}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => claim(confirmRequest)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`mc-fade-up fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-red-200 text-red-700"
              : toast.type === "info"
              ? "border-blue-200 text-blue-700"
              : "border-emerald-200 text-emerald-700"
          }`}
        >
          {toast.type === "error" ? (
            <X size={16} className="shrink-0" />
          ) : toast.type === "info" ? (
            <Clock3 size={16} className="shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   CONFIRM ACCEPT MODAL
============================================================ */

const ConfirmAcceptModal = ({ req, busy, onCancel, onConfirm }) => {
  const [ackMatch, setAckMatch] = useState(false);

  const safeCancel = () => {
    if (!busy) onCancel();
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const rows = [
    {
      icon: CalendarDays,
      label: "Date",
      value: req.date || "Not specified",
      strong: true,
    },
    {
      icon: Clock3,
      label: "Time",
      value: req.time || "Not specified",
      strong: true,
    },
    {
      icon: Timer,
      label: "Duration",
      value: `${getDurationMinutes(req.duration)} minutes`,
      strong: true,
    },
    {
      icon: Briefcase,
      label: "Role wanted",
      value:
        req.role === "Other" && req.otherRole
          ? req.otherRole          : req.role || "Not specified",
    },
    {
      icon: Globe,
      label: "Language",
      value: req.language || "Any",
    },
    {
      icon: Users,
      label: "Gender preference",
      value: req.gender || "No preference",
    },
    {
      icon: IndianRupee,
      label: "You will earn",
      value: inr(mentorShare(req.amount)),
      strong: true,
      green: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-accept-title"
    >
      <div className="mc-modal-in w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Review before accepting
              </p>
              <h2
                id="confirm-accept-title"
                className="mt-1 text-xl font-bold"
              >
                Check the fresher's requirements
              </h2>
            </div>
            <button
              type="button"
              onClick={safeCancel}
              disabled={busy}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Avatar name={req.name} src={req.avatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">
                {req.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {req.topic || "Mentoring session"}
                {req.company ? ` · ${req.company}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Icon size={15} />
                    <span className="text-xs font-medium">{r.label}</span>
                  </div>
                  <span
                    className={`text-right text-sm ${
                      r.strong ? "font-bold" : "font-medium"
                    } ${r.green ? "text-emerald-600" : "text-slate-900"}`}
                  >
                    {r.value}
                  </span>
                </div>
              );
            })}
          </div>

          {req.message && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-700">
                <MessageSquare size={13} />
                Why the fresher wants this session
              </div>
              <p className="text-sm leading-6 text-slate-700">{req.message}</p>
            </div>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <input
              type="checkbox"
              checked={ackMatch}
              onChange={(e) => setAckMatch(e.target.checked)}
              disabled={busy}
              className="mt-0.5 h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-emerald-900">
              <strong>I can handle this session.</strong> I match the
              requirements above, I'll be on time, and I'll follow the mentor
              guidelines.
            </span>
          </label>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Only accept if you genuinely match the language, role, gender
              preference and timing. The fresher is paying for this session.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={safeCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ackMatch || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            {busy ? "Accepting…" : "Confirm & accept"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- pieces ---------- */

const Stat = ({ label, amount, icon: Icon, strong }) => {
  const shown = useCountUp(amount);
  return (
    <Link
      to="/mentor/earnings"
      className="group relative block bg-white p-5 transition hover:bg-blue-50/40"
    >
      <div className="flex items-center gap-2 text-slate-400 transition group-hover:text-blue-600">
        <Icon size={16} />
        <span className="text-xs text-slate-500">{label}</span>
        <ArrowRight
          size={13}
          className="ml-auto -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
        />
      </div>
      <p
        className={`mt-3 font-semibold tracking-tight tabular-nums ${strong ? "text-3xl" : "text-2xl"}`}
      >
        {inr(shown)}
      </p>
    </Link>
  );
};

const Avatar = ({ name, src }) =>
  src ? (
    <img
      src={src}
      alt={name}
      className="h-11 w-11 shrink-0 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
      {(name || "F")
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </div>
  );

const Empty = ({ icon: Icon, title, text }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Icon size={22} />
    </div>
    <h3 className="mt-4 font-semibold">{title}</h3>
    <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{text}</p>
  </div>
);

const SkeletonList = () => (
  <ul className="space-y-2" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li
        key={i}
        className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-100 p-4"
      >
        <div className="h-11 w-11 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
      </li>
    ))}
  </ul>
);

const Scanning = ({ connected, boost }) => (
  <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
    <div
      className={`relative flex h-40 w-40 items-center justify-center ${
        boost ? "scale-105" : ""
      } transition-transform duration-300`}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-full border border-blue-300 motion-safe:animate-ping motion-reduce:opacity-30"
          style={{
            animationDuration: boost ? "1.2s" : "3s",
            animationDelay: `${i}s`,
            opacity: 0.5,
          }}
        />
      ))}
      <span className="absolute inset-4 rounded-full border border-slate-200" />
      <span className="absolute inset-10 rounded-full border border-slate-200" />
      <span
        className="absolute inset-0 rounded-full motion-safe:animate-spin"
        style={{
          animationDuration: boost ? "1s" : "2.8s",
          background:
            "conic-gradient(from 0deg, rgba(37,99,235,0) 0deg, rgba(37,99,235,0) 270deg, rgba(37,99,235,0.28) 360deg)",
        }}
      />
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-40 motion-safe:animate-ping" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
      </span>
    </div>
    <h3 className="mt-6 font-semibold text-slate-900">
      {!connected
        ? "Reconnecting…"
        : boost
        ? "Restarting scan…"
        : "Scanning for requests"}
    </h3>
    <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
      {connected
        ? "Keep this page open. The first mentor to accept gets the session."
        : "Check your internet connection. We'll resume scanning automatically."}
    </p>
  </div>
);

const Ring = ({ pct, urgent, label, seconds }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="relative h-11 w-11 shrink-0"
      role="timer"
      aria-label={`${seconds} seconds left to accept`}
    >
      <svg
        viewBox="0 0 44 44"
        className="h-11 w-11 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="3"
          className="stroke-slate-100"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "stroke-red-500" : "stroke-blue-600"}`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold tabular-nums ${urgent ? "text-red-600" : "text-slate-600"}`}
      >
        {label}
      </span>
    </div>
  );
};

const RequestCard = ({ req, now, busy, disabled, onClaim, onSkip }) => {
  const [open, setOpen] = useState(false);
  const left = Math.max(
    0,
    CLAIM_WINDOW_SECONDS - Math.floor((now - req.receivedAt) / 1000)
  );
  const pct = (left / CLAIM_WINDOW_SECONDS) * 100;
  const urgent = left <= 20;
  const longMessage = (req.message || "").length > 110;

  return (
    <article
      className={`mc-slide-in overflow-hidden rounded-2xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        urgent
          ? "border-red-200"
          : "border-slate-200 hover:border-blue-300"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={req.name} src={req.avatar} />
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{req.name}</h3>
              <p className="truncate text-xs text-slate-500">
                {req.role} · {req.topic}
              </p>
            </div>
          </div>
          <Ring
            pct={pct}
            urgent={urgent}
            seconds={left}
            label={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          {req.date && <Chip icon={CalendarDays}>{req.date}</Chip>}
          {req.time && <Chip icon={Clock3}>{req.time}</Chip>}
          <Chip icon={Video}>
            {getDurationMinutes(req.duration)} min video call
          </Chip>
        </div>

        {req.message && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p
              className={`text-sm leading-6 text-slate-600 ${open ? "" : "line-clamp-2"}`}
            >
              {req.message}
            </p>
            {longMessage && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                aria-expanded={open}
              >
                {open ? "Show less" : "Read more"}
                <ChevronDown
                  size={13}
                  className={`transition ${open ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-400">You earn</p>
            <p className="text-2xl font-semibold tracking-tight">
              {inr(mentorShare(req.amount))}
            </p>
          </div>
          <p className="text-xs text-slate-400">of {inr(req.amount)} total</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClaim}
            disabled={disabled}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {busy ? "Accepting…" : "Review & accept"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
          >
            Skip
          </button>
        </div>
      </div>
    </article>
  );
};

const Chip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
    <Icon size={13} className="text-slate-400" />
    {children}
  </span>
);

export default Home;