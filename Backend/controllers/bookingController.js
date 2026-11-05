// controllers/bookingController.js
// SINGLE + GROUP sessions.
//   single : 1 fresher pays RATE_PER_HOUR
//   group  : host creates the booking (pays own share), friends join with an invite code
//            and EACH pays GROUP_RATE_PER_HOUR (per person). Refunds / earnings are per payment.
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Review = require("../models/Review"); // <-- add

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const Notification = require("../models/Notification");
const TOKEN_OPEN_BEFORE_MS = 60 * 1000;

const { optionalAuth } = require("../middleware/panelAuth");
const {
  notify,
  emitToUser,
  serializeNotification,
} = require("../utils/realtime");
const { parseSessionStart } = require("../utils/sessionTime");
const { splitAmount } = require("../utils/wallet");
const {
  linkPaymentToRequest,
  assignMentorToRequest,
  claimPayment,
  reconcileStaleOrders,
} = require("./paymentController");
const {
  refundableAmountOf,
  checkoutOf,
  getConfig,
  toPaise,
  round2,
} = require("../utils/pricing");

/* ============================ CONFIG ============================ */
const MENTOR_PUBLIC_FIELDS =
  "name email profilePic currentCompany designation department officeLocation yearsOfExperience languages skills bio linkedinProfile gender rating totalReviews totalSessions isVerified";

const PAYMENT_GRACE_MS = (Number(process.env.PAYMENT_GRACE_SEC) || 60) * 1000;

const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 25);

const PENDING_CUTOFF_MIN = Number(process.env.PENDING_CUTOFF_MIN) || 10;
const PENDING_CUTOFF_MS = PENDING_CUTOFF_MIN * 60 * 1000;
const MIN_WAIT_MS = 2 * 60 * 1000;

const expiryFor = (startsAt) => {
  const start = new Date(startsAt).getTime();
  const ideal = start - PENDING_CUTOFF_MS;
  const floor = Date.now() + MIN_WAIT_MS;
  return new Date(Math.min(start - 30 * 1000, Math.max(ideal, floor)));
};

const MAX_REFUND_ATTEMPTS = 5;
const REFUND_RETRY_GAP_MS = 30 * 60 * 1000;

const NO_SHOW_GRACE_MS =
  (Number(process.env.NO_SHOW_GRACE_MIN) || 15) * 60 * 1000;

const CONFIRM_WAIT_MS =
  (Number(process.env.CONFIRM_WAIT_HOURS) || 24) * 60 * 60 * 1000;
const UNCONFIRMED_ACTION =
  process.env.UNCONFIRMED_ACTION === "refund" ? "refund" : "release";

// ---- pricing ----
const RATE_PER_HOUR = Number(process.env.SESSION_RATE_PER_HOUR) || 400;
// group: price PER PERSON per hour (30 min = half)
const GROUP_RATE_PER_HOUR = Number(process.env.GROUP_RATE_PER_HOUR) || 50;
const MAX_GROUP = Number(process.env.MAX_GROUP_MEMBERS) || 60; // college batch = up to 60

const expectedPrice = (minutes, mode = "single") =>
  Math.round(
    ((mode === "group" ? GROUP_RATE_PER_HOUR : RATE_PER_HOUR) * minutes) / 60,
  );

/* ============================ HELPERS ============================ */

let razorpay = null;
const getRazorpay = () => {
  if (razorpay) return razorpay;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)
    throw new Error("Razorpay keys not set");
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  return razorpay;
};

const arr = (v) =>
  Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const isAny = (v) =>
  ["", "any", "all", "no preference", "none"].includes(norm(v));
const loose = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

const MENTOR_FIELDS =
  "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";
const POPULATE_MENTOR = "name email profilePic currentCompany designation";

const SPOKEN_LANGS = new Set([
  "english",
  "tamil",
  "hindi",
  "malayalam",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "urdu",
  "punjabi",
  "odia",
  "assamese",
]);

const whyNot = (m, b) => {
  if (b.companyName && !loose(m.currentCompany, b.companyName))
    return `company mismatch (mentor "${m.currentCompany}" vs "${b.companyName}")`;

  if (!isAny(b.gender) && norm(m.gender) !== norm(b.gender))
    return `gender mismatch (mentor "${m.gender}" vs "${b.gender}")`;

  if (
    !isAny(b.role) &&
    norm(m.department) !== norm(b.role) &&
    norm(m.designation) !== norm(b.role)
  )
    return `role mismatch (mentor department "${m.department}" / designation "${m.designation}" vs "${b.role}")`;
  const spoken = [...arr(m.languages), ...arr(m.spokenLanguages)]
    .map(norm)
    .filter((l) => SPOKEN_LANGS.has(l));
  if (
    !isAny(b.language) &&
    spoken.length &&
    !spoken.some((l) => loose(l, b.language))
  )
    return `language mismatch (mentor [${spoken.join(", ")}] vs "${b.language}")`;

  return "";
};

const socketIdsOf = (app, mentorId) => {
  const map = app.get("onlineMentors");
  const entry = map && map.get(String(mentorId));
  if (!entry) return [];
  return Array.from(entry instanceof Set ? entry : [].concat(entry));
};

const emitToMentorSockets = (app, mentorId, event, payload) => {
  const io = app.get("io");
  if (!io) return;
  socketIdsOf(app, mentorId).forEach((sid) => io.to(sid).emit(event, payload));
};

const hasConflict = (mentorId, startsAt, endsAt, excludeId) =>
  Booking.exists({
    mentor: mentorId,
    status: { $in: ["accepted", "in_progress"] },
    requestGroupId: { $ne: excludeId || "" },
    startsAt: { $lt: new Date(new Date(endsAt).getTime() + GAP_MS) },
    endsAt: { $gt: new Date(new Date(startsAt).getTime() - GAP_MS) },
  });

/* ---------- group helpers ---------- */

const isGroup = (b) => b.sessionMode === "group";

// everyone who paid for this booking: [{ fresher, razorpayPaymentId, amount, name }]
// (old single bookings have no `participants` -> fall back to the host fields)
const membersOf = (b) =>
  b.participants && b.participants.length
    ? b.participants.map((p) => ({
        fresher: p.fresher,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        name: p.name,
      }))
    : [
        {
          fresher: b.fresher,
          razorpayPaymentId: b.razorpayPaymentId,
          amount: b.amount,
          name: b.fresherName,
        },
      ];

const paymentIdsOf = (b) => [
  ...new Set(
    [
      b.razorpayPaymentId,
      ...membersOf(b).map((m) => m.razorpayPaymentId),
    ].filter(Boolean),
  ),
];

const participantUserIds = (b) => [
  ...new Set(
    [b.fresher, ...membersOf(b).map((m) => m.fresher)]
      .filter(Boolean)
      .map((x) => String(x._id || x)),
  ),
];

const paymentUsed = (paymentId) =>
  Booking.exists({
    $or: [
      { razorpayPaymentId: paymentId },
      { "participants.razorpayPaymentId": paymentId },
    ],
  });

const makeInviteCode = () =>
  crypto.randomBytes(6).toString("hex").toUpperCase();

const emitBooking = (b) => {
  const payload = toClient(b);
  participantUserIds(b).forEach((id) =>
    emitToUser(id, "booking:updated", payload),
  );
  if (b.mentor)
    emitToUser(b.mentor._id || b.mentor, "booking:updated", payload);
};

// payments of EVERY member -> assigned to the accepting mentor
// payments of EVERY member -> assigned to the accepting mentor
const assignMentorToAll = async (b, mentorId) => {
  await Payment.updateMany(
    {
      $or: [
        { requestGroupId: b.requestGroupId },
        { razorpayPaymentId: { $in: paymentIdsOf(b) } },
      ],
      status: "paid",
      sessionStatus: { $nin: ["cancelled", "completed"] },
    },
    { $set: { mentor: mentorId, sessionStatus: "upcoming" } },
  ).catch((e) => console.error("assignMentorToAll:", e.message));
};

