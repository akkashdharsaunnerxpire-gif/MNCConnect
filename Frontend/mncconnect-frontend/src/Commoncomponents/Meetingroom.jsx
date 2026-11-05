// src/components/MeetingRoom.jsx
// ONE video engine for everything: LiveKit (SFU)   ->   npm i livekit-client
//   SINGLE meeting : 2 people (employee + fresher), big remote video + small self preview
//   GROUP meeting  : 2 to 60 people
//
// Backend: POST /bookings/:id/livekit-token must now work for BOTH modes
//   (single = max 2 participants). Identity: mentor => "mentor:<id>", fresher => "fresher:<id>".
//
// GROUP layout (Zoom style)
//   - Employee (mentor) sees the freshers BIG in a gallery grid (auto columns, pages of 12)
//   - Fresher sees the employee BIG, and everybody else in a centered strip
//   - Active speaker gets a green ring, double-click / pin icon pins anybody to the big stage
//   - Screen share (employee / host) takes the big stage automatically
//   - Full-screen button (meeting only), grid / speaker view toggle
//   - Chat opens on the right and the video stage SHIFTS left (nothing is hidden)
// CHAT
//   - single : employee <-> fresher (1 to 1, no names)
//   - group  : EVERYBODY (employee, host, friends) can chat, every message shows the sender's name
// POPUPS
//   - "Did the session go well?" (last 3 minutes)   -> only the single fresher / group HOST
//        Yes -> confirmed
//        No  -> valid reason -> "Are you sure?" (OK / Cancel) -> declined
//   - Review (stars + feedback, last 1 minute)      -> EVERY fresher (host and friends)
//   - Meeting finished and not confirmed            -> the confirm popup again (after the meeting)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  CameraOff,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Clock3,
  UserRound,
  CheckCircle,
  Star,
  MessageSquare,
  Users,
  X,
  Maximize,
  Minimize,
  Pin,
  PinOff,
  LayoutGrid,
  ScreenShare,
  ScreenShareOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import { socket } from "../utils/socket";
import MeetingInstructionsGate from "../Commoncomponents/MeetingInstructionsGate";
import SessionConfirmModal, {
  confirmSessionApi,
} from "../Commoncomponents/SessionConfirmModal";
import ChatPanel from "../Commoncomponents/Chatpanel";
import {
  API_URL,
  ENDPOINTS,
  fmtClock,
  getUserId,
} from "../services/fresherApi";

const ONE_MIN = 60 * 1000;
const THREE_MIN = 3 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const REVIEW_AT_MS = ONE_MIN;
const OPEN_BEFORE_MIN = 5;
const CONFIRMED_BANNER_MS = 20 * 1000;
const ENTRY_BEFORE_MS = 20 * 1000;

// group: students join with mic + camera OFF when the group is bigger than this
const AUTO_MEDIA_MAX = 6;
// group gallery: tiles per page
const GRID_PAGE = 12;

const initialsOf = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

// gallery columns by number of tiles (rows are filled so the grid uses the whole stage)
const colsFor = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

/* ---------- Fresher (host / single / friend): last 1 minute, stars + feedback REQUIRED ---------- */
const ReviewGate = ({ booking, onDone }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = rating >= 1 && comment.trim().length >= 10 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestGroupId: booking.requestGroupId,
          rating,
          comment: comment.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) onDone();
      else if (res.status === 409) onDone(); // already reviewed
      else setErr(d.message || "Could not submit. Try again.");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
          Required · last minute
        </p>
        <h3 className="mt-1 text-xl font-bold">How was your session?</h3>
        <p className="mt-1 text-xs text-slate-500">
          Give a star rating and your feedback. The meeting continues until the
          timer ends.
        </p>

        <div className="mt-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star
                size={34}
                className={
                  (hover || rating) >= n
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-slate-300"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Write your feedback / review (min 10 characters)"
          className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"
        />

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit review"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Stars and feedback are both required to continue.
        </p>
      </div>
    </div>
  );
};

/* ---------- one participant tile (LiveKit) ----------
   size : "xl" (few big tiles) | "md" (gallery) | "sm" (strip / self preview)   */
const AVATAR = {
  xl: "h-28 w-28 text-4xl",
  md: "h-16 w-16 text-xl",
  sm: "h-12 w-12 text-sm",
};

