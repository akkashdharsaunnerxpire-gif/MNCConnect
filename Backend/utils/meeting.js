// utils/meeting.js  (single + GROUP meetings)
//
// Timing rules
//  - room opens 5 min before startsAt (instructions screen is shown)
//  - the frontend lets people in during the last 20 sec before startsAt
//  - the TIMER starts only at startsAt (never earlier, even if everybody accepted)
//    and only when: mentor inside + accepted, HOST inside + accepted
//  - late start: if everyone is ready after startsAt, the timer ends at the scheduled end
//
// Group rules
//  - room = 1 mentor + 1..N freshers (host + friends who paid)
//  - only the HOST answers "success / not success" at the end
//  - WebRTC signalling is addressed: payload.to = target socket id (mesh).
//    Without `to` it still broadcasts, so the old 1:1 client keeps working.
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const { completeBooking } = require("../controllers/bookingController");
const { emitToUser } = require("./realtime");

const OPEN_BEFORE_MS = 5 * 60 * 1000; // room + instructions open
const SUCCESS_WINDOW_MS = 3 * 60 * 1000;
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

const identify = (socket, payload = {}) => {
  const u = socket.data?.user || socket.user;
  if (u && (u.id || u._id) && u.role) {
    return { id: String(u.id || u._id), role: u.role };
  }
  return verify(payload.token);
};

// host OR a friend who paid and joined the group
const isMemberFresher = (b, userId) =>
  String(b.fresher) === userId ||
  (b.participants || []).some((p) => String(p.fresher) === userId);

const remainingOf = (r) =>
  r.running && r.endsAtMs ? Math.max(0, r.endsAtMs - Date.now()) : r.remainingMs;

const hostInside = (r) => Array.from(r.fresher.values()).includes(r.fresherId);

const stateOf = (r) => ({
  bookingId: r.id,
  totalMs: r.totalMs,
  remainingMs: Math.round(remainingOf(r)),
  running: r.running,
  mentorPresent: r.mentor.size > 0,
  fresherPresent: r.fresher.size > 0,
  fresherCount: new Set(r.fresher.values()).size, // distinct freshers inside
  hostPresent: hostInside(r),
  mode: r.mode,
  maxMembers: r.maxMembers,
  hostId: r.fresherId,
  instructions: { ...r.instructionsAccepted }, // fresher = HOST accepted
  startedOnce: Boolean(r.startedOnce),
  successRequested: Boolean(r.successRequested),
  fresherConfirmed: Boolean(r.fresherConfirmed),
  fresherDeclined: Boolean(r.fresherDeclined),
  startsAtMs: r.startsAtMs,
  serverNow: Date.now(),
});

// what ONE person must see on the instructions gate (a friend's own acceptance, not the host's)
const instructionsFor = (r, role, userId) => ({
  mentor: Boolean(r.instructionsAccepted.mentor),
  fresher:
    role === "fresher"
      ? r.acceptedUsers.has(userId)
      : Boolean(r.instructionsAccepted.fresher),
});

const sendInstructions = (io, r) => {
  r.mentor.forEach((userId, sid) =>
    io.to(sid).emit("meeting:instructions-state", instructionsFor(r, "mentor", userId)),
  );
  r.fresher.forEach((userId, sid) =>
    io.to(sid).emit("meeting:instructions-state", instructionsFor(r, "fresher", userId)),
  );
};

const pushToUsers = (r) => {
  const payload = {
    requestGroupId: r.id,
    running: r.running,
    remainingMs: Math.round(remainingOf(r)),
  };
  r.fresherIds.forEach((id) => emitToUser(id, "meeting:timer", payload));
  if (r.mentorId) emitToUser(r.mentorId, "meeting:timer", payload);
};