const toMentorPayload = (b) => ({
  id: b.requestGroupId,
  requestGroupId: b.requestGroupId,
  name: b.fresherName || "Fresher",
  avatar: b.fresherImage || "",
  requester: {
    fullName: b.fresherName,
    email: b.fresherEmail,
    image: b.fresherImage,
  },
  role:
    norm(b.role) === "other" && b.otherRole ? b.otherRole : b.role || "Fresher",
  company: b.companyName,
  companyName: b.companyName,
  topic: b.sessionType || "Session",
  date: b.date,
  time: b.time,
  duration: b.durationMinutes,
  amount: b.amount,
  message: b.reason,
  type: isGroup(b) ? "Group Video Call" : "Video Call",
  mode: b.sessionMode || "single",
  maxMembers: b.maxMembers || 1,
  members: membersOf(b).length,
  gender: b.gender,
  language: b.language,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  expiresAt: b.expiresAt,
  status: "pending",
  direct: Boolean(b.preferredMentor),
});

const mentorCard = (m) =>
  m && typeof m === "object" && m.name
    ? {
        id: String(m._id),
        name: m.name,
        designation: m.designation || "",
        company: m.currentCompany || "",
        image: m.profilePic || "",
        email: m.email || "",
      }
    : null;

const isRunning = (b) =>
  b.status === "in_progress" &&
  Boolean(b.meeting?.timerEndsAt) &&
  !b.meeting?.endedAt;

const remainingOf = (b) =>
  isRunning(b)
    ? Math.max(0, new Date(b.meeting.timerEndsAt).getTime() - Date.now())
    : (b.meeting?.remainingMs ?? null);

function toClient(b) {
  return {
    id: b.requestGroupId,
    requestGroupId: b.requestGroupId,
    status: b.status,
    companyName: b.companyName,
    sessionType: b.sessionType,
    reason: b.reason,
    language: b.language,
    role: b.role,
    otherRole: b.otherRole,
    durationMinutes: b.durationMinutes,
    amount: b.amount, // PER PERSON for group sessions
    date: b.date,
    time: b.time,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    expiresAt: b.expiresAt,
    opensAt: new Date(new Date(b.startsAt).getTime() - OPEN_BEFORE_MS),
    mentor:
      mentorCard(b.mentor) ||
      (b.status === "pending" ? mentorCard(b.preferredMentor) : null),
    direct: Boolean(b.preferredMentor),
    reviewed: Boolean(b.reviewed),
    refundStatus: b.refundStatus || "",
    remainingMs: remainingOf(b),
    timerRunning: isRunning(b),
    // ---- group ----
    mode: b.sessionMode || "single",
    maxMembers: b.maxMembers || 1,
    perPersonAmount: b.perPersonAmount || b.amount,
    inviteCode: isGroup(b) ? b.inviteCode || "" : "",
    hostId: b.fresher ? String(b.fresher._id || b.fresher) : "",
    members: membersOf(b).map((m) => ({
      id: m.fresher ? String(m.fresher) : "",
      name: m.name || "Fresher",
    })),
  };
}

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ============================ REFUNDS ============================ */

/* ============================ REFUNDS ============================ */

// "wallet"   (default): instant, can never fail, shows in Bonus Wallet > Total Refunds
// "original" : back to card / UPI via Razorpay (5-7 days, can fail if Razorpay balance is low)
const REFUND_DESTINATION =
  String(process.env.REFUND_DESTINATION || "wallet").toLowerCase() ===
  "original"
    ? "original"
    : "wallet";

const isWalletPayment = (p) =>
  Boolean(p) &&
  (p.method === "wallet" ||
    String(p.razorpayPaymentId || "").startsWith("wallet_pay_"));

// returns "refunded" | "failed"
// returns "refunded" | "failed"
// RULE: only the SESSION PRICE is ever refunded.
// The convenience fee (what the customer paid to cover Razorpay's cost) is NEVER refunded,
// because Razorpay does not give its fee back to us on refunds.
const refundPayment = async (payment, reason = "", options = {}) => {
  if (!payment) return "failed";

  // always work on the latest copy of the payment
  const fresh = await Payment.findById(payment._id || payment);
  if (!fresh) return "failed";
  if (fresh.status === "refunded") return "refunded";
  if (fresh.status !== "paid") return "failed";

  const walletPaid = isWalletPayment(fresh);
  let toWallet =
    walletPaid ||
    options.to === "wallet" ||
    (options.to !== "original" && REFUND_DESTINATION === "wallet");

  // no fresher on the payment -> cannot credit a wallet, use Razorpay instead
  if (toWallet && !fresh.fresher) {
    if (walletPaid) return "failed";
    toWallet = false;
  }
  if (!toWallet && !fresh.razorpayPaymentId) return "failed";

  // ONLY the session price is refunded. Convenience fee stays with the platform.
  const sessionAmount = round2(Number(fresh.amount) || 0);
  // never refund more than the customer really paid
  const amount = round2(Math.min(sessionAmount, checkoutOf(fresh)));
  if (!(amount > 0)) return "failed";
  const feePart = 0; // convenience fee is never refunded

  // ATOMIC lock. Refund amounts are written here, so the books are right even if something fails later.
  const before = await Payment.findOneAndUpdate(
    { _id: fresh._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        sessionStatus: "cancelled",
        refundMethod: toWallet ? "wallet" : "original",
        refundedAt: new Date(),
        refundAmount: amount,
        convenienceFeeRefunded: feePart,
        refundError: "",
      },
    },
    { returnDocument: "before" },
  );

  if (!before) {
    const cur = await Payment.findById(fresh._id).select("status").lean();
    return cur?.status === "refunded" ? "refunded" : "failed";
  }

  const unlock = async () => {
    const back = {
      status: "paid",
      refundMethod: "",
      refundedAt: null,
      refundAmount: 0,
      convenienceFeeRefunded: 0,
    };
    if (before.sessionStatus) back.sessionStatus = before.sessionStatus;
    await Payment.updateOne(
      { _id: before._id, status: "refunded" },
      { $set: back },
    ).catch(() => {});
  };

  const creditWallet = async () => {
    await Fresher.updateOne(
      { _id: before.fresher },
      { $inc: { walletBalance: amount, totalRefunds: amount } },
    );
    emitToUser(String(before.fresher), "wallet:updated", { amount });
  };

  try {
    if (toWallet) {
      await creditWallet(); // money is given from here: NEVER unlock after this line
      return "refunded";
    }

    // partial refund: only the session price (₹200), not the ₹204.84 the customer paid
    await getRazorpay().payments.refund(before.razorpayPaymentId, {
      amount: toPaise(amount),
      speed: "normal",
      notes: { reason: String(reason).slice(0, 100) },
    });
    return "refunded";
  } catch (error) {
    const rz = error?.error || {};
    const desc = rz.description || error.message || "";

    if (!toWallet && /already.*refund|fully refunded/i.test(desc))
      return "refunded";

    console.error("REFUND FAILED:", {
      payment: before.razorpayPaymentId,
      amount,
      toWallet,
      statusCode: error?.statusCode,
      code: rz.code,
      description: desc,
    });

    // Razorpay clearly said NO (4xx, e.g. low balance) -> give the money to the wallet instead
    const definiteNo =
      Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500;
    if (!toWallet && definiteNo && before.fresher) {
      try {
        await creditWallet();
        await Payment.updateOne(
          { _id: before._id },
          {
            $set: {
              refundMethod: "wallet",
              refundError: `Razorpay refund failed (${String(desc).slice(0, 150)}). Credited to wallet.`,
            },
          },
        );
        return "refunded";
      } catch (e2) {
        console.error("Wallet fallback failed:", e2.message);
      }
    }

    await Payment.updateOne(
      { _id: before._id },
      {
        $set: {
          refundError: String(desc).slice(0, 300),
          refundFailedAt: new Date(),
        },
      },
    ).catch(() => {});
    await unlock();
    return "failed";
  }
};
// Refund EVERY member's payment. Safe to call again. Returns FRESH payment docs.
const refundAll = async (booking, reason, options = {}) => {
  const ids = paymentIdsOf(booking);
  if (!ids.length) return { result: "failed", payments: [] };

  const list = await Payment.find({ razorpayPaymentId: { $in: ids } });
  if (!list.length) return { result: "failed", payments: [] };

  let allOk = true;
  for (const p of list) {
    const r = await refundPayment(p, reason, options);
    if (r !== "refunded") allOk = false;
  }

  const payments = await Payment.find({
    razorpayPaymentId: { $in: ids },
  }).lean();
  return { result: allOk ? "refunded" : "failed", payments };
};

