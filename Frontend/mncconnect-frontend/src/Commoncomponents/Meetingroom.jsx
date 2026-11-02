// src/components/MeetingRoom.jsx
// SINGLE meeting : peer-to-peer WebRTC (same as before)
// GROUP meeting  : LiveKit (SFU) - works for 2 to 60 people
//   npm i livekit-client
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
} from "lucide-react";
import { Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import { socket } from "../utils/socket";
import ReviewModal from "../FresherDashboard/pages/Reviewmodal";
import MeetingInstructionsGate from "../Commoncomponents/MeetingInstructionsGate";
import SessionCompletionModal from "../Commoncomponents/SessionCompletionModal";
import ChatPanel from "../Commoncomponents/Chatpanel";
import { API_URL, ENDPOINTS, fmtClock, getUserId } from "../services/fresherApi";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // { urls: "turn:YOUR_TURN_HOST:3478", username: "USER", credential: "PASS" },
  ],
};

const ONE_MIN = 60 * 1000;
const THREE_MIN = 3 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const REVIEW_AT_MS = ONE_MIN;
const OPEN_BEFORE_MIN = 2;
const CONFIRMED_BANNER_MS = 20 * 1000;

// group: students join with mic + camera OFF when the group is bigger than this
const AUTO_MEDIA_MAX = 6;
// group: how many student tiles are drawn at once (the rest are listed under "People")
const GRID_MAX = 11;

/* ---------- HD camera + mic (single meeting) ---------- */
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
    {
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: HD_AUDIO,
      audioOnly: false,
    },
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
      if (!params.encodings || !params.encodings.length)
        params.encodings = [{}];
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

const initialsOf = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/* ---------- Fresher (host / single): last 1 minute, stars + feedback REQUIRED ---------- */
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
        <button
          onClick={onNo}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
        >
          No
        </button>
        <button
          onClick={onYes}
          className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Yes
        </button>
      </div>
    </div>
  </div>
);

