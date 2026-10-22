// utils/meeting.js
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const { completeBooking } = require("../controllers/bookingController");
const { emitToUser } = require("./realtime");

const OPEN_BEFORE_MS = 5 * 60 * 1000;
const BROADCAST_EVERY_TICKS = 5;
const SAVE_EVERY_MS = 10 * 1000;
const ORPHAN_ROOM_TTL_MS = 30 * 60 * 1000;

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

/* ---------- room helpers ---------- */

// running -> always computed from the absolute end time (never drifts, never resets)
const remainingOf = (r) =>
  r.running && r.endsAtMs ? Math.max(0, r.endsAtMs - Date.now()) : r.remainingMs;

const stateOf = (r) => ({
  bookingId: r.id,
  totalMs: r.totalMs,
  remainingMs: Math.round(remainingOf(r)),
  running: r.running,
  mentorPresent: r.mentor.size > 0,
  fresherPresent: r.fresher.size > 0,
  instructions: { ...r.instructionsAccepted },
  startedOnce: Boolean(r.startedOnce),
  serverNow: Date.now(),
});

// push timer to both users' personal rooms -> My Bookings / Sessions cards update live
const pushToUsers = (r) => {
  const payload = {
    requestGroupId: r.id,
    running: r.running,
    remainingMs: Math.round(remainingOf(r)),
  };
  if (r.fresherId) emitToUser(r.fresherId, "meeting:timer", payload);
  if (r.mentorId) emitToUser(r.mentorId, "meeting:timer", payload);
};

const makeRoom = (b) => {
  const saved = b.meeting || {};
  const total = Number(b.durationMinutes) * 60000;
  const resumed = b.status === "in_progress" && saved.timerEndsAt;

  return {
    id: b.requestGroupId,
    fresherId: b.fresher ? String(b.fresher) : "",
    mentorId: b.mentor ? String(b.mentor) : "",
    totalMs: total,
    startsAtMs: new Date(b.startsAt).getTime(),
    scheduledEndMs: new Date(b.endsAt).getTime(),
    endsAtMs: resumed ? new Date(saved.timerEndsAt).getTime() : null,
    remainingMs: typeof saved.remainingMs === "number" ? Math.max(0, saved.remainingMs) : total,
    running: Boolean(resumed), // already started once -> keeps running
    startedOnce: Boolean(saved.startedAt || resumed),
    finishing: false,
    mentor: new Set(),
    fresher: new Set(),
    lastSave: Date.now(),
    lastActivity: Date.now(),
    ticks: 0,
    instructionsAccepted: {
      mentor: Boolean(saved.instructionsAccepted?.mentor),
      fresher: Boolean(saved.instructionsAccepted?.fresher),
    },
  };
};

const save = (r) =>
  Booking.updateOne(
    { requestGroupId: r.id },
    {
      $set: {
        "meeting.remainingMs": Math.round(remainingOf(r)),
        "meeting.instructionsAccepted": {
          mentor: Boolean(r.instructionsAccepted.mentor),
          fresher: Boolean(r.instructionsAccepted.fresher),
        },
      },
    }
  ).catch(() => {});

// Starts ONCE. After this the timer only stops at zero (or mentor force-end)
const startTimer = (r) => {
  const now = Date.now();
  r.startedOnce = true;
  r.running = true;
  // joined before session time -> full duration, joined late -> till scheduled end
  r.endsAtMs = now < r.startsAtMs ? now + r.totalMs : r.scheduledEndMs;
  r.remainingMs = Math.max(0, r.endsAtMs - now);
  r.lastSave = now;

  Booking.updateOne(
    { requestGroupId: r.id, status: "accepted" },
    {
      $set: {
        status: "in_progress",
        "meeting.startedAt": new Date(now),
        "meeting.timerEndsAt": new Date(r.endsAtMs),
        "meeting.remainingMs": r.remainingMs,
      },
    }
  ).catch((e) => console.error("startTimer save:", e.message));

  pushToUsers(r);
};

const refresh = (io, r) => {
  r.lastActivity = Date.now();
  const bothInside = r.mentor.size > 0 && r.fresher.size > 0;
  const bothAccepted = r.instructionsAccepted.mentor && r.instructionsAccepted.fresher;

  // first time both inside (and instructions accepted) -> start. Never again.
  if (!r.startedOnce && bothInside && bothAccepted) startTimer(r);

  io.to(channel(r.id)).emit("meeting:state", stateOf(r));
};

const finish = async (io, r) => {
  if (r.finishing) return;
  r.finishing = true;
  rooms.delete(r.id);
  r.running = false;
  r.remainingMs = 0;
  try {
    await completeBooking(r.id); // -> awaiting_confirmation + notifies both users
  } catch (e) {
    console.error("completeBooking failed:", e.message);
  }
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
  r.lastActivity = Date.now();

  if (r[m.role].size === 0) {
    socket.to(channel(m.id)).emit("meeting:peer-left", { role: m.role });
  }

  refresh(io, r);

  // a running timer keeps its room even when nobody is inside
  if (r.mentor.size === 0 && r.fresher.size === 0 && !r.running) {
    save(r);
    rooms.delete(m.id);
  }
};

// server restart: bring back rooms whose timer was running
const recoverRooms = async () => {
  try {
    const list = await Booking.find({ status: "in_progress" }).lean();
    for (const b of list) {
      if (!rooms.has(b.requestGroupId)) rooms.set(b.requestGroupId, makeRoom(b));
    }
  } catch (e) {
    console.error("recoverRooms:", e.message);
  }
};

/* ---------- socket handlers ---------- */

exports.initMeetings = (io) => {
  recoverRooms();

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
          r = makeRoom(b);
          rooms.set(r.id, r);
        }

        r[role].add(socket.id);
        socket.data.meeting = { id: r.id, role };
        socket.join(channel(r.id));

        socket.to(channel(r.id)).emit("meeting:peer-joined", { role });
        refresh(io, r);
        socket.emit("meeting:instructions-state", r.instructionsAccepted);

        return ack({ ok: true, role, state: stateOf(r) });
      } catch (error) {
        console.error("meeting:join error:", error.message);
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

    // mentor "Meeting Success" button
    socket.on("meeting:force-end", ({ bookingId } = {}) => {
      const m = socket.data.meeting;
      if (!m || m.id !== bookingId || m.role !== "mentor") return;
      const r = rooms.get(m.id);
      if (!r) return;
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
        r.ticks += 1;

        if (now >= r.endsAtMs) {
          finish(io, r).catch(console.error);
          continue;
        }

        if (now - r.lastSave > SAVE_EVERY_MS) {
          r.lastSave = now;
          save(r);
        }

        if (r.ticks % BROADCAST_EVERY_TICKS === 0) {
          io.to(channel(r.id)).emit("meeting:state", stateOf(r));
          pushToUsers(r);
        }
        continue;
      }

      const empty = r.mentor.size === 0 && r.fresher.size === 0;
      if (empty && now - r.lastActivity > ORPHAN_ROOM_TTL_MS) rooms.delete(r.id);
    }
  }, 1000);
};