// tell each member what really happened to THEIR payment
const notifyRefunds = (fresh, payments, result, { title, reason }) => {
  for (const mem of membersOf(fresh)) {
    if (!mem.fresher) continue;
    const pay = payments.find(
      (p) => p.razorpayPaymentId === mem.razorpayPaymentId,
    );
    const done = Boolean(pay && pay.status === "refunded");
    const wallet =
      done && (pay.refundMethod === "wallet" || isWalletPayment(pay));
    const amt =
      pay && Number(pay.refundAmount) > 0
        ? pay.refundAmount
        : mem.amount || fresh.amount;

    const text = done
      ? wallet
        ? `${reason} ₹${amt} was added back to your wallet.`
        : `${reason} ₹${amt} is being refunded to your original payment method (5-7 working days).`
      : `${reason} Refund is processing, we will update you soon.`;

    notify({
      user: mem.fresher,
      role: "fresher",
      title: done
        ? `${title || "Request closed"} - refund done`
        : title || "Request closed",
      message: text,
      type: "payment",
      link: wallet ? "/Home/bonus-wallet" : "/Home",
    });
  }
};

const closeAndRefund = async (
  bookingId,
  { from, to, reason, title, mentorNote, refundTo },
) => {
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: from } },
    { $set: { status: to } },
    { returnDocument: "after" },
  );
  if (!locked) return null;

  const { result, payments } = await refundAll(
    locked,
    reason,
    refundTo ? { to: refundTo } : {},
  );
  await Booking.updateOne(
    { _id: locked._id },
    { $set: { refundStatus: result } },
  );

  const fresh = await Booking.findById(locked._id).populate(
    "mentor",
    POPULATE_MENTOR,
  );
  if (!fresh) return null;

  notifyRefunds(fresh, payments, result, { title, reason });
  participantUserIds(fresh).forEach((id) =>
    emitToUser(id, "booking:updated", toClient(fresh)),
  );

  if (mentorNote && fresh.mentor) {
    notify({
      user: fresh.mentor._id,
      role: "mentor",
      title: "Session missed",
      message: mentorNote,
      type: "session",
      link: "/mentor/sessions",
    });
    emitToUser(fresh.mentor._id, "booking:updated", toClient(fresh));
  }

  return fresh;
};

const expireAndRefund = (bookingId, reason) =>
  closeAndRefund(bookingId, {
    from: ["pending"],
    to: "expired",
    reason,
    title: "Booking auto-cancelled",
    refundTo: "wallet",
  });

/* ============================ BROADCAST ============================ */

const broadcastLoop = async (
  req,
  mentors,
  booking,
  payload,
  startsAt,
  endsAt,
  requestGroupId,
  notified,
) => {
  const direct = Boolean(booking.preferredMentor);
  const report = [];
  const kind = isGroup(booking)
    ? `a group session (up to ${booking.maxMembers} people)`
    : "a session";

  for (const m of mentors) {
    const label = `${m.name || m._id} (${m.currentCompany || "-"}/${m.department || "-"}/${m.gender || "-"})`;

    if (await hasConflict(m._id, startsAt, endsAt, requestGroupId)) {
      report.push(`${label}: SKIP busy (another session within 30 min)`);
      continue;
    }

    const online = socketIdsOf(req.app, m._id).length > 0;

    if (direct && !online) {
      report.push(`${label}: direct, offline -> notification only`);
      notify({
        user: m._id,
        role: "mentor",
        title: "A fresher requested you again",
        message: `${booking.fresherName} wants ${kind}.`,
        type: "session",
        link: "/mentor/home",
      });
      continue;
    }

    const reason =
      (direct ? "" : whyNot(m, booking)) ||
      (!online ? "not online (no socket in onlineMentors map)" : "");
    if (reason) {
      report.push(`${label}: SKIP ${reason}`);
      continue;
    }

    report.push(`${label}: SENT`);
    notified.push(m._id);
    emitToMentorSockets(req.app, m._id, "session-request", payload);
    notify({
      user: m._id,
      role: "mentor",
      title: direct ? "A fresher requested you again" : "New session request",
      message: `${booking.fresherName} wants ${kind}.`,
      type: "session",
      link: "/mentor/home",
    });
  }

  console.log(
    `[request ${requestGroupId}] mode=${booking.sessionMode} needs company="${booking.companyName}" dept="${booking.role}" gender="${booking.gender}" lang="${booking.language}" | auto-cancel at ${new Date(booking.expiresAt).toISOString()}\n  ${
      report.join("\n  ") || "no approved+active mentors found"
    }`,
  );
};

const withdrawOverlapping = async (app, mentorId, accepted) => {
  try {
    const overlapping = await Booking.find({
      _id: { $ne: accepted._id },
      status: "pending",
      startsAt: { $lt: new Date(new Date(accepted.endsAt).getTime() + GAP_MS) },
      endsAt: { $gt: new Date(new Date(accepted.startsAt).getTime() - GAP_MS) },
      $or: [{ notified: mentorId }, { preferredMentor: mentorId }],
    });

    for (const b of overlapping) {
      const isMine =
        b.preferredMentor && String(b.preferredMentor) === String(mentorId);

      if (isMine) {
        await expireAndRefund(
          b._id,
          "The mentor you selected has another session at that time.",
        );
      } else {
        await Booking.updateOne(
          { _id: b._id },
          { $pull: { notified: mentorId } },
        );
      }

      emitToMentorSockets(app, mentorId, "session-request-taken", {
        id: b.requestGroupId,
        requestGroupId: b.requestGroupId,
      });
    }
  } catch (error) {
    console.error("withdrawOverlapping error:", error.message);
  }
};

/* ============================ CREATE ============================ */