const Tile = ({
  participant,
  version,
  big = false,
  size = "md",
  source = Track.Source.Camera,
  pinned = false,
  onPin,
}) => {
  const ref = useRef(null);
  const pub = participant.getTrackPublication(source);
  const videoOn = Boolean(pub?.track) && !pub.isMuted;
  const micOn = participant.isMicrophoneEnabled;
  const speaking = participant.isSpeaking;
  const name = participant.name || participant.identity;
  const mentor = participant.identity.startsWith("mentor:");
  const isScreen = source === Track.Source.ScreenShare;

  useEffect(() => {
    const el = ref.current;
    const p = participant.getTrackPublication(source);
    const track = p?.track;
    if (!el || !track || p.isMuted) return undefined;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [participant, version, videoOn, source]);

  return (
    <div
      onDoubleClick={() => onPin && onPin(participant.identity)}
      className={`group relative h-full w-full overflow-hidden rounded-xl bg-slate-900 transition-shadow ${
        speaking && !isScreen ? "ring-2 ring-emerald-400" : ""
      }`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full ${big || isScreen ? "object-contain" : "object-cover"} ${videoOn ? "" : "hidden"}`}
      />
      {!videoOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div
            className={`flex items-center justify-center rounded-full bg-slate-700 font-bold text-slate-100 ${AVATAR[size] || AVATAR.md}`}
          >
            {initialsOf(name)}
          </div>
        </div>
      )}

      {onPin && !isScreen && (
        <button
          type="button"
          title={pinned ? "Unpin" : "Pin to big screen"}
          onClick={(e) => {
            e.stopPropagation();
            onPin(participant.identity);
          }}
          className="absolute right-1.5 top-1.5 hidden rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80 group-hover:block"
        >
          {pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex max-w-[92%] items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        {!micOn && <MicOff size={11} className="shrink-0 text-red-400" />}
        <span className="truncate">
          {isScreen ? `${name}'s screen` : name}
          {!isScreen && participant.isLocal ? " (You)" : ""}
          {!isScreen && mentor ? " · Employee" : ""}
        </span>
      </div>
    </div>
  );
};

const WaitingStage = ({ text }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
      <UserRound size={36} />
    </div>
    <p className="mt-4 text-sm">{text}</p>
  </div>
);

const Center = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
    {children}
  </div>
);

export default function MeetingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const isMentor = useLocation().pathname.startsWith("/mentor");
  const myUserId = String(getUserId?.() || "");

  /* ---------- chat ---------- */
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  // userId -> name (kept even after a person leaves, so old messages keep their name)
  const nameCache = useRef({});
  const toggleChat = () => {
    const next = !chatOpenRef.current;
    chatOpenRef.current = next;
    setChatOpen(next);
    if (next) setUnread(0);
  };
  const closeChat = () => {
    chatOpenRef.current = false;
    setChatOpen(false);
  };

  const [phase, setPhase] = useState("joining");
  const [message, setMessage] = useState("");
  const [opensAt, setOpensAt] = useState(null);
  const [clock, setClock] = useState({
    remainingMs: 0,
    running: false,
    at: Date.now(),
    mentorPresent: false,
    fresherPresent: false,
    successRequested: false,
    fresherConfirmed: false,
    fresherDeclined: false,
    instructions: { mentor: false, fresher: false },
    mode: "single",
    maxMembers: 1,
    hostId: "",
  });
  const [, forceTick] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaNote, setMediaNote] = useState("");
  const [booking, setBooking] = useState(null);
  const [reviewDone, setReviewDone] = useState(false);
  const [showSuccessBtn, setShowSuccessBtn] = useState(false);
  const [confirmedBanner, setConfirmedBanner] = useState(false);

  // MY OWN acceptance of the instructions (a friend's acceptance is separate from the host's)
  const [myAcc, setMyAcc] = useState(false);

  /* ---------- LiveKit state (single + group) ---------- */
  const lkRoomRef = useRef(null);
  const audioBox = useRef(null);
  const [lkVersion, setLkVersion] = useState(0);
  const [lkConnected, setLkConnected] = useState(false);
  const [needAudio, setNeedAudio] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  // group layout controls
  // employee: gallery of freshers (grid)   |   fresher: employee big (speaker)
  const [viewMode, setViewMode] = useState(isMentor ? "grid" : "speaker");
  const [pinnedId, setPinnedId] = useState(null);
  const [page, setPage] = useState(0);
  const togglePin = useCallback(
    (id) => setPinnedId((prev) => (prev === id ? null : id)),
    [],
  );

  // full screen (the whole page goes full screen; the meeting already covers the page)
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const on = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } catch {
      /* not supported */
    }
  };

  const joined = useRef(false);
  const retryTimer = useRef(null);

  const isGroup = clock.mode === "group";
  const isHost = !isMentor && myUserId && String(clock.hostId) === myUserId;
  // single meeting fresher OR the group host: confirms "did it go well?"
  const isHostFresher = !isMentor && (!isGroup || isHost);
  // every fresher (host AND friends) writes a review
  const isFresher = !isMentor;

  /* ---------- join + socket listeners (clock, instructions, chat, ended) ---------- */
  const join = useCallback(() => {
    socket.emit("meeting:join", { bookingId }, (res) => {
      if (!res?.ok) {
        if (res?.code === "NOT_OPEN") {
          setOpensAt(res.opensAt);
          setPhase("waitingOpen");
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(
            join,
            Math.min(Math.max(res.opensAt - Date.now(), 1000), 30000),
          );
        } else if (res?.code === "ENDED") {
          setPhase("ended");
        } else {
          setMessage(res?.message || "Could not join.");
          setPhase("error");
        }
        return;
      }
      joined.current = true;
      setClock({ ...res.state, at: Date.now() });
      const ins = res.instructions || {};
      setMyAcc(Boolean(res.role === "mentor" ? ins.mentor : ins.fresher));
      setPhase("in");
    });
  }, [bookingId]);

  useEffect(() => {
    const onState = (s) => setClock({ ...s, at: Date.now() });
    // per-person instructions state (a friend sees HIS own acceptance here)
    const onInstructionsState = (s) =>
      setMyAcc(Boolean(isMentor ? s.mentor : s.fresher));

    const onEnded = (p) => {
      lkRoomRef.current?.disconnect();
      // confirmed during the meeting -> done.
      // not confirmed -> the fresher gets the confirm popup again (awaiting_confirmation)
      setPhase(p?.confirmed ? "ended" : "awaiting_confirmation");
    };
    const onReconnect = () => joined.current && join();

    socket.on("meeting:state", onState);
    socket.on("meeting:instructions-state", onInstructionsState);
    socket.on("meeting:ended", onEnded);
    socket.on("connect", onReconnect);

    if (!socket.connected) socket.connect();
    join();

    return () => {
      clearTimeout(retryTimer.current);
      joined.current = false;
      socket.emit("meeting:leave");
      socket.off("meeting:state", onState);
      socket.off("meeting:instructions-state", onInstructionsState);
      socket.off("meeting:ended", onEnded);
      socket.off("connect", onReconnect);
      // leave full screen when the meeting page closes
      if (document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  /* ---------- when may the camera / video start? ----------
     start condition (server): employee + HOST accepted the instructions.
     I need MY OWN acceptance too (so every friend reads the instructions). */
  const inst = clock.instructions || {};
  const startReady = Boolean(inst.mentor && inst.fresher);

  // door opens at (startsAt - 20s). If the session is already running (rejoin), no wait.
  const startsAtMs = booking?.startsAt
    ? new Date(booking.startsAt).getTime()
    : null;
  const entryAtMs = startsAtMs !== null ? startsAtMs - ENTRY_BEFORE_MS : null;
  const entryInMs =
    entryAtMs !== null ? Math.max(0, entryAtMs - Date.now()) : null;
  const doorOpen =
    clock.running || (entryAtMs !== null && Date.now() >= entryAtMs);

  const mediaAllowed = myAcc && (startReady || clock.running) && doorOpen;

  // what the "waiting for the other side" line of the gate should check
  const peerDone = isMentor
    ? Boolean(inst.fresher)
    : isHost || !isGroup
      ? Boolean(inst.mentor)
      : startReady;

  /* ---------- connect to LiveKit (single AND group) ---------- */
  useEffect(() => {
    if (phase !== "in" || !mediaAllowed) return undefined;

    let cancelled = false;
    let room = null;

    const bump = () => {
      if (!cancelled) setLkVersion((v) => v + 1);
    };

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}${ENDPOINTS.booking(bookingId)}/livekit-token`,
          { method: "POST", credentials: "include" },
        );
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.token)
          throw new Error(d.message || "Could not start the video.");
        if (cancelled) return;

        const group = clockRef.current.mode === "group";

        room = new Room({
          adaptiveStream: true, // only download the tiles that are on screen
          dynacast: true,
          // single = 2 people, so full HD. group = 720p to keep everyone smooth.
          videoCaptureDefaults: {
            resolution: group ? VideoPresets.h720 : VideoPresets.h1080,
          },
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        lkRoomRef.current = room;

        room
          .on(RoomEvent.ParticipantConnected, bump)
          .on(RoomEvent.ParticipantDisconnected, bump)
          .on(RoomEvent.TrackPublished, bump)
          .on(RoomEvent.TrackUnpublished, bump)
          .on(RoomEvent.TrackMuted, bump)
          .on(RoomEvent.TrackUnmuted, bump)
          .on(RoomEvent.LocalTrackPublished, bump)
          .on(RoomEvent.LocalTrackUnpublished, bump)
          .on(RoomEvent.ActiveSpeakersChanged, bump)
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach();
              audioBox.current?.appendChild(el);
            }
            bump();
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((el) => el.remove());
            bump();
          })
          .on(RoomEvent.AudioPlaybackStatusChanged, () => {
            if (!cancelled) setNeedAudio(!room.canPlaybackAudio);
          })
          .on(RoomEvent.Reconnecting, () => {
            if (!cancelled) setMediaNote("Connection weak. Reconnecting…");
          })
          .on(RoomEvent.Reconnected, () => {
            if (!cancelled) setMediaNote("");
          })
          .on(RoomEvent.Disconnected, () => {
            if (!cancelled) setLkConnected(false);
          });

        await room.connect(d.url, d.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setLkConnected(true);
        setNeedAudio(!room.canPlaybackAudio);

        // big groups: students join muted (their choice to unmute). single: always on.
        const big = group && (clockRef.current.maxMembers || 1) > AUTO_MEDIA_MAX;
        const startMuted = big && !isMentor;
        if (startMuted) {
          setMicOn(false);
          setCamOn(false);
          setMediaNote(
            "Big group: your mic and camera are off. Use the buttons below to switch them on.",
          );
        } else {
          let blocked = false;
          await room.localParticipant.setMicrophoneEnabled(true).catch(() => {
            blocked = true;
          });
          await room.localParticipant.setCameraEnabled(true).catch(() => {
            blocked = true;
          });
          if (blocked && !cancelled)
            setMediaNote(
              "Camera or mic is blocked. Allow it in the browser address bar.",
            );
          if (!room.localParticipant.isCameraEnabled) setCamOn(false);
          if (!room.localParticipant.isMicrophoneEnabled) setMicOn(false);
        }
        bump();
      } catch (e) {
        console.error("livekit error", e);
        if (!cancelled)
          setMediaNote(e.message || "Could not start the video.");
      }
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      lkRoomRef.current = null;
      setLkConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mediaAllowed, bookingId]);

  /* ---------- clock / booking ---------- */
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}${ENDPOINTS.booking(bookingId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => d.booking && setBooking(d.booking))
      .catch(() => {});
  }, [bookingId, phase]);

  const currentRemaining = clock.running
    ? Math.max(0, clock.remainingMs - (Date.now() - clock.at))
    : clock.remainingMs;

  const inLast5 =
    clock.running && currentRemaining > 0 && currentRemaining <= FIVE_MIN;
  const inLast3 =
    clock.running && currentRemaining > 0 && currentRemaining <= THREE_MIN;
  const inLast1 =
    clock.running && currentRemaining > 0 && currentRemaining <= REVIEW_AT_MS;

  useEffect(() => {
    setShowSuccessBtn(isMentor && phase === "in" && inLast3);
  }, [inLast3, phase, isMentor]);

  useEffect(() => {
    if (!isMentor || !clock.fresherConfirmed) {
      setConfirmedBanner(false);
      return undefined;
    }
    setConfirmedBanner(true);
    const t = setTimeout(() => setConfirmedBanner(false), CONFIRMED_BANNER_MS);
    return () => clearTimeout(t);
  }, [isMentor, clock.fresherConfirmed]);

  const sendSuccessRequest = () =>
    socket.emit("meeting:success-request", { bookingId });

  // in-meeting confirmation. accepted=false needs a validated reason.
  const answerSuccess = (accepted, reason = "") =>
    new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, v) => {
        if (settled) return;
        settled = true;
        fn(v);
      };
      // if the server sends no ack, the meeting:state event closes the modal anyway
      const t = setTimeout(() => finish(resolve), 4000);
      socket.emit(
        "meeting:success-confirm",
        { bookingId, accepted, reason },
        (res) => {
          clearTimeout(t);
          if (res && res.ok === false)
            finish(
              reject,
              new Error(res.message || "Could not save. Try again."),
            );
          else finish(resolve);
        },
      );
    });

  // REVIEW  -> every fresher (single fresher, group host AND group friends)
  //   host / single : booking.reviewed
  //   friend        : booking.myReviewed (if the backend sends it) or the local reviewDone
  const alreadyReviewed =
    reviewDone ||
    Boolean(booking?.myReviewed) ||
    (isHostFresher && Boolean(booking?.reviewed));
  const showReviewGate =
    isFresher &&
    phase === "in" &&
    Boolean(booking) &&
    inLast1 &&
    !alreadyReviewed;

  // "Did the session go well?" -> ONLY single fresher / group HOST
  //   - automatically in the last 3 minutes (until the fresher answers No)
  //   - or any time the employee clicks "Meeting Success"
  const showSuccessConfirm =
    isHostFresher &&
    phase === "in" &&
    !clock.fresherConfirmed &&
    !showReviewGate &&
    (clock.successRequested || (inLast3 && !clock.fresherDeclined));

  // mic / camera (same for single and group)
  const toggle = async (kind) => {
    const lp = lkRoomRef.current?.localParticipant;
    if (!lp) return;
    try {
      if (kind === "mic") {
        const next = !micOn;
        await lp.setMicrophoneEnabled(next);
        setMicOn(next);
      } else {
        const next = !camOn;
        await lp.setCameraEnabled(next);
        setCamOn(next);
      }
      setMediaNote("");
      setLkVersion((v) => v + 1);
    } catch {
      setMediaNote(
        "Could not turn it on. Allow camera / mic in the browser address bar.",
      );
    }
  };

  // GROUP: screen share (employee + host)
  const toggleShare = async () => {
    const lp = lkRoomRef.current?.localParticipant;
    if (!lp) return;
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled);
      setLkVersion((v) => v + 1);
    } catch {
      setMediaNote("Could not share the screen.");
    }
  };

  const toggleView = () => {
    setPinnedId(null);
    setPage(0);
    setViewMode((v) => (v === "grid" ? "speaker" : "grid"));
  };

  const leaveRoom = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    navigate(isMentor ? "/mentor/sessions" : "/Home/my-bookings");
  };

  /* ---------- screens ---------- */
  if (phase === "joining") {
    return (
      <Center>
        <Loader2 className="animate-spin" size={30} />
        <p className="mt-4 text-sm text-slate-300">Joining the meeting…</p>
      </Center>
    );
  }

  if (phase === "waitingOpen") {
    return (
      <Center>
        <Clock3 size={36} className="text-blue-400" />
        <h2 className="mt-4 text-xl font-bold">
          The meeting room opens {OPEN_BEFORE_MIN} minutes before the session
        </h2>
        <p className="mt-2 font-mono text-3xl">
          {fmtClock((opensAt || Date.now()) - Date.now())}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          We'll let you in automatically.
        </p>
        <button
          onClick={leaveRoom}
          className="mt-6 rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold"
        >
          Back
        </button>
      </Center>
    );
  }

  if (phase === "error") {
    return (
      <Center>
        <h2 className="text-xl font-bold">Can't open this meeting</h2>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <button
          onClick={leaveRoom}
          className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
        >
          Back
        </button>
      </Center>
    );
  }

  if (phase === "awaiting_confirmation") {
    return (
      <Center>
        {isMentor ? (
          <>
            <Clock3 size={44} className="text-amber-400" />
            <h2 className="mt-4 text-2xl font-bold">Session time completed</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Waiting for the {isGroup ? "host" : "fresher"} to confirm the
              session. Once confirmed, your earnings will be released.
            </p>
            <button
              onClick={leaveRoom}
              className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
            >
              Back to sessions
            </button>
          </>
        ) : !isHostFresher ? (
          <>
            <CheckCircle size={44} className="text-emerald-400" />
            <h2 className="mt-4 text-2xl font-bold">Session ended</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Thanks for joining. The group host will confirm the session.
            </p>
            <button
              onClick={leaveRoom}
              className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
            >
              Back to my bookings
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Session finished</h2>
            <p className="mt-2 text-sm text-slate-400">
              You did not confirm during the meeting. Please confirm now.
            </p>
            <SessionConfirmModal
              title="Was your session successful?"
              subtitle="The session time is over. Please confirm."
              onYes={async () => {
                await confirmSessionApi(bookingId, true);
                leaveRoom();
              }}
              onNo={async (reason) => {
                await confirmSessionApi(bookingId, false, reason);
                leaveRoom();
              }}
            />
          </>
        )}
      </Center>
    );
  }

  if (phase === "ended") {
    return (
      <Center>
        <CheckCircle size={46} className="text-emerald-400" />
        <h2 className="mt-4 text-2xl font-bold">Session completed</h2>
        <p className="mt-2 text-sm text-slate-400">
          {isMentor
            ? "The session is completed. Your earnings will be released after confirmation."
            : "Thanks for your feedback. Your session is confirmed."}
        </p>
        <button
          onClick={leaveRoom}
          className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
        >
          {isMentor ? "Back to sessions" : "Back to my bookings"}
        </button>
      </Center>
    );
  }

  /* ---------- instructions gate (every person reads it) ---------- */
  if (phase === "in" && !mediaAllowed) {
    return (
      <MeetingInstructionsGate
        bookingId={bookingId}
        role={isMentor ? "mentor" : "fresher"}
        alreadyAccepted={myAcc}
        peerAccepted={peerDone}
        entryInMs={entryInMs}
      />
    );
  }

  /* ---------- stage data (from LiveKit) ---------- */
  const lkRoom = lkRoomRef.current;
  const people = lkRoom
    ? [
        lkRoom.localParticipant,
        ...Array.from(lkRoom.remoteParticipants.values()),
      ]
    : [];
  const hasTrack = (p, src) => {
    const pub = p.getTrackPublication(src);
    return Boolean(pub?.track) && !pub.isMuted;
  };
  const camOnOf = (p) => hasTrack(p, Track.Source.Camera);
  const mentorP = people.find((p) => p.identity.startsWith("mentor:"));
  const students = people
    .filter((p) => p !== mentorP)
    .sort(
      (a, b) =>
        Number(b.isLocal) - Number(a.isLocal) ||
        Number(camOnOf(b)) - Number(camOnOf(a)),
    );
  const sharer = people.find((p) => hasTrack(p, Track.Source.ScreenShare));
  const pinnedP = pinnedId ? people.find((p) => p.identity === pinnedId) : null;
  const iAmSharing = Boolean(lkRoom?.localParticipant?.isScreenShareEnabled);

  // SINGLE: the one other person in the room
  const otherP = people.find((p) => !p.isLocal) || null;
  const otherHere = Boolean(otherP);

  // chat: userId -> name  (so every message shows WHO wrote it, even when the server sends no name)
  people.forEach((p) => {
    const id = String(p.identity || "")
      .split(":")
      .pop();
    if (id && p.name) nameCache.current[id] = p.name;
  });
  const chatNames = { ...nameCache.current };

  const mediaReady = lkConnected;
  const status = clock.running
    ? "Session in progress"
    : !mediaReady
      ? "Starting camera…"
      : isGroup
        ? "Waiting for everyone to join…"
        : otherHere
          ? "Connected. Waiting for the timer to start…"
          : `Waiting for the ${isMentor ? "fresher" : "employee"} to join.`;

  const timerCls = inLast5
    ? "animate-pulse bg-red-600 text-white ring-2 ring-red-400/60"
    : clock.running
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-amber-500/15 text-amber-300";

  // GROUP layout: "spot" = one big tile + strip   |   "grid" = gallery
  let layout = "grid";
  let mainP = null;
  let mainSrc = Track.Source.Camera;
  let stripList = [];
  let gridList = [];

  if (isGroup) {
    if (pinnedP) {
      layout = "spot";
      mainP = pinnedP;
      stripList = people.filter((p) => p !== pinnedP);
    } else if (sharer) {
      layout = "spot";
      mainP = sharer;
      mainSrc = Track.Source.ScreenShare;
      stripList = people;
    } else if (viewMode === "speaker") {
      layout = "spot";
      mainP = isMentor
        ? students.find((p) => p.isSpeaking) || students[0] || null
        : mentorP || null;
      stripList = students.filter((p) => p !== mainP);
    } else {
      gridList = isMentor ? students : people;
    }
  }

  const pages = Math.max(1, Math.ceil(gridList.length / GRID_PAGE));
  const curPage = Math.min(page, pages - 1);
  const pageItems = gridList.slice(
    curPage * GRID_PAGE,
    (curPage + 1) * GRID_PAGE,
  );
  const cols = colsFor(pageItems.length);
  const rows = Math.max(1, Math.ceil(pageItems.length / cols));
  const gridTileSize = pageItems.length <= 4 ? "xl" : "md";

  // CHAT: single = employee <-> fresher.  group = EVERYBODY.
  const canChat = true;
  const canShare = isGroup && (isMentor || isHost);
  // the stage moves left while the chat panel is open (nothing is hidden behind it)
  const shiftForChat = canChat && chatOpen;

  const ctrlBtn = (on) =>
    `flex h-12 w-12 items-center justify-center rounded-full transition ${
      on ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white transition-[padding] duration-200 ${
          shiftForChat ? "sm:pr-96" : ""
        }`}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
              <span className="truncate">
                {booking?.companyName || "MNCConnect session"}
              </span>
              {isGroup && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                  Group · {people.length || 1} online
                </span>
              )}
              {isFresher && mentorP && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                  Employee: {mentorP.name || "Employee"}
                </span>
              )}
            </p>
            <p
              className={`text-xs ${
                inLast5
                  ? "text-red-400"
                  : clock.running
                    ? "text-emerald-400"
                    : "text-amber-300"
              }`}
            >
              {inLast5 ? "Last 5 minutes" : status}
            </p>
          </div>
          <div
            className={`shrink-0 rounded-xl px-4 py-1.5 font-mono text-xl font-bold tabular-nums ${timerCls}`}
          >
            {fmtClock(currentRemaining)}
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 px-2 pb-2"
          style={{ minHeight: 0 }}
        >
          {!isGroup ? (
            /* ================= SINGLE STAGE (LiveKit, 2 people) ================= */
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
              {otherP ? (
                <Tile
                  participant={otherP}
                  version={lkVersion}
                  big
                  size="xl"
                />
              ) : (
                <WaitingStage
                  text={`Waiting for the ${isMentor ? "fresher" : "employee"}…`}
                />
              )}

              {/* my own small preview */}
              {lkRoom && (
                <div className="absolute bottom-4 right-4 z-20 aspect-video w-32 sm:w-52">
                  <Tile
                    participant={lkRoom.localParticipant}
                    version={lkVersion}
                    size="sm"
                  />
                </div>
              )}
            </div>
          ) : (
            /* ================= GROUP STAGE ================= */
            <div className="relative flex h-full w-full flex-col gap-2">
              {layout === "spot" ? (
                <>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
                    {mainP ? (
                      <Tile
                        participant={mainP}
                        version={lkVersion}
                        big
                        size="xl"
                        source={mainSrc}
                        pinned={pinnedId === mainP.identity}
                        onPin={
                          mainSrc === Track.Source.Camera
                            ? togglePin
                            : undefined
                        }
                      />
                    ) : (
                      <WaitingStage
                        text={
                          isMentor
                            ? "Waiting for the freshers…"
                            : "Waiting for the employee…"
                        }
                      />
                    )}
                  </div>

                  {/* strip: centered when it fits, scrolls when there are many people */}
                  {stripList.length > 0 && (
                    <div
                      className="flex shrink-0 gap-2 overflow-x-auto pb-1 [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
                      style={{ height: "clamp(110px, 22vh, 190px)" }}
                    >
                      {stripList.map((p) => (
                        <div
                          key={p.identity}
                          className="aspect-video h-full shrink-0"
                        >
                          <Tile
                            participant={p}
                            version={lkVersion}
                            size="sm"
                            pinned={pinnedId === p.identity}
                            onPin={togglePin}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black p-1.5">
                  {pageItems.length > 0 ? (
                    <div
                      className="grid h-full w-full gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                      }}
                    >
                      {pageItems.map((p) => (
                        <div key={p.identity} className="min-h-0 min-w-0">
                          <Tile
                            participant={p}
                            version={lkVersion}
                            size={gridTileSize}
                            pinned={pinnedId === p.identity}
                            onPin={togglePin}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <WaitingStage
                      text={
                        isMentor
                          ? "Waiting for the freshers…"
                          : "Waiting for the employee…"
                      }
                    />
                  )}

                  {pages > 1 && (
                    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-2 py-1 text-xs">
                      <button
                        type="button"
                        disabled={curPage === 0}
                        onClick={() => setPage(curPage - 1)}
                        className="rounded-full p-1 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="tabular-nums">
                        {curPage + 1} / {pages}
                      </span>
                      <button
                        type="button"
                        disabled={curPage >= pages - 1}
                        onClick={() => setPage(curPage + 1)}
                        className="rounded-full p-1 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}

                  {/* employee: my own small preview */}
                  {isMentor && lkRoom && pageItems.length > 0 && (
                    <div className="absolute bottom-3 right-3 z-20 aspect-video w-40 sm:w-52">
                      <Tile
                        participant={lkRoom.localParticipant}
                        version={lkVersion}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* every remote voice plays from here (single + group) */}
          <div ref={audioBox} className="hidden" />

          {needAudio && (
            <button
              type="button"
              onClick={() => {
                lkRoomRef.current?.startAudio().then(() => setNeedAudio(false));
              }}
              className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold shadow-xl hover:bg-blue-700"
            >
              Click to enable meeting audio
            </button>
          )}

          {inLast5 && (
            <p className="absolute right-6 top-3 z-20 rounded-lg bg-red-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              ⏱ Last 5 minutes. Please start wrapping up.
            </p>
          )}
          {mediaNote && (
            <p className="absolute left-6 top-3 z-20 max-w-[60%] rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
              {mediaNote}
            </p>
          )}

          {isMentor && confirmedBanner && (
            <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
              <CheckCircle size={18} />
              The {isGroup ? "host" : "fresher"} confirmed: the meeting went
              well ✅
            </div>
          )}
          {isMentor &&
            clock.fresherDeclined &&
            !clock.successRequested &&
            !clock.fresherConfirmed && (
              <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-xl">
                The {isGroup ? "host" : "fresher"} said the session is not
                complete yet. You can ask again.
              </div>
            )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 pb-2">
          {isMentor &&
            showSuccessBtn &&
            !clock.successRequested &&
            !clock.fresherConfirmed && (
              <button
                onClick={sendSuccessRequest}
                className="flex h-12 animate-pulse items-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-bold hover:bg-emerald-700"
              >
                <CheckCircle size={18} /> Meeting Success
              </button>
            )}
          {isMentor && clock.successRequested && !clock.fresherConfirmed && (
            <span className="flex h-12 items-center gap-2 rounded-full bg-slate-800 px-5 text-xs font-semibold text-amber-300">
              <Loader2 size={14} className="animate-spin" /> Waiting for the{" "}
              {isGroup ? "host" : "fresher"} to confirm…
            </span>
          )}

          <button
            onClick={() => toggle("mic")}
            title={micOn ? "Mute" : "Unmute"}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${micOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600"}`}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={() => toggle("cam")}
            title={camOn ? "Stop video" : "Start video"}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${camOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600"}`}
          >
            {camOn ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>

          {canShare && (
            <button
              onClick={toggleShare}
              title={iAmSharing ? "Stop sharing" : "Share screen"}
              className={ctrlBtn(iAmSharing)}
            >
              {iAmSharing ? (
                <ScreenShareOff size={20} />
              ) : (
                <ScreenShare size={20} />
              )}
            </button>
          )}
          {isGroup && (
            <button
              onClick={toggleView}
              title={
                viewMode === "grid"
                  ? "Switch to speaker view"
                  : "Switch to gallery view"
              }
              className={ctrlBtn(viewMode === "grid" && !pinnedId && !sharer)}
            >
              <LayoutGrid size={20} />
            </button>
          )}
          {isGroup && (
            <button
              onClick={() => setPeopleOpen((v) => !v)}
              title="People"
              className={`relative flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${peopleOpen ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"}`}
            >
              <Users size={18} /> {people.length}
            </button>
          )}
          {canChat && (
            <button
              onClick={toggleChat}
              title={isGroup ? "Group chat" : "Chat"}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full ${chatOpen ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"}`}
            >
              <MessageSquare size={20} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            title={isFs ? "Exit full screen" : "Full screen"}
            className={ctrlBtn(isFs)}
          >
            {isFs ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button
            onClick={leaveRoom}
            className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold hover:bg-red-700"
          >
            <PhoneOff size={18} /> Leave
          </button>
        </div>
        <p className="shrink-0 pb-2 text-center text-[11px] text-slate-500">
          Once the session starts, the timer runs to zero even if someone
          leaves.
        </p>
      </div>

      {/* PEOPLE LIST (group) */}
      {isGroup && peopleOpen && (
        <div
          className={`fixed bottom-24 z-40 w-72 max-w-[90vw] rounded-2xl border border-slate-700 bg-slate-900 p-3 text-white shadow-2xl ${
            shiftForChat ? "right-4 sm:right-[25rem]" : "right-4"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">People ({people.length})</p>
            <button
              onClick={() => setPeopleOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {[...(mentorP ? [mentorP] : []), ...students].map((p) => (
              <li
                key={p.identity}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800"
              >
                <span className="truncate">
                  {p.name || p.identity}
                  {p.isLocal ? " (You)" : ""}
                  {p.identity.startsWith("mentor:") ? " · Employee" : ""}
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1.5 text-slate-400">
                  <button
                    type="button"
                    title="Pin"
                    onClick={() => togglePin(p.identity)}
                    className={pinnedId === p.identity ? "text-blue-400" : ""}
                  >
                    <Pin size={13} />
                  </button>
                  {p.isMicrophoneEnabled ? (
                    <Mic size={13} />
                  ) : (
                    <MicOff size={13} className="text-red-400" />
                  )}
                  {camOnOf(p) ? (
                    <Camera size={13} />
                  ) : (
                    <CameraOff size={13} className="text-red-400" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* chat: always mounted while in the room, so messages arrive even when closed.
          group = true  -> everybody can write, sender name is shown on every message
          group = false -> single chat, no names */}
      {canChat && (
        <ChatPanel
          variant="panel"
          open={chatOpen}
          bookingId={bookingId}
          role={isMentor ? "mentor" : "fresher"}
          group={isGroup}
          myUserId={myUserId}
          names={chatNames}
          title={
            isGroup
              ? "Group chat"
              : isMentor
                ? "Chat with fresher"
                : "Chat with employee"
          }
          onClose={closeChat}
          onIncoming={() => {
            if (!chatOpenRef.current) setUnread((n) => n + 1);
          }}
        />
      )}

      {/* review (last 1 minute): EVERY fresher (host + friends) */}
      {showReviewGate && (
        <ReviewGate booking={booking} onDone={() => setReviewDone(true)} />
      )}

      {/* "did it go well?" (last 3 minutes): ONLY the single fresher / group host
          No -> reason -> "Are you sure?" (OK / Cancel) */}
      {showSuccessConfirm && (
        <SessionConfirmModal
          title="Did the session go well?"
          subtitle="Please confirm your session. The meeting continues until the timer ends."
          onYes={() => answerSuccess(true)}
          onNo={(reason) => answerSuccess(false, reason)}
        />
      )}
    </>
  );
}