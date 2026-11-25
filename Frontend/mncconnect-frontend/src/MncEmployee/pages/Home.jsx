import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { stopSpeaking } from "../../utils/speak";
import VoiceTour from "./VoiceTour";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  IndianRupee,
  Loader2,
  Star,
  Video,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Briefcase,
  Globe,
  Users,
  Timer,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { socket } from "../../utils/socket";
import { playRequestSound, unlockAudio } from "../../utils/chatSounds";
import useLive from "../../hooks/useLive";
import useMentorSessions from "../../hooks/useMentorSessions";
import { api, ENDPOINTS, EVENTS, inr, timeAgo } from "../../services/mentorApi";
import {
  assignPaymentToMentor,
  getConflictMessage,
  getDurationMinutes,
  getSessionConflict,
  normalizeSessionRequest,
  respondToSessionRequest,
} from "../../utils/sessionRequests";

const PLATFORM_FEE = 0.25;
const CLAIM_WINDOW_SECONDS = 120;
const CLAIM_WINDOW_MS = CLAIM_WINDOW_SECONDS * 1000;
const JOIN_READY_MS = 2 * 60 * 1000;

// Background of the "next session" banner
const NEXT_SESSION_BG = "#85dbb0e0";

// ============ CONSTANTS ============

const mentorShare = (amount) => Math.round(amount * (1 - PLATFORM_FEE));

// always 2 decimals: ₹187.50 (not ₹187.5)
const fmtEarn = (n) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// group or single? (backend sends type "Group Video Call" / "Video Call" and mode "group" / "single")
const isGroupReq = (r) =>
  /group/i.test(String(r?.type || "")) || r?.mode === "group";

// One request = one key. Group requests can reach a mentor with different ids,
// so requestGroupId (when present) is the real identity.
const reqKey = (r) => String(r?.requestGroupId || r?.id || "");

// Booking statuses that mean "this session is no longer upcoming"
const isFinishedStatus = (status) =>
  [
    "completed",
    "awaiting_confirmation",
    "canceled",
    "cancelled",
    "missed",
    "expired",
    "disputed",
  ].includes(String(status || "").toLowerCase());

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

const vibrate = () => {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400]);
  } catch {
    /* not supported */
  }
};