const makeRoom = (b) => {
  const saved = b.meeting || {};
  const total = Number(b.durationMinutes) * 60000;
  const resumed = b.status === "in_progress" && saved.timerEndsAt;

  const fresherIds = new Set(
    [b.fresher, ...(b.participants || []).map((p) => p.fresher)]
      .filter(Boolean)
      .map(String),
  );

  return {
    id: b.requestGroupId,
    fresherId: b.fresher ? String(b.fresher) : "", // HOST
    fresherIds, // host + friends
    mode: b.sessionMode || "single",
    maxMembers: b.maxMembers || 1,
    mentorId: b.mentor ? String(b.mentor) : "",
    totalMs: total,
    startsAtMs: new Date(b.startsAt).getTime(),
    scheduledEndMs: new Date(b.endsAt).getTime(),
    endsAtMs: resumed ? new Date(saved.timerEndsAt).getTime() : null,
    remainingMs: typeof saved.remainingMs === "number" ? Math.max(0, saved.remainingMs) : total,
    running: Boolean(resumed),
    startedOnce: Boolean(saved.startedAt || resumed),
    finishing: false,
    successRequested: Boolean(saved.successRequested),
    fresherConfirmed: Boolean(saved.fresherConfirmed),
    fresherDeclined: false,
    mentor: new Map(), // socketId -> userId
    fresher: new Map(), // socketId -> userId
    acceptedUsers: new Set(saved.instructionsAccepted?.fresher && b.fresher ? [String(b.fresher)] : []), // host stays accepted after a server restart
    lastSave: Date.now(),
    lastActivity: Date.now(),
    ticks: 0,
    instructionsAccepted: {
      mentor: Boolean(saved.instructionsAccepted?.mentor),
      fresher: Boolean(saved.instructionsAccepted?.fresher), // = host accepted
    },
  };
};

const save = (r) =>
  Booking.updateOne(
    { requestGroupId: r.id },
    {
      $set: {
        "meeting.remainingMs": Math.round(remainingOf(r)),
        "meeting.successRequested": Boolean(r.successRequested),
        "meeting.fresherConfirmed": Boolean(r.fresherConfirmed),
        "meeting.instructionsAccepted": {
          mentor: Boolean(r.instructionsAccepted.mentor),
          fresher: Boolean(r.instructionsAccepted.fresher),
        },
      },
    }
  ).catch(() => {});

// everything needed to start the timer. NOTE: the time check is the important part:
// accepting the instructions early must NOT start the timer.
const canStart = (r) =>
  !r.startedOnce &&
  !r.running &&
  Date.now() >= r.startsAtMs &&
  r.mentor.size > 0 &&
  hostInside(r) &&
  r.instructionsAccepted.mentor &&
  r.instructionsAccepted.fresher;

const startTimer = (r) => {
  const now = Date.now();
  r.startedOnce = true;
  r.running = true;
  // we are always at/after startsAt here -> the session ends at its scheduled end
  r.endsAtMs = Math.min(r.scheduledEndMs, now + r.totalMs);
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
  if (canStart(r)) startTimer(r);
  io.to(channel(r.id)).emit("meeting:state", stateOf(r));
};

const finish = async (io, r) => {
  if (r.finishing) return;
  r.finishing = true;
  rooms.delete(r.id);
  r.running = false;
  r.remainingMs = 0;
  const confirmed = Boolean(r.fresherConfirmed);
  try {
    await save(r);
    await completeBooking(r.id);
  } catch (e) {
    console.error("completeBooking failed:", e.message);
  }
  io.to(channel(r.id)).emit("meeting:ended", { bookingId: r.id, confirmed });
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

  // group: tell everybody WHICH peer left (socketId) so they can close that connection
  socket.to(channel(m.id)).emit("meeting:peer-left", {
    role: m.role,
    socketId: socket.id,
    userId: m.userId,
    roleEmpty: r[m.role].size === 0,
  });

  refresh(io, r);

  if (r.mentor.size === 0 && r.fresher.size === 0 && !r.running) {
    save(r);
    rooms.delete(m.id);
  }
};

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

