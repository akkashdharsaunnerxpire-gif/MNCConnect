const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Booking = require("./Booking");

const chatSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["mentor", "fresher"],
      required: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    // who should receive this message (used for delivered ticks)
    recipientRole: {
      type: String,
      enum: ["mentor", "fresher"],
      default: null,
    },
    recipientId: {
      type: String,
      default: null,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", chatSchema);

// ---------------- ROOM HELPERS ----------------

const chatRoom = (bookingKey) => `chat:${bookingKey}`;
const userRoom = (role, id) => `user:${role}:${id}`;
const peerRoleOf = (role) => (role === "mentor" ? "fresher" : "mentor");

// ---------------- PRESENCE HELPERS ----------------

const OFFLINE_GRACE_MS = 2000;

// user has at least one connected socket (any tab / any page)
async function isUserOnline(io, role, id) {
  if (!role || !id) return false;
  const sockets = await io.in(userRoom(role, String(id))).fetchSockets();
  return sockets.length > 0;
}

async function getOnlineMap(io, mentorId, fresherId) {
  const [mentor, fresher] = await Promise.all([
    isUserOnline(io, "mentor", mentorId),
    isUserOnline(io, "fresher", fresherId),
  ]);
  return { mentor, fresher };
}

// Tell every open chat of this user's bookings about the new online state.
async function broadcastPresence(io, role, userId) {
  try {
    const bookings = await Booking.find({ [role]: userId })
      .select("_id requestGroupId mentor fresher")
      .limit(200)
      .lean();

    for (const b of bookings) {
      const online = await getOnlineMap(
        io,
        String(b.mentor || ""),
        String(b.fresher || ""),
      );

      io.to(chatRoom(String(b._id))).emit("chat:presence", {
        bookingId: String(b._id),
        requestGroupId: String(b.requestGroupId || ""),
        online,
      });
    }
  } catch (err) {
    console.error("broadcastPresence failed:", err.message);
  }
}

// ---------------- AUTH ----------------

function verifyAndDecode(token) {
  if (!token) throw new Error("Authentication token is missing");

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const role = decoded.role;
  const userId = String(
    decoded.id || decoded._id || decoded.userId || "",
  );

  if (!["mentor", "fresher"].includes(role) || !userId) {
    throw new Error("Invalid authentication token");
  }

  return { role, userId };
}

// ---------------- BOOKING ACCESS ----------------

async function getChatUser(token, bookingId) {
  if (!bookingId) return null;

  const { role, userId } = verifyAndDecode(token);

  const query = mongoose.isValidObjectId(bookingId)
    ? {
        $or: [
          { _id: bookingId },
          { requestGroupId: bookingId },
        ],
      }
    : { requestGroupId: bookingId };

  const booking = await Booking.findOne(query).lean();

  if (!booking) return null;

  const mentorId = String(booking.mentor || "");
  const fresherId = String(booking.fresher || "");

  const allowed =
    (role === "mentor" && mentorId === userId) ||
    (role === "fresher" && fresherId === userId);

  if (!allowed) return null;

  return {
    role,
    userId,
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
// When a user connects (any page), all messages waiting for them
// are marked "delivered" and the senders get a receipt.

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

// ---------------- CHAT HISTORY ----------------

async function getChatHistory(req, res) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    const user = await getChatUser(token, req.params.bookingId);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to access this chat",
      });
    }

    const messages = await ChatMessage.find({
      bookingId: user.bookingKey,
    })
      .sort({ createdAt: 1 })
      .limit(300)
      .lean();

    return res.json({ success: true, messages });
  } catch (error) {
    console.error("Chat history error:", error.message);

    const authError = [
      "JsonWebTokenError",
      "TokenExpiredError",
    ].includes(error.name);

    return res.status(authError ? 401 : 500).json({
      success: false,
      message: authError
        ? "Invalid or expired token"
        : "Could not load chat",
    });
  }
}

// ---------------- SOCKET CHAT ----------------