exports.createRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const body = req.body || {};
    const sd = body.sessionDetails || {};
    const requestGroupId = String(body.requestGroupId || "").trim();
    const paymentId = String(body.razorpayPaymentId || "").trim();
    const preferredMentorId = mongoose.Types.ObjectId.isValid(
      body.preferredMentorId,
    )
      ? String(body.preferredMentorId)
      : null;

    if (!requestGroupId || !paymentId)
      return fail(res, 400, "requestGroupId and paymentId required");

    const existing = await Booking.findOne({ requestGroupId }).populate(
      "mentor",
      POPULATE_MENTOR,
    );
    if (existing)
      return res.json({
        success: true,
        booking: toClient(existing),
        notifiedCount: existing.notified.length,
      });

    const payment = await Payment.findOne({
      razorpayPaymentId: paymentId,
      status: "paid",
    });
    if (!payment) return fail(res, 402, "Payment not verified");
    if (
      req.user?.role === "fresher" &&
      payment.fresher &&
      String(payment.fresher) !== String(req.user.id)
    ) {
      return fail(res, 403, "This payment belongs to another account");
    }

    if (await paymentUsed(paymentId)) {
      return fail(res, 409, "This payment is already used for another booking");
    }
    const claimed = await claimPayment(paymentId, requestGroupId);
    if (!claimed)
      return fail(res, 409, "This payment is already used for another booking");

    // payment without an owner cannot be refunded to a wallet -> attach the logged-in fresher
    if (req.user?.role === "fresher" && !payment.fresher) {
      await Payment.updateOne(
        { _id: payment._id, fresher: null },
        { $set: { fresher: req.user.id } },
      ).catch(() => {});
      payment.fresher = req.user.id;
    }

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message);
      return fail(
        res,
        status,
        `${message}${result === "refunded" ? " Refunded." : ""}`,
      );
    };

    const minutes = Number(sd.duration);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 240)
      return reject(400, "Invalid duration");

    // ---- single or group ----
    const mode = sd.mode === "group" ? "group" : "single";
    let maxMembers = 1;
    if (mode === "group") {
      maxMembers = Number(sd.maxMembers);
      if (
        !Number.isInteger(maxMembers) ||
        maxMembers < 2 ||
        maxMembers > MAX_GROUP
      )
        return reject(400, `Group size must be 2 to ${MAX_GROUP} people.`);
    }

    if (Number(payment.amount) !== expectedPrice(minutes, mode)) {
      return reject(400, "Payment amount does not match the session price.");
    }

    const startsAt = parseSessionStart(sd.date, sd.time);
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      console.warn("createRequest: cannot read date/time", {
        date: sd.date,
        time: sd.time,
      });
      return reject(400, "We could not read the date and time you selected.");
    }

    const secondsLeft = Math.round((startsAt.getTime() - Date.now()) / 1000);
    if (startsAt.getTime() < Date.now() + PAYMENT_GRACE_MS) {
      console.warn("createRequest: slot passed while paying", {
        date: sd.date,
        time: sd.time,
        startsAtISO: startsAt.toISOString(),
        nowISO: new Date().toISOString(),
        secondsLeft,
      });
      return reject(
        400,
        "The time you selected passed while you were paying. Please book a later time.",
      );
    }
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    let preferredMentor = null;
    if (preferredMentorId) {
      preferredMentor = await Mentor.findOne({
        _id: preferredMentorId,
        verificationStatus: "approved",
        accountStatus: "active",
      })
        .select(MENTOR_FIELDS)
        .lean();
      if (!preferredMentor)
        return reject(400, "Selected mentor is not available.");

      if (
        await hasConflict(preferredMentor._id, startsAt, endsAt, requestGroupId)
      ) {
        return reject(
          409,
          "This mentor has another session around that time. Please pick another time.",
        );
      }
    }

    const fresherId =
      req.user?.role === "fresher"
        ? req.user.id
        : payment.fresher
          ? String(payment.fresher)
          : null;
    const fresherDoc = fresherId
      ? await Fresher.findById(fresherId).select("name email gender").lean()
      : null;

    // ---- WHO may receive this request (gender rule) ----
    //  single : the fresher's OWN gender from the profile (boy -> male employee,
    //           girl -> female employee). Old accounts without gender: use the form value.
    //  group  : whatever the host selected ("" = no preference, any employee)
    const profileGender = norm(fresherDoc?.gender);
    const profileKnown = profileGender === "male" || profileGender === "female";
    const pickedGender = norm(sd.gender);
    const pickedKnown = pickedGender === "male" || pickedGender === "female";

    let fresherGender = "";
    if (mode === "group") {
      fresherGender = pickedKnown ? pickedGender : ""; // "" = any
    } else {
      fresherGender = profileKnown
        ? profileGender
        : pickedKnown
          ? pickedGender
          : "";
    }

    const department = String(sd.role || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!preferredMentor) {
      if (mode === "single" && !fresherGender)
        return reject(400, "Please select your gender.");
      if (!department) return reject(400, "Please select a department.");
    }
    const hostName = fresherDoc?.name || body.requester?.fullName || "Fresher";

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: hostName,
      fresherEmail: fresherDoc?.email || body.requester?.email || "",
      fresherImage: String(body.requester?.image || ""),
      companyName: String(
        preferredMentor?.currentCompany || body.companyName || "",
      ).trim(),
      sessionType: String(sd.sessionType || "").slice(0, 60),
      reason: String(sd.reason || "").slice(0, 1000),
      role: department,
      otherRole: "",
      gender: fresherGender,
      language: String(sd.language || ""),
      durationMinutes: minutes,
      amount: Number(payment.amount), // per person
      date: String(sd.date),
      time: String(sd.time),
      startsAt,
      endsAt,
      expiresAt: expiryFor(startsAt),
      razorpayPaymentId: paymentId,
      preferredMentor: preferredMentor ? preferredMentor._id : null,
      // ---- group ----
      sessionMode: mode,
      maxMembers,
      perPersonAmount: Number(payment.amount),
      inviteCode: mode === "group" ? makeInviteCode() : "",
      participants: [
        {
          fresher: fresherId || null,
          name: hostName,
          razorpayPaymentId: paymentId,
          amount: Number(payment.amount),
        },
      ],
    });

    await linkPaymentToRequest({
      razorpayPaymentId: paymentId,
      requestGroupId,
      topic: booking.sessionType || booking.companyName,
      date: booking.date,
      time: booking.time,
      duration: minutes,
    });

    const mentors = preferredMentor
      ? [preferredMentor]
      : await Mentor.find({
          verificationStatus: "approved",
          accountStatus: "active",
        })
          .select(MENTOR_FIELDS)
          .lean();

    const notified = [];
    await broadcastLoop(
      req,
      mentors,
      booking,
      toMentorPayload(booking),
      startsAt,
      booking.endsAt,
      requestGroupId,
      notified,
    );
    if (notified.length)
      await Booking.updateOne({ _id: booking._id }, { $set: { notified } });

    const out = await Booking.findById(booking._id)
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);

    return res.status(201).json({
      success: true,
      booking: toClient(out || booking),
      notifiedCount: notified.length,
    });
  } catch (error) {
    if (error?.code === 11000)
      return fail(res, 409, "This payment is already used for another booking");
    console.error("createRequest error:", error);
    return fail(res, 500, "Failed to create request");
  }
};

/* ============================ GROUP: PREVIEW + JOIN ============================ */

// GET /api/bookings/invite/:code   (fresher) -> what a friend sees before paying
exports.joinPreview = async (req, res) => {
  try {
    const code = String(req.params.code || "")
      .trim()
      .toUpperCase();
    if (!code) return fail(res, 400, "Invite code is required");

    const b = await Booking.findOne({
      inviteCode: code,
      sessionMode: "group",
    }).lean();
    if (!b) return fail(res, 404, "This invite link is not valid.");

    const joined = membersOf(b).length;
    const alreadyJoined = participantUserIds(b).includes(String(req.user.id));
    const notStarted =
      new Date(b.startsAt).getTime() > Date.now() + PAYMENT_GRACE_MS;
    const statusOk = ["pending", "accepted"].includes(b.status);

    return res.json({
      success: true,
      invite: {
        requestGroupId: b.requestGroupId,
        inviteCode: code,
        hostName: b.fresherName || "Your friend",
        companyName: b.companyName,
        sessionType: b.sessionType,
        date: b.date,
        time: b.time,
        durationMinutes: b.durationMinutes,
        perPersonAmount: b.perPersonAmount || b.amount,
        maxMembers: b.maxMembers,
        joined,
        spotsLeft: Math.max(0, b.maxMembers - joined),
        status: b.status,
        alreadyJoined,
        open: statusOk && notStarted && joined < b.maxMembers,
      },
    });
  } catch (error) {
    console.error("joinPreview error:", error);
    return fail(res, 500, "Failed to load invite");
  }
};

