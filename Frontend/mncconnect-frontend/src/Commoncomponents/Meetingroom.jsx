// src/components/MeetingRoom.jsx
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
} from "lucide-react";
import socket from "../socket";
import ReviewModal from "../FresherDashboard/pages/Reviewmodal";
import MeetingInstructionsGate from "../Commoncomponents/MeetingInstructionsGate";
import SessionCompletionModal from "../Commoncomponents/SessionCompletionModal";
import ChatPanel from "../Commoncomponents/Chatpanel";
import { API_URL, ENDPOINTS, fmtClock } from "../services/fresherApi";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // { urls: "turn:YOUR_TURN_HOST:3478", username: "USER", credential: "PASS" },
  ],
};

const ONE_MIN = 60 * 1000;
const THREE_MIN = 3 * 60 * 1000; // confirm "did the session go well?"
const FIVE_MIN = 5 * 60 * 1000; // timer turns red + wrap-up banner
const REVIEW_AT_MS = ONE_MIN; // review pops in the last 1 minute

/* ---------- HD camera + mic ---------- */
const HD_VIDEO = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: "user",
};
const HD_AUDIO = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

const getMedia = async () => {
  const attempts = [
    { video: HD_VIDEO, audio: HD_AUDIO, audioOnly: false },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: HD_AUDIO, audioOnly: false },
    { video: true, audio: true, audioOnly: false },
    { video: false, audio: HD_AUDIO, audioOnly: true },
  ];
  for (const { audioOnly, ...constraints } of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getVideoTracks().forEach((t) => {
        if ("contentHint" in t) t.contentHint = "motion";
      });
      return { stream, audioOnly };
    } catch {
      /* next */
    }
  }
  return { stream: null, audioOnly: false };
};

const tuneSenders = async (peer) => {
  for (const sender of peer.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      if (sender.track.kind === "video") {
        params.encodings[0].maxBitrate = 2_500_000;
        params.encodings[0].maxFramerate = 30;
        params.degradationPreference = "maintain-resolution";
      } else {
        params.encodings[0].maxBitrate = 64_000;
      }
      await sender.setParameters(params);
    } catch {
      /* not supported */
    }
  }
};

const sendSignal = (data) => socket.emit("meeting:signal", { data });

/* ---------- Fresher: last 1 minute, stars + feedback REQUIRED ---------- */
const ReviewGate = ({ booking, token, onDone }) => {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requestGroupId: booking.requestGroupId,
          rating,
          comment: comment.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) onDone();
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
          Give a star rating and your feedback. The meeting continues until the timer ends.
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
                className={(hover || rating) >= n ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}
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

/* ---------- Fresher: "did the session go well?" (last 3 minutes) ---------- */
const SuccessConfirmModal = ({ onYes, onNo }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="text-emerald-600" size={30} />
      </div>
      <h3 className="mt-4 text-lg font-bold">Did the session go well?</h3>
      <p className="mt-1 text-sm text-slate-500">
        Please confirm your session. The meeting continues until the timer ends.
      </p>
      <div className="mt-5 flex gap-3">
        <button onClick={onNo} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
          No
        </button>
        <button onClick={onYes} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">
          Yes
        </button>
      </div>
    </div>
  </div>
);

