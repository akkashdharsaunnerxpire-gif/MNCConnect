// utils/meeting.js
// Real-time meeting rooms (socket.io). The SERVER owns the timer:
//   * the room opens 5 minutes before the session starts
//   * the clock only runs while BOTH the fresher and the employee are inside
//   * if someone leaves, the clock pauses and resumes from the remaining time
//   * when the remaining time hits zero the booking is completed
// Video itself is peer-to-peer WebRTC; this file only relays the signalling.

const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const { completeBooking } = require("../controllers/bookingController");

const OPEN_BEFORE_MS = 5 * 60 * 1000;
const rooms = new Map(); // requestGroupId -> room

const verify = (token) => {
  try {
    const p = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return p && p.id ? { id: String(p.id), role: p.role } : null;
  } catch (_) {
    return null;
  }
};

const channel = (id) => `meeting:${id}`;

const stateOf = (r) => ({
  bookingId: r.id,
  totalMs: r.totalMs,
  remainingMs: Math.max(0, Math.round(r.remainingMs)),
  running: r.running,
  mentorPresent: r.mentor.size > 0,
  fresherPresent: r.fresher.size > 0,
  serverNow: Date.now(),
});

const advance = (r) => {
  if (!r.running) return;
  const now = Date.now();
  r.remainingMs -= now - r.lastTick;
  r.lastTick = now;
};

const save = (r) =>
  Booking.updateOne({ requestGroupId: r.id }, { $set: { "meeting.remainingMs": Math.max(0, Math.round(r.remainingMs)) } }).catch(
    () => {}
  );

const refresh = (io, r) => {
  const both = r.mentor.size > 0 && r.fresher.size > 0;

  if (both && !r.running) {
    r.running = true;
    r.lastTick = Date.now();
    if (!r.startedMarked) {
      r.startedMarked = true;
      Booking.updateOne({ requestGroupId: r.id }, { $set: { "meeting.startedAt": new Date() } }).catch(() => {});
    }
  } else if (!both && r.running) {
    advance(r);
    r.running = false;
    save(r);
  }
  io.to(channel(r.id)).emit("meeting:state", stateOf(r));
};

const finish = async (io, r) => {
  rooms.delete(r.id);
  r.running = false;
  await completeBooking(r.id);
  io.to(channel(r.id)).emit("meeting:ended", { bookingId: r.id });
};

const leave = (io, socket) => {
  const m = socket.data.meeting;
  if (!m) return;
  socket.data.meeting = null;
  socket.leave(channel(m.id));

  const r = rooms.get(m.id);
  if (!r) return;

  r[m.role].delete(socket.id);
  if (r[m.role].size === 0) socket.to(channel(m.id)).emit("meeting:peer-left", { role: m.role });

  refresh(io, r);

  if (r.mentor.size === 0 && r.fresher.size === 0) {
    save(r);
    rooms.delete(m.id);
  }
};

exports.initMeetings = (io) => {
  io.on("connection", (socket) => {
    socket.on("meeting:join", async (payload = {}, ack = () => {}) => {
      try {
        const user = verify(payload.token);
        if (!user) return ack({ ok: false, code: "AUTH", message: "Please log in again." });

        const b = await Booking.findOne({ requestGroupId: String(payload.bookingId || "") }).lean();
        if (!b) return ack({ ok: false, code: "NOT_FOUND", message: "Session not found." });

        const role =
          String(b.mentor) === user.id && user.role === "mentor"
            ? "mentor"
            : String(b.fresher) === user.id && user.role === "fresher"
            ? "fresher"
            : null;
        if (!role) return ack({ ok: false, code: "FORBIDDEN", message: "This session is not yours." });

        if (b.status === "completed") return ack({ ok: false, code: "ENDED", message: "This session has ended." });
        if (b.status !== "accepted") return ack({ ok: false, code: "NOT_ACTIVE", message: "This session is not active." });

        const opensAt = new Date(b.startsAt).getTime() - OPEN_BEFORE_MS;
        if (Date.now() < opensAt) return ack({ ok: false, code: "NOT_OPEN", opensAt, message: "The meeting room is not open yet." });

        leave(io, socket); // never be in two rooms

        let r = rooms.get(b.requestGroupId);
        if (!r) {
          const total = b.durationMinutes * 60000;
          r = {
            id: b.requestGroupId,
            totalMs: total,
            remainingMs: b.meeting?.remainingMs ?? total,
            mentor: new Set(),
            fresher: new Set(),
            running: false,
            lastTick: 0,
            lastSave: Date.now(),
            ticks: 0,
            startedMarked: Boolean(b.meeting?.startedAt),
          };
          rooms.set(r.id, r);
        }

        r[role].add(socket.id);
        socket.data.meeting = { id: r.id, role };
        socket.join(channel(r.id));
        socket.to(channel(r.id)).emit("meeting:peer-joined", { role });

        refresh(io, r);
        return ack({ ok: true, role, state: stateOf(r) });
      } catch (error) {
        console.error("meeting:join error:", error.message);
        return ack({ ok: false, code: "ERROR", message: "Could not join the meeting." });
      }
    });

    // WebRTC signalling relay (offer / answer / ICE candidates)
    socket.on("meeting:signal", (payload = {}) => {
      const m = socket.data.meeting;
      if (m) socket.to(channel(m.id)).emit("meeting:signal", { data: payload.data });
    });

    socket.on("meeting:leave", () => leave(io, socket));
    socket.on("disconnect", () => leave(io, socket));
  });

  // 1 second clock
  setInterval(() => {
    for (const r of rooms.values()) {
      if (!r.running) continue;
      advance(r);
      r.ticks += 1;

      if (r.remainingMs <= 0) {
        finish(io, r).catch((e) => console.error("finish meeting error:", e.message));
        continue;
      }
      if (Date.now() - r.lastSave > 10000) {
        r.lastSave = Date.now();
        save(r);
      }
      if (r.ticks % 5 === 0) io.to(channel(r.id)).emit("meeting:state", stateOf(r));
    }
  }, 1000);

  console.log("Meeting rooms ready");
};