exports.initMeetings = (io) => {
  recoverRooms();

  io.on("connection", (socket) => {
    socket.on("meeting:join", async (payload = {}, ack = () => {}) => {
      try {
        const user = identify(socket, payload);
        if (!user) return ack({ ok: false, code: "AUTH", message: "Log in again." });

        const bookingId = String(payload.bookingId || "").trim();
        const b = await Booking.findOne({ requestGroupId: bookingId }).lean();
        if (!b) return ack({ ok: false, code: "NOT_FOUND" });

        const role =
          String(b.mentor) === user.id && user.role === "mentor" ? "mentor" :
          isMemberFresher(b, user.id) && user.role === "fresher" ? "fresher" : null;
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
        if (role === "fresher") r.fresherIds.add(user.id); // friend joined after the room was built

        // everybody who is already inside (new joiner starts a connection to each of them)
        const peers = [];
        r.mentor.forEach((uid, sid) => peers.push({ socketId: sid, role: "mentor", userId: uid }));
        r.fresher.forEach((uid, sid) => peers.push({ socketId: sid, role: "fresher", userId: uid }));

        r[role].set(socket.id, user.id);
        socket.data.meeting = { id: r.id, role, userId: user.id };
        socket.join(channel(r.id));

        socket.to(channel(r.id)).emit("meeting:peer-joined", {
          role,
          socketId: socket.id,
          userId: user.id,
        });
        refresh(io, r);
        socket.emit("meeting:instructions-state", instructionsFor(r, role, user.id));

        return ack({
          ok: true,
          role,
          isHost: role === "fresher" && user.id === r.fresherId,
          instructions: instructionsFor(r, role, user.id),
          peers,
          state: stateOf(r),
        });
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

      if (m.role === "mentor") {
        r.instructionsAccepted.mentor = true;
      } else {
        r.acceptedUsers.add(m.userId);
        if (m.userId === r.fresherId) r.instructionsAccepted.fresher = true; // host decides the start
      }

      sendInstructions(io, r);
      save(r);
      refresh(io, r); // starts the timer only if startsAt already passed
    });

    // MENTOR: "Meeting Success"
    socket.on("meeting:success-request", ({ bookingId } = {}) => {
      const m = socket.data.meeting;
      if (!m || m.id !== bookingId || m.role !== "mentor") return;
      const r = rooms.get(m.id);
      if (!r || !r.running || r.fresherConfirmed) return;
      if (remainingOf(r) > SUCCESS_WINDOW_MS) return;
      r.successRequested = true;
      r.fresherDeclined = false;
      save(r);
      refresh(io, r);
    });

    // HOST only: Yes / No
    socket.on("meeting:success-confirm", ({ bookingId, accepted } = {}) => {
      const m = socket.data.meeting;
      if (!m || m.id !== bookingId || m.role !== "fresher") return;
      const r = rooms.get(m.id);
      if (!r || !r.successRequested) return;
      if (m.userId !== r.fresherId) return; // friends cannot confirm
      if (accepted) {
        r.fresherConfirmed = true;
        r.fresherDeclined = false;
      } else {
        r.successRequested = false;
        r.fresherDeclined = true;
      }
      save(r);
      refresh(io, r);
    });

    // WebRTC signalling.  payload = { data, to? }
    //  to  -> only that socket (mesh, group)
    //  no to -> everybody else in the room (old 1:1 behaviour)
    socket.on("meeting:signal", (payload = {}) => {
      const m = socket.data.meeting;
      if (!m) return;
      const out = { data: payload.data, from: socket.id, role: m.role, userId: m.userId };

      if (payload.to) {
        const target = io.sockets.sockets.get(String(payload.to));
        if (target && target.data.meeting?.id === m.id) target.emit("meeting:signal", out);
        return;
      }
      socket.to(channel(m.id)).emit("meeting:signal", out);
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

      // NOT running yet: everybody accepted early -> start exactly when startsAt arrives
      if (canStart(r)) {
        startTimer(r);
        io.to(channel(r.id)).emit("meeting:state", stateOf(r));
        continue;
      }

      const empty = r.mentor.size === 0 && r.fresher.size === 0;
      if (empty && now - r.lastActivity > ORPHAN_ROOM_TTL_MS) rooms.delete(r.id);
    }
  }, 1000);
};