export default function MeetingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const isMentor = useLocation().pathname.startsWith("/mentor");
  const token =
    localStorage.getItem(isMentor ? "mnc_mentor_token" : "fresher_token") || "";

  /* ---------- chat ---------- */
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
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
  });
  const [, forceTick] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaNote, setMediaNote] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [booking, setBooking] = useState(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [endedConfirmed, setEndedConfirmed] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [showSuccessBtn, setShowSuccessBtn] = useState(false);
  // fresher pressed "No" on the auto pop-up (do not show it again until the mentor asks)
  const [confirmSkipped, setConfirmSkipped] = useState(false);

  const [instructionsAccepted, setInstructionsAccepted] = useState({
    mentor: false,
    fresher: false,
  });

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteStream = useRef(null);
  const localStream = useRef(null);
  const pc = useRef(null);
  const pendingIce = useRef([]);
  const pendingOffer = useRef(null);
  const retryTimer = useRef(null);
  const joined = useRef(false);
  const unmounted = useRef(false);

  const mediaStarted = useRef(false);
  const localReadyRef = useRef(false);
  const peerReadyRef = useRef(false);
  const calledRef = useRef(false);

  /* ---------- WebRTC ---------- */
  const dropPeer = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    remoteStream.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }, []);

  const closePeer = useCallback(() => {
    dropPeer();
    pendingIce.current = [];
  }, [dropPeer]);

  const makePeer = useCallback(() => {
    dropPeer();
    const peer = new RTCPeerConnection(ICE);

    const tracks = localStream.current?.getTracks() || [];
    if (tracks.length) tracks.forEach((t) => peer.addTrack(t, localStream.current));
    if (!tracks.some((t) => t.kind === "video")) peer.addTransceiver("video", { direction: "recvonly" });
    if (!tracks.some((t) => t.kind === "audio")) peer.addTransceiver("audio", { direction: "recvonly" });

    tuneSenders(peer);

    peer.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = e.streams[0];
        remoteVideo.current.play?.().catch(() => {});
      }
    };
    peer.onicecandidate = (e) => e.candidate && sendSignal({ candidate: e.candidate });
    pc.current = peer;
    return peer;
  }, [dropPeer]);

  const callPeer = useCallback(async () => {
    const peer = makePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal({ description: peer.localDescription });
  }, [makePeer]);

  const maybeCall = useCallback(() => {
    if (!isMentor || calledRef.current) return;
    if (!localReadyRef.current || !peerReadyRef.current) return;
    calledRef.current = true;
    callPeer().catch((e) => {
      calledRef.current = false;
      console.error("offer error", e);
    });
  }, [isMentor, callPeer]);

  const flushIce = useCallback(async () => {
    for (const c of pendingIce.current.splice(0))
      await pc.current?.addIceCandidate(c).catch(() => {});
  }, []);

  const handleOffer = useCallback(
    async (description) => {
      const peer = makePeer();
      await peer.setRemoteDescription(description);
      await flushIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({ description: peer.localDescription });
    },
    [makePeer, flushIce],
  );

  const onSignal = useCallback(
    async ({ data }) => {
      try {
        if (data?.mediaReady) {
          peerReadyRef.current = true;
          maybeCall();
        } else if (data?.description) {
          if (data.description.type === "offer") {
            if (!localReadyRef.current) {
              pendingOffer.current = data.description;
              return;
            }
            await handleOffer(data.description);
          } else if (pc.current) {
            await pc.current.setRemoteDescription(data.description);
            await flushIce();
          }
        } else if (data?.candidate) {
          if (pc.current?.remoteDescription)
            await pc.current.addIceCandidate(data.candidate).catch(() => {});
          else pendingIce.current.push(data.candidate);
        }
      } catch (e) {
        console.error("signal error", e);
      }
    },
    [maybeCall, handleOffer, flushIce],
  );

  /* ---------- join + socket listeners ---------- */
  const join = useCallback(() => {
    socket.emit("meeting:join", { bookingId, token }, (res) => {
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
          setNeedsReview(false);
        } else {
          setMessage(res?.message || "Could not join.");
          setPhase("error");
        }
        return;
      }
      joined.current = true;
      setPhase("in");
      setClock({ ...res.state, at: Date.now() });
      setInstructionsAccepted(res.state.instructions || { mentor: false, fresher: false });
    });
  }, [bookingId, token, isMentor]);

  useEffect(() => {
    unmounted.current = false;

    const onState = (s) => {
      setClock({ ...s, at: Date.now() });
      if (s.instructions) setInstructionsAccepted(s.instructions);
      // mentor asked again -> allow the pop-up to show again
      if (s.successRequested) setConfirmSkipped(false);
    };
    const onInstructionsState = (state) => setInstructionsAccepted(state);

    const onPeerJoined = () => {
      closePeer();
      peerReadyRef.current = false;
      calledRef.current = false;
      pendingOffer.current = null;
      if (localReadyRef.current) sendSignal({ mediaReady: true });
    };
    const onPeerLeft = () => {
      closePeer();
      peerReadyRef.current = false;
      calledRef.current = false;
      pendingOffer.current = null;
    };
    // timer reached zero
    const onEnded = (p) => {
      closePeer();
      if (p?.confirmed) {
        setEndedConfirmed(true);
        setPhase("ended"); // fresher already said YES -> completed
      } else {
        setPhase("awaiting_confirmation");
      }
    };
    const onReconnect = () => joined.current && join();

    socket.on("meeting:state", onState);
    socket.on("meeting:instructions-state", onInstructionsState);
    socket.on("meeting:peer-joined", onPeerJoined);
    socket.on("meeting:peer-left", onPeerLeft);
    socket.on("meeting:signal", onSignal);
    socket.on("meeting:ended", onEnded);
    socket.on("connect", onReconnect);

    if (!socket.connected) socket.connect();
    join();

    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      joined.current = false;
      socket.emit("meeting:leave");
      socket.off("meeting:state", onState);
      socket.off("meeting:instructions-state", onInstructionsState);
      socket.off("meeting:peer-joined", onPeerJoined);
      socket.off("meeting:peer-left", onPeerLeft);
      socket.off("meeting:signal", onSignal);
      socket.off("meeting:ended", onEnded);
      socket.off("connect", onReconnect);
      closePeer();
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      localReadyRef.current = false;
      mediaStarted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  /* ---------- camera ON after both accepted ---------- */
  const bothAccepted = instructionsAccepted.mentor && instructionsAccepted.fresher;
  const mediaAllowed = bothAccepted || clock.running;

  useEffect(() => {
    if (phase !== "in" || !mediaAllowed || mediaStarted.current) return;
    mediaStarted.current = true;

    (async () => {
      const { stream, audioOnly } = await getMedia();

      if (unmounted.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      localStream.current = stream;
      if (!stream) setMediaNote("Camera and mic blocked.");
      else if (audioOnly) setMediaNote("Camera not available. Joined with audio only.");
      else setMediaNote("");

      if (localVideo.current && stream) localVideo.current.srcObject = stream;

      localReadyRef.current = true;
      setLocalReady(true);
      sendSignal({ mediaReady: true });

      if (pendingOffer.current) {
        const offer = pendingOffer.current;
        pendingOffer.current = null;
        handleOffer(offer).catch((e) => console.error(e));
      }
      maybeCall();
    })();
  }, [phase, mediaAllowed, handleOffer, maybeCall]);

  /* ---------- clock / booking ---------- */
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}${ENDPOINTS.booking(bookingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => d.booking && setBooking(d.booking))
      .catch(() => {});
  }, [bookingId, token, phase]);

  const currentRemaining = clock.running
    ? Math.max(0, clock.remainingMs - (Date.now() - clock.at))
    : clock.remainingMs;

  const inLast5 = clock.running && currentRemaining > 0 && currentRemaining <= FIVE_MIN;
  const inLast3 = clock.running && currentRemaining > 0 && currentRemaining <= THREE_MIN;
  const inLast1 = clock.running && currentRemaining > 0 && currentRemaining <= REVIEW_AT_MS;

  // Mentor: "Meeting Success" button in the last 3 min
  useEffect(() => {
    setShowSuccessBtn(isMentor && phase === "in" && inLast3);
  }, [inLast3, phase, isMentor]);

  const sendSuccessRequest = () => socket.emit("meeting:success-request", { bookingId });
  const answerSuccess = (accepted) => {
    if (!accepted) setConfirmSkipped(true);
    socket.emit("meeting:success-confirm", { bookingId, accepted });
  };

  // Fresher: mandatory review popup in the LAST 1 MINUTE
  const alreadyReviewed = reviewDone || Boolean(booking?.reviewed);
  const showReviewGate =
    !isMentor && phase === "in" && Boolean(booking) && inLast1 && !alreadyReviewed;

  // Fresher: "did the session go well?" pops at 3 minutes (or when the mentor asks)
  const showSuccessConfirm =
    !isMentor &&
    phase === "in" &&
    !clock.fresherConfirmed &&
    !showReviewGate &&
    (clock.successRequested || (inLast3 && !confirmSkipped));

  const toggle = (kind) => {
    const tracks =
      kind === "mic"
        ? localStream.current?.getAudioTracks()
        : localStream.current?.getVideoTracks();
    if (!tracks?.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    kind === "mic" ? setMicOn(next) : setCamOn(next);
  };

  const leaveRoom = () => navigate(isMentor ? "/mentor/sessions" : "/Home/my-bookings");
  const otherHere = isMentor ? clock.fresherPresent : clock.mentorPresent;

  const myInstructionsDone = isMentor ? instructionsAccepted.mentor : instructionsAccepted.fresher;
  const peerInstructionsDone = isMentor ? instructionsAccepted.fresher : instructionsAccepted.mentor;

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
        <h2 className="mt-4 text-xl font-bold">The meeting room opens 5 minutes before the session</h2>
        <p className="mt-2 font-mono text-3xl">{fmtClock((opensAt || Date.now()) - Date.now())}</p>
        <p className="mt-2 text-sm text-slate-400">We'll let you in automatically.</p>
        <button onClick={leaveRoom} className="mt-6 rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold">
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
        <button onClick={leaveRoom} className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">
          Back
        </button>
      </Center>
    );
  }

  // timer ended and fresher has NOT confirmed yet
  if (phase === "awaiting_confirmation") {
    return (
      <Center>
        {isMentor ? (
          <>
            <Clock3 size={44} className="text-amber-400" />
            <h2 className="mt-4 text-2xl font-bold">Session time completed</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Waiting for the fresher to confirm the session. Once confirmed, your earnings will be released.
            </p>
            <button onClick={leaveRoom} className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">
              Back to sessions
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">How was the session?</h2>
            <p className="mt-2 text-sm text-slate-400">Please confirm the session.</p>
            {booking ? (
              <SessionCompletionModal booking={booking} onDone={() => leaveRoom()} />
            ) : (
              <Loader2 className="mt-6 animate-spin" />
            )}
          </>
        )}
      </Center>
    );
  }

  // timer ended and fresher already said YES -> everything completed
  if (phase === "ended") {
    return (
      <Center>
        <CheckCircle size={46} className="text-emerald-400" />
        <h2 className="mt-4 text-2xl font-bold">Session completed</h2>
        <p className="mt-2 text-sm text-slate-400">
          {isMentor
            ? "The fresher confirmed the session. Your earnings are now available."
            : "Thanks for your feedback. Your session is confirmed."}
        </p>
        <button onClick={leaveRoom} className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">
          {isMentor ? "Back to sessions" : "Back to my bookings"}
        </button>
        {needsReview && booking && !isMentor && !endedConfirmed && (
          <ReviewModal booking={booking} onDone={leaveRoom} />
        )}
      </Center>
    );
  }

  /* ---------- instructions gate ---------- */
  if (phase === "in" && !clock.running && !bothAccepted) {
    return (
      <MeetingInstructionsGate
        bookingId={bookingId}
        role={isMentor ? "mentor" : "fresher"}
        alreadyAccepted={myInstructionsDone}
        peerAccepted={peerInstructionsDone}
      />
    );
  }

  const status = clock.running
    ? "Session in progress"
    : !localReady
      ? "Starting camera…"
      : otherHere
        ? "Connecting…"
        : `Waiting for the ${isMentor ? "fresher" : "employee"} to join.`;

  // timer colours: normal = emerald, last 5 min = RED
  const timerCls = inLast5
    ? "animate-pulse bg-red-600 text-white ring-2 ring-red-400/60"
    : clock.running
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-amber-500/15 text-amber-300";

  return (
    <>
      <div className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-semibold">{booking?.companyName || "MNCConnect session"}</p>
            <p
              className={`text-xs ${
                inLast5 ? "text-red-400" : clock.running ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              {inLast5 ? "Last 5 minutes" : status}
            </p>
          </div>
          <div className={`rounded-xl px-4 py-2 font-mono text-xl font-bold tabular-nums ${timerCls}`}>
            {fmtClock(currentRemaining)}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 px-4 pb-4" style={{ minHeight: 0 }}>
          <div
            className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
            style={{ width: "100%", height: "100%", minHeight: 0 }}
          >
            <video
              ref={(el) => {
                remoteVideo.current = el;
                if (el && remoteStream.current && el.srcObject !== remoteStream.current) {
                  el.srcObject = remoteStream.current;
                  el.play?.().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              style={{
                position: "absolute",
                inset: 0,
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "#000",
              }}
            />
            {!otherHere && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
                  <UserRound size={36} />
                </div>
                <p className="mt-4 text-sm">Waiting for the {isMentor ? "fresher" : "employee"}…</p>
              </div>
            )}
            <video
              ref={(el) => {
                localVideo.current = el;
                if (el && localStream.current && el.srcObject !== localStream.current)
                  el.srcObject = localStream.current;
              }}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                zIndex: 10,
                right: "16px",
                bottom: "16px",
                width: "clamp(110px, 18vw, 220px)",
                height: "clamp(85px, 22vh, 160px)",
                objectFit: "cover",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.25)",
                backgroundColor: "#0f172a",
              }}
            />
          </div>

          {inLast5 && (
            <p className="absolute right-8 top-4 z-20 rounded-lg bg-red-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              ⏱ Last 5 minutes. Please start wrapping up.
            </p>
          )}
          {mediaNote && (
            <p className="absolute left-8 top-4 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
              {mediaNote}
            </p>
          )}

          {/* MENTOR: green alert when the fresher said YES */}
          {isMentor && clock.fresherConfirmed && (
            <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
              <CheckCircle size={18} />
              The fresher confirmed: the meeting went well ✅
            </div>
          )}
          {isMentor && clock.fresherDeclined && !clock.successRequested && !clock.fresherConfirmed && (
            <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-xl">
              The fresher said the session is not complete yet. You can ask again.
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 pb-3">
          {isMentor && showSuccessBtn && !clock.successRequested && !clock.fresherConfirmed && (
            <button
              onClick={sendSuccessRequest}
              className="flex h-12 animate-pulse items-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-bold hover:bg-emerald-700"
            >
              <CheckCircle size={18} /> Meeting Success
            </button>
          )}
          {isMentor && clock.successRequested && !clock.fresherConfirmed && (
            <span className="flex h-12 items-center gap-2 rounded-full bg-slate-800 px-5 text-xs font-semibold text-amber-300">
              <Loader2 size={14} className="animate-spin" /> Waiting for the fresher to confirm…
            </span>
          )}

          <button
            onClick={() => toggle("mic")}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${micOn ? "bg-slate-700" : "bg-red-600"}`}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={() => toggle("cam")}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${camOn ? "bg-slate-700" : "bg-red-600"}`}
          >
            {camOn ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>
          <button
            onClick={toggleChat}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full ${chatOpen ? "bg-blue-600" : "bg-slate-700"}`}
          >
            <MessageSquare size={20} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={leaveRoom}
            className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold"
          >
            <PhoneOff size={18} /> Leave
          </button>
        </div>
        <p className="shrink-0 pb-3 text-center text-[11px] text-slate-500">
          Once the session starts, the timer runs to zero even if someone leaves.
        </p>
      </div>

      {/* Always mounted while in the room, so messages arrive even when closed */}
      <ChatPanel
        variant="panel"
        open={chatOpen}
        bookingId={bookingId}
        token={token}
        role={isMentor ? "mentor" : "fresher"}
        title={isMentor ? "Chat with fresher" : "Chat with employee"}
        onClose={closeChat}
        onIncoming={() => {
          if (!chatOpenRef.current) setUnread((n) => n + 1);
        }}
      />

      {showReviewGate && (
        <ReviewGate booking={booking} token={token} onDone={() => setReviewDone(true)} />
      )}
      {showSuccessConfirm && (
        <SuccessConfirmModal onYes={() => answerSuccess(true)} onNo={() => answerSuccess(false)} />
      )}
    </>
  );
}

const Center = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
    {children}
  </div>
);