/* ---------- GROUP: one participant tile (LiveKit) ---------- */
const Tile = ({ participant, version, big = false }) => {
  const ref = useRef(null);
  const pub = participant.getTrackPublication(Track.Source.Camera);
  const camOn = Boolean(pub?.track) && !pub.isMuted;
  const micOn = participant.isMicrophoneEnabled;
  const name = participant.name || participant.identity;
  const mentor = participant.identity.startsWith("mentor:");

  useEffect(() => {
    const el = ref.current;
    const p = participant.getTrackPublication(Track.Source.Camera);
    const track = p?.track;
    if (!el || !track || p.isMuted) return undefined;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [participant, version, camOn]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-900">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full ${big ? "object-contain" : "object-cover"} ${camOn ? "" : "hidden"}`}
      />
      {!camOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`flex items-center justify-center rounded-full bg-slate-700 font-bold text-slate-100 ${big ? "h-24 w-24 text-3xl" : "h-12 w-12 text-sm"}`}
          >
            {initialsOf(name)}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex max-w-[92%] items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        {!micOn && <MicOff size={11} className="shrink-0 text-red-400" />}
        <span className="truncate">
          {name}
          {participant.isLocal ? " (You)" : ""}
          {mentor ? " · Employee" : ""}
        </span>
      </div>
    </div>
  );
};

export default function MeetingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const isMentor = useLocation().pathname.startsWith("/mentor");
  const myUserId = String(getUserId?.() || "");

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
    instructions: { mentor: false, fresher: false },
    mode: "single",
    maxMembers: 1,
    hostId: "",
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
  const [confirmedBanner, setConfirmedBanner] = useState(false);

  // MY OWN acceptance of the instructions (a friend's acceptance is separate from the host's)
  const [myAcc, setMyAcc] = useState(false);

  /* ---------- group (LiveKit) state ---------- */
  const lkRoomRef = useRef(null);
  const audioBox = useRef(null);
  const [lkVersion, setLkVersion] = useState(0);
  const [lkConnected, setLkConnected] = useState(false);
  const [needAudio, setNeedAudio] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const clockRef = useRef(clock);
  clockRef.current = clock;

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

  const isGroup = clock.mode === "group";
  const isHost = !isMentor && myUserId && String(clock.hostId) === myUserId;
  // single meeting fresher OR the group host: can review / confirm / chat
  const isHostFresher = !isMentor && (!isGroup || isHost);

  /* ---------- WebRTC (single) ---------- */
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
    if (tracks.length)
      tracks.forEach((t) => peer.addTrack(t, localStream.current));
    if (!tracks.some((t) => t.kind === "video"))
      peer.addTransceiver("video", { direction: "recvonly" });
    if (!tracks.some((t) => t.kind === "audio"))
      peer.addTransceiver("audio", { direction: "recvonly" });

    tuneSenders(peer);

    peer.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = e.streams[0];
        remoteVideo.current.play?.().catch(() => {});
      }
    };
    peer.onicecandidate = (e) =>
      e.candidate && sendSignal({ candidate: e.candidate });
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
          setNeedsReview(false);
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
    unmounted.current = false;

    const onState = (s) => setClock({ ...s, at: Date.now() });
    // per-person instructions state (a friend sees HIS own acceptance here)
    const onInstructionsState = (s) =>
      setMyAcc(Boolean(isMentor ? s.mentor : s.fresher));

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
    const onEnded = (p) => {
      closePeer();
      lkRoomRef.current?.disconnect();
      if (p?.confirmed) {
        setEndedConfirmed(true);
        setPhase("ended");
      } else {
        setPhase("awaiting_confirmation");
      }
    };
    const onReconnect = () => joined.current && join();

    socket.on("meeting:state", onState);
    socket.on("meeting:instructions-state", onInstructionsState);
    // single meeting only (group uses LiveKit): these are harmless in a group
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

  /* ---------- when may the camera / video start? ----------
     start condition (server): employee + HOST accepted the instructions.
     I need MY OWN acceptance too (so every friend reads the instructions). */
  const inst = clock.instructions || {};
  const startReady = Boolean(inst.mentor && inst.fresher);
  const mediaAllowed = myAcc && (startReady || clock.running);

  // what the "waiting for the other side" line of the gate should check
  const peerDone = isMentor
    ? Boolean(inst.fresher)
    : isHost || !isGroup
      ? Boolean(inst.mentor)
      : startReady;

  /* ---------- SINGLE: camera + mic ---------- */
  useEffect(() => {
    if (isGroup || phase !== "in" || !mediaAllowed || mediaStarted.current)
      return;
    mediaStarted.current = true;

    (async () => {
      const { stream, audioOnly } = await getMedia();

      if (unmounted.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      localStream.current = stream;
      if (!stream) setMediaNote("Camera and mic blocked.");
      else if (audioOnly)
        setMediaNote("Camera not available. Joined with audio only.");
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
  }, [isGroup, phase, mediaAllowed, handleOffer, maybeCall]);

  /* ---------- GROUP: connect to LiveKit ---------- */
  useEffect(() => {
    if (!isGroup || phase !== "in" || !mediaAllowed) return undefined;

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
          throw new Error(d.message || "Could not start the group video.");
        if (cancelled) return;

        room = new Room({
          adaptiveStream: true, // only download the tiles that are on screen
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h720 },
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

        // big groups: students join muted (their choice to unmute)
        const big = (clockRef.current.maxMembers || 1) > AUTO_MEDIA_MAX;
        const startMuted = big && !isMentor;
        if (startMuted) {
          setMicOn(false);
          setCamOn(false);
          setMediaNote(
            "Big group: your mic and camera are off. Use the buttons below to switch them on.",
          );
        } else {
          let blocked = false;
          await room.localParticipant
            .setMicrophoneEnabled(true)
            .catch(() => {
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
          setMediaNote(e.message || "Could not start the group video.");
      }
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      lkRoomRef.current = null;
      setLkConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup, phase, mediaAllowed, bookingId]);

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
  const answerSuccess = (accepted) => {
    socket.emit("meeting:success-confirm", { bookingId, accepted });
  };

  // review + "did it go well?" are for the single-meeting fresher / the group HOST only
  const alreadyReviewed = reviewDone || Boolean(booking?.reviewed);
  const showReviewGate =
    isHostFresher &&
    phase === "in" &&
    Boolean(booking) &&
    inLast1 &&
    !alreadyReviewed;

  const showSuccessConfirm =
    isHostFresher &&
    phase === "in" &&
    !clock.fresherConfirmed &&
    !showReviewGate &&
    clock.successRequested;

  const toggle = async (kind) => {
    if (isGroup) {
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
      return;
    }

    const tracks =
      kind === "mic"
        ? localStream.current?.getAudioTracks()
        : localStream.current?.getVideoTracks();
    if (!tracks?.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    kind === "mic" ? setMicOn(next) : setCamOn(next);
  };

  const leaveRoom = () =>
    navigate(isMentor ? "/mentor/sessions" : "/Home/my-bookings");
  const otherHere = isMentor ? clock.fresherPresent : clock.mentorPresent;

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
              Waiting for the fresher to confirm the session. Once confirmed,
              your earnings will be released.
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
            <h2 className="text-2xl font-bold">How was the session?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Please confirm the session.
            </p>
            {booking ? (
              <SessionCompletionModal
                booking={booking}
                onDone={() => leaveRoom()}
              />
            ) : (
              <Loader2 className="mt-6 animate-spin" />
            )}
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
            ? "The fresher confirmed the session. Your earnings are now available."
            : "Thanks for your feedback. Your session is confirmed."}
        </p>
        <button
          onClick={leaveRoom}
          className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
        >
          {isMentor ? "Back to sessions" : "Back to my bookings"}
        </button>
        {needsReview && booking && isHostFresher && !endedConfirmed && (
          <ReviewModal booking={booking} onDone={leaveRoom} />
        )}
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
      />
    );
  }

  const mediaReady = isGroup ? lkConnected : localReady;
  const status = clock.running
    ? "Session in progress"
    : !mediaReady
      ? "Starting camera…"
      : isGroup
        ? "Waiting for everyone to join…"
        : otherHere
          ? "Connecting…"
          : `Waiting for the ${isMentor ? "fresher" : "employee"} to join.`;

  const timerCls = inLast5
    ? "animate-pulse bg-red-600 text-white ring-2 ring-red-400/60"
    : clock.running
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-amber-500/15 text-amber-300";

  /* ---------- group stage data ---------- */
  const lkRoom = lkRoomRef.current;
  const people = lkRoom
    ? [lkRoom.localParticipant, ...Array.from(lkRoom.remoteParticipants.values())]
    : [];
  const mentorP = people.find((p) => p.identity.startsWith("mentor:"));
  const camOnOf = (p) => {
    const pub = p.getTrackPublication(Track.Source.Camera);
    return Boolean(pub?.track) && !pub.isMuted;
  };
  const students = people
    .filter((p) => p !== mentorP)
    .sort(
      (a, b) =>
        Number(b.isLocal) - Number(a.isLocal) ||
        Number(camOnOf(b)) - Number(camOnOf(a)),
    );
  const shownStudents = students.slice(0, GRID_MAX);
  const hiddenStudents = Math.max(0, students.length - shownStudents.length);

  const canChat = !isGroup || isMentor || isHost;

  return (
    <>
      <div className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-semibold">
              {booking?.companyName || "MNCConnect session"}
              {isGroup && (
                <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                  Group · {students.length + (mentorP ? 1 : 0) || 1} online
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
            className={`rounded-xl px-4 py-2 font-mono text-xl font-bold tabular-nums ${timerCls}`}
          >
            {fmtClock(currentRemaining)}
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 px-4 pb-4"
          style={{ minHeight: 0 }}
        >
          {isGroup ? (
            /* ================= GROUP STAGE ================= */
            <div className="flex h-full w-full flex-col gap-2">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
                {mentorP ? (
                  <Tile participant={mentorP} version={lkVersion} big />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
                      <UserRound size={36} />
                    </div>
                    <p className="mt-4 text-sm">Waiting for the employee…</p>
                  </div>
                )}
              </div>

              {students.length > 0 && (
                <div className="grid max-h-[34%] shrink-0 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
                  {shownStudents.map((p) => (
                    <div key={p.identity} className="aspect-video">
                      <Tile participant={p} version={lkVersion} />
                    </div>
                  ))}
                  {hiddenStudents > 0 && (
                    <button
                      type="button"
                      onClick={() => setPeopleOpen(true)}
                      className="flex aspect-video items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      +{hiddenStudents} more
                    </button>
                  )}
                </div>
              )}

              {/* every remote voice plays from here */}
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
            </div>
          ) : (
            /* ================= SINGLE STAGE ================= */
            <div
              className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
              style={{ width: "100%", height: "100%", minHeight: 0 }}
            >
              <video
                ref={(el) => {
                  remoteVideo.current = el;
                  if (
                    el &&
                    remoteStream.current &&
                    el.srcObject !== remoteStream.current
                  ) {
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
                  <p className="mt-4 text-sm">
                    Waiting for the {isMentor ? "fresher" : "employee"}…
                  </p>
                </div>
              )}
              <video
                ref={(el) => {
                  localVideo.current = el;
                  if (
                    el &&
                    localStream.current &&
                    el.srcObject !== localStream.current
                  )
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
          )}

          {inLast5 && (
            <p className="absolute right-8 top-4 z-20 rounded-lg bg-red-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              ⏱ Last 5 minutes. Please start wrapping up.
            </p>
          )}
          {mediaNote && (
            <p className="absolute left-8 top-4 z-20 max-w-[60%] rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
              {mediaNote}
            </p>
          )}

          {isMentor && confirmedBanner && (
            <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
              <CheckCircle size={18} />
              The fresher confirmed: the meeting went well ✅
            </div>
          )}
          {isMentor &&
            clock.fresherDeclined &&
            !clock.successRequested &&
            !clock.fresherConfirmed && (
              <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-xl">
                The fresher said the session is not complete yet. You can ask
                again.
              </div>
            )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 pb-3">
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
              <Loader2 size={14} className="animate-spin" /> Waiting for the
              fresher to confirm…
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
          {isGroup && (
            <button
              onClick={() => setPeopleOpen((v) => !v)}
              className={`relative flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${peopleOpen ? "bg-blue-600" : "bg-slate-700"}`}
            >
              <Users size={18} /> {people.length}
            </button>
          )}
          {canChat && (
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
          )}
          <button
            onClick={leaveRoom}
            className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold"
          >
            <PhoneOff size={18} /> Leave
          </button>
        </div>
        <p className="shrink-0 pb-3 text-center text-[11px] text-slate-500">
          Once the session starts, the timer runs to zero even if someone
          leaves.
        </p>
      </div>

      {/* PEOPLE LIST (group) */}
      {isGroup && peopleOpen && (
        <div className="fixed bottom-20 right-4 z-40 w-72 max-w-[90vw] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">People ({people.length})</p>
            <button onClick={() => setPeopleOpen(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {[...(mentorP ? [mentorP] : []), ...students].map((p) => (
              <li key={p.identity} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800">
                <span className="truncate">
                  {p.name || p.identity}
                  {p.isLocal ? " (You)" : ""}
                  {p.identity.startsWith("mentor:") ? " · Employee" : ""}
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1.5 text-slate-400">
                  {p.isMicrophoneEnabled ? <Mic size={13} /> : <MicOff size={13} className="text-red-400" />}
                  {camOnOf(p) ? <Camera size={13} /> : <CameraOff size={13} className="text-red-400" />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* chat: always mounted while in the room, so messages arrive even when closed */}
      {canChat && (
        <ChatPanel
          variant="panel"
          open={chatOpen}
          bookingId={bookingId}
          role={isMentor ? "mentor" : "fresher"}
          title={isMentor ? "Chat with fresher" : "Chat with employee"}
          onClose={closeChat}
          onIncoming={() => {
            if (!chatOpenRef.current) setUnread((n) => n + 1);
          }}
        />
      )}

      {showReviewGate && (
        <ReviewGate booking={booking} onDone={() => setReviewDone(true)} />
      )}
      {showSuccessConfirm && (
        <SuccessConfirmModal
          onYes={() => answerSuccess(true)}
          onNo={() => answerSuccess(false)}
        />
      )}
    </>
  );
}

const Center = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
    {children}
  </div>
);