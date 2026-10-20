// utils/meeting.js
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const { completeBooking } = require("../controllers/bookingController");

const OPEN_BEFORE_MS = 5 * 60 * 1000;
const STATE_BROADCAST_EVERY_TICKS = 5;
const SAVE_EVERY_MS = 10 * 1000;
const ORPHAN_ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_TICK_DRIFT_MS = 60 * 1000;

const rooms = new Map();
const channel = (id) => `meeting:${id}`;

const verify = (token) => {
  try {
    const p = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return p && p.id ? { id: String(p.id), role: p.role } : null;
  } catch (_) {
    return null;
  }
};

const stateOf = (r) => ({
  bookingId: r.id,
  totalMs: r.totalMs,
  remainingMs: Math.max(0, Math.round(r.remainingMs)),
  running: r.running,
  mentorPresent: r.mentor.size > 0,
  fresherPresent: r.fresher.size > 0,
  instructions: { ...r.instructionsAccepted },
  startedOnce: Boolean(r.startedOnce),
  serverNow: Date.now(),
});

const advance = (r) => {
  if (!r.running) return;
  const now = Date.now();
  const delta = Math.min(now - r.lastTick, MAX_TICK_DRIFT_MS);
  if (delta > 0) r.remainingMs -= delta;
  r.lastTick = now;
};

const save = (r) =>
  Booking.updateOne(
    { requestGroupId: r.id },
    {
      $set: {
        "meeting.remainingMs": Math.max(0, Math.round(r.remainingMs)),
        "meeting.instructionsAccepted": { mentor: Boolean(r.instructionsAccepted.mentor), fresher: Boolean(r.instructionsAccepted.fresher) },
      },
    },
  ).catch(() => {});

const markStarted = (r) => {
  if (r.startedMarked) return;
  r.startedMarked = true;
  Booking.updateOne(
    { requestGroupId: r.id },
    { $set: { "meeting.startedAt": new Date(), status: "in_progress" } },
  ).catch(() => {});
};

const refresh = (io, r) => {
  r.lastActivity = Date.now();
  const bothInside = r.mentor.size > 0 && r.fresher.size > 0;
  const bothAccepted = r.instructionsAccepted.mentor && r.instructionsAccepted.fresher;

  if (!r.startedOnce && bothInside && bothAccepted) {
    r.running = true;
    r.startedOnce = true;
    r.lastTick = Date.now();
    markStarted(r);
    save(r);
  }

  io.to(channel(r.id)).emit("meeting:state", stateOf(r));
};

const leave = (io, socket) => {
  const m = socket.data.meeting;
  if (!m) return;
  socket.data.meeting = null;
  socket.leave(channel(m.id));

  const r = rooms.get(m.id);
  if (!r) return;

  r[m.role].delete(socket.id);
  r.lastActivity = Date.now();

  if (r[m.role].size === 0) {
    socket.to(channel(m.id)).emit("meeting:peer-left", { role: m.role });
  }

  refresh(io, r);

  if (r.mentor.size === 0 && r.fresher.size === 0) {
    save(r);
    rooms.delete(m.id);
  }
};

const finish = async (io, r) => {
  rooms.delete(r.id);
  r.running = false;
  try {
    await completeBooking(r.id);
  } catch (e) {
    console.error("completeBooking failed:", e.message);
  }
  io.to(channel(r.id)).emit("meeting:ended", { bookingId: r.id });
};

