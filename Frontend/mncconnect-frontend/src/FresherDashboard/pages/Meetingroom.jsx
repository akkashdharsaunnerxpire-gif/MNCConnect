// src/components/MeetingRoom.jsx   (shared by fresher AND mentor)
// Routes:  /Home/meeting/:bookingId   and   /mentor/meeting/:bookingId
//
//  * opens 5 minutes before the start time
//  * the timer runs on the SERVER and only while BOTH people are inside
//  * if someone leaves, the timer pauses; when they come back it resumes
//  * video/audio is peer-to-peer WebRTC (signalling relayed by socket.io)
//  * when the time ends the fresher must submit a review

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Camera, CameraOff, Loader2, Mic, MicOff, PhoneOff, Clock3, UserRound } from "lucide-react";
import socket from "../../socket";
import ReviewModal from "../pages/Reviewmodal";
import { API_URL, ENDPOINTS, fmtClock } from "../../services/fresherApi";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

export default function MeetingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const isMentor = useLocation().pathname.startsWith("/mentor");
  const token = localStorage.getItem(isMentor ? "mnc_mentor_token" : "fresher_token") || "";
  const otherRole = isMentor ? "fresher" : "employee";

  const [phase, setPhase] = useState("joining"); // joining | waitingOpen | in | ended | error
  const [message, setMessage] = useState("");
  const [opensAt, setOpensAt] = useState(null);
  const [clock, setClock] = useState({ remainingMs: 0, running: false, at: Date.now(), mentorPresent: false, fresherPresent: false });
  const [, forceTick] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaNote, setMediaNote] = useState("");
  const [booking, setBooking] = useState(null);
  const [needsReview, setNeedsReview] = useState(false);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteStream = useRef(null);
  const localStream = useRef(null);
  const pc = useRef(null);
  const pendingIce = useRef([]);
  const retryTimer = useRef(null);
  const joined = useRef(false);

  /* ---------- WebRTC ---------- */
  const closePeer = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    pendingIce.current = [];
    remoteStream.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }, []);

  const makePeer = useCallback(() => {
    closePeer();
    const peer = new RTCPeerConnection(ICE);
    localStream.current?.getTracks().forEach((t) => peer.addTrack(t, localStream.current));
    peer.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = e.streams[0];
        remoteVideo.current.play?.().catch(() => {});
      }
    };
    peer.onicecandidate = (e) => e.candidate && socket.emit("meeting:signal", { data: { candidate: e.candidate } });
    pc.current = peer;
    return peer;
  }, [closePeer]);

  const callPeer = useCallback(async () => {
    const peer = makePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("meeting:signal", { data: { description: peer.localDescription } });
  }, [makePeer]);

  const onSignal = useCallback(
    async ({ data }) => {
      try {
        if (data?.description) {
          if (data.description.type === "offer") {
            const peer = makePeer();
            await peer.setRemoteDescription(data.description);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("meeting:signal", { data: { description: peer.localDescription } });
          } else if (pc.current) {
            await pc.current.setRemoteDescription(data.description);
          }
          for (const c of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(c).catch(() => {});
        } else if (data?.candidate) {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(data.candidate).catch(() => {});
          else pendingIce.current.push(data.candidate);
        }
      } catch (e) {
        console.error("signal error", e);
      }
    },
    [makePeer]
  );

  /* ---------- join ---------- */
  const join = useCallback(() => {
    socket.emit("meeting:join", { bookingId, token }, (res) => {
      if (!res?.ok) {
        if (res?.code === "NOT_OPEN") {
          setOpensAt(res.opensAt);
          setPhase("waitingOpen");
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(join, Math.min(Math.max(res.opensAt - Date.now(), 1000), 30000));
        } else if (res?.code === "ENDED") {
          setPhase("ended");
          setNeedsReview(!isMentor);
        } else {
          setMessage(res?.message || "Could not join the meeting.");
          setPhase("error");
        }
        return;
      }
      joined.current = true;
      setPhase("in");
      setClock({ ...res.state, at: Date.now() });
    });
  }, [bookingId, token, isMentor]);

  useEffect(() => {
    let cancelled = false;

    const onState = (s) => setClock({ ...s, at: Date.now() });
    const onPeerJoined = () => callPeer().catch((e) => console.error(e));
    const onPeerLeft = () => closePeer();
    const onEnded = () => {
      setPhase("ended");
      setNeedsReview(!isMentor);
      closePeer();
    };
    const onReconnect = () => joined.current && join();

    (async () => {
      // camera + mic (fall back to audio only, then to none)
      for (const constraints of [{ video: true, audio: true }, { video: false, audio: true }]) {
        try {
          localStream.current = await navigator.mediaDevices.getUserMedia(constraints);
          if (!constraints.video) setMediaNote("Camera not available. Joined with audio only.");
          break;
        } catch {
          /* try next */
        }
      }
      if (!localStream.current) setMediaNote("Camera and microphone are blocked. Allow access in your browser to be seen and heard.");
      if (cancelled) return;
      if (localVideo.current && localStream.current) localVideo.current.srcObject = localStream.current;

      socket.on("meeting:state", onState);
      socket.on("meeting:peer-joined", onPeerJoined);
      socket.on("meeting:peer-left", onPeerLeft);
      socket.on("meeting:signal", onSignal);
      socket.on("meeting:ended", onEnded);
      socket.on("connect", onReconnect);

      if (!socket.connected) socket.connect();
      join();
    })();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer.current);
      socket.emit("meeting:leave");
      socket.off("meeting:state", onState);
      socket.off("meeting:peer-joined", onPeerJoined);
      socket.off("meeting:peer-left", onPeerLeft);
      socket.off("meeting:signal", onSignal);
      socket.off("meeting:ended", onEnded);
      socket.off("connect", onReconnect);
      closePeer();
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // the <video> elements only exist in the "in" phase, so attach the camera then
  useEffect(() => {
    if (phase === "in" && localVideo.current && localStream.current) {
      localVideo.current.srcObject = localStream.current;
    }
  }, [phase]);

  // local 1-second repaint between server updates
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // booking details (for the review + header)
  useEffect(() => {
    fetch(`${API_URL}${ENDPOINTS.booking(bookingId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => d.booking && setBooking(d.booking))
      .catch(() => {});
  }, [bookingId, token, phase]);

  const toggle = (kind) => {
    const tracks = kind === "mic" ? localStream.current?.getAudioTracks() : localStream.current?.getVideoTracks();
    if (!tracks?.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    kind === "mic" ? setMicOn(next) : setCamOn(next);
  };

  const leaveRoom = () => navigate(isMentor ? "/mentor/sessions" : "/Home/my-bookings");

  const remaining = clock.running ? clock.remainingMs - (Date.now() - clock.at) : clock.remainingMs;
  const otherHere = isMentor ? clock.fresherPresent : clock.mentorPresent;

  /* ---------- screens ---------- */
  if (phase === "joining") {
    return <Center><Loader2 className="animate-spin" size={30} /><p className="mt-4 text-sm text-slate-300">Joining the meeting…</p></Center>;
  }

  if (phase === "waitingOpen") {
    return (
      <Center>
        <Clock3 size={36} className="text-blue-400" />
        <h2 className="mt-4 text-xl font-bold">The meeting room opens 5 minutes before the session</h2>
        <p className="mt-2 font-mono text-3xl">{fmtClock((opensAt || Date.now()) - Date.now())}</p>
        <p className="mt-2 text-sm text-slate-400">We'll let you in automatically.</p>
        <button onClick={leaveRoom} className="mt-6 rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold">Back</button>
      </Center>
    );
  }

  if (phase === "error") {
    return (
      <Center>
        <h2 className="text-xl font-bold">Can't open this meeting</h2>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <button onClick={leaveRoom} className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Back</button>
      </Center>
    );
  }

  if (phase === "ended") {
    return (
      <Center>
        <h2 className="text-2xl font-bold">Session completed</h2>
        <p className="mt-2 text-sm text-slate-400">{isMentor ? "Your earnings are now available." : "Please share a quick review to finish."}</p>
        {isMentor && <button onClick={leaveRoom} className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Back to sessions</button>}
        {needsReview && booking && <ReviewModal booking={booking} onDone={leaveRoom} />}
        {needsReview && !booking && <Loader2 className="mt-6 animate-spin" />}
      </Center>
    );
  }

  const status = clock.running
    ? "Session in progress"
    : otherHere
    ? "Connecting…"
    : `Waiting for the ${otherRole} to join. The timer is paused.`;

  return (
    <div className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <div>
          <p className="text-sm font-semibold">{booking?.companyName || "MNCConnect session"}</p>
          <p className={`text-xs ${clock.running ? "text-emerald-400" : "text-amber-300"}`}>{status}</p>
        </div>
        <div className={`rounded-xl px-4 py-2 font-mono text-xl font-bold ${clock.running ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
          {fmtClock(remaining)}
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
              maxWidth: "none",
              maxHeight: "none",
              objectFit: "cover",
              objectPosition: "center center",
              backgroundColor: "#000",
            }}
          />
          {!otherHere && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800"><UserRound size={36} /></div>
              <p className="mt-4 text-sm">Waiting for the {otherRole}…</p>
            </div>
          )}
          <video
            ref={(el) => {
              localVideo.current = el;
              if (el && localStream.current && el.srcObject !== localStream.current) el.srcObject = localStream.current;
            }}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              zIndex: 10,
              right: "16px",
              bottom: "16px",
              display: "block",
              width: "clamp(110px, 18vw, 220px)",
              height: "clamp(85px, 22vh, 160px)",
              objectFit: "cover",
              objectPosition: "center center",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.25)",
              backgroundColor: "#0f172a",
            }}
          />
        </div>
        {mediaNote && <p className="absolute left-8 top-4 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">{mediaNote}</p>}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 pb-3">
        <button onClick={() => toggle("mic")} className={`flex h-12 w-12 items-center justify-center rounded-full ${micOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600"}`} aria-label="Toggle microphone">{micOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button onClick={() => toggle("cam")} className={`flex h-12 w-12 items-center justify-center rounded-full ${camOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600"}`} aria-label="Toggle camera">{camOn ? <Camera size={20} /> : <CameraOff size={20} />}</button>
        <button onClick={leaveRoom} className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold hover:bg-red-700"><PhoneOff size={18} /> Leave</button>
      </div>
      <p className="shrink-0 pb-3 text-center text-[11px] text-slate-500">If you leave, the timer pauses. Rejoin from My Bookings and it resumes where it stopped.</p>
    </div>
  );
}

const Center = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">{children}</div>
);