function registerChat(io) {
  io.on("connection", (socket) => {
    // Personal room: this user receives chat events on ANY page,
    // even when the chat window is closed.
    const authUser = socket.data.user;
    if (authUser?.id && authUser?.role) {
      socket.join(userRoom(authUser.role, authUser.id));

      markDeliveredForUser(io, authUser.role, authUser.id).catch((err) =>
        console.error("markDeliveredForUser failed:", err.message),
      );

      // user is now online -> update any open chat of their bookings
      broadcastPresence(io, authUser.role, String(authUser.id));
    }

    // ---------- JOIN ----------
    socket.on("chat:join", async (payload = {}, ack) => {
      try {
        const { bookingId, token } = payload;

        if (!bookingId || !token) {
          return ack?.({
            ok: false,
            message: "Booking ID and token are required",
          });
        }

        const user = await getChatUser(token, bookingId);

        if (!user) {
          return ack?.({ ok: false, message: "Not allowed" });
        }

        // the token must belong to the same user as the socket
        if (
          socket.data.user &&
          String(socket.data.user.id) !== user.userId
        ) {
          return ack?.({ ok: false, message: "Not allowed" });
        }

        socket.data.chat ||= {};
        socket.data.chat[String(bookingId)] = user;

        const room = chatRoom(user.bookingKey);
        await socket.join(room);

        // Safety: if the socket has no auth user, still make it
        // count as "online" for this user.
        if (!socket.data.user) {
          await socket.join(userRoom(user.role, user.userId));
          broadcastPresence(io, user.role, user.userId);
        }

        // pending incoming messages have now reached this user's device
        const pending = await ChatMessage.find({
          bookingId: user.bookingKey,
          senderRole: { $ne: user.role },
          deliveredAt: null,
        }).select("_id");

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

        // who is online right now? (me = true, peer = checked)
        const peerOnline = await isUserOnline(
          io,
          user.peerRole,
          user.peerId,
        );

        return ack?.({
          ok: true,
          online: {
            [user.role]: true,
            [user.peerRole]: peerOnline,
          },
        });
      } catch (error) {
        console.error("Chat join error:", error.message);
        return ack?.({
          ok: false,
          message: "Chat unavailable",
        });
      }
    });

    // ---------- SEND ----------
    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const bookingId = String(payload.bookingId || "");
        const user = socket.data.chat?.[bookingId];
        const text = String(payload.text || "").trim();

        if (!user || !text || text.length > 1000) {
          return ack?.({
            ok: false,
            message: "Cannot send message",
          });
        }

        // Is the other person connected anywhere (any tab / page)?
        const recipientOnline = await isUserOnline(
          io,
          user.peerRole,
          user.peerId,
        );

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

        // Chained .to() = each socket receives it only ONCE
        // even if it is in more than one of these rooms.
        io.to(chatRoom(user.bookingKey))
          .to(userRoom(user.peerRole, user.peerId))
          .to(userRoom(user.role, user.userId))
          .emit("chat:message", message);

        return ack?.({ ok: true, message });
      } catch (error) {
        console.error("Chat send error:", error.message);
        return ack?.({
          ok: false,
          message: "Could not send message",
        });
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

        const filter = {
          _id: { $in: requestedIds },
          bookingId: user.bookingKey,
          senderRole: { $ne: user.role },
          readAt: null,
        };

        const targets = await ChatMessage.find(filter)
          .select("_id")
          .lean();

        if (!targets.length) {
          return ack?.({ ok: true, updated: 0 });
        }

        const ids = targets.map((m) => m._id);
        const now = new Date();

        // read also means delivered
        await ChatMessage.updateMany(
          { _id: { $in: ids }, deliveredAt: null },
          { $set: { deliveredAt: now } },
        );
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
        return ack?.({
          ok: false,
          message: "Could not update read receipt",
        });
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
      const me =
        authUser?.id && authUser?.role
          ? { role: authUser.role, userId: String(authUser.id) }
          : (() => {
              const first = Object.values(socket.data.chat || {})[0];
              return first
                ? { role: first.role, userId: first.userId }
                : null;
            })();

      if (!me) return;

      // small grace period so page change / refresh doesn't flicker
      // "Offline". If the user reconnected meanwhile, they stay online.
      setTimeout(async () => {
        try {
          const stillOnline = await isUserOnline(io, me.role, me.userId);
          if (!stillOnline) {
            await broadcastPresence(io, me.role, me.userId);
          }
        } catch (err) {
          console.error("presence on disconnect failed:", err.message);
        }
      }, OFFLINE_GRACE_MS);
    });
  });
}

module.exports = {
  ChatMessage,
  getChatUser,
  getChatHistory,
  registerChat,
};