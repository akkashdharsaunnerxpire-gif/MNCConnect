// utils/chatSocket.js
// Socket side of the chat: chat:join / chat:leave / chat:send / chat:read
// FIX: group chat -> every paid member (host + friends) and the mentor can chat.
const jwt = require("jsonwebtoken");
const ChatMessage = require("../models/ChatMessage");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const { emitToUser } = require("./realtime");

const { chatAccess } = ChatMessage;

const MAX_LEN = 1000;
const BLOCKED = ["pending", "expired", "missed", "cancelled"];

const room = (id) => `chat:${id}`;
const idOf = (v) => String(v?._id || v || "");

// bookingId -> { mentor: Date, fresher: Date }   (for "last seen")
const lastSeen = new Map();
const nameCache = new Map();

const verify = (token) => {
  try {
    const p = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return p && p.id ? { id: String(p.id), role: p.role } : null;
  } catch (_) {
    return null;
  }
};

// same way utils/meeting.js finds the user
const identify = (socket, payload = {}) => {
  const u = socket.data?.user || socket.user;
  if (u && (u.id || u._id) && u.role) {
    return { id: String(u.id || u._id), role: u.role };
  }
  return verify(payload.token);
};

const nameOf = async (user) => {
  const key = `${user.role}:${user.id}`;
  if (nameCache.has(key)) return nameCache.get(key);
  const Model = user.role === "mentor" ? Mentor : Fresher;
  const doc = await Model.findById(user.id).select("name").lean().catch(() => null);
  const name = doc?.name || (user.role === "mentor" ? "Employee" : "Fresher");
  nameCache.set(key, name);
  return name;
};

// who is inside this chat room right now
const insideOf = async (io, bookingId) => {
  const sockets = await io.in(room(bookingId)).fetchSockets();
  const users = new Set();
  const online = { mentor: false, fresher: false };
  sockets.forEach((s) => {
    const c = s.data?.chat;
    if (!c) return;
    users.add(c.userId);
    online[c.role] = true;
  });
  return { sockets, users, online };
};

const emitPresence = async (io, bookingId) => {
  const { online } = await insideOf(io, bookingId);
  io.to(room(bookingId)).emit("chat:presence", {
    bookingId,
    requestGroupId: bookingId,
    online,
    lastSeen: lastSeen.get(bookingId) || {},
  });
};

const leaveRoom = async (io, socket, bookingId) => {
  const c = socket.data.chat;
  if (!socket.rooms.has(room(bookingId))) return;

  socket.leave(room(bookingId));
  socket.data.chatRooms?.delete(bookingId);

  const { online } = await insideOf(io, bookingId);
  if (c && !online[c.role]) {
    const cur = lastSeen.get(bookingId) || {};
    cur[c.role] = new Date();
    lastSeen.set(bookingId, cur);
  }
  emitPresence(io, bookingId).catch(() => {});
};

