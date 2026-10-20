// utils/meeting.js
// ============================================================
// Real-time meeting rooms (socket.io). The SERVER owns the timer.
//
//   * the room opens 5 minutes before the session starts
//   * the timer starts ONLY when:
//       (a) both fresher AND mentor are inside the room
//       (b) both have accepted the pre-meeting instructions
//   * once started, the timer runs to zero even if someone leaves
//     (fresher "cut" pannalum time poitey than irukanum)
//   * when remaining time hits zero the booking is completed
//   * WebRTC signalling is relayed only between the two participants
//
// Video itself is peer-to-peer WebRTC; this file only relays the
// signalling messages and owns the meeting clock.
// ============================================================

const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const { completeBooking } = require("../controllers/bookingController");

// ============================================================
// CONFIG
// ============================================================

const OPEN_BEFORE_MS = 5 * 60 * 1000; // meeting opens 5 min before start
const STATE_BROADCAST_EVERY_TICKS = 5; // emit state every 5 seconds
const SAVE_EVERY_MS = 10 * 1000; // persist to DB every 10s
const ORPHAN_ROOM_TTL_MS = 30 * 60 * 1000; // drop room after 30 min of silence
const MAX_TICK_DRIFT_MS = 60 * 1000; // cap a single tick if server was frozen

// ============================================================
// ROOM STORE
// ============================================================

/**
 * rooms: Map<requestGroupId, room>
 * room = {
 *   id,                       // requestGroupId (booking id)
 *   totalMs,                  // full duration in ms
 *   remainingMs,              // time left
 *   mentor: Set<socketId>,    // sockets for the mentor role
 *   fresher: Set<socketId>,   // sockets for the fresher role
 *   running,                  // is the clock ticking?
 *   startedOnce,              // has the clock ever started?
 *   startedMarked,            // has meeting.startedAt been written to DB?
 *   lastTick,                 // timestamp of last advance()
 *   lastSave,                 // timestamp of last save()
 *   lastActivity,             // last join/leave/signal (orphan cleanup)
 *   ticks,                    // tick counter for state broadcasts
 *   instructionsAccepted: { mentor: bool, fresher: bool },
 * }
 */
const rooms = new Map();

// ============================================================
// HELPERS
// ============================================================

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
        "meeting.instructionsAccepted": {
          mentor: Boolean(r.instructionsAccepted.mentor),
          fresher: Boolean(r.instructionsAccepted.fresher),
        },
      },
    },
  ).catch(() => {});

const markStarted = (r) => {
  if (r.startedMarked) return;
  r.startedMarked = true;
  Booking.updateOne(
    { requestGroupId: r.id },
    { $set: { "meeting.startedAt": new Date() } },
  ).catch(() => {});
};

// Start the clock only when both conditions are met:
//   1) both participants are in the room
//   2) both have accepted the instructions
const refresh = (io, r) => {
  r.lastActivity = Date.now();

  const bothInside = r.mentor.size > 0 && r.fresher.size > 0;
  const bothAccepted =
    r.instructionsAccepted.mentor && r.instructionsAccepted.fresher;

  // Only start once — never pause. Fresher cut pannalum timer odum.
  if (!r.startedOnce && bothInside && bothAccepted) {
    r.running = true;
    r.startedOnce = true;
    r.lastTick = Date.now();
    markStarted(r);
    save(r);
  }

  io.to(channel(r.id)).emit("meeting:state", stateOf(r));
};

// ============================================================
// LEAVE
// ============================================================

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

  // Both gone → persist and drop the room to free memory
  if (r.mentor.size === 0 && r.fresher.size === 0) {
    save(r);
    rooms.delete(m.id);
  }
};

// ============================================================
// FINISH
// ============================================================

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

// ============================================================
// INIT
// ============================================================