// POST /api/bookings/join   (fresher)  { inviteCode, razorpayPaymentId }
// The friend has ALREADY paid (wallet or Razorpay). Any failure here refunds that payment.
exports.joinGroup = async (req, res) => {
  try {
    const code = String(req.body?.inviteCode || "")
      .trim()
      .toUpperCase();
    const paymentId = String(req.body?.razorpayPaymentId || "").trim();
    if (!code || !paymentId)
      return fail(res, 400, "inviteCode and paymentId required");

    const payment = await Payment.findOne({
      razorpayPaymentId: paymentId,
      status: "paid",
    });
    if (!payment) return fail(res, 402, "Payment not verified");
    if (payment.fresher && String(payment.fresher) !== String(req.user.id))
      return fail(res, 403, "This payment belongs to another account");

    if (await paymentUsed(paymentId))
      return fail(res, 409, "This payment is already used for another booking");
    const claimed = await claimPayment(
      paymentId,
      `join:${code}:${req.user.id}`,
    );
    if (!claimed)
      return fail(res, 409, "This payment is already used for another booking");

    // payment without an owner cannot be refunded to a wallet -> attach the logged-in fresher
    if (req.user?.role === "fresher" && !payment.fresher) {
      await Payment.updateOne(
        { _id: payment._id, fresher: null },
        { $set: { fresher: req.user.id } },
      ).catch(() => {});
      payment.fresher = req.user.id;
    }

    const reject = async (status, message) => {
      const result = await refundPayment(payment, message, { to: "wallet" });
      return fail(
        res,
        status,
        `${message}${result === "refunded" ? " Your payment is back in your wallet." : ""}`,
      );
    };

    const b = await Booking.findOne({ inviteCode: code, sessionMode: "group" });
    if (!b) return reject(404, "This invite link is not valid.");

    if (
      !["pending", "accepted"].includes(b.status) ||
      new Date(b.startsAt).getTime() < Date.now() + PAYMENT_GRACE_MS
    )
      return reject(409, "This group is closed.");

    if (Number(payment.amount) !== Number(b.perPersonAmount))
      return reject(400, "Payment amount does not match the group price.");

    const me = await Fresher.findById(req.user.id).select("name").lean();
    const myName = me?.name || payment.fresherName || "Fresher";

    // atomic: a free spot AND this person is not already inside
    const updated = await Booking.findOneAndUpdate(
      {
        _id: b._id,
        status: { $in: ["pending", "accepted"] },
        "participants.fresher": { $ne: req.user.id },
        $expr: { $lt: [{ $size: "$participants" }, "$maxMembers"] },
      },
      {
        $push: {
          participants: {
            fresher: req.user.id,
            name: myName,
            razorpayPaymentId: paymentId,
            amount: Number(payment.amount),
          },
        },
      },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);

    if (!updated)
      return reject(409, "The group is full or you already joined.");

    await linkPaymentToRequest({
      razorpayPaymentId: paymentId,
      requestGroupId: updated.requestGroupId,
      topic: updated.sessionType || updated.companyName,
      date: updated.date,
      time: updated.time,
      duration: updated.durationMinutes,
    });

    // mentor already accepted -> this payment belongs to him too
    if (updated.mentor) {
      await Payment.updateOne(
        { razorpayPaymentId: paymentId, status: "paid", mentor: null },
        { $set: { mentor: updated.mentor._id, sessionStatus: "upcoming" } },
      ).catch(() => {});
      emitToUser(updated.mentor._id, "wallet:updated", {
        requestGroupId: updated.requestGroupId,
      });
    }

    const count = membersOf(updated).length;
    if (updated.fresher) {
      notify({
        user: updated.fresher,
        role: "fresher",
        title: "A friend joined your group",
        message: `${myName} joined (${count}/${updated.maxMembers}).`,
        type: "session",
        link: "/Home/my-bookings",
      });
    }
    if (updated.mentor) {
      notify({
        user: updated.mentor._id,
        role: "mentor",
        title: "Group member joined",
        message: `${myName} joined the group session (${count}/${updated.maxMembers}).`,
        type: "session",
        link: "/mentor/sessions",
      });
    }
    emitBooking(updated);

    return res.json({ success: true, booking: toClient(updated) });
  } catch (error) {
    if (error?.code === 11000)
      return fail(res, 409, "This payment is already used for another booking");
    console.error("joinGroup error:", error);
    return fail(res, 500, "Failed to join the group");
  }
};

/* ============================ ACCEPT / REJECT ============================ */

exports.updateRequest = async (req, res) => {
  try {
    optionalAuth(req, null, () => {});
    const requestGroupId = String(
      req.params.requestGroupId || req.params.id || "",
    ).trim();
    const status = String(req.body?.status || "")
      .trim()
      .toLowerCase();

    if (req.user?.role !== "mentor")
      return fail(res, 401, "Mentor login required");
    const mentorId = req.user.id;

    if (!["accepted", "rejected"].includes(status))
      return fail(res, 400, "Status must be accepted/rejected");

    const booking = await Booking.findOne({ requestGroupId });
    if (!booking) return fail(res, 404, "Request not found");

    const isDirect = Boolean(booking.preferredMentor);
    if (isDirect && String(booking.preferredMentor) !== String(mentorId)) {
      return fail(res, 403, "This request is for another mentor");
    }

    if (
      !isDirect &&
      !(booking.notified || []).map(String).includes(String(mentorId))
    ) {
      const mentor = await Mentor.findById(mentorId)
        .select(MENTOR_FIELDS)
        .lean();
      if (!mentor || whyNot(mentor, booking))
        return fail(res, 403, "This request was not sent to you");
    }

    if (status === "rejected") {
      await Booking.updateOne(
        { _id: booking._id },
        { $addToSet: { declinedBy: mentorId } },
      );
      if (isDirect && booking.status === "pending") {
        await expireAndRefund(
          booking._id,
          "The mentor you selected is not available for this slot.",
        );
      }
      return res.json({ success: true, status: "rejected" });
    }

    if (booking.status !== "pending" || booking.expiresAt <= new Date())
      return fail(res, 409, "Request unavailable");

    if (
      await hasConflict(
        mentorId,
        booking.startsAt,
        booking.endsAt,
        requestGroupId,
      )
    ) {
      return fail(res, 409, "You have another session near this time");
    }

    const accepted = await Booking.findOneAndUpdate(
      { requestGroupId, status: "pending" },
      {
        $set: { status: "accepted", mentor: mentorId, acceptedAt: new Date() },
      },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);

    if (!accepted) return fail(res, 409, "Already accepted");

    await assignMentorToAll(accepted, mentorId);

    emitBooking(accepted);

    (accepted.notified || [])
      .filter((id) => String(id) !== String(mentorId))
      .forEach((id) =>
        emitToMentorSockets(req.app, id, "session-request-taken", {
          id: accepted.requestGroupId,
          requestGroupId: accepted.requestGroupId,
        }),
      );

    await withdrawOverlapping(req.app, mentorId, accepted);

    return res.json({
      success: true,
      status: "accepted",
      booking: toClient(accepted),
    });
  } catch (error) {
    console.error("updateRequest error:", error);
    return fail(res, 500, "Failed to update");
  }
};

exports.respondToRequest = exports.updateRequest;

/* ============================ READ ============================ */

exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({
      requestGroupId: String(req.params.requestGroupId || ""),
    })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    return res.json({
      success: true,
      request: toClient(b),
      booking: toClient(b),
    });
  } catch (error) {
    return fail(res, 500, "Failed to load request");
  }
};

exports.getAcceptedBookings = async (req, res) => {
  try {
    const email = norm(req.query.email);
    if (!email) return fail(res, 400, "Email is required");
    const list = await Booking.find({
      fresherEmail: email,
      status: { $in: ["accepted", "in_progress", "completed"] },
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ startsAt: -1 });
    const bookings = list.map((b) => ({
      ...toClient(b),
      bookingId: b.requestGroupId,
      mentorName: b.mentor?.name || "Mentor",
    }));
    return res.json({ success: true, bookings, count: bookings.length });
  } catch (error) {
    return fail(res, 500, "Failed to fetch bookings");
  }
};