exports.initMeetings = (io) => {
  io.on("connection", (socket) => {
    socket.on("meeting:join", async (payload = {}, ack = () => {}) => {
      try {
        const user = verify(payload.token);
        if (!user) return ack({ ok: false, code: "AUTH", message: "Log in again." });

        const bookingId = String(payload.bookingId || "").trim();
        const b = await Booking.findOne({ requestGroupId: bookingId }).lean();
        if (!b) return ack({ ok: false, code: "NOT_FOUND" });

        const role =
          String(b.mentor) === user.id && user.role === "mentor" ? "mentor" :
          String(b.fresher) === user.id && user.role === "fresher" ? "fresher" : null;
        if (!role) return ack({ ok: false, code: "FORBIDDEN" });

        if (["completed", "awaiting_confirmation", "disputed"].includes(b.status)) {
          return ack({ ok: false, code: "ENDED", message: "This session has ended." });
        }
        
        if (!["accepted", "in_progress"].includes(b.status)) {
          return ack({ ok: false, code: "NOT_ACTIVE" });
        }

        const opensAt = new Date(b.startsAt).getTime() - OPEN_BEFORE_MS;
        if (Date.now() < opensAt) return ack({ ok: false, code: "NOT_OPEN", opensAt });

        leave(io, socket);

        let r = rooms.get(b.requestGroupId);
        if (!r) {
          const total = Number(b.durationMinutes) * 60000;
          const saved = b.meeting || {};
          r = {
            id: b.requestGroupId,
            totalMs: total,
            remainingMs: typeof saved.remainingMs === "number" ? Math.max(0, saved.remainingMs) : total,
            mentor: new Set(),
            fresher: new Set(),
            running: false,
            startedOnce: Boolean(saved.startedAt),
            startedMarked: Boolean(saved.startedAt),
            lastTick: Date.now(),
            lastSave: Date.now(),
            lastActivity: Date.now(),
            ticks: 0,
            instructionsAccepted: {
              mentor: Boolean(saved.instructionsAccepted?.mentor),
              fresher: Boolean(saved.instructionsAccepted?.fresher),
            },
          };
          rooms.set(r.id, r);

          if (r.startedOnce && r.instructionsAccepted.mentor && r.instructionsAccepted.fresher) {
            r.running = true;
          }
        }

        r[role].add(socket.id);
        socket.data.meeting = { id: r.id, role };
        socket.join(channel(r.id));

        socket.to(channel(r.id)).emit("meeting:peer-joined", { role });
        refresh(io, r);
        socket.emit("meeting:instructions-state", r.instructionsAccepted);

        return ack({ ok: true, role, state: stateOf(r) });
      } catch (error) {
        return ack({ ok: false, code: "ERROR" });
      }
    });

    socket.on("meeting:instructions-accepted", ({ bookingId } = {}) => {
      const m = socket.data.meeting;
      if (!m || m.id !== bookingId) return;
      const r = rooms.get(m.id);
      if (!r) return;

      r.instructionsAccepted[m.role] = true;
      io.to(channel(m.id)).emit("meeting:instructions-state", r.instructionsAccepted);
      save(r);
      refresh(io, r);
    });

    // ✅ MENTOR MANUALLY ENDS MEETING SUCCESSFULLY
    socket.on("meeting:force-end", ({ bookingId } = {}) => {
      const m = socket.data.meeting;
      if (!m || m.id !== bookingId || m.role !== "mentor") return;
      
      const r = rooms.get(m.id);
      if (!r) return;

      // Stop timer immediately and trigger complete
      r.remainingMs = 0;
      r.running = false;
      r.lastTick = Date.now();
      
      finish(io, r).catch(console.error);
    });

    socket.on("meeting:signal", (payload = {}) => {
      const m = socket.data.meeting;
      if (m) socket.to(channel(m.id)).emit("meeting:signal", { data: payload.data });
    });

    socket.on("meeting:leave", () => leave(io, socket));
    socket.on("disconnect", () => leave(io, socket));
  });

  setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      if (r.running) {
        advance(r);
        r.ticks += 1;

        if (r.remainingMs <= 0) {
          finish(io, r).catch(console.error);
          continue;
        }

        if (now - r.lastSave > SAVE_EVERY_MS) {
          r.lastSave = now;
          save(r);
        }

        if (r.ticks % STATE_BROADCAST_EVERY_TICKS === 0) {
          io.to(channel(r.id)).emit("meeting:state", stateOf(r));
        }
      }

      const empty = r.mentor.size === 0 && r.fresher.size === 0;
      if (!r.running && empty && now - r.lastActivity > ORPHAN_ROOM_TTL_MS) {
        rooms.delete(r.id);
      }
    }
  }, 1000);
};