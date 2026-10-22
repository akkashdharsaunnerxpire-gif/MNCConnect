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
} from "lucide-react";
import socket from "../socket";
import ReviewModal from "../FresherDashboard/pages/Reviewmodal";
import MeetingInstructionsGate from "../Commoncomponents/MeetingInstructionsGate";
import SessionCompletionModal from "../Commoncomponents/SessionCompletionModal";
import { API_URL, ENDPOINTS, fmtClock } from "../services/fresherApi";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// camera + mic edukka. Video fail aana audio mattum try pannum
const getMedia = async () => {
  for (const constraints of [
    { video: true, audio: true },
    { video: false, audio: true },
  ]) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream, audioOnly: !constraints.video };
    } catch {
      /* next */
    }
  }
  return { stream: null, audioOnly: false };
};

const sendSignal = (data) => socket.emit("meeting:signal", { data });

export default function MeetingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const isMentor = useLocation().pathname.startsWith("/mentor");
  const token =
    localStorage.getItem(isMentor ? "mnc_mentor_token" : "fresher_token") || "";

  const [phase, setPhase] = useState("joining");
  const [message, setMessage] = useState("");
  const [opensAt, setOpensAt] = useState(null);
  const [clock, setClock] = useState({
    remainingMs: 0,
    running: false,
    at: Date.now(),
    mentorPresent: false,
    fresherPresent: false,
  });
  const [, forceTick] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaNote, setMediaNote] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [booking, setBooking] = useState(null);
  const [needsReview, setNeedsReview] = useState(false);

  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [completionDone, setCompletionDone] = useState(false);
  const [showSuccessBtn, setShowSuccessBtn] = useState(false);

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

  // camera / WebRTC sync flags
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

  // peer poche: ICE buffer-um clear
  const closePeer = useCallback(() => {
    dropPeer();
    pendingIce.current = [];
  }, [dropPeer]);

  const makePeer = useCallback(() => {
    dropPeer(); // pendingIce-a clear panna koodathu
    const peer = new RTCPeerConnection(ICE);

    const tracks = localStream.current?.getTracks() || [];
    if (tracks.length) {
      tracks.forEach((t) => peer.addTrack(t, localStream.current));
    }
    // camera illanalum remote video paaka
    if (!tracks.some((t) => t.kind === "video")) {
      peer.addTransceiver("video", { direction: "recvonly" });
    }
    if (!tracks.some((t) => t.kind === "audio")) {
      peer.addTransceiver("audio", { direction: "recvonly" });
    }

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

  // Mentor mattum offer pannum, rendu side camera ready aana apram
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
            // namma camera ready aagala na wait pannu
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

  /* ---------- join + socket listeners (camera illa) ---------- */
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
          setNeedsReview(!isMentor);
        } else {
          setMessage(res?.message || "Could not join.");
          setPhase("error");
        }
        return;
      }
      joined.current = true;
      setPhase("in");
      setClock({ ...res.state, at: Date.now() });
      setInstructionsAccepted(
        res.state.instructions || { mentor: false, fresher: false },
      );
    });
  }, [bookingId, token, isMentor]);

  useEffect(() => {
    unmounted.current = false;

    const onState = (s) => {
      setClock({ ...s, at: Date.now() });
      if (s.instructions) setInstructionsAccepted(s.instructions);
    };
    const onInstructionsState = (state) => setInstructionsAccepted(state);

    const onPeerJoined = () => {
      // pudhu peer: connection reset, namma camera ready na thirumba sollu
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
    const onEnded = () => {
      setPhase("awaiting_confirmation");
      setNeedsReview(!isMentor);
      closePeer();
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

  /* ---------- camera ON: rendu perum accept panna apram mattum ---------- */
  const bothAccepted =
    instructionsAccepted.mentor && instructionsAccepted.fresher;
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
      else if (audioOnly)
        setMediaNote("Camera not available. Joined with audio only.");
      else setMediaNote("");

      if (localVideo.current && stream) localVideo.current.srcObject = stream;

      localReadyRef.current = true;
      setLocalReady(true);

      // peer-kku "en camera ready" nu sollu
      sendSignal({ mediaReady: true });

      // offer already vandhu irundha ippo answer pannu
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

  // 5-min popup for Fresher
  useEffect(() => {
    if (
      !isMentor &&
      phase === "in" &&
      clock.running &&
      currentRemaining > 0 &&
      currentRemaining <= 5 * 60 * 1000 &&
      !showCompletionPrompt &&
      !completionDone
    ) {
      setShowCompletionPrompt(true);
    }
  }, [
    currentRemaining,
    phase,
    isMentor,
    showCompletionPrompt,
    completionDone,
    clock.running,
  ]);

  // 3-min "Meeting Success" button for Mentor
  useEffect(() => {
    if (
      isMentor &&
      phase === "in" &&
      clock.running &&
      currentRemaining > 0 &&
      currentRemaining <= 3 * 60 * 1000
    ) {
      setShowSuccessBtn(true);
    } else {
      setShowSuccessBtn(false);
    }
  }, [currentRemaining, phase, isMentor, clock.running]);

  const handleForceSuccess = () => {
    if (
      !confirm(
        "Are you sure you want to end the meeting as SUCCESS? The fresher will be asked to confirm.",
      )
    )
      return;
    socket.emit("meeting:force-end", { bookingId });
  };

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

  const leaveRoom = () =>
    navigate(isMentor ? "/mentor/sessions" : "/Home/my-bookings");
  const otherHere = isMentor ? clock.fresherPresent : clock.mentorPresent;

  const myInstructionsDone = isMentor
    ? instructionsAccepted.mentor
    : instructionsAccepted.fresher;
  const peerInstructionsDone = isMentor
    ? instructionsAccepted.fresher
    : instructionsAccepted.mentor;

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
          The meeting room opens 5 minutes before the session
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
        ) : (
          <>
            <h2 className="text-2xl font-bold">How was the session?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Please confirm and leave a review. This is done right here in the meeting.
            </p>
            {booking ? (
              // Yes click -> review step ULLE varum. Review submit aana apram thaan onDone(true)
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
        <h2 className="text-2xl font-bold">Session completed</h2>
        <p className="mt-2 text-sm text-slate-400">
          {isMentor
            ? "Your earnings are now available."
            : "Please share a quick review to finish."}
        </p>
        {isMentor && (
          <button
            onClick={leaveRoom}
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
          >
            Back to sessions
          </button>
        )}
        {needsReview && booking && !isMentor && (
          <ReviewModal booking={booking} onDone={leaveRoom} />
        )}
        {needsReview && !booking && <Loader2 className="mt-6 animate-spin" />}
      </Center>
    );
  }

  /* ---------- instructions gate: camera OFF ---------- */
  // Rendu perum accept panra varaikum gate irukkum, camera start aagadhu
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

  return (
    <>
      <div className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-semibold">
              {booking?.companyName || "MNCConnect session"}
            </p>
            <p
              className={`text-xs ${clock.running ? "text-emerald-400" : "text-amber-300"}`}
            >
              {status}
            </p>
          </div>
          <div
            className={`rounded-xl px-4 py-2 font-mono text-xl font-bold ${clock.running ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
          >
            {fmtClock(currentRemaining)}
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 px-4 pb-4"
          style={{ minHeight: 0 }}
        >
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
                objectFit: "cover",
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
          {clock.running &&
            currentRemaining > 0 &&
            currentRemaining <= 5 * 60 * 1000 && (
              <p className="absolute right-8 top-4 z-20 rounded-lg bg-amber-500/95 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg">
                ⏱ Last 5 minutes. Please start wrapping up.
              </p>
            )}
          {mediaNote && (
            <p className="absolute left-8 top-4 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
              {mediaNote}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 pb-3">
          {showSuccessBtn && isMentor && (
            <button
              onClick={handleForceSuccess}
              className="flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-bold hover:bg-emerald-700 animate-pulse"
            >
              <CheckCircle size={18} /> Meeting Success
            </button>
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

      {showCompletionPrompt && !isMentor && (
        <SessionCompletionModal
          booking={booking}
          variant="prompt"
          onClose={() => {
            setShowCompletionPrompt(false);
            setCompletionDone(true);
          }}
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