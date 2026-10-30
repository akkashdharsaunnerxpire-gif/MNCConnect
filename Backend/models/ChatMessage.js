// models/ChatMessage.js
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Booking = require("./Booking");

const chatSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true },
    senderRole: { type: String, enum: ["mentor", "fresher"], required: true },
    senderId: { type: String, required: true },
    // who should receive this message (used for delivered ticks)
    recipientRole: { type: String, enum: ["mentor", "fresher"], default: null },
    recipientId: { type: String, default: null },
    text: { type: String, required: true, maxlength: 1000, trim: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

chatSchema.index({ bookingId: 1, createdAt: -1 });
chatSchema.index({ recipientRole: 1, recipientId: 1, deliveredAt: 1 });
// unread badge query: recipient + readAt
chatSchema.index({ recipientRole: 1, recipientId: 1, readAt: 1 });

const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatSchema);

// ---------------- LAST SEEN (saved in its own small collection) ----------------

const presenceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // "role:id"
  lastSeenAt: { type: Date, default: null },
});

const UserPresence =
  mongoose.models.UserPresence || mongoose.model("UserPresence", presenceSchema);

const saveLastSeen = (role, id, at) =>
  UserPresence.updateOne(
    { key: `${role}:${String(id)}` },
    { $set: { lastSeenAt: at } },
    { upsert: true },
  ).catch((err) => console.error("saveLastSeen failed:", err.message));

const getLastSeen = async (role, id) => {
  if (!role || !id) return null;
  try {
    const doc = await UserPresence.findOne({ key: `${role}:${String(id)}` })
      .select("lastSeenAt")
      .lean();
    return doc?.lastSeenAt || null;
  } catch {
    return null;
  }
};

// ---------------- ROOM HELPERS ----------------

const chatRoom = (bookingKey) => `chat:${bookingKey}`;
const userRoom = (role, id) => `user:${role}:${id}`;
const peerRoleOf = (role) => (role === "mentor" ? "fresher" : "mentor");

// ---------------- PRESENCE (in-memory counter) ----------------
// "role:id" -> number of connected sockets. Single server instance only.

const OFFLINE_GRACE_MS = 2000;
const onlineCount = new Map();

const keyOf = (role, id) => `${role}:${String(id)}`;

const isUserOnline = (role, id) => {
  if (!role || !id) return false;
  return (onlineCount.get(keyOf(role, id)) || 0) > 0;
};

const getOnlineMap = (mentorId, fresherId) => ({
  mentor: isUserOnline("mentor", mentorId),
  fresher: isUserOnline("fresher", fresherId),
});

// Returns true if the user just came online (first socket).
function trackOnline(socket, role, id) {
  if (socket.data.onlineKey) return false;
  const k = keyOf(role, id);
  socket.data.onlineKey = { role, userId: String(id) };
  const n = (onlineCount.get(k) || 0) + 1;
  onlineCount.set(k, n);
  return n === 1;
}

function untrackOnline(socket) {
  const info = socket.data.onlineKey;
  if (!info) return null;
  socket.data.onlineKey = null;

  const k = keyOf(info.role, info.userId);
  const n = (onlineCount.get(k) || 1) - 1;
  if (n <= 0) onlineCount.delete(k);
  else onlineCount.set(k, n);

  return info;
}

async function broadcastPresence(io, role, userId, lastSeenAt = null) {
  try {
    const bookings = await Booking.find({ [role]: userId })
      .select("_id requestGroupId mentor fresher")
      .limit(200)
      .lean();

    for (const b of bookings) {
      const room = chatRoom(String(b._id));
      if (!io.sockets.adapter.rooms.has(room)) continue;

      io.to(room).emit("chat:presence", {
        bookingId: String(b._id),
        requestGroupId: String(b.requestGroupId || ""),
        online: getOnlineMap(String(b.mentor || ""), String(b.fresher || "")),
        // only the user whose state changed (used for "last seen")
        ...(lastSeenAt ? { lastSeen: { [role]: lastSeenAt } } : {}),
      });
    }
  } catch (err) {
    console.error("broadcastPresence failed:", err.message);
  }
}