// system notification, only when the tab is in the background
const showSystemNotification = (req) => {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted" || !document.hidden) return;
    const n = new Notification("New session request", {
      body: `${req.name || "A fresher"} wants a session. Accept within 2 minutes!`,
      tag: `req-${reqKey(req)}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* optional */
  }
};

const useCountUp = (target, duration = 700) => {
  const [value, setValue] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    const to = Number(target) || 0;
    const from = last.current;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
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
  // empty until /auth/me answers -> the title shows a skeleton, not "Mentor"
  const [mentorName, setMentorName] = useState("");
  const [connected, setConnected] = useState(socket.connected);
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [claimingId, setClaimingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("upcoming");
  // sound preference lives in memory only (nothing in localStorage)
  const [soundOn, setSoundOn] = useState(true);
  // true after the first click / key / touch (browsers block sound before that)
  const [audioReady, setAudioReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const [mentorKey, setMentorKey] = useState("");
  const [tourStage, setTourStage] = useState(null);
  const [tourSteps, setTourSteps] = useState([]);
  // becomes true after the FIRST sessions/wallet response
  const [loadedOnce, setLoadedOnce] = useState(false);

  // sessions that finished / were cancelled: hidden from Upcoming immediately
  const [doneIds, setDoneIds] = useState(() => new Set());

  // Confirm modal state
  const [confirmRequest, setConfirmRequest] = useState(null);

  // "Scanning" pulse: briefly true right after a skip to show the transition
  const [scanningBoost, setScanningBoost] = useState(false);

  // banner shown at the top when a new request arrives
  const [alertReq, setAlertReq] = useState(null);

  const toastTimer = useRef(null);
  const soundRef = useRef(soundOn);
  const seenIds = useRef(new Set()); // sound only for requests not seen before
  // requests that were accepted / skipped / taken / expired: never show again
  const dismissedKeys = useRef(new Set());
  const scanBoostTimer = useRef(null);

  /* ---------- first-time login: blur the page + point at the speaker ---------- */
  const { user } = useAuth();
  const introChecked = useRef(false);

  const checkIntro = useCallback((u) => {
    if (!u || introChecked.current) return;
    introChecked.current = true;

    const key = `mnc_voice_intro_seen_${u._id || u.id || u.email || u.name}`;
    setMentorKey(key);

    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(key));
    } catch {
      /* ignore */
    }

    // add ?tour=1 to the URL to force the hint while testing
    const force =
      new URLSearchParams(window.location.search).get("tour") === "1";

    if (force || !seen) {
      setShowVoiceHint(true);
      setTourStage("hint");
    }
  }, []);

  // instant: AuthContext already has the user, so there is no blur delay
  useEffect(() => {
    if (user) checkIntro(user);
  }, [user, checkIntro]);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setMentorName(d?.user?.name || "Mentor");
        checkIntro(d?.user); // fallback if AuthContext was not ready yet
      })
      .catch(() => {
        if (alive) setMentorName("Mentor");
      });
    return () => {
      alive = false;
    };
  }, [checkIntro]);

  /* ---------- live server data ---------- */
  const {
    sessions,
    wallet,
    loading: sessionsLoading,
    error: walletError,
    reload: reloadWallet,
  } = useMentorSessions();

  const reloadRef = useRef(reloadWallet);
  useEffect(() => {
    reloadRef.current = reloadWallet;
  }, [reloadWallet]);

  const { data: notifData, loading: notifLoading } = useLive({
    fetcher: () => api(`${ENDPOINTS.notifications}?limit=5`),
    events: [EVENTS.notification],
  });

  const { data: reviewData, loading: reviewsLoading } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
  });

  // skeleton only until the FIRST response (background reloads keep old data)
  useEffect(() => {
    if (!sessionsLoading) setLoadedOnce(true);
  }, [sessionsLoading]);

  const initialLoading = !loadedOnce;
  const reviewsInitial = reviewsLoading && !reviewData;
  const notifInitial = notifLoading && !notifData;

  const rating = useMemo(() => {
    const list = reviewData?.reviews || [];
    if (!list.length) return { avg: "0.0", count: 0 };
    const avg =
      list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length;
    return { avg: avg.toFixed(1), count: list.length };
  }, [reviewData]);

  /* ---------- Activity = live requests (while still open) + notifications ---------- */
  const requestActivity = useMemo(
    () =>
      requests.map((r) => ({
        id: `req-${reqKey(r)}`,
        title: "New session request",
        message: `${r.name || "A fresher"} wants a ${getDurationMinutes(r.duration)} min ${
          isGroupReq(r) ? "group" : "1:1"
        } session${r.date ? ` · ${r.date}` : ""}${r.time ? ` at ${r.time}` : ""}`,
        createdAt: new Date(r.receivedAt).toISOString(),
        read: false,
        isRequest: true,
      })),
    [requests],
  );

  const serverActivity = useMemo(
    () =>
      (notifData?.notifications || []).filter(
        (n) => !/request/i.test(`${n.type || ""} ${n.title || ""}`),
      ),
    [notifData],
  );

  const activity = useMemo(
    () => [...requestActivity, ...serverActivity].slice(0, 5),
    [requestActivity, serverActivity],
  );
  const unreadActivity =
    requestActivity.length + serverActivity.filter((n) => !n.read).length;

  const serverUpcoming = useMemo(
    () => sessions.filter((s) => s.status === "Upcoming"),
    [sessions],
  );

  // Upcoming = still "Upcoming" on the server, not over, not completed/cancelled
  const upcomingSessions = useMemo(() => {
    const map = new Map();
    serverUpcoming.forEach((s) => {
      const key = String(s.id);
      if (doneIds.has(key)) return;
      if (s.endsAt && s.endsAt <= now) return;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...s });
      } else {
        // same group session listed once per fresher -> count it once
        prev.earning = (Number(prev.earning) || 0) + (Number(s.earning) || 0);
      }
    });
    return [...map.values()].sort(
      (a, b) => (a.startsAt || 0) - (b.startsAt || 0),
    );
  }, [serverUpcoming, doneIds, now]);
  const nextSession = upcomingSessions[0];

  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(
      () => setToast(null),
      type === "error" ? 6000 : 3500,
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => () => clearTimeout(scanBoostTimer.current), []);

  /* tab title: "(2) Title" normally, flashes "🔔 New request!" in a background tab */
  useEffect(() => {
    const base = document.title.replace(/^(\(\d+\)|🔔 New request!)\s*/, "");
    if (!requests.length) {
      document.title = base;
      return undefined;
    }
    let on = false;
    const tick = () => {
      on = !on;
      document.title =
        on && document.hidden
          ? `🔔 New request! ${base}`
          : `(${requests.length}) ${base}`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = base;
    };
  }, [requests.length]);

  // banner hides itself after 8 seconds
  useEffect(() => {
    if (!alertReq) return undefined;
    const t = setTimeout(() => setAlertReq(null), 8000);
    return () => clearTimeout(t);
  }, [alertReq]);

  // still-unanswered request + tab in background: repeat the sound every 6s
  useEffect(() => {
    if (!requests.length) return undefined;
    const id = setInterval(() => {
      if (document.hidden && soundRef.current) playRequestSound();
    }, 6000);
    return () => clearInterval(id);
  }, [requests.length]);

  // browsers block sound until the first click / key / touch:
  // unlock the shared audio context once, then remember it
  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart"];
    const handler = () => {
      unlockAudio();
      setAudioReady(true);
      events.forEach((ev) => window.removeEventListener(ev, handler));
    };
    events.forEach((ev) => window.addEventListener(ev, handler));
    return () =>
      events.forEach((ev) => window.removeEventListener(ev, handler));
  }, []);

  // ask notification permission on the first click anywhere (browsers need a gesture)
  useEffect(() => {
    if (typeof Notification === "undefined") return undefined;
    if (Notification.permission !== "default") return undefined;
    const ask = () => Notification.requestPermission().catch(() => {});
    window.addEventListener("click", ask, { once: true });
    return () => window.removeEventListener("click", ask);
  }, []);

  /* one clock for the whole page; drops requests whose claim window is over */
  useEffect(() => {
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      setRequests((prev) => {
        const next = prev.filter((r) => {
          const alive = ts - r.receivedAt < CLAIM_WINDOW_MS;
          if (!alive) dismissedKeys.current.add(reqKey(r));
          return alive;
        });
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- hide finished sessions from Upcoming as soon as they end ---------- */
  useEffect(() => {
    const markDone = (p) => {
      const id = p?.requestGroupId || p?.bookingId || p?.id;
      if (!id) return;
      if (!isFinishedStatus(p?.status)) return;
      setDoneIds((prev) => {
        const key = String(id);
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      reloadRef.current?.();
    };

    const evt = EVENTS?.booking || "booking:updated";
    socket.on(evt, markDone);
    socket.on("meeting:state", markDone);
    socket.on("meeting:timer", markDone);
    return () => {
      socket.off(evt, markDone);
      socket.off("meeting:state", markDone);
      socket.off("meeting:timer", markDone);
    };
  }, []);

  /* ---------- live request feed ---------- */
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onRequest = (incoming) => {
      const base = normalizeSessionRequest(incoming);
      const req = {
        ...base,
        // group / single info straight from the server (so it is never lost)
        type: incoming?.type ?? base?.type,
        mode: incoming?.mode ?? base?.mode,
        maxMembers: incoming?.maxMembers ?? base?.maxMembers,
        requestGroupId: incoming?.requestGroupId ?? base?.requestGroupId,
        receivedAt: Date.now(),
      };
      if (!req.id) return;

      const key = reqKey(req);

      // already accepted / skipped / taken / expired -> never show again
      if (dismissedKeys.current.has(key)) return;

      if (!seenIds.current.has(key)) {
        seenIds.current.add(key);
        if (soundRef.current) playRequestSound();
        vibrate();
        showSystemNotification(req);
        setAlertReq(req);
      }

      // same request again (server re-emit, reconnect, group duplicate) -> ignore
      setRequests((prev) =>
        prev.some((p) => reqKey(p) === key) ? prev : [req, ...prev],
      );
    };

    const onTaken = ({ id, requestGroupId } = {}) => {
      const keys = [id, requestGroupId].filter(Boolean).map(String);
      if (!keys.length) return;
      keys.forEach((k) => dismissedKeys.current.add(k));
      setRequests((prev) =>
        prev.filter(
          (p) => !keys.includes(String(p.id)) && !keys.includes(reqKey(p)),
        ),
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
        serverReady ? serverUpcoming : null,
      );
      if (conflict) {
        showToast("error", getConflictMessage(conflict));
        return;
      }

      setConfirmRequest(req);
    },
    [claimingId, sessionsLoading, walletError, serverUpcoming, showToast],
  );

  /* ---------- actual accept (called from modal) ---------- */
  const claim = useCallback(
    async (req) => {
      if (claimingId) return;

      const key = reqKey(req);
      setClaimingId(req.id);
      setConfirmRequest(null);

      try {
        const result = await respondToSessionRequest(req, "accepted");

        if (result.taken) {
          dismissedKeys.current.add(key);
          setRequests((p) => p.filter((x) => reqKey(x) !== key));
          showToast("error", "Another mentor accepted this request first.");
          return;
        }
        if (!result.ok)
          throw new Error(result.data.message || "Could not accept request");

        assignPaymentToMentor(result.requestGroupId);

        const session = { ...req, status: "Upcoming" };

        // accepted -> gone from Live requests AND from Activity
        dismissedKeys.current.add(key);
        setRequests((p) => p.filter((x) => reqKey(x) !== key));
        reloadWallet();
        showToast("success", "Session accepted! Check Sessions page.");
        navigate("/mentor/sessions", { state: { acceptedSession: session } });
      } catch (e) {
        showToast("error", e.message || "Network error. Please try again.");
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, navigate, reloadWallet, showToast],
  );

  /* ---------- skip: notify backend + remove locally + resume scanning ---------- */
  const skip = useCallback(
    async (id) => {
      if (!id || claimingId) return;

      // Find the full request object so we can send it to the backend
      const target = requests.find(
        (r) => String(r.id) === String(id) || reqKey(r) === String(id),
      );
      if (!target) return;

      const key = reqKey(target);

      // 1. Remove from UI instantly (optimistic)
      dismissedKeys.current.add(key);
      setRequests((prev) => prev.filter((r) => reqKey(r) !== key));

      // 2. Show "restarting scan" feedback
      setScanningBoost(true);
      clearTimeout(scanBoostTimer.current);
      scanBoostTimer.current = setTimeout(() => setScanningBoost(false), 1500);

      showToast("info", "Skipped. Scanning for new requests…");

      // 3. Tell backend this mentor declined, so it never comes back
      try {
        await respondToSessionRequest(target, "rejected");
      } catch (e) {
        console.error("Skip (reject) failed:", e);
        // Put the request back if the call failed: user can retry
        dismissedKeys.current.delete(key);
        setRequests((prev) =>
          prev.some((r) => reqKey(r) === key) ? prev : [target, ...prev],
        );
        showToast("error", "Could not skip. Please try again.");
      }
    },
    [claimingId, requests, showToast],
  );

  const msToNext = nextSession?.startsAt ? nextSession.startsAt - now : null;

  // Stop voice playback when the Home page unmounts.
  useEffect(() => () => stopSpeaking(), []);

  /* warm up the speech engine, so the first mic click speaks instantly */
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    synth.getVoices();
    const onVoices = () => synth.getVoices();
    synth.addEventListener?.("voiceschanged", onVoices);
    return () => synth.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  /* ---------- guided tour: home sections first, then the whole sidebar ---------- */
  const buildTour = () => {
    const n = requests.length;
    const share = Math.round((1 - PLATFORM_FEE) * 100);

    const steps = [
      {
        text: `Welcome back, ${mentorName}! I'm your guide to MNCConnect. Let me quickly show you around.`,
        speak: `Welcome back, ${mentorName}. I'm your guide to M N C Connect. Let me quickly show you around.`,
        target: null,
      },
      {
        text: "These are your live requests. Freshers send them here. The first mentor to accept gets the session, and you have 2 minutes per request.",
        target: '[data-tour="requests"]',
      },
      {
        text:
          n > 0
            ? `You have ${n} live request${n > 1 ? "s" : ""} waiting right now. Tap Review and accept.`
            : "No live requests right now. Keep this page open and you'll hear an alert when one arrives.",
        target: '[data-tour="requests"]',
      },
      {
        text: `Here are your earnings. You keep ${share}% of every session. Earnings are released when a session ends, and you can withdraw above ₹500.`,
        speak: `Here are your earnings. You keep ${share} percent of every session. Earnings are released when a session ends, and you can withdraw above 500 rupees.`,
        target: '[data-tour="earnings"]',
      },
    ];

    if (nextSession) {
      steps.push({
        text: `Your next session is with ${nextSession.name} at ${nextSession.time}.`,
        target: '[data-tour="next"]',
      });
    }

    steps.push(
      {
        text: "Now let's look at the sidebar. You can reach every part of MNCConnect from here. Home is where you are now. It shows live requests, earnings and upcoming sessions.",
        speak:
          "Now let's look at the sidebar. You can reach every part of M N C Connect from here. Home is where you are now. It shows live requests, earnings and upcoming sessions.",
        target: '[data-tour="nav-home"]',
      },
      {
        text: "Requests shows the session requests sent by freshers. You can review each one and accept or skip it. The number badge shows how many are waiting.",
        target: '[data-tour="nav-requests"]',
      },
      {
        text: "Sessions shows the sessions you have accepted or booked. Open it to see dates, times and to join your video call.",
        target: '[data-tour="nav-sessions"]',
      },
      {
        text: "Earnings shows your available balance, pending payments, this week's earnings and lifetime earnings. You can also withdraw from here.",
        target: '[data-tour="nav-earnings"]',
      },
      {
        text: "Reviews shows the feedback and ratings freshers have given you after sessions.",
        target: '[data-tour="nav-reviews"]',
      },
      {
        text: "Tap your name to view or edit your profile. The button next to it logs you out.",
        target: '[data-tour="nav-profile"]',
      },
      {
        text: "That's the full tour! Tap the speaker any time to hear it again. Happy mentoring!",
        target: null,
      },
    );

    return steps;
  };

  const markVoiceSeen = () => {
    setShowVoiceHint(false);
    if (mentorKey) {
      try {
        localStorage.setItem(mentorKey, "1");
      } catch {
        /* ignore */
      }
    }
  };

  const closeTour = () => {
    stopSpeaking();
    setTourStage(null);
    setSpeaking(false);
  };

  const handleVoiceClick = () => {
    // tapping the speaker while the guide is talking stops the tour
    if (tourStage === "talk") {
      closeTour();
      return;
    }
    markVoiceSeen();
    setSoundOn(true);
    setTourSteps(buildTour());
    setTourStage("talk");
  };

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
        @keyframes mc-blip {
          0%   { opacity: 0; transform: scale(.3); }
          15%  { opacity: 1; transform: scale(1.15); }
          25%  { transform: scale(1); }
          75%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(.6); }
        }
        @keyframes mc-ripple {
          0%   { transform: scale(.35); opacity: .55; }
          100% { transform: scale(1);   opacity: 0; }
        }
        .mc-ripple { animation: mc-ripple 3s ease-out infinite; }
        .mc-fade-up { animation: mc-fade-up .5s cubic-bezier(.2,.7,.2,1) both; }
        .mc-slide-in { animation: mc-slide-in .45s cubic-bezier(.2,.7,.2,1) both; }
        .mc-modal-in { animation: mc-modal-in .28s cubic-bezier(.2,.7,.2,1) both; }
        .mc-blip { animation: mc-blip 2.4s ease-in-out both; }
        @keyframes mc-drop { from { opacity: 0; transform: translateY(-24px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes mc-flash { 0%,100% { box-shadow: 0 0 0 0 rgba(37,99,235,.55); } 50% { box-shadow: 0 0 0 10px rgba(37,99,235,0); } }
        .mc-drop { animation: mc-drop .35s cubic-bezier(.2,.7,.2,1) both; }
        .mc-flash { animation: mc-slide-in .45s cubic-bezier(.2,.7,.2,1) both, mc-flash 1.2s ease-out 3; }
        @media (prefers-reduced-motion: reduce) { .mc-fade-up, .mc-slide-in, .mc-modal-in, .mc-blip, .mc-ripple, .mc-drop, .mc-flash { animation: none; } }
      `}</style>

      {/* NEW REQUEST BANNER */}
      {alertReq &&
        requests.some((r) => reqKey(r) === reqKey(alertReq)) && (
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-3">
            <button
              type="button"
              onClick={() => {
                setAlertReq(null);
                document
                  .querySelector('[data-tour="requests"]')
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mc-drop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-left text-white shadow-2xl ring-4 ring-blue-300/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Bell size={18} className="motion-safe:animate-bounce" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  New session request
                </span>
                <span className="block truncate text-xs text-blue-100">
                  {alertReq.name || "A fresher"} ·{" "}
                  {getDurationMinutes(alertReq.duration)} min · tap to review
                </span>
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* header */}
        <header className="mc-fade-up flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              {greetingFor(new Date(now))}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {mentorName ? (
                `Welcome back, ${mentorName}`
              ) : (
                <span
                  className="inline-block h-8 w-64 max-w-full animate-pulse rounded-md bg-slate-200 align-middle"
                  aria-label="Loading"
                />
              )}
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
              data-tour="speaker"
              onClick={handleVoiceClick}
              aria-pressed={speaking}
              title={speaking ? "Stop voice tour" : "Hear a quick tour"}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-90 ${
                speaking
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-blue-200 bg-blue-50 text-blue-600"
              }`}
            >
              {showVoiceHint && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-blue-400 opacity-60 motion-safe:animate-ping"
                />
              )}
              <Volume2 size={16} />
              <span className="sr-only">Play voice tour</span>
            </button>

            {reviewsInitial ? (
              <div
                className="h-[46px] w-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                aria-hidden="true"
              />
            ) : (
              <Link
                to="/mentor/reviews"
                data-tour="rating"
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
            )}
          </div>
        </header>

        {walletError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn't load your earnings.{" "}
            <button onClick={reloadWallet} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {/* next session */}
        {nextSession && msToNext !== null && (
          <Link
            to="/mentor/sessions"
            data-tour="next"
            className="mc-fade-up group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-emerald-300/60 px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
            style={{
              animationDelay: "100ms",
              backgroundColor: NEXT_SESSION_BG,
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={nextSession.name} src={nextSession.avatar} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {msToNext <= JOIN_READY_MS
                    ? "Your session is ready to join"
                    : `Next session with ${nextSession.name}`}
                </p>
                <p className="text-xs text-slate-700">
                  {nextSession.date} at {nextSession.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
                {msToNext > 0 ? `in ${countdown(msToNext)}` : "Live now"}
              </span>
              <ArrowRight
                size={16}
                className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-slate-900"
              />
            </div>
          </Link>
        )}

        {/* requests + side panel (moved UP so the mentor sees it first) */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section data-tour="requests" aria-live="polite" className="min-w-0">
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
              <Scanning
                connected={connected}
                boost={scanningBoost}
                audioReady={audioReady}
                soundOn={soundOn}
                onToggleSound={() => {
                  unlockAudio();
                  setSoundOn((v) => !v);
                }}
              />
            ) : (
              <div className="space-y-4">
                {requests.map((r) => (
                  <RequestCard
                    key={reqKey(r)}
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
                  count: initialLoading ? 0 : upcomingSessions.length,
                },
                {
                  id: "activity",
                  label: "Activity",
                  count: notifInitial ? requestActivity.length : unreadActivity,
                },
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
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums ${
                        tab === t.id
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {t.count > 99 ? "99+" : t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div key={tab} className="mc-fade-up">
              {tab === "upcoming" ? (
                initialLoading ? (
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
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {ms !== null && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${soon ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                                    >
                                      <Clock3 size={11} />
                                      {ms > 0
                                        ? `in ${countdown(ms)}`
                                        : "Live now"}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    Earn:{" "}
                                    {fmtEarn(s.earning || mentorShare(s.amount))}
                                  </span>
                                </div>
                              </div>
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
              ) : notifInitial && activity.length === 0 ? (
                <SkeletonList />
              ) : activity.length === 0 ? (
                <Empty
                  icon={Bell}
                  title="Nothing yet"
                  text="New requests, payments and reviews will appear here live."
                />
              ) : (
                <>
                  <ul className="space-y-2">
                    {activity.map((n) => (
                      <li
                        key={n.id || n._id}
                        className={`flex gap-3 rounded-2xl border bg-white p-4 transition hover:shadow-sm ${
                          n.isRequest
                            ? "mc-slide-in border-blue-200 bg-blue-50/40"
                            : "border-slate-200 hover:border-blue-200"
                        }`}
                      >
                        {n.isRequest ? (
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                            <UserPlus size={13} />
                          </span>
                        ) : (
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-blue-600"}`}
                          />
                        )}
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

        {/* earnings (now below the live requests) */}
        {walletError && null}
        <section
          data-tour="earnings"
          onMouseMove={(e) => {
            const el = e.currentTarget;
            const r = el.getBoundingClientRect();
            el.style.setProperty(
              "--gx",
              `${((e.clientX - r.left) / r.width) * 100}%`,
            );
            el.style.setProperty(
              "--gy",
              `${((e.clientY - r.top) / r.height) * 100}%`,
            );
          }}
          className="mc-fade-up relative mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
              loading={initialLoading}
            />
            <Stat
              label="Clearing after sessions"
              amount={wallet.pending}
              icon={Clock3}
              loading={initialLoading}
            />
            <Stat
              label="Earned this week"
              amount={wallet.week}
              icon={IndianRupee}
              loading={initialLoading}
            />
            <Stat
              label="Lifetime earnings"
              amount={wallet.lifetime}
              icon={Star}
              loading={initialLoading}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              You keep {Math.round((1 - PLATFORM_FEE) * 100)}% of every session.
              Earnings are released when a session ends, and you can withdraw
              anytime above ₹500.
            </p>
            <Link
              to="/mentor/earnings"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <ArrowDownToLine size={16} /> Withdraw
            </Link>
          </div>
        </section>
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

      {/* GUIDED VOICE TOUR */}
      <VoiceTour
        stage={tourStage}
        steps={tourSteps}
        onTalkingChange={setSpeaking}
        onDone={closeTour}
        onStop={closeTour}
        onHintSkip={() => {
          markVoiceSeen();
          setTourStage(null);
        }}
      />

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
   SESSION TYPE BADGE (Group / 1:1)
============================================================ */

const SessionBadge = ({ req }) =>
  isGroupReq(req) ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
      <Users size={12} /> Group session
      {Number(req.maxMembers) > 1 ? ` · up to ${req.maxMembers}` : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
      <Video size={12} /> 1:1 Session
    </span>
  );

/* ============================================================
   CONFIRM ACCEPT MODAL
============================================================ */

const ConfirmAcceptModal = ({ req, busy, onCancel, onConfirm }) => {
  const [ackMatch, setAckMatch] = useState(false);
  const group = isGroupReq(req);

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
      icon: Users,
      label: "Session type",
      value: group
        ? `Group session${Number(req.maxMembers) > 1 ? ` (up to ${req.maxMembers})` : ""}`
        : "1:1 Session",
      strong: true,
    },
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
          ? req.otherRole
          : req.role || "Not specified",
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
      label: group ? "You earn (per person)" : "You will earn",
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
              <h2 id="confirm-accept-title" className="mt-1 text-xl font-bold">
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
              <div className="mt-1.5">
                <SessionBadge req={req} />
              </div>
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

const Stat = ({ label, amount, icon: Icon, strong, loading }) => {
  // hook runs every render (rules of hooks); 0 while loading, so the first
  // real value counts up from 0 when the data arrives
  const shown = useCountUp(loading ? 0 : amount);

  if (loading) {
    return (
      <div className="animate-pulse bg-white p-5" aria-hidden="true">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-200" />
          <div className="h-3 w-28 rounded bg-slate-200" />
        </div>
        <div
          className={`mt-3 rounded-md bg-slate-200 ${
            strong ? "h-9 w-32" : "h-8 w-24"
          }`}
        />
      </div>
    );
  }

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

/* Compact "scanning" strip: small radar on the left, text on the right,
   plus a sound hint so the mentor knows the alert sound is ready. */
const Scanning = ({ connected, boost, audioReady, soundOn, onToggleSound }) => (
  <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/40 px-4 py-4 sm:px-5">
    <div className="flex items-center gap-4">
      {/* mini radar */}
      <div
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform duration-300 ${
          boost ? "scale-110" : ""
        }`}
        aria-hidden="true"
      >
        {connected &&
          [0, 1, 2].map((i) => (
            <span
              key={i}
              className="mc-ripple absolute inset-0 rounded-full border border-blue-300"
              style={{
                animationDuration: boost ? "1.2s" : "3s",
                animationDelay: `${i}s`,
              }}
            />
          ))}
        <span className="absolute inset-[14%] rounded-full border border-blue-200" />
        <span className="absolute inset-[30%] rounded-full border border-blue-200" />
        <span
          className="absolute inset-0 rounded-full motion-safe:animate-spin"
          style={{
            animationDuration: boost ? "1s" : "2.8s",
            background:
              "conic-gradient(from 0deg, rgba(37,99,235,0) 0deg, rgba(37,99,235,0) 270deg, rgba(37,99,235,0.35) 360deg)",
          }}
        />
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-40 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">
          {!connected
            ? "Reconnecting…"
            : boost
              ? "Restarting scan…"
              : "Scanning for requests"}
        </h3>
        <p className="mt-0.5 text-sm text-slate-600">
          {connected
            ? "Keep this page open. The first mentor to accept gets the session."
            : "Check your internet connection. We'll resume scanning automatically."}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggleSound}
        aria-pressed={soundOn}
        title={soundOn ? "Mute request alert" : "Unmute request alert"}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${
          soundOn
            ? "border-blue-200 bg-white text-blue-600"
            : "border-slate-200 bg-slate-100 text-slate-400"
        }`}
      >
        {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span className="sr-only">Toggle request alert sound</span>
      </button>
    </div>

    {/* sound status */}
    {soundOn && !audioReady ? (
      <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        <Bell size={13} className="shrink-0" />
        Click anywhere on this page once to enable the alert sound.
      </p>
    ) : soundOn ? (
      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
        <Volume2 size={13} className="shrink-0" />
        Sound on: you will hear an alert when a request arrives.
      </p>
    ) : (
      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <VolumeX size={13} className="shrink-0" />
        Sound is muted. Tap the speaker to turn it on.
      </p>
    )}
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
  const group = isGroupReq(req);
  const left = Math.max(
    0,
    CLAIM_WINDOW_SECONDS - Math.floor((now - req.receivedAt) / 1000),
  );
  const pct = (left / CLAIM_WINDOW_SECONDS) * 100;
  const urgent = left <= 20;
  const longMessage = (req.message || "").length > 110;

  return (
    <article
      className={`mc-flash overflow-hidden rounded-2xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        urgent ? "border-red-200" : "border-slate-200 hover:border-blue-300"
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
              <div className="mt-1.5">
                <SessionBadge req={req} />
              </div>
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
            <p className="text-xs text-slate-400">
              {group ? "You earn (per person)" : "You earn"}
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {inr(mentorShare(req.amount))}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            {group ? "per person · " : ""}of {inr(req.amount)} total
          </p>
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