exports.initChat = (io) => {
  io.on("connection", (socket) => {
    socket.data.chatRooms = new Set();

    /* ---------------- JOIN ---------------- */
    socket.on("chat:join", async (payload = {}, ack = () => {}) => {
      try {
        const user = identify(socket, payload);
        if (!user) return ack({ ok: false, message: "Log in again." });

        const bookingId = String(payload.bookingId || "").trim();
        const access = await chatAccess(bookingId, user);
        if (!access.ok) return ack({ ok: false, message: access.message });

        socket.data.chat = { userId: user.id, role: access.role };
        socket.data.chatRooms.add(bookingId);
        socket.join(room(bookingId));

        // everything sent by others is now "delivered"
        const now = new Date();
        const pending = await ChatMessage.find({
          bookingId,
          senderId: { $ne: user.id },
          deliveredAt: null,
        })
          .select("_id")
          .lean();

        if (pending.length) {
          await ChatMessage.updateMany(
            { _id: { $in: pending.map((p) => p._id) } },
            { $set: { deliveredAt: now } },
          );
          socket.to(room(bookingId)).emit("chat:receipt", {
            bookingId,
            messageIds: pending.map((p) => String(p._id)),
            status: "delivered",
            deliveredAt: now,
          });
        }

        const { online } = await insideOf(io, bookingId);
        const seen = lastSeen.get(bookingId) || {};
        const peerRole = access.role === "mentor" ? "fresher" : "mentor";

        emitPresence(io, bookingId).catch(() => {});

        return ack({
          ok: true,
          role: access.role,
          online,
          lastSeen: seen[peerRole] || null,
        });
      } catch (error) {
        console.error("chat:join error:", error.message);
        return ack({ ok: false, message: "Chat unavailable." });
      }
    });

    socket.on("chat:leave", (payload = {}) => {
      const bookingId = String(payload.bookingId || "").trim();
      if (bookingId) leaveRoom(io, socket, bookingId).catch(() => {});
    });

    /* ---------------- SEND ---------------- */
    socket.on("chat:send", async (payload = {}, ack = () => {}) => {
      try {
        const user = identify(socket, payload);
        if (!user) return ack({ ok: false, message: "Log in again." });

        const bookingId = String(payload.bookingId || "").trim();
        const text = String(payload.text || "").trim().slice(0, MAX_LEN);
        if (!text) return ack({ ok: false, message: "Message is empty." });

        const access = await chatAccess(bookingId, user);
        if (!access.ok) return ack({ ok: false, message: access.message });

        const b = access.booking;
        if (BLOCKED.includes(b.status))
          return ack({ ok: false, message: "Chat is closed for this session." });

        // reply snapshot
        let replyTo = null;
        if (payload.replyToId && /^[a-f\d]{24}$/i.test(String(payload.replyToId))) {
          const orig = await ChatMessage.findOne({
            _id: payload.replyToId,
            bookingId,
          }).lean();
          if (orig) {
            replyTo = {
              messageId: String(orig._id),
              text: String(orig.text || "").slice(0, 200),
              senderId: orig.senderId || "",
              senderRole: orig.senderRole,
              senderName: orig.senderName || "",
            };
          }
        }

        const senderName = await nameOf(user);
        const { users: inside } = await insideOf(io, bookingId);
        const someoneElseInside = Array.from(inside).some((u) => u !== user.id);

        const doc = await ChatMessage.create({
          bookingId,
          senderId: user.id,
          senderRole: access.role,
          senderName,
          text,
          replyTo,
          readBy: [user.id],
          deliveredAt: someoneElseInside ? new Date() : null,
        });

        const message = {
          ...doc.toObject(),
          _id: String(doc._id),
          requestGroupId: bookingId,
        };

        // people inside the chat room (not me)
        socket.to(room(bookingId)).emit("chat:message", message);

        // everybody else of this booking (not inside the room): unread badge / sound
        const recipients = new Set(
          [idOf(b.fresher), idOf(b.mentor), ...(b.participants || []).map((p) => idOf(p.fresher))].filter(Boolean),
        );
        recipients.delete(user.id);
        inside.forEach((u) => recipients.delete(u));
        recipients.forEach((id) => emitToUser(id, "chat:message", message));

        // tell the other members that it was delivered
        if (someoneElseInside) {
          socket.to(room(bookingId)).emit("chat:receipt", {
            bookingId,
            messageIds: [String(doc._id)],
            status: "delivered",
            deliveredAt: message.deliveredAt,
          });
        }

        return ack({ ok: true, message });
      } catch (error) {
        console.error("chat:send error:", error.message);
        return ack({ ok: false, message: "Could not send. Try again." });
      }
    });

    /* ---------------- READ (blue ticks) ---------------- */
    socket.on("chat:read", async (payload = {}, ack = () => {}) => {
      try {
        const user = identify(socket, payload);
        if (!user) return ack({ ok: false });

        const bookingId = String(payload.bookingId || "").trim();
        const access = await chatAccess(bookingId, user);
        if (!access.ok) return ack({ ok: false, message: access.message });

        const ids = (Array.isArray(payload.messageIds) ? payload.messageIds : [])
          .map(String)
          .filter((x) => /^[a-f\d]{24}$/i.test(x))
          .slice(0, 200);
        if (!ids.length) return ack({ ok: true });

        const now = new Date();
        await ChatMessage.updateMany(
          { _id: { $in: ids }, bookingId, senderId: { $ne: user.id } },
          [
            {
              $set: {
                readBy: {
                  $setUnion: [{ $ifNull: ["$readBy", []] }, [user.id]],
                },
                readAt: { $ifNull: ["$readAt", now] },
                deliveredAt: { $ifNull: ["$deliveredAt", now] },
              },
            },
          ],
        );

        io.to(room(bookingId)).emit("chat:receipt", {
          bookingId,
          messageIds: ids,
          status: "read",
          readAt: now,
          deliveredAt: now,
        });

        return ack({ ok: true });
      } catch (error) {
        console.error("chat:read error:", error.message);
        return ack({ ok: false });
      }
    });

    /* ---------------- DISCONNECT ---------------- */
    socket.on("disconnect", () => {
      const ids = Array.from(socket.data.chatRooms || []);
      ids.forEach((bookingId) => {
        const c = socket.data.chat;
        insideOf(io, bookingId)
          .then(({ online }) => {
            if (c && !online[c.role]) {
              const cur = lastSeen.get(bookingId) || {};
              cur[c.role] = new Date();
              lastSeen.set(bookingId, cur);
            }
            return emitPresence(io, bookingId);
          })
          .catch(() => {});
      });
    });
  });
};