// ---------------- AUTH ----------------

// Old way: JWT string. Kept as a fallback for clients that still send a token.
function verifyAndDecode(token) {
  if (!token) throw new Error("Authentication token is missing");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const role = decoded.role;
  const userId = String(decoded.id || decoded._id || decoded.userId || "");

  if (!["mentor", "fresher"].includes(role) || !userId) {
    throw new Error("Invalid authentication token");
  }
  return { role, userId };
}

// ---------------- BOOKING ACCESS ----------------

/**
 * identity = { role, userId }  (cookie login: req.user / socket.data.user)
 *          | "<jwt string>"    (old Bearer token fallback)
 */
async function getChatUser(identity, bookingId) {
  if (!bookingId || !identity) return null;

  const { role, userId } =
    typeof identity === "string" ? verifyAndDecode(identity) : identity;

  if (!["mentor", "fresher"].includes(role) || !userId) return null;

  const query = mongoose.isValidObjectId(bookingId)
    ? { $or: [{ _id: bookingId }, { requestGroupId: bookingId }] }
    : { requestGroupId: bookingId };

  const booking = await Booking.findOne(query)
    .select("_id requestGroupId mentor fresher")
    .lean();

  if (!booking) return null;

  const mentorId = String(booking.mentor || "");
  const fresherId = String(booking.fresher || "");
  const uid = String(userId);

  const allowed =
    (role === "mentor" && mentorId === uid) ||
    (role === "fresher" && fresherId === uid);

  if (!allowed) return null;

  return {
    role,
    userId: uid,
    bookingKey: String(booking._id),
    requestGroupId: String(booking.requestGroupId || ""),
    peerRole: peerRoleOf(role),
    peerId: role === "mentor" ? fresherId : mentorId,
  };
}

// message shape sent to clients. Includes BOTH ids so either side can match it.
function toClient(msg, user) {
  return {
    ...(msg.toObject ? msg.toObject() : msg),
    bookingId: user.bookingKey,
    requestGroupId: user.requestGroupId,
  };
}

// ---------------- DELIVERED ON CONNECT ----------------

async function markDeliveredForUser(io, role, userId) {
  const pending = await ChatMessage.find({
    recipientRole: role,
    recipientId: String(userId),
    deliveredAt: null,
  })
    .select("_id senderRole senderId")
    .lean();

  if (!pending.length) return;

  const now = new Date();

  await ChatMessage.updateMany(
    { _id: { $in: pending.map((m) => m._id) }, deliveredAt: null },
    { $set: { deliveredAt: now } },
  );

  const bySender = new Map();
  pending.forEach((m) => {
    const room = userRoom(m.senderRole, m.senderId);
    if (!bySender.has(room)) bySender.set(room, []);
    bySender.get(room).push(String(m._id));
  });

  for (const [room, ids] of bySender) {
    io.to(room).emit("chat:receipt", {
      messageIds: ids,
      status: "delivered",
      deliveredAt: now,
    });
  }
}

// ---------------- CHAT HISTORY (paginated) ----------------
// GET /chat/:bookingId                -> latest 50 messages
// GET /chat/:bookingId?before=<ISO>   -> 50 messages older than that time
// Needs requireAuth("fresher", "mentor") on the route (sets req.user from the cookie).

const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

async function getChatHistory(req, res) {
  try {
    // cookie login (req.user) first, Bearer token as fallback
    let identity;
    if (req.user?.id && req.user?.role) {
      identity = { role: req.user.role, userId: String(req.user.id) };
    } else {
      const authorization = req.headers.authorization || "";
      identity = authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";
    }

    const user = await getChatUser(identity, req.params.bookingId);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to access this chat",
      });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE, 1),
      MAX_PAGE,
    );

    const filter = { bookingId: user.bookingKey };

    if (req.query.before) {
      const before = new Date(req.query.before);
      if (!Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
      }
    }

    const rows = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();

    return res.json({ success: true, messages, hasMore });
  } catch (error) {
    console.error("Chat history error:", error.message);

    const authError = ["JsonWebTokenError", "TokenExpiredError"].includes(
      error.name,
    );

    return res.status(authError ? 401 : 500).json({
      success: false,
      message: authError ? "Invalid or expired token" : "Could not load chat",
    });
  }
}