// bookings I created (host) + group bookings I joined (friend)
exports.myBookings = async (req, res) => {
  try {
    const list = await Booking.find({
      $or: [{ fresher: req.user.id }, { "participants.fresher": req.user.id }],
    })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR)
      .sort({ startsAt: -1 });
    return res.json({ success: true, bookings: list.map((b) => toClient(b)) });
  } catch (error) {
    return fail(res, 500, "Failed to load bookings");
  }
};

exports.needsReview = async (req, res) => {
  try {
    const b = await Booking.findOne({
      fresher: req.user.id,
      status: "completed",
      reviewed: false,
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ completedAt: 1 });
    return res.json({ success: true, booking: b ? toClient(b) : null });
  } catch (error) {
    return fail(res, 500, "Failed to check reviews");
  }
};

exports.getBooking = async (req, res) => {
  try {
    const b = await Booking.findOne({ requestGroupId: String(req.params.id) })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");
    const mine =
      participantUserIds(b).includes(String(req.user.id)) ||
      String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "Access denied");
    return res.json({ success: true, booking: toClient(b) });
  } catch (error) {
    return fail(res, 500, "Failed to load booking");
  }
};

exports.getCounterpart = async (req, res) => {
  try {
    const b = await Booking.findOne({
      requestGroupId: String(req.params.id || "").trim(),
    }).lean();
    if (!b) return fail(res, 404, "Booking not found");

    const me = String(req.user?.id || "");
    const isFresher = participantUserIds(b).includes(me);
    const isMentor = Boolean(b.mentor) && String(b.mentor) === me;
    if (!isFresher && !isMentor) return fail(res, 403, "Access denied");

    const session = {
      sessionType: b.sessionType || "",
      reason: b.reason || "",
      date: b.date || "",
      time: b.time || "",
      durationMinutes: b.durationMinutes,
      language: b.language || "",
      role: b.role || "",
      companyName: b.companyName || "",
      mode: b.sessionMode || "single",
      maxMembers: b.maxMembers || 1,
      members: membersOf(b).map((m) => m.name || "Fresher"),
    };

    if (isFresher) {
      if (!b.mentor)
        return fail(res, 404, "No employee has accepted this booking yet.");

      const m = await Mentor.findById(b.mentor)
        .select(MENTOR_PUBLIC_FIELDS)
        .lean();
      if (!m) return fail(res, 404, "Employee not found");

      // rating + reviews + sessions (calculated live, no schema fields needed)
      const [byStar, recent, completedCount] = await Promise.all([
        Review.aggregate([
          { $match: { mentor: m._id } },
          { $group: { _id: "$rating", count: { $sum: 1 } } },
        ]),
        Review.find({ mentor: m._id })
          .sort({ createdAt: -1 })
          .limit(20)
          .select(
            "fresherName fresherRole session rating comment reply createdAt",
          )
          .lean(),
        Booking.countDocuments({ mentor: m._id, status: "completed" }),
      ]);

      const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let reviewCount = 0;
      let ratingSum = 0;
      byStar.forEach(({ _id, count }) => {
        if (ratingBreakdown[_id] === undefined) return;
        ratingBreakdown[_id] = count;
        reviewCount += count;
        ratingSum += _id * count;
      });
      const rating = reviewCount
        ? Math.round((ratingSum / reviewCount) * 10) / 10
        : 0;

      return res.json({
        success: true,
        kind: "mentor",
        person: {
          id: String(m._id),
          name: m.name || "",
          email: m.email || "",
          image: m.profilePic || "",
          gender: m.gender || "",
          company: m.currentCompany || "",
          designation: m.designation || "",
          department: m.department || "",
          officeLocation: m.officeLocation || "",
          yearsOfExperience: m.yearsOfExperience || 0,
          languages: m.languages || [],
          skills: m.skills || [],
          bio: m.bio || "",
          linkedinProfile: m.linkedinProfile || "",
          isVerified: Boolean(m.isVerified),

          rating,
          reviewCount,
          totalReviews: reviewCount,
          ratingBreakdown,
          totalSessions: completedCount,
          reviews: recent.map((r) => ({
            id: String(r._id),
            name: r.fresherName || "Fresher",
            role: r.fresherRole || "Fresher",
            rating: r.rating,
            comment: r.comment || "",
            session: r.session || "Mentoring session",
            reply: r.reply?.text || "",
            createdAt: r.createdAt,
          })),
        },
        session,
      });
    }

    // mentor side: host + (group) every other fresher
    const ids = participantUserIds(b);
    const freshers = await Fresher.find({ _id: { $in: ids } })
      .select("name email gender profilePic")
      .lean();

    const people = ids
      .map((id) => {
        const f = freshers.find((x) => String(x._id) === id);
        const part = (b.participants || []).find(
          (p) => String(p.fresher) === id,
        );
        return {
          id,
          name: f?.name || part?.name || "Fresher",
          email: f?.email || "",
          image: f?.profilePic || "",
          gender: f?.gender || "",
          isHost: String(b.fresher) === id,
        };
      })
      .sort((a, z) => Number(z.isHost) - Number(a.isHost)); // host first

    const host = people.find((p) => p.isHost) || people[0] || {};

    return res.json({
      success: true,
      kind: "fresher",
      person: {
        id: host.id || "",
        name: host.name || b.fresherName || "Fresher",
        email: host.email || b.fresherEmail || "",
        image: host.image || b.fresherImage || "",
        gender: host.gender || b.gender || "",
      },
      people, // used by the group details modal
      session,
    });
  } catch (error) {
    console.error("getCounterpart error:", error);
    return fail(res, 500, "Failed to load details");
  }
};

exports.mentorPending = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.user.id)
      .select(`${MENTOR_FIELDS} verificationStatus accountStatus`)
      .lean();
    if (
      !mentor ||
      mentor.verificationStatus !== "approved" ||
      mentor.accountStatus !== "active"
    )
      return res.json({ success: true, requests: [] });

    const list = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
      $or: [
        { preferredMentor: null },
        { preferredMentor: { $exists: false } },
        { preferredMentor: mentor._id },
      ],
    }).sort({ createdAt: -1 });

    const free = [];
    for (const b of list) {
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId))
        continue;
      const reason = b.preferredMentor ? "" : whyNot(mentor, b);
      if (reason) {
        console.log(
          `[mentorPending] ${mentor.name} skip ${b.requestGroupId}: ${reason}`,
        );
        continue;
      }
      if (!(b.notified || []).map(String).includes(String(mentor._id)))
        await Booking.updateOne(
          { _id: b._id },
          { $addToSet: { notified: mentor._id } },
        );
      free.push(b);
    }

    return res.json({ success: true, requests: free.map(toMentorPayload) });
  } catch (error) {
    console.error("mentorPending error:", error);
    return fail(res, 500, "Failed to load requests");
  }
};

/* ============================ COMPLETION ============================ */

const pushTimerOff = (b) => {
  const payload = {
    requestGroupId: b.requestGroupId,
    running: false,
    remainingMs: 0,
  };
  participantUserIds(b).forEach((id) =>
    emitToUser(id, "meeting:timer", payload),
  );
  if (b.mentor) emitToUser(b.mentor._id || b.mentor, "meeting:timer", payload);
};

