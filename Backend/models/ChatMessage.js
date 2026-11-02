// models/ChatMessage.js
// Model + REST handlers (routes/chatRoutes.js imports getChatHistory, getUnreadCounts from here)
// group chat: host + friends (booking.participants) + mentor can open / read / write.
// readers = who has read the message (name + photo)
// PRIVACY: a person only gets the readers of HIS OWN messages.
const mongoose = require("mongoose");
const Booking = require("./Booking");

const replySchema = new mongoose.Schema(
  {
    messageId: { type: String, default: "" },
    text: { type: String, default: "" },
    senderId: { type: String, default: "" },
    senderRole: { type: String, default: "" },
    senderName: { type: String, default: "" },
  },
  { _id: false },
);

const readerSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    role: { type: String, default: "" },
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatMessageSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true }, // = requestGroupId
    senderId: { type: String, default: "" },
    senderRole: { type: String, enum: ["fresher", "mentor"], required: true },
    senderName: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 1000 },
    replyTo: { type: replySchema, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null }, // first time someone else read it
    readBy: { type: [String], default: [] }, // user ids that read it
    readers: { type: [readerSchema], default: [] }, // same people, with name + photo
  },
  { timestamps: true },
);

chatMessageSchema.index({ bookingId: 1, createdAt: -1 });

const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);

/* ------------------------------------------------------------------ */
/* ACCESS: host + friends who joined (participants) + accepted mentor  */
/* ------------------------------------------------------------------ */
const idOf = (v) => String(v?._id || v || "");

const chatAccess = async (bookingId, user) => {
  const b = await Booking.findOne({
    requestGroupId: String(bookingId || "").trim(),
  })
    .select("requestGroupId fresher mentor participants sessionMode status")
    .lean();

  if (!b) return { ok: false, message: "Booking not found" };

  const me = String(user?.id || user?._id || "");
  if (!me) return { ok: false, message: "Log in again." };

  if (user.role === "mentor") {
    return b.mentor && idOf(b.mentor) === me
      ? { ok: true, booking: b, role: "mentor" }
      : { ok: false, message: "Not allowed to access this chat" };
  }

  const isMember =
    idOf(b.fresher) === me ||
    (b.participants || []).some((p) => idOf(p.fresher) === me);

  return isMember
    ? { ok: true, booking: b, role: "fresher" }
    : { ok: false, message: "Not allowed to access this chat" };
};

// PRIVACY: readers / readBy of OTHER people's messages never leave the server.
const toClient = (m, me) => {
  const { readBy = [], readers = [], ...rest } = m;
  const mine = String(m.senderId || "") === String(me);
  return {
    ...rest,
    readers: mine ? readers : [],
    readByMe: readBy.map(String).includes(String(me)),
    requestGroupId: m.bookingId,
  };
};

/* ------------------------------------------------------------------ */
/* GET /api/chat/:bookingId?limit=50&before=<ISO date>                 */
/* ------------------------------------------------------------------ */
const getChatHistory = async (req, res) => {
  try {
    const access = await chatAccess(req.params.bookingId, req.user);
    if (!access.ok)
      return res.status(403).json({ success: false, message: access.message });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const filter = { bookingId: access.booking.requestGroupId };

    if (req.query.before) {
      const d = new Date(req.query.before);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }

    const rows = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const me = String(req.user.id);
    const hasMore = rows.length > limit;
    const messages = rows
      .slice(0, limit)
      .reverse()
      .map((m) => toClient(m, me));

    return res.json({ success: true, messages, hasMore });
  } catch (error) {
    console.error("getChatHistory error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not load chat." });
  }
};

/* ------------------------------------------------------------------ */
/* GET /api/chat/unread  ->  { counts: { requestGroupId: n } }         */
/* ------------------------------------------------------------------ */
const getUnreadCounts = async (req, res) => {
  try {
    const me = String(req.user.id);
    const role = req.user.role;

    const bookings = await Booking.find({
      $or: [{ fresher: me }, { "participants.fresher": me }, { mentor: me }],
      status: { $nin: ["pending", "expired", "missed", "cancelled"] },
    })
      .select("requestGroupId sessionMode mentor")
      .lean();

    const mine = bookings.filter((b) =>
      role === "mentor" ? idOf(b.mentor) === me : true,
    );

    if (!mine.length) return res.json({ success: true, counts: {} });

    const conds = mine.map((b) =>
      b.sessionMode === "group"
        ? {
            bookingId: b.requestGroupId,
            senderId: { $ne: me },
            readBy: { $ne: me },
          }
        : {
            bookingId: b.requestGroupId,
            senderRole: { $ne: role },
            readAt: null,
          },
    );

    const agg = await ChatMessage.aggregate([
      { $match: { $or: conds } },
      { $group: { _id: "$bookingId", n: { $sum: 1 } } },
    ]);

    const counts = {};
    agg.forEach((r) => {
      counts[r._id] = r.n;
    });

    return res.json({ success: true, counts });
  } catch (error) {
    console.error("getUnreadCounts error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not load unread counts." });
  }
};

ChatMessage.chatAccess = chatAccess;
ChatMessage.getChatHistory = getChatHistory;
ChatMessage.getUnreadCounts = getUnreadCounts;

module.exports = ChatMessage;