exports.initMeetings = (io) => {
  io.on("connection", (socket) => {
    // ------------------------------------------------------
    // JOIN
    // ------------------------------------------------------
    socket.on("meeting:join", async (payload = {}, ack = () => {}) => {
      try {
        const user = verify(payload.token);
        if (!user) {
          return ack({
            ok: false,
            code: "AUTH",
            message: "Please log in again.",
          });
        }

        const bookingId = String(payload.bookingId || "").trim();
        if (!bookingId) {
          return ack({
            ok: false,
            code: "BAD_REQUEST",
            message: "Booking id is required.",
          });
        }

        const b = await Booking.findOne({ requestGroupId: bookingId }).lean();
        if (!b) {
          return ack({
            ok: false,
            code: "NOT_FOUND",
            message: "Session not found.",
          });
        }

        // Role check — only the real participants can join
        const role =
          String(b.mentor) === user.id && user.role === "mentor"
            ? "mentor"
            : String(b.fresher) === user.id && user.role === "fresher"
              ? "fresher"
              : null;
        if (!role) {
          return ack({
            ok: false,
            code: "FORBIDDEN",
            message: "This session is not yours.",
          });
        }

        if (b.status === "completed") {
          return ack({
            ok: false,
            code: "ENDED",
            message: "This session has ended.",
          });
        }
        if (b.status !== "accepted") {
          return ack({
            ok: false,
            code: "NOT_ACTIVE",
            message: "This session is not active.",
          });
        }

        const opensAt = new Date(b.startsAt).getTime() - OPEN_BEFORE_MS;
        if (Date.now() < opensAt) {
          return ack({
            ok: false,
            code: "NOT_OPEN",
            opensAt,
            message: "The meeting room is not open yet.",
          });
        }

        // Never be in two rooms at once
        leave(io, socket);

        // Load or create the room
        let r = rooms.get(b.requestGroupId);
        if (!r) {
          const total = Number(b.durationMinutes) * 60000;
          const saved = b.meeting || {};
          r = {
            id: b.requestGroupId,
            totalMs: total,
            remainingMs:
              typeof saved.remainingMs === "number"
                ? Math.max(0, saved.remainingMs)
                : total,
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

          // If the session was already running (server restarted mid-meeting)
          // and both participants were previously inside, resume the clock.
          if (
            r.startedOnce &&
            r.instructionsAccepted.mentor &&
            r.instructionsAccepted.fresher
          ) {
            r.running = true;
          }
        }

        r[role].add(socket.id);
        socket.data.meeting = { id: r.id, role };
        socket.join(channel(r.id));

        // Tell the other side a peer joined
        socket.to(channel(r.id)).emit("meeting:peer-joined", { role });

        refresh(io, r);

        // Send the current instruction state so the UI can render the gate
        socket.emit("meeting:instructions-state", r.instructionsAccepted);

        return ack({ ok: true, role, state: stateOf(r) });
      } catch (error) {
        console.error("meeting:join error:", error.message);
        return ack({
          ok: false,
          code: "ERROR",
          message: "Could not join the meeting.",
        });
      }
    });

    // ------------------------------------------------------
    // INSTRUCTIONS ACCEPTED
    // ------------------------------------------------------
    socket.on("meeting:instructions-accepted", ({ bookingId } = {}) => {
      try {
        const m = socket.data.meeting;
        if (!m || m.id !== bookingId) return;

        const r = rooms.get(m.id);
        if (!r) return;

        r.instructionsAccepted[m.role] = true;
        r.lastActivity = Date.now();

        io.to(channel(m.id)).emit(
          "meeting:instructions-state",
          r.instructionsAccepted,
        );

        save(r);
        refresh(io, r);
      } catch (error) {
        console.error("meeting:instructions-accepted error:", error.message);
      }
    });

    // ------------------------------------------------------
    // SIGNAL RELAY (WebRTC offer/answer/ICE)
    // ------------------------------------------------------
    socket.on("meeting:signal", (payload = {}) => {
      const m = socket.data.meeting;
      if (!m) return;
      const r = rooms.get(m.id);
      if (r) r.lastActivity = Date.now();

      socket.to(channel(m.id)).emit("meeting:signal", {
        data: payload.data,
      });
    });

    // ------------------------------------------------------
    // LEAVE / DISCONNECT
    // ------------------------------------------------------
    socket.on("meeting:leave", () => leave(io, socket));
    socket.on("disconnect", () => leave(io, socket));
  });

  // ============================================================
  // 1 SECOND CLOCK
  // ============================================================

  setInterval(() => {
    const now = Date.now();

    for (const r of rooms.values()) {
      // ---- clock tick (only when running) ----
      if (r.running) {
        advance(r);
        r.ticks += 1;

        if (r.remainingMs <= 0) {
          finish(io, r).catch((e) =>
            console.error("finish meeting error:", e.message),
          );
          continue;
        }

        // Periodic save
        if (now - r.lastSave > SAVE_EVERY_MS) {
          r.lastSave = now;
          save(r);
        }

        // Periodic broadcast (state must be fresh for both peers)
        if (r.ticks % STATE_BROADCAST_EVERY_TICKS === 0) {
          io.to(channel(r.id)).emit("meeting:state", stateOf(r));
        }
      }

      // ---- orphan cleanup (memory safety) ----
      // A room with nobody inside for ORPHAN_ROOM_TTL_MS is dropped.
      // Running-but-empty rooms keep running until finish() clears them.
      const empty = r.mentor.size === 0 && r.fresher.size === 0;
      if (!r.running && empty && now - r.lastActivity > ORPHAN_ROOM_TTL_MS) {
        rooms.delete(r.id);
      }
    }
  }, 1000);

  console.log("Meeting rooms ready");
};