// ---------------- UNREAD COUNTS ----------------
// GET /chat/unread -> { counts: { <requestGroupId>: n } } for the logged-in user

async function getUnreadCounts(req, res) {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const rows = await ChatMessage.aggregate([
      {
        $match: {
          recipientRole: req.user.role,
          recipientId: String(req.user.id),
          readAt: null,
        },
      },
      { $group: { _id: "$bookingId", count: { $sum: 1 } } },
    ]);

    const ids = rows.map((r) => r._id).filter((id) => mongoose.isValidObjectId(id));
    const bookings = ids.length
      ? await Booking.find({ _id: { $in: ids } })
          .select("_id requestGroupId")
          .lean()
      : [];

    const keyById = new Map(
      bookings.map((b) => [String(b._id), String(b.requestGroupId || "")]),
    );

    const counts = {};
    rows.forEach((r) => {
      const key = keyById.get(String(r._id));
      if (key) counts[key] = r.count;
    });

    return res.json({ success: true, counts });
  } catch (error) {
    console.error("Unread counts error:", error.message);
    return res.status(500).json({ success: false, message: "Could not load unread" });
  }
}

// ---------------- SOCKET CHAT ----------------

function registerChat(io) {
  io.on("connection", (socket) => {
    const authUser = socket.data.user;
    if (authUser?.id && authUser?.role) {
      const uid = String(authUser.id);
      socket.join(userRoom(authUser.role, uid));

      markDeliveredForUser(io, authUser.role, uid).catch((err) =>
        console.error("markDeliveredForUser failed:", err.message),
      );

      if (trackOnline(socket, authUser.role, uid)) {
        broadcastPresence(io, authUser.role, uid);
      }
    }

    // ---------- JOIN ----------
    socket.on("chat:join", async (payload = {}, ack) => {
      try {
        const { bookingId, token } = payload;

        // cookie login: identity comes from the socket handshake
        const identity = socket.data.user?.id
          ? {
              role: socket.data.user.role,
              userId: String(socket.data.user.id),
            }
          : token;

        if (!bookingId || !identity) {
          return ack?.({
            ok: false,
            message: "Booking ID and login are required",
          });
        }

        const user = await getChatUser(identity, bookingId);

        if (!user) {
          return ack?.({ ok: false, message: "Not allowed" });
        }

        socket.data.chat ||= {};
        socket.data.chat[String(bookingId)] = user;

        const room = chatRoom(user.bookingKey);
        await socket.join(room);

        // no auth user on the socket: still count it as online for this user
        if (!socket.data.user) {
          await socket.join(userRoom(user.role, user.userId));
          if (trackOnline(socket, user.role, user.userId)) {
            broadcastPresence(io, user.role, user.userId);
          }
        }

        const pending = await ChatMessage.find({
          bookingId: user.bookingKey,
          senderRole: { $ne: user.role },
          deliveredAt: null,
        })
          .select("_id")
          .lean();

        if (pending.length) {
          const ids = pending.map((m) => m._id);
          const now = new Date();

          await ChatMessage.updateMany(
            { _id: { $in: ids }, deliveredAt: null },
            { $set: { deliveredAt: now } },
          );

          io.to(room)
            .to(userRoom(user.peerRole, user.peerId))
            .emit("chat:receipt", {
              bookingId: user.bookingKey,
              requestGroupId: user.requestGroupId,
              messageIds: ids.map(String),
              status: "delivered",
              deliveredAt: now,
            });
        }

        const peerOnline = isUserOnline(user.peerRole, user.peerId);

        return ack?.({
          ok: true,
          online: {
            [user.role]: true,
            [user.peerRole]: peerOnline,
          },
          lastSeen: peerOnline
            ? null
            : await getLastSeen(user.peerRole, user.peerId),
        });
      } catch (error) {
        console.error("Chat join error:", error.message);
        return ack?.({ ok: false, message: "Chat unavailable" });
      }
    });

    // ---------- SEND ----------
    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const bookingId = String(payload.bookingId || "");
        const user = socket.data.chat?.[bookingId];
        const text = String(payload.text || "").trim();

        if (!user || !text || text.length > 1000) {
          return ack?.({ ok: false, message: "Cannot send message" });
        }

        const recipientOnline = isUserOnline(user.peerRole, user.peerId);

        const msg = await ChatMessage.create({
          bookingId: user.bookingKey,
          senderRole: user.role,
          senderId: user.userId,
          recipientRole: user.peerRole,
          recipientId: user.peerId,
          text,
          deliveredAt: recipientOnline ? new Date() : null,
        });

        const message = toClient(msg, user);

        io.to(chatRoom(user.bookingKey))
          .to(userRoom(user.peerRole, user.peerId))
          .to(userRoom(user.role, user.userId))
          .emit("chat:message", message);

        return ack?.({ ok: true, message });
      } catch (error) {
        console.error("Chat send error:", error.message);
        return ack?.({ ok: false, message: "Could not send message" });
      }
    });

    // ---------- READ ----------
    socket.on("chat:read", async (payload = {}, ack) => {
      try {
        const bookingId = String(payload.bookingId || "");
        const user = socket.data.chat?.[bookingId];

        if (!user) {
          return ack?.({ ok: false, message: "Not allowed" });
        }

        const requestedIds = Array.isArray(payload.messageIds)
          ? payload.messageIds
              .filter((id) => mongoose.isValidObjectId(id))
              .map((id) => new mongoose.Types.ObjectId(id))
          : [];

        if (!requestedIds.length) {
          return ack?.({ ok: true, updated: 0 });
        }

        // only messages sent by the OTHER person and still unread
        const targets = await ChatMessage.find({
          _id: { $in: requestedIds },
          bookingId: user.bookingKey,
          senderRole: { $ne: user.role },
          readAt: null,
        })
          .select("_id")
          .lean();

        if (!targets.length) {
          return ack?.({ ok: true, updated: 0 });
        }

        const ids = targets.map((m) => m._id);
        const now = new Date();

        // Two plain updates (an array / pipeline update throws
        // "Cannot pass an array to query updates unless updatePipeline is set",
        // so readAt was never saved and the unread badge stayed at 4).
        // 1) a message that is being read must also count as delivered
        await ChatMessage.updateMany(
          { _id: { $in: ids }, deliveredAt: null },
          { $set: { deliveredAt: now } },
        );
        // 2) mark as read
        await ChatMessage.updateMany(
          { _id: { $in: ids }, readAt: null },
          { $set: { readAt: now } },
        );

        io.to(chatRoom(user.bookingKey))
          .to(userRoom(user.peerRole, user.peerId))
          .emit("chat:receipt", {
            bookingId: user.bookingKey,
            requestGroupId: user.requestGroupId,
            messageIds: ids.map(String),
            status: "read",
            deliveredAt: now,
            readAt: now,
          });

        return ack?.({ ok: true, updated: ids.length });
      } catch (error) {
        console.error("Chat read error:", error.message);
        return ack?.({ ok: false, message: "Could not update read receipt" });
      }
    });

    // ---------- LEAVE ----------
    socket.on("chat:leave", (payload = {}) => {
      const bookingId = String(payload.bookingId || "");
      const user = socket.data.chat?.[bookingId];

      if (user) {
        socket.leave(chatRoom(user.bookingKey));
        delete socket.data.chat[bookingId];
      }
    });

    // ---------- DISCONNECT ----------
    socket.on("disconnect", () => {
      const me = untrackOnline(socket);
      if (!me) return;

      const seenAt = new Date();

      // small grace period so refresh / page change does not flicker.
      // Still offline after that -> save "last seen" and tell the other person.
      setTimeout(async () => {
        if (isUserOnline(me.role, me.userId)) return;
        await saveLastSeen(me.role, me.userId, seenAt);
        broadcastPresence(io, me.role, me.userId, seenAt);
      }, OFFLINE_GRACE_MS);
    });
  });
}

module.exports = {
  ChatMessage,
  getChatUser,
  getChatHistory,
  getUnreadCounts,
  registerChat,
};