const settleCompleted = async (booking, { auto = false } = {}) => {
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: { $in: ["awaiting_confirmation", "in_progress", "accepted"] },
    },
    {
      $set: {
        status: "completed",
        completedAt: now,
        "meeting.remainingMs": 0,
        "meeting.endedAt": now,
      },
    },
    { returnDocument: "after" },
  ).populate("mentor", POPULATE_MENTOR);
  if (!updated) return null;

  // ALL paid members of the booking (group = several payments)
  const paymentFilter = {
    status: "paid",
    $or: [
      { requestGroupId: updated.requestGroupId },
      { razorpayPaymentId: { $in: paymentIdsOf(updated) } },
    ],
  };

  const paidList = await Payment.find(paymentFilter)
    .select("mentorEarning")
    .lean();

  await Payment.updateMany(paymentFilter, {
    $set: {
      sessionStatus: "completed",
      releasedAt: now,
      ...(updated.mentor ? { mentor: updated.mentor._id } : {}),
    },
  });

  const mentorShare = paidList.length
    ? paidList.reduce((sum, p) => sum + (Number(p.mentorEarning) || 0), 0)
    : splitAmount(
        Number(updated.amount || 0) * membersOf(updated).length,
        PLATFORM_FEE_PERCENT,
      ).earning;

  if (updated.mentor) {
    await Mentor.updateOne(
      { _id: updated.mentor._id },
      { $inc: { totalSessions: 1 } },
    );
    notify({
      user: updated.mentor._id,
      role: "mentor",
      title: "Session confirmed & Paid",
      message: auto
        ? `The session was auto-confirmed. ₹${mentorShare} added to your wallet.`
        : `Fresher confirmed the session. ₹${mentorShare} added to your wallet.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(updated.mentor._id, "wallet:updated", {
      requestGroupId: updated.requestGroupId,
    });
    emitToUser(updated.mentor._id, "booking:updated", toClient(updated));
  }

  if (auto && updated.fresher) {
    notify({
      user: updated.fresher,
      role: "fresher",
      title: "Session auto-confirmed",
      message:
        "You did not confirm the session in time, so it was marked as completed.",
      type: "session",
      link: "/Home/my-bookings",
    });
  }

  emitBooking(updated);
  pushTimerOff(updated);
  return updated;
};

const completeBooking = async (requestGroupId) => {
  const pre = await Booking.findOne({
    requestGroupId,
    status: { $in: ["accepted", "in_progress"] },
  });
  if (!pre) return null;

  if (pre.meeting?.fresherConfirmed) return settleCompleted(pre);

  const b = await Booking.findOneAndUpdate(
    { requestGroupId, status: { $in: ["accepted", "in_progress"] } },
    {
      $set: {
        status: "awaiting_confirmation",
        "meeting.remainingMs": 0,
        "meeting.endedAt": new Date(),
      },
    },
    { returnDocument: "after" },
  ).populate("mentor", POPULATE_MENTOR);
  if (!b) return null;

  // only the HOST confirms the payment release (friends just get "session ended")
  notify({
    user: b.fresher,
    role: "fresher",
    title: "Session ended",
    message: "Did the session go well? Please confirm to release payment.",
    type: "session",
    link: `/Home/meeting/${b.requestGroupId}`,
  });
  participantUserIds(b)
    .filter((id) => id !== String(b.fresher))
    .forEach((id) =>
      notify({
        user: id,
        role: "fresher",
        title: "Session ended",
        message: "Your group session has ended. The host will confirm it.",
        type: "session",
        link: "/Home/my-bookings",
      }),
    );

  emitBooking(b);
  pushTimerOff(b);
  return b;
};

exports.completeBooking = completeBooking;

exports.confirmCompletion = async (req, res) => {
  try {
    const requestGroupId = String(req.params.requestGroupId || "").trim();
    const accepted = Boolean(req.body?.accepted);

    const booking = await Booking.findOne({ requestGroupId }).populate(
      "mentor",
      POPULATE_MENTOR,
    );
    if (!booking) return fail(res, 404, "Session not found");
    // group: only the host confirms
    if (String(booking.fresher) !== req.user.id)
      return fail(res, 403, "Access denied");

    if (booking.status === "completed")
      return res.json({
        success: true,
        status: "completed",
        booking: toClient(booking),
      });
    if (booking.status === "disputed")
      return res.json({
        success: true,
        status: "disputed",
        booking: toClient(booking),
      });
    if (booking.status !== "awaiting_confirmation")
      return fail(res, 400, "This session is not awaiting confirmation.");

    if (accepted) {
      const updated = await settleCompleted(booking);
      if (!updated) return fail(res, 409, "Session already updated");
      return res.json({
        success: true,
        status: "completed",
        booking: toClient(updated),
      });
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      { $set: { status: "disputed", completedAt: new Date() } },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);
    if (!updated) return fail(res, 409, "Session already updated");

    // refund EVERY member to their wallet
    const { result, payments } = await refundAll(
      booking,
      "Fresher marked the session as not complete",
      { to: "wallet" },
    );
    await Booking.updateOne(
      { _id: updated._id },
      { $set: { refundStatus: result } },
    );
    updated.refundStatus = result;

    for (const mem of membersOf(updated)) {
      if (!mem.fresher) continue;
      const pay = payments.find(
        (p) => p.razorpayPaymentId === mem.razorpayPaymentId,
      );
      const amt =
        pay && Number(pay.refundAmount) > 0
          ? pay.refundAmount
          : mem.amount || updated.amount;
      notify({
        user: mem.fresher,
        role: "fresher",
        title:
          result === "refunded"
            ? "Refund added to wallet"
            : "Refund is processing",
        message:
          result === "refunded"
            ? `₹${amt} was added back to your wallet.`
            : "We could not add the refund yet. We will retry automatically.",
        type: "payment",
        link: "/Home/wallet",
      });
      emitToUser(mem.fresher, "wallet:updated", { amount: amt });
    }
    void payments;

    emitBooking(updated);
    return res.json({
      success: true,
      status: "disputed",
      booking: toClient(updated),
    });
  } catch (error) {
    console.error("confirmCompletion error:", error);
    return fail(res, 500, "Unable to confirm session");
  }
};

/* ============================ FRESHER NOTIFICATIONS ============================ */

exports.getFresherNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const filter = { user: req.user.id, role: "fresher" };
    const [items, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    return res.json({
      success: true,
      notifications: items.map(serializeNotification),
      unreadCount,
    });
  } catch (error) {
    return fail(res, 500, "Unable to load notifications.");
  }
};

exports.markFresherNotificationRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return fail(res, 400, "Invalid id.");
    await Notification.updateOne(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notification.");
  }
};

exports.markAllFresherNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, role: "fresher", read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    return fail(res, 500, "Unable to update notifications.");
  }
};

/* ============================ SCHEDULERS ============================ */
let schedulerBusy = false;
let lastReconcileAt = 0; // <-- add this

exports.startSchedulers = (app) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    if (schedulerBusy) return;
    schedulerBusy = true;

    try {
      const now = new Date();

      // 1) AUTO-CANCEL (refunds EVERY member of a group)
      const stale = await Booking.find({
        status: "pending",
        expiresAt: { $lte: now },
      }).select("_id");
      for (const b of stale) {
        const closed = await expireAndRefund(
          b._id,
          `No employee accepted your request ${PENDING_CUTOFF_MIN} minutes before the session, so it was cancelled automatically.`,
        );

        if (closed) {
          (closed.notified || []).forEach((mentorId) =>
            emitToMentorSockets(app, mentorId, "session-request-taken", {
              id: closed.requestGroupId,
              requestGroupId: closed.requestGroupId,
            }),
          );
        }
      }

      // 2) NO-SHOW
      const noShows = await Booking.find({
        status: "accepted",
        startsAt: { $lte: new Date(now.getTime() - NO_SHOW_GRACE_MS) },
        "meeting.timerEndsAt": null,
      }).select("_id");
      for (const b of noShows) {
        await closeAndRefund(b._id, {
          from: ["accepted"],
          to: "missed",
          title: "Session missed",
          reason:
            "The session did not start because both of you did not join in time.",
          mentorNote:
            "The session did not start in time, so it was marked as missed and the fresher was refunded.",
        });
      }

      // 3) fresher never answered "did it go well?"
      const unconfirmed = await Booking.find({
        status: "awaiting_confirmation",
        "meeting.endedAt": { $lte: new Date(now.getTime() - CONFIRM_WAIT_MS) },
      }).select("_id");
      for (const b of unconfirmed) {
        if (UNCONFIRMED_ACTION === "refund") {
          await closeAndRefund(b._id, {
            from: ["awaiting_confirmation"],
            to: "cancelled",
            title: "Session not confirmed",
            reason: "The session was not confirmed in time.",
          });
        } else {
          const full = await Booking.findById(b._id);
          if (full) await settleCompleted(full, { auto: true });
        }
      }

      // 4) retry failed refunds (all members)
      const failedRefunds = await Booking.find({
        status: { $in: ["expired", "missed", "cancelled", "disputed"] },
        refundStatus: "failed",
        razorpayPaymentId: { $ne: "" },
        refundAttempts: { $not: { $gte: MAX_REFUND_ATTEMPTS } },
        $or: [
          { lastRefundAttemptAt: null },
          {
            lastRefundAttemptAt: {
              $lte: new Date(now.getTime() - REFUND_RETRY_GAP_MS),
            },
          },
        ],
      }).limit(10);

      for (const b of failedRefunds) {
        await Booking.updateOne(
          { _id: b._id },
          {
            $inc: { refundAttempts: 1 },
            $set: { lastRefundAttemptAt: new Date() },
          },
        );

        const { result } = await refundAll(b, "Retry: session refund", {
          to: undefined, // uses REFUND_DESTINATION (wallet by default)
        });

        if (result === "refunded") {
          await Booking.updateOne(
            { _id: b._id },
            { $set: { refundStatus: "refunded" } },
          );
          for (const mem of membersOf(b)) {
            if (!mem.fresher) continue;
            notify({
              user: mem.fresher,
              role: "fresher",
              title: "Refund completed",
              message: `Your refund of ₹${mem.amount || b.amount} has been processed.`,
              type: "payment",
              link: "/Home",
            });
            emitToUser(mem.fresher, "booking:updated", {
              requestGroupId: b.requestGroupId,
              refundStatus: "refunded",
            });
          }
        }
      }

      // 5) overdue running timers
      const overdue = await Booking.find({
        status: "in_progress",
        "meeting.timerEndsAt": { $lte: now },
      }).select("requestGroupId");
      for (const b of overdue) await completeBooking(b.requestGroupId);

      // 6) reminders
      const soon = await Booking.find({
        status: "accepted",
        reminderSent: false,
        startsAt: { $lte: new Date(now.getTime() + OPEN_BEFORE_MS) },
      });
      for (const b of soon)
        await Booking.updateOne(
          { _id: b._id },
          { $set: { reminderSent: true } },
        );

      // 7) money was taken (wallet OR Razorpay) but the booking / group join never happened -> give it back
      const orphanPaid = await Payment.find({
        status: "paid",
        sessionStatus: "unassigned",
        $or: [
          {
            method: "wallet",
            paidAt: { $lte: new Date(now.getTime() - 10 * 60 * 1000) },
          },
          {
            method: { $ne: "wallet" },
            paidAt: { $lte: new Date(now.getTime() - 30 * 60 * 1000) },
          },
        ],
      }).limit(20);

      for (const p of orphanPaid) {
        if (await paymentUsed(p.razorpayPaymentId)) continue;

        const viaWallet = isWalletPayment(p);
        const result = await refundPayment(p, "Booking was not created", {});
        if (result === "refunded" && p.fresher) {
          const done = await Payment.findById(p._id)
            .select("refundMethod refundAmount")
            .lean();
          const toWallet = done?.refundMethod === "wallet";
          const amt = done?.refundAmount || p.amount;
          notify({
            user: p.fresher,
            role: "fresher",
            title: toWallet ? "Wallet refund" : "Payment refunded",
            message: toWallet
              ? `₹${amt} was added back to your wallet because the booking was not completed.`
              : `₹${amt} is being refunded to your payment method because the booking was not completed.`,
            type: "payment",
            link: toWallet ? "/Home/bonus-wallet" : "/Home",
          });
        }
      }

      // 8) Razorpay money captured but verify never reached us / abandoned or failed checkouts (every 5 min)
      if (Date.now() - lastReconcileAt > 5 * 60 * 1000) {
        lastReconcileAt = Date.now();
        await reconcileStaleOrders();
      }
    } catch (e) {
      console.error("scheduler error:", e);
    } finally {
      schedulerBusy = false;
    }
  }, 15000);
};

exports.pushPendingToMentor = async (app, mentorId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(mentorId)) return;

    const mentor = await Mentor.findById(mentorId)
      .select(`${MENTOR_FIELDS} verificationStatus accountStatus`)
      .lean();
    if (
      !mentor ||
      mentor.verificationStatus !== "approved" ||
      mentor.accountStatus !== "active"
    )
      return;

    const open = await Booking.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      declinedBy: { $ne: mentor._id },
      $or: [
        { preferredMentor: null },
        { preferredMentor: { $exists: false } },
        { preferredMentor: mentor._id },
      ],
    });

    for (const b of open) {
      if (await hasConflict(mentor._id, b.startsAt, b.endsAt, b.requestGroupId))
        continue;

      const reason = b.preferredMentor ? "" : whyNot(mentor, b);
      if (reason) {
        console.log(
          `[pushPending] ${mentor.name} skip ${b.requestGroupId}: ${reason}`,
        );
        continue;
      }

      await Booking.updateOne(
        { _id: b._id },
        { $addToSet: { notified: mentor._id } },
      );
      emitToMentorSockets(
        app,
        mentor._id,
        "session-request",
        toMentorPayload(b),
      );
    }
  } catch (error) {
    console.error("pushPendingToMentor error:", error.message);
  }
};

exports.whyNot = whyNot;
exports.participantUserIds = participantUserIds;

/* ============================ GROUP VIDEO TOKEN (LiveKit) ============================ */
// POST /api/bookings/:id/livekit-token   (fresher member OR the accepted mentor)
// Group meetings (up to 60 people) run on LiveKit (SFU). P2P cannot handle that many.
// Only people who PAID and joined (or the mentor who accepted) get a token,
// so the link alone never lets a stranger in, and the seat limit (maxMembers) is enforced at join time.
exports.livekitToken = async (req, res) => {
  try {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET)
      return fail(
        res,
        500,
        "Group video is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing).",
      );

    const b = await Booking.findOne({
      requestGroupId: String(req.params.id || "").trim(),
    }).lean();
    if (!b) return fail(res, 404, "Booking not found");
    if (b.sessionMode !== "group")
      return fail(res, 400, "This is not a group session");

    const me = String(req.user.id);
    const isMentor =
      req.user.role === "mentor" && b.mentor && String(b.mentor) === me;
    const isMember =
      req.user.role === "fresher" && participantUserIds(b).includes(me);
    if (!isMentor && !isMember) return fail(res, 403, "Access denied");

    if (!["accepted", "in_progress"].includes(b.status))
      return fail(res, 409, "This session is not active");
    // livekitToken
    if (Date.now() < new Date(b.startsAt).getTime() - TOKEN_OPEN_BEFORE_MS)
      return fail(res, 409, "The meeting room is not open yet");

    let name = "Guest";
    if (isMentor) {
      const m = await Mentor.findById(me).select("name").lean();
      name = m?.name || "Employee";
    } else {
      const mem = (b.participants || []).find((p) => String(p.fresher) === me);
      const f = await Fresher.findById(me).select("name").lean();
      name = f?.name || mem?.name || "Fresher";
    }

    const { AccessToken } = require("livekit-server-sdk");
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `${isMentor ? "mentor" : "fresher"}:${me}`,
      name,
      ttl: "5h",
    });
    at.addGrant({
      roomJoin: true,
      room: b.requestGroupId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    const token = await at.toJwt();
    return res.json({ success: true, token, url: LIVEKIT_URL });
  } catch (error) {
    console.error("livekitToken error:", error);
    return fail(res, 500, "Could not create the meeting token");
  }
};
