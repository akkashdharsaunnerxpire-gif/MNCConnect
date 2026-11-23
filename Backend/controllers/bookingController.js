// controllers/bookingController.js
// SINGLE + GROUP sessions.
//   single : 1 fresher pays RATE_PER_HOUR            (Rs 350 / hour)
//   group  : host creates the booking (pays own share), friends join with an invite code
//            and EACH pays GROUP_RATE_PER_HOUR       (Rs 99 / hour / person)
//
// RULES IN THIS VERSION
//   1. GROUP MINIMUM  : a group needs at least GROUP_MIN_MEMBERS (default 2) paid members
//                       GROUP_FILL_CUTOFF_MIN (default 15) minutes before the start.
//                       Not filled -> group cancelled, everybody refunded to the wallet.
//                       With 2 or more members the session runs normally.
//   2. DISPUTE HOLD   : fresher clicks "session not complete" -> money is held, admin decides.
//                       If admin does nothing for DISPUTE_REVIEW_HOURS the decision is made
//                       from PRESENCE + run time + the fresher's dispute history (autoDecisionFor).
//   3. FRESHER NO-SHOW: employee joined, fresher did not -> no-show fee (default 50%) to the employee.
//   4. EMPLOYEE NO-SHOW: fresher joined, employee did not -> FULL refund + strike
//                       (3 strikes = warning, 5 strikes = account suspended).
//   5. PRESENCE       : stamped ONLY by the LiveKit webhook (participant_joined), never by taking a token.
//
// SECURITY: email / phone / linkedin of one side is NEVER sent to the other side.
// REFUND SAFETY: closeAndRefund locks the booking ("pending") BEFORE refunding; the scheduler retries.
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Review = require("../models/Review");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const { sendMail, sessionEmail } = require("../utils/mailer");
const {
  expectedPrice,
  MAX_GROUP,
  RATE_PER_HOUR,
  GROUP_RATE_PER_HOUR,
} = require("../utils/sessionPrice");
const { creditWallet } = require("../utils/walletLedger");
const { sendSessionWhatsApp } = require("../utils/whatsapp");
const SITE_URL = (
  process.env.SITE_URL || "https://mncconnect.onrender.com"
).replace(/\/$/, "");
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
  claimPayment,
  reconcileStaleOrders,
} = require("./paymentController");
const { checkoutOf, toPaise, round2 } = require("../utils/pricing");

/* ============================ CONFIG ============================ */

// reads a number from .env, but a real 0 stays 0 (Number(x) || default would turn 0 into default)
const envNum = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
};

// What a fresher may see about a mentor. NO email, NO phone, NO linkedin.
const MENTOR_PUBLIC_FIELDS =
  "name profilePic currentCompany designation department officeLocation yearsOfExperience languages skills bio gender isVerified";

const PAYMENT_GRACE_MS = envNum("PAYMENT_GRACE_SEC", 60) * 1000;

const GAP_MS = 30 * 60 * 1000;
const OPEN_BEFORE_MS = 5 * 60 * 1000;
const PLATFORM_FEE_PERCENT = envNum("PLATFORM_FEE_PERCENT", 25);

const PENDING_CUTOFF_MIN = envNum("PENDING_CUTOFF_MIN", 10) || 10;
const PENDING_CUTOFF_MS = PENDING_CUTOFF_MIN * 60 * 1000;
const MIN_WAIT_MS = 2 * 60 * 1000;

const expiryFor = (startsAt) => {
  const start = new Date(startsAt).getTime();
  const ideal = start - PENDING_CUTOFF_MS;
  const floor = Date.now() + MIN_WAIT_MS;
  return new Date(Math.min(start - 30 * 1000, Math.max(ideal, floor)));
};

// refund retry: every 5 min, up to 50 times (~4 hours)
const MAX_REFUND_ATTEMPTS = 50;
const REFUND_RETRY_GAP_MS = 5 * 60 * 1000;
// a freshly closed booking is left alone this long before the scheduler retries it
const REFUND_RETRY_AFTER_CLOSE_MS = 2 * 60 * 1000;

// scheduler watchdog: a run that hangs longer than this is released
const SCHEDULER_STUCK_MS = 3 * 60 * 1000;

const NO_SHOW_GRACE_MS = envNum("NO_SHOW_GRACE_MIN", 15) * 60 * 1000;

// fresher did not join but the employee did: this % of the session price is kept
// (goes to the employee after the platform cut). 0 = always full refund, 100 = no refund.
const FRESHER_NOSHOW_FEE_PERCENT = Math.min(
  100,
  Math.max(0, envNum("FRESHER_NOSHOW_FEE_PERCENT", 50)),
);

const CONFIRM_WAIT_MS = envNum("CONFIRM_WAIT_HOURS", 24) * 60 * 60 * 1000;
const UNCONFIRMED_ACTION =
  process.env.UNCONFIRMED_ACTION === "refund" ? "refund" : "release";

// DISPUTE: money is held until the admin decides. After this time the auto decision runs.
const DISPUTE_REVIEW_MS = envNum("DISPUTE_REVIEW_HOURS", 72) * 60 * 60 * 1000;
const DISPUTE_DEFAULT_DECISION =
  process.env.DISPUTE_DEFAULT_DECISION === "release" ? "release" : "refund";

// session ran at least this % of its length with both sides present -> release
const DISPUTE_MIN_RUN_PERCENT = envNum("DISPUTE_MIN_RUN_PERCENT", 60);
// a fresher with this many disputes is "flagged"
const DISPUTE_FLAG_COUNT = envNum("DISPUTE_FLAG_COUNT", 3);

// GROUP: minimum paid members (2 = host + 1 friend) and when it is checked
const GROUP_MIN_MEMBERS = Math.max(2, envNum("GROUP_MIN_MEMBERS", 2));
const GROUP_FILL_CUTOFF_MS = envNum("GROUP_FILL_CUTOFF_MIN", 15) * 60 * 1000;

// employee strikes
const STRIKE_WARN = envNum("MENTOR_STRIKE_WARN", 3);
const STRIKE_SUSPEND = envNum("MENTOR_STRIKE_SUSPEND", 5);

// closed (expired / missed / cancelled) + refunded bookings are deleted after this
const CLOSED_RETENTION_MS =
  envNum("CLOSED_RETENTION_HOURS", 24) * 60 * 60 * 1000;

// What the dispute timeout does with a dispute nobody reviewed.
// Presence comes from the LiveKit webhook only (cannot be faked by taking a token).
const autoDecisionFor = (b, disputeCount = 0) => {
  const mentorHere = Boolean(b.mentorJoinedAt);
  const fresherHere = Boolean(b.fresherJoinedAt);

  // the employee never really joined -> the fresher is right
  if (!mentorHere) return "refund";

  // both were in the room and the timer ran most of the session -> not a real problem
  const start = b.meeting?.startedAt;
  const end = b.meeting?.endedAt;
  if (mentorHere && fresherHere && start && end) {
    const ranMin =
      (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (ranMin >= (Number(b.durationMinutes) * DISPUTE_MIN_RUN_PERCENT) / 100)
      return "release";
  }

  // repeat reporter and the employee was present -> release
  if (disputeCount >= DISPUTE_FLAG_COUNT) return "release";

  return DISPUTE_DEFAULT_DECISION;
};

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

// used for matching on the SERVER only (never sent to the client as is)
const MENTOR_FIELDS =
  "name email profilePic currentCompany designation department gender languages spokenLanguages skills expertise";

// SECURITY: email removed. This is what gets populated into booking.mentor
// and therefore what reaches the fresher in every booking API / socket event.
const POPULATE_MENTOR = "name profilePic currentCompany designation";

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

/* ---------- email + WhatsApp to the people in a booking ---------- */
// NOTE: these are sent SERVER-SIDE. Contact details are read here, used to send
// the message, and are never returned to any client.

const CONTACT_FIELDS =
  "name email phone mobile phoneNumber whatsappNumber whatsapp mobileNumber contactNumber contact";

const pickPhone = (d) =>
  d &&
  (d.whatsappNumber ||
    d.whatsapp ||
    d.phone ||
    d.mobile ||
    d.phoneNumber ||
    d.mobileNumber ||
    d.contactNumber ||
    d.contact);

// kind: "booked" | "reminder".  opts.only = one fresher id, opts.skipMentor = true
const emailBookingParties = async (b, kind = "booked", opts = {}) => {
  try {
    const ids = opts.only ? [String(opts.only)] : participantUserIds(b);

    const freshers = await Fresher.find({ _id: { $in: ids } })
      .select(CONTACT_FIELDS)
      .lean();

    const mentorDoc = b.mentor
      ? await Mentor.findById(b.mentor._id || b.mentor)
          .select(CONTACT_FIELDS)
          .lean()
      : null;

    const base = {
      kind,
      companyName: b.companyName,
      sessionType: b.sessionType,
      date: b.date,
      time: b.time,
      durationMinutes: b.durationMinutes,
      isGroup: isGroup(b),
    };

    const jobs = [];

    for (const f of freshers) {
      const meetingUrl = `${SITE_URL}/Home/meeting/${b.requestGroupId}`;

      if (f.email) {
        jobs.push(
          sendMail({
            to: f.email,
            toName: f.name,
            ...sessionEmail({
              ...base,
              name: f.name,
              role: "fresher",
              otherName: mentorDoc?.name || "",
              meetingUrl,
            }),
          }),
        );
      }

      const fresherPhone = pickPhone(f);

      if (fresherPhone) {
        jobs.push(
          sendSessionWhatsApp({
            kind,
            to: fresherPhone,
            name: f.name,
            date: b.date,
            time: b.time,
            meetingUrl,
          }),
        );
      } else {
        console.warn(
          `WhatsApp skipped: fresher ${f.name || f._id} has no phone number saved`,
        );
      }
    }

    if (!opts.skipMentor && mentorDoc) {
      const meetingUrl = `${SITE_URL}/mentor/meeting/${b.requestGroupId}`;

      if (mentorDoc.email) {
        jobs.push(
          sendMail({
            to: mentorDoc.email,
            toName: mentorDoc.name,
            ...sessionEmail({
              ...base,
              name: mentorDoc.name,
              role: "mentor",
              otherName: isGroup(b)
                ? `${membersOf(b).length} freshers`
                : b.fresherName,
              meetingUrl,
            }),
          }),
        );
      }

      const mentorPhone = pickPhone(mentorDoc);

      if (mentorPhone) {
        jobs.push(
          sendSessionWhatsApp({
            kind,
            to: mentorPhone,
            name: mentorDoc.name,
            date: b.date,
            time: b.time,
            meetingUrl,
          }),
        );
      } else {
        console.warn(
          `WhatsApp skipped: mentor ${mentorDoc.name || mentorDoc._id} has no phone number saved`,
        );
      }
    }

    const results = await Promise.allSettled(jobs);

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Notification error:", result.reason?.message);
      } else if (result.value?.success === false) {
        console.error(
          "Email/WhatsApp notification failed:",
          result.value.error,
        );
      }
    });
  } catch (e) {
    console.error("emailBookingParties:", e.message);
  }
};

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

// what the MENTOR sees about a request. SECURITY: no fresher email.
const toMentorPayload = (b) => ({
  id: b.requestGroupId,
  requestGroupId: b.requestGroupId,
  name: b.fresherName || "Fresher",
  avatar: b.fresherImage || "",
  requester: {
    fullName: b.fresherName,
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

// what the FRESHER sees about a mentor. SECURITY: no email.
const mentorCard = (m) =>
  m && typeof m === "object" && m.name
    ? {
        id: String(m._id),
        name: m.name,
        designation: m.designation || "",
        company: m.currentCompany || "",
        image: m.profilePic || "",
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
    // "review" = a dispute is waiting for the admin (frontend: show "Under review")
    refundStatus: b.refundStatus || "",
    noShowBy: b.noShowBy || "",
    closedAt: b.closedAt || null,
    remainingMs: remainingOf(b),
    timerRunning: isRunning(b),
    // ---- group ----
    mode: b.sessionMode || "single",
    maxMembers: b.maxMembers || 1,
    minMembers: b.minMembers || 1,
    // true while a group still has fewer paid members than it needs to start
    needsMoreMembers:
      isGroup(b) &&
      ["pending", "accepted"].includes(b.status) &&
      membersOf(b).length < (b.minMembers || 1),
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

// wallet-paid -> back to the SAME buckets (scaled for partial refunds),
// Razorpay-paid -> refundable cash
const walletCreditFor = (payment, back, sessionAmount) => {
  const wb = payment.walletBreakdown || {};
  const hasBreakdown =
    isWalletPayment(payment) &&
    (Number(wb.bonus) > 0 ||
      Number(wb.referral) > 0 ||
      Number(wb.refundable) > 0);

  if (!hasBreakdown) return { refundable: back };

  const ratio = sessionAmount > 0 ? back / sessionAmount : 0;
  const bonus = round2((Number(wb.bonus) || 0) * ratio);
  const referral = round2((Number(wb.referral) || 0) * ratio);
  const refundable = Math.max(0, round2(back - bonus - referral));
  return { bonus, referral, refundable };
};

// Wallet refund = "mark payment refunded" + "credit the wallet" in ONE transaction.
// Crash in between -> everything rolls back, the scheduler retries. No lost money.
const refundToWalletAtomic = async (fresh, amount) => {
  const session = await mongoose.startSession();
  let result = "failed";

  try {
    await session.withTransaction(async () => {
      result = "failed"; // the driver can retry this callback

      const before = await Payment.findOneAndUpdate(
        { _id: fresh._id, status: "paid" },
        {
          $set: {
            status: "refunded",
            sessionStatus: "cancelled",
            refundMethod: "wallet",
            refundedAt: new Date(),
            refundAmount: amount,
            convenienceFeeRefunded: 0,
            refundError: "",
          },
        },
        { returnDocument: "before", session },
      );

      if (!before) {
        const cur = await Payment.findById(fresh._id)
          .select("status")
          .session(session)
          .lean();
        result = cur?.status === "refunded" ? "refunded" : "failed";
        return;
      }

      const credit = walletCreditFor(before, amount, amount);
      await creditWallet(before.fresher, credit, session);

      if (Number(credit.refundable) > 0) {
        await Fresher.updateOne(
          { _id: before.fresher },
          { $inc: { totalRefunds: Number(credit.refundable) } },
          { session },
        );
      }
      result = "refunded";
    });
  } catch (e) {
    console.error("refundToWalletAtomic failed:", fresh._id, e.message);
    result = "failed";

    // keep the real reason in the DB so it can be seen without server logs
    await Payment.updateOne(
      { _id: fresh._id, status: "paid" },
      {
        $set: {
          refundError: String(e.message || "wallet refund failed").slice(
            0,
            300,
          ),
          refundFailedAt: new Date(),
        },
      },
    ).catch(() => {});
  } finally {
    session.endSession();
  }

  if (result === "refunded" && fresh.fresher) {
    emitToUser(String(fresh.fresher), "wallet:updated", { amount });
  }
  return result;
};

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

  // wallet refunds are atomic (payment status + wallet credit together)
  if (toWallet) return refundToWalletAtomic(fresh, amount);

  // ---------- original payment method (Razorpay) ----------
  // ATOMIC lock. Refund amounts are written here, so the books are right even if something fails later.
  const before = await Payment.findOneAndUpdate(
    { _id: fresh._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        sessionStatus: "cancelled",
        refundMethod: "original",
        refundedAt: new Date(),
        refundAmount: amount,
        convenienceFeeRefunded: 0,
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

  try {
    // partial refund: only the session price, not the fee the customer paid
    await getRazorpay().payments.refund(before.razorpayPaymentId, {
      amount: toPaise(amount),
      speed: "normal",
      notes: { reason: String(reason).slice(0, 100) },
    });
    return "refunded";
  } catch (error) {
    const rz = error?.error || {};
    const desc = rz.description || error.message || "";

    if (/already.*refund|fully refunded/i.test(desc)) return "refunded";

    console.error("REFUND FAILED:", {
      payment: before.razorpayPaymentId,
      amount,
      statusCode: error?.statusCode,
      code: rz.code,
      description: desc,
    });

    // Razorpay clearly said NO (4xx, e.g. low balance) -> give the money to the wallet instead
    const definiteNo =
      Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500;
    if (definiteNo && before.fresher) {
      try {
        await creditWallet(before.fresher, { refundable: amount });
        await Fresher.updateOne(
          { _id: before.fresher },
          { $inc: { totalRefunds: Number(amount) } },
        ).catch(() => {});
        emitToUser(String(before.fresher), "wallet:updated", { amount });
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
    // one payment throwing must not stop the others (or leave the booking stuck)
    let r = "failed";
    try {
      r = await refundPayment(p, reason, options);
    } catch (e) {
      console.error("refundPayment threw:", p._id, e.message);
    }
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
  { from, to, reason, title, mentorNote, refundTo, noShowBy },
) => {
  // refundStatus is set to "pending" together with the status change.
  // If the server crashes / sleeps from here on, the scheduler still finds
  // this booking (refundStatus != "refunded") and finishes the refund.
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: from } },
    {
      $set: {
        status: to,
        closedAt: new Date(),
        refundStatus: "pending",
        ...(noShowBy ? { noShowBy } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!locked) return null;

  let result = "failed";
  let payments = [];
  try {
    const out = await refundAll(
      locked,
      reason,
      refundTo ? { to: refundTo } : {},
    );
    result = out.result;
    payments = out.payments;
  } catch (e) {
    console.error("closeAndRefund: refundAll threw:", locked.requestGroupId, e);
  }

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

/* ============================ FRESHER NO-SHOW (partial settle) ============================ */
// The employee was in the room, the fresher never came.
// For every payment:  keep = FRESHER_NOSHOW_FEE_PERCENT of the session price
//   -> the payment is marked completed, the employee earns (keep - platform cut)
//   -> the rest (price - keep) is credited back to the fresher's wallet
// Payment update + wallet credit run in ONE transaction. Safe to call again (idempotent).
const settleNoShowPayment = async (payment, mentorId) => {
  const fresh = await Payment.findById(payment._id || payment);
  if (!fresh) return "failed";
  if (fresh.status === "refunded") return "refunded";
  if (fresh.status !== "paid") return "failed";
  // already settled by an earlier run
  if (fresh.sessionStatus === "completed") return "refunded";
  if (!fresh.fresher) return "failed";

  const sessionAmount = round2(
    Math.min(Number(fresh.amount) || 0, checkoutOf(fresh)),
  );
  if (!(sessionAmount > 0)) return "failed";

  const keep = round2((sessionAmount * FRESHER_NOSHOW_FEE_PERCENT) / 100);
  const back = round2(sessionAmount - keep);
  const { fee, earning } = splitAmount(keep, PLATFORM_FEE_PERCENT);

  const session = await mongoose.startSession();
  let result = "failed";

  try {
    await session.withTransaction(async () => {
      result = "failed"; // the driver can retry this callback

      const before = await Payment.findOneAndUpdate(
        {
          _id: fresh._id,
          status: "paid",
          sessionStatus: { $nin: ["completed", "cancelled"] },
        },
        {
          $set: {
            sessionStatus: "completed",
            releasedAt: new Date(),
            ...(mentorId ? { mentor: mentorId } : {}),
            platformFee: fee,
            mentorEarning: earning,
            refundMethod: back > 0 ? "wallet" : "",
            refundedAt: back > 0 ? new Date() : null,
            refundAmount: back,
            convenienceFeeRefunded: 0,
            refundError: "",
          },
        },
        { returnDocument: "before", session },
      );

      if (!before) {
        const cur = await Payment.findById(fresh._id)
          .select("status sessionStatus")
          .session(session)
          .lean();
        result =
          cur?.status === "refunded" || cur?.sessionStatus === "completed"
            ? "refunded"
            : "failed";
        return;
      }

      if (back > 0) {
        const credit = walletCreditFor(before, back, sessionAmount);
        await creditWallet(before.fresher, credit, session);
        if (Number(credit.refundable) > 0) {
          await Fresher.updateOne(
            { _id: before.fresher },
            { $inc: { totalRefunds: Number(credit.refundable) } },
            { session },
          );
        }
      }
      result = "refunded";
    });
  } catch (e) {
    console.error("settleNoShowPayment failed:", fresh._id, e.message);
    result = "failed";
    await Payment.updateOne(
      { _id: fresh._id, status: "paid" },
      {
        $set: {
          refundError: String(e.message || "no-show settle failed").slice(
            0,
            300,
          ),
          refundFailedAt: new Date(),
        },
      },
    ).catch(() => {});
  } finally {
    session.endSession();
  }

  if (result === "refunded" && back > 0) {
    emitToUser(String(fresh.fresher), "wallet:updated", { amount: back });
  }
  return result;
};

const settleNoShowPayments = async (booking) => {
  const ids = paymentIdsOf(booking);
  const list = ids.length
    ? await Payment.find({ razorpayPaymentId: { $in: ids } })
    : [];
  if (!list.length) return { result: "failed", payments: [] };

  const mentorId = booking.mentor ? booking.mentor._id || booking.mentor : null;

  let allOk = true;
  for (const p of list) {
    let r = "failed";
    try {
      r = await settleNoShowPayment(p, mentorId);
    } catch (e) {
      console.error("settleNoShowPayment threw:", p._id, e.message);
    }
    if (r !== "refunded") allOk = false;
  }

  const payments = await Payment.find({
    razorpayPaymentId: { $in: ids },
  }).lean();
  return { result: allOk ? "refunded" : "failed", payments };
};

// tells everybody what happened after a fresher no-show settle
const notifyNoShowOutcome = async (fresh, payments, result) => {
  for (const mem of membersOf(fresh)) {
    if (!mem.fresher) continue;
    const pay = payments.find(
      (p) => p.razorpayPaymentId === mem.razorpayPaymentId,
    );
    const back = Number(pay?.refundAmount) || 0;
    const paid = Number(pay?.amount) || Number(mem.amount) || 0;
    const kept = round2(Math.max(0, paid - back));

    notify({
      user: mem.fresher,
      role: "fresher",
      title: "Session missed",
      message:
        result === "refunded"
          ? `You did not join the session. A no-show fee of ₹${kept} was charged and ₹${back} was added back to your wallet.`
          : "You did not join the session. Your balance is being settled, we will update you soon.",
      type: "payment",
      link: "/Home/bonus-wallet",
    });
  }

  if (fresh.mentor) {
    const mentorId = fresh.mentor._id || fresh.mentor;
    const earned = round2(
      payments
        .filter((p) => p.sessionStatus === "completed")
        .reduce((s, p) => s + (Number(p.mentorEarning) || 0), 0),
    );
    notify({
      user: mentorId,
      role: "mentor",
      title: "Fresher did not join",
      message:
        earned > 0
          ? `The ${isGroup(fresh) ? "group" : "fresher"} did not join. ₹${earned} was added to your wallet for your time.`
          : `The ${isGroup(fresh) ? "group" : "fresher"} did not join, so the session was marked as missed.`,
      type: "payment",
      link: "/mentor/earnings",
    });
    emitToUser(mentorId, "wallet:updated", {
      requestGroupId: fresh.requestGroupId,
    });
  }
};

const handleFresherNoShow = async (bookingId) => {
  const locked = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "accepted" },
    {
      $set: {
        status: "missed",
        closedAt: new Date(),
        refundStatus: "pending",
        noShowBy: "fresher",
      },
    },
    { returnDocument: "after" },
  );
  if (!locked) return null;

  let out = { result: "failed", payments: [] };
  try {
    out = await settleNoShowPayments(locked);
  } catch (e) {
    console.error("handleFresherNoShow threw:", locked.requestGroupId, e);
  }

  await Booking.updateOne(
    { _id: locked._id },
    { $set: { refundStatus: out.result } },
  );

  const fresh = await Booking.findById(locked._id).populate(
    "mentor",
    POPULATE_MENTOR,
  );
  if (!fresh) return null;

  await notifyNoShowOutcome(fresh, out.payments, out.result);
  emitBooking(fresh);
  return fresh;
};

// adds one strike to the employee. 3 = warning, 5 = suspended.
const addMentorStrike = async (mentorId) => {
  const m = await Mentor.findOneAndUpdate(
    { _id: mentorId },
    { $inc: { missedSessions: 1 } },
    { returnDocument: "after" },
  )
    .select("missedSessions accountStatus")
    .lean()
    .catch(() => null);
  if (!m) return;

  if (m.missedSessions >= STRIKE_SUSPEND && m.accountStatus === "active") {
    await Mentor.updateOne(
      { _id: m._id },
      { $set: { accountStatus: "suspended" } },
    ).catch(() => {});
    notify({
      user: m._id,
      role: "mentor",
      title: "Account suspended",
      message: `You missed ${m.missedSessions} sessions, so your account was suspended. Please contact support.`,
      type: "session",
      link: "/mentor/sessions",
    });
  } else if (m.missedSessions >= STRIKE_WARN) {
    notify({
      user: m._id,
      role: "mentor",
      title: "Warning: missed sessions",
      message: `You have missed ${m.missedSessions} sessions. At ${STRIKE_SUSPEND} misses your account will be suspended.`,
      type: "session",
      link: "/mentor/sessions",
    });
  }
};

// decides what to do with an accepted booking whose timer never started
const handleNoShow = async (bookingId) => {
  const b = await Booking.findById(bookingId);
  if (!b || b.status !== "accepted") return null;

  const mentorHere = Boolean(b.mentorJoinedAt);
  const fresherHere = Boolean(b.fresherJoinedAt);

  // employee was waiting, fresher never came -> fresher pays the no-show fee
  if (mentorHere && !fresherHere && FRESHER_NOSHOW_FEE_PERCENT > 0) {
    return handleFresherNoShow(b._id);
  }

  // everything else (employee missing, nobody came, both came but it never started): FULL refund
  const mentorMissing = !mentorHere && fresherHere;

  const closed = await closeAndRefund(b._id, {
    from: ["accepted"],
    to: "missed",
    title: "Session missed",
    reason: mentorMissing
      ? "The employee did not join the session, so you got a full refund."
      : "The session did not start because nobody joined in time.",
    mentorNote: mentorMissing
      ? "You did not join the session, so it was marked as missed and the fresher was refunded. Repeated misses can affect your account."
      : "The session did not start in time, so it was marked as missed and the fresher was refunded.",
    refundTo: "wallet",
    noShowBy: mentorMissing ? "mentor" : undefined,
  });

  // employee strike
  if (closed && mentorMissing && b.mentor) {
    await addMentorStrike(b.mentor._id || b.mentor);
  }
  return closed;
};

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
    // 1. Check whether the fresher is logged in
    if (!req.user?.id) {
      return fail(res, 401, "Please login to book a session.");
    }

    // 2. Get fresher details
    const user = await Fresher.findById(req.user.id).lean();

    if (!user) {
      return fail(res, 404, "Fresher profile not found.");
    }

    const has = (v) =>
      Array.isArray(v) ? v.length > 0 : String(v ?? "").trim().length > 0;

    const photo =
      user.profilePic ||
      user.profileImage ||
      user.avatar ||
      user.photo ||
      user.photoUrl;

    // 3. Career is optional. Only these 9 fields are required.
    const requiredFields = [
      photo,
      user.name,
      user.phone || user.mobile,
      user.gender,
      user.location,
      user.bio,
      user.education,
      user.skills,
      user.interests,
    ];

    const done = requiredFields.filter(has).length;

    if (!photo || done / requiredFields.length < 0.8) {
      return res.status(403).json({
        message:
          "Complete your profile (photo + required details) to book a session.",
      });
    }

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

    if (!requestGroupId || !paymentId) {
      return fail(res, 400, "requestGroupId and paymentId required");
    }

    const existing = await Booking.findOne({ requestGroupId }).populate(
      "mentor",
      POPULATE_MENTOR,
    );

    if (existing) {
      return res.json({
        success: true,
        booking: toClient(existing),
        notifiedCount: existing.notified.length,
      });
    }

    const payment = await Payment.findOne({
      razorpayPaymentId: paymentId,
      status: "paid",
    });

    if (!payment) {
      return fail(res, 402, "Payment not verified");
    }

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

    if (!claimed) {
      return fail(res, 409, "This payment is already used for another booking");
    }

    // Payment without an owner cannot be refunded to a wallet. Attach the logged-in fresher.
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

    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 240) {
      return reject(400, "Invalid duration");
    }

    // ---- single or group ----
    const mode = sd.mode === "group" ? "group" : "single";

    let maxMembers = 1;

    if (mode === "group") {
      maxMembers = Number(sd.maxMembers);

      if (
        !Number.isInteger(maxMembers) ||
        maxMembers < 2 ||
        maxMembers > MAX_GROUP
      ) {
        return reject(400, `Group size must be 2 to ${MAX_GROUP} people.`);
      }
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

      if (!preferredMentor) {
        return reject(400, "Selected mentor is not available.");
      }

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
    const profileGender = norm(fresherDoc?.gender);
    const profileKnown = profileGender === "male" || profileGender === "female";
    const pickedGender = norm(sd.gender);
    const pickedKnown = pickedGender === "male" || pickedGender === "female";

    let fresherGender = "";

    if (mode === "group") {
      fresherGender = pickedKnown ? pickedGender : "";
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
      if (mode === "single" && !fresherGender) {
        return reject(400, "Please select your gender.");
      }

      if (!department) {
        return reject(400, "Please select a department.");
      }
    }

    const hostName = fresherDoc?.name || body.requester?.fullName || "Fresher";

    const booking = await Booking.create({
      requestGroupId,
      fresher: fresherId || null,
      fresherName: hostName,
      // stored for server-side use only. It is never returned to the mentor.
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
      amount: Number(payment.amount),
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
      // a group of 2 needs both people, bigger groups need GROUP_MIN_MEMBERS (default 2)
      minMembers:
        mode === "group" ? Math.min(maxMembers, GROUP_MIN_MEMBERS) : 1,
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

    if (notified.length) {
      await Booking.updateOne({ _id: booking._id }, { $set: { notified } });
    }

    const out = await Booking.findById(booking._id)
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);

    return res.status(201).json({
      success: true,
      booking: toClient(out || booking),
      notifiedCount: notified.length,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return fail(res, 409, "This payment is already used for another booking");
    }

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
        minMembers: b.minMembers || 1,
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

    // mentor already accepted -> the new friend also gets the
    // "join 5 minutes early" email + WhatsApp
    if (updated.mentor) {
      emailBookingParties(updated, "booked", {
        only: String(req.user.id),
        skipMentor: true,
      });
    }

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
    emailBookingParties(accepted, "booked"); // email + WhatsApp (not awaited, never blocks)

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

// only the people of this booking (or a mentor it was sent to) may read it
exports.getRequestStatus = async (req, res) => {
  try {
    const b = await Booking.findOne({
      requestGroupId: String(req.params.requestGroupId || ""),
    })
      .populate("mentor", POPULATE_MENTOR)
      .populate("preferredMentor", POPULATE_MENTOR);
    if (!b) return fail(res, 404, "Not found");

    const me = String(req.user?.id || "");
    const isMember = participantUserIds(b).includes(me);
    const isMentor =
      req.user?.role === "mentor" &&
      [
        b.mentor && String(b.mentor._id || b.mentor),
        b.preferredMentor && String(b.preferredMentor._id || b.preferredMentor),
        ...(b.notified || []).map(String),
      ].includes(me);
    if (!isMember && !isMentor) return fail(res, 403, "Access denied");

    return res.json({
      success: true,
      request: toClient(b),
      booking: toClient(b),
    });
  } catch (error) {
    return fail(res, 500, "Failed to load request");
  }
};

// SECURITY FIX: uses the logged-in user (no more ?email=). Route must be behind fresher auth.
exports.getAcceptedBookings = async (req, res) => {
  try {
    if (!req.user?.id) return fail(res, 401, "Please login.");

    const list = await Booking.find({
      $or: [{ fresher: req.user.id }, { "participants.fresher": req.user.id }],
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

// group friends can be asked to review too (the old code looked at the host only)
exports.needsReview = async (req, res) => {
  try {
    const uid = String(req.user.id);
    const list = await Booking.find({
      status: "completed",
      mentor: { $ne: null },
      completedAt: { $gte: new Date(Date.now() - 14 * 86400000) }, // do not nag about old sessions
      $or: [{ fresher: uid }, { "participants.fresher": uid }],
    })
      .populate("mentor", POPULATE_MENTOR)
      .sort({ completedAt: 1 })
      .limit(20);

    if (!list.length) return res.json({ success: true, booking: null });

    const done = await Review.find({
      fresher: uid,
      sessionKey: { $in: list.map((x) => x.requestGroupId) },
    })
      .select("sessionKey")
      .lean();
    const reviewed = new Set(done.map((r) => r.sessionKey));

    const next = list.find((x) => !reviewed.has(x.requestGroupId));
    return res.json({ success: true, booking: next ? toClient(next) : null });
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
    const isMember = participantUserIds(b).includes(String(req.user.id));
    const mine = isMember || String(b.mentor?._id || b.mentor) === req.user.id;
    if (!mine) return fail(res, 403, "Access denied");

    // FIX: MeetingRoom reads `myReviewed`. Without it every group friend was asked to review again.
    let myReviewed = false;
    if (isMember) {
      myReviewed = Boolean(
        await Review.exists({
          fresher: req.user.id,
          sessionKey: b.requestGroupId,
        }),
      );
    }

    return res.json({
      success: true,
      booking: { ...toClient(b), myReviewed },
    });
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

      // MENTOR_PUBLIC_FIELDS has no email / phone / linkedin
      const m = await Mentor.findById(b.mentor)
        .select(MENTOR_PUBLIC_FIELDS)
        .lean();
      if (!m) return fail(res, 404, "Employee not found");

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
          isVerified: Boolean(m.isVerified),
          // SECURITY: no email, no linkedinProfile, no phone here

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
    // SECURITY: no email of any fresher is selected or returned
    const ids = participantUserIds(b);
    const freshers = await Fresher.find({ _id: { $in: ids } })
      .select("name gender profilePic")
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

// auto       : nobody answered in time -> auto-confirmed
// fromDispute: the admin (or the review timeout) decided to RELEASE the held money to the employee
const settleCompleted = async (
  booking,
  { auto = false, fromDispute = false } = {},
) => {
  const now = new Date();
  const filter = fromDispute
    ? { _id: booking._id, status: "disputed", refundStatus: "review" }
    : {
        _id: booking._id,
        status: { $in: ["awaiting_confirmation", "in_progress", "accepted"] },
      };

  const updated = await Booking.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "completed",
        completedAt: now,
        "meeting.remainingMs": 0,
        "meeting.endedAt": now,
        ...(fromDispute ? { refundStatus: "" } : {}),
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
      message: fromDispute
        ? `Our team reviewed the report and confirmed the session. ₹${mentorShare} added to your wallet.`
        : auto
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

// POST /api/bookings/:requestGroupId/confirm   { accepted: true | false, reason }
//   accepted = true  -> session completed, employee is paid
//   accepted = false -> DISPUTE. Money is HELD for admin review (no automatic refund).
exports.confirmCompletion = async (req, res) => {
  try {
    const requestGroupId = String(req.params.requestGroupId || "").trim();
    const accepted = Boolean(req.body?.accepted);
    const reportReason = String(req.body?.reason || "")
      .trim()
      .slice(0, 500);

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

    // ---------- DISPUTE: hold the money, admin decides ----------
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "awaiting_confirmation" },
      {
        $set: {
          status: "disputed",
          disputedAt: new Date(),
          disputeReason: reportReason,
          refundStatus: "review",
        },
      },
      { returnDocument: "after" },
    ).populate("mentor", POPULATE_MENTOR);
    if (!updated) return fail(res, 409, "Session already updated");

    // count the report (repeat reporters get flagged in the admin list)
    await Fresher.updateOne(
      { _id: booking.fresher },
      { $inc: { disputeCount: 1 }, $set: { lastDisputeAt: new Date() } },
    ).catch(() => {});

    const hours = Math.round(DISPUTE_REVIEW_MS / 3600000);

    participantUserIds(updated).forEach((id) =>
      notify({
        user: id,
        role: "fresher",
        title: "Report received",
        message: `We received your report. Our team will review it within ${hours} hours and update you.`,
        type: "session",
        link: "/Home/my-meetings?tab=cancelled",
      }),
    );

    if (updated.mentor) {
      notify({
        user: updated.mentor._id,
        role: "mentor",
        title: "Session under review",
        message:
          "The fresher reported a problem with this session. Our team is reviewing it and will update you.",
        type: "session",
        link: "/mentor/sessions",
      });
    }

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

/* ============================ DISPUTES (admin) ============================ */

// decision = "refund"  -> every member is refunded to the wallet
//          = "release" -> the session counts as completed, the employee is paid
const applyDisputeDecision = async (
  bookingId,
  decision,
  { note = "" } = {},
) => {
  const b = await Booking.findOne({
    _id: bookingId,
    status: "disputed",
    refundStatus: "review",
  }).populate("mentor", POPULATE_MENTOR);
  if (!b) return null;

  if (decision === "release") {
    const done = await settleCompleted(b, { fromDispute: true });
    if (!done) return null;
    participantUserIds(done).forEach((id) =>
      notify({
        user: id,
        role: "fresher",
        title: "Report reviewed",
        message:
          "We reviewed your report. The session was confirmed as completed, so no refund is due.",
        type: "session",
        link: "/Home/my-bookings",
      }),
    );
    return { decision, booking: done };
  }

  // refund
  const lock = await Booking.findOneAndUpdate(
    { _id: b._id, status: "disputed", refundStatus: "review" },
    {
      $set: {
        refundStatus: "pending",
        completedAt: new Date(),
        disputeNote: String(note || "").slice(0, 300),
      },
    },
    { returnDocument: "after" },
  );
  if (!lock) return null;

  let result = "failed";
  let payments = [];
  try {
    const out = await refundAll(
      lock,
      "Your report was approved after review.",
      { to: "wallet" },
    );
    result = out.result;
    payments = out.payments;
  } catch (e) {
    console.error(
      "applyDisputeDecision: refundAll threw:",
      lock.requestGroupId,
      e,
    );
  }

  await Booking.updateOne(
    { _id: lock._id },
    { $set: { refundStatus: result } },
  );

  const fresh = await Booking.findById(lock._id).populate(
    "mentor",
    POPULATE_MENTOR,
  );
  if (!fresh) return null;

  notifyRefunds(fresh, payments, result, {
    title: "Report approved",
    reason: "We reviewed your report and approved your refund.",
  });

  if (fresh.mentor) {
    notify({
      user: fresh.mentor._id,
      role: "mentor",
      title: "Session refunded",
      message:
        "After review, this session was refunded to the fresher. No earnings were released for it.",
      type: "session",
      link: "/mentor/sessions",
    });
  }

  emitBooking(fresh);
  return { decision, booking: fresh };
};

// GET /api/bookings/admin/disputes   (admin)
exports.listDisputes = async (req, res) => {
  try {
    if (req.user?.role !== "admin") return fail(res, 403, "Admin only");

    const list = await Booking.find({
      status: "disputed",
      refundStatus: "review",
    })
      .populate("mentor", "name currentCompany")
      .sort({ disputedAt: 1 })
      .lean();

    const hostIds = [
      ...new Set(
        list
          .map((b) => b.fresher)
          .filter(Boolean)
          .map(String),
      ),
    ];
    const hosts = hostIds.length
      ? await Fresher.find({ _id: { $in: hostIds } })
          .select("disputeCount")
          .lean()
      : [];
    const countOf = (id) =>
      Number(hosts.find((h) => String(h._id) === String(id))?.disputeCount) ||
      0;

    return res.json({
      success: true,
      count: list.length,
      disputes: list.map((b) => ({
        requestGroupId: b.requestGroupId,
        companyName: b.companyName,
        sessionType: b.sessionType,
        mode: b.sessionMode || "single",
        members: membersOf(b).length,
        hostName: b.fresherName,
        mentorName: b.mentor?.name || "",
        date: b.date,
        time: b.time,
        durationMinutes: b.durationMinutes,
        perPersonAmount: b.perPersonAmount || b.amount,
        totalHeld: round2(
          membersOf(b).reduce((s, m) => s + (Number(m.amount) || 0), 0),
        ),
        sessionPurpose: b.reason || "",
        reportReason: b.disputeReason || "",
        disputedAt: b.disputedAt || null,
        mentorJoinedAt: b.mentorJoinedAt || null,
        fresherJoinedAt: b.fresherJoinedAt || null,
        presenceProof: Boolean(b.mentorJoinedAt && b.fresherJoinedAt),
        hostDisputeCount: countOf(b.fresher),
        flagged: countOf(b.fresher) >= DISPUTE_FLAG_COUNT,
        autoDecisionAt: b.disputedAt
          ? new Date(new Date(b.disputedAt).getTime() + DISPUTE_REVIEW_MS)
          : null,
        autoDecision: autoDecisionFor(b, countOf(b.fresher)),
      })),
    });
  } catch (error) {
    console.error("listDisputes error:", error);
    return fail(res, 500, "Failed to load disputes");
  }
};

// POST /api/bookings/admin/disputes/:requestGroupId/resolve   (admin)   { decision: "refund"|"release", note }
exports.resolveDispute = async (req, res) => {
  try {
    if (req.user?.role !== "admin") return fail(res, 403, "Admin only");

    const decision = String(req.body?.decision || "").toLowerCase();
    if (!["refund", "release"].includes(decision))
      return fail(res, 400, 'decision must be "refund" or "release"');

    const b = await Booking.findOne({
      requestGroupId: String(req.params.requestGroupId || "").trim(),
    }).select("_id status refundStatus");
    if (!b) return fail(res, 404, "Booking not found");
    if (b.status !== "disputed" || b.refundStatus !== "review")
      return fail(res, 409, "This booking is not waiting for a review.");

    const out = await applyDisputeDecision(b._id, decision, {
      note: req.body?.note,
    });
    if (!out) return fail(res, 409, "Already resolved");

    return res.json({
      success: true,
      decision,
      booking: toClient(out.booking),
    });
  } catch (error) {
    console.error("resolveDispute error:", error);
    return fail(res, 500, "Failed to resolve the dispute");
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
let busySince = 0;
let lastReconcileAt = 0;

// Runs one scheduler step. A crash inside a step is logged and the NEXT steps still run.
const safely = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`scheduler step failed [${name}]:`, e);
  }
};

exports.startSchedulers = (app) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;

    // watchdog: a run that hangs (DB / Razorpay call) is released after SCHEDULER_STUCK_MS
    if (schedulerBusy) {
      if (Date.now() - busySince < SCHEDULER_STUCK_MS) return;
      console.error(
        "scheduler: previous run looks stuck, releasing the lock and continuing",
      );
    }
    schedulerBusy = true;
    busySince = Date.now();

    try {
      const now = new Date();

      // 1) AUTO-CANCEL (refunds EVERY member of a group)
      await safely("auto-cancel", async () => {
        const stale = await Booking.find({
          status: "pending",
          expiresAt: { $lte: now },
        }).select("_id");

        for (const b of stale) {
          await safely(`auto-cancel ${b._id}`, async () => {
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
          });
        }
      });

      // 1b) GROUP NOT FILLED: fewer than minMembers paid -> cancel, refund everybody
      await safely("group-fill", async () => {
        const unfilled = await Booking.find({
          status: { $in: ["pending", "accepted"] },
          sessionMode: "group",
          startsAt: { $lte: new Date(now.getTime() + GROUP_FILL_CUTOFF_MS) },
          minMembers: { $gt: 1 },
          $expr: { $lt: [{ $size: "$participants" }, "$minMembers"] },
        })
          .select("_id")
          .limit(20);

        for (const b of unfilled) {
          await safely(`group-fill ${b._id}`, async () => {
            const closed = await closeAndRefund(b._id, {
              from: ["pending", "accepted"],
              to: "cancelled",
              title: "Group cancelled",
              reason:
                "Not enough friends joined your group in time, so it was cancelled.",
              mentorNote:
                "The group did not get enough members, so the session was cancelled. No action needed from you.",
              refundTo: "wallet",
            });

            if (closed) {
              (closed.notified || []).forEach((mentorId) =>
                emitToMentorSockets(app, mentorId, "session-request-taken", {
                  id: closed.requestGroupId,
                  requestGroupId: closed.requestGroupId,
                }),
              );
            }
          });
        }
      });

      // 2) NO-SHOW (who was missing decides who pays)
      await safely("no-show", async () => {
        const noShows = await Booking.find({
          status: "accepted",
          startsAt: { $lte: new Date(now.getTime() - NO_SHOW_GRACE_MS) },
          "meeting.timerEndsAt": null,
        }).select("_id");

        for (const b of noShows) {
          await safely(`no-show ${b._id}`, () => handleNoShow(b._id));
        }
      });

      // 3) fresher never answered "did it go well?"
      await safely("unconfirmed", async () => {
        const unconfirmed = await Booking.find({
          status: "awaiting_confirmation",
          "meeting.endedAt": {
            $lte: new Date(now.getTime() - CONFIRM_WAIT_MS),
          },
        }).select("_id");

        for (const b of unconfirmed) {
          await safely(`unconfirmed ${b._id}`, async () => {
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
          });
        }
      });

      // 3b) DISPUTE TIMEOUT: admin did not decide in time -> decide from presence + history
      await safely("dispute-timeout", async () => {
        const due = await Booking.find({
          status: "disputed",
          refundStatus: "review",
          disputedAt: {
            $ne: null,
            $lte: new Date(now.getTime() - DISPUTE_REVIEW_MS),
          },
        }).limit(20);

        for (const b of due) {
          await safely(`dispute-timeout ${b.requestGroupId}`, async () => {
            const host = b.fresher
              ? await Fresher.findById(b.fresher).select("disputeCount").lean()
              : null;
            const decision = autoDecisionFor(
              b,
              Number(host?.disputeCount) || 0,
            );
            await applyDisputeDecision(b._id, decision, {
              note: `Auto decision: ${decision} (review time over)`,
            });
          });
        }
      });

      // 4) RETRY REFUNDS (all members)
      // Every closed booking whose refund is NOT done ("pending" = crashed in the middle,
      // "" = old bookings, "failed") is picked up. Disputes that are waiting for the admin
      // (refundStatus "review") are NEVER touched here.
      await safely("refund-retry", async () => {
        const settleAfter = new Date(
          now.getTime() - REFUND_RETRY_AFTER_CLOSE_MS,
        );
        const retryBefore = new Date(now.getTime() - REFUND_RETRY_GAP_MS);

        const failedRefunds = await Booking.find({
          status: { $in: ["expired", "missed", "cancelled", "disputed"] },
          refundStatus: { $nin: ["refunded", "review"] },
          razorpayPaymentId: { $ne: "" },
          refundAttempts: { $not: { $gte: MAX_REFUND_ATTEMPTS } },
          $and: [
            { $or: [{ closedAt: null }, { closedAt: { $lte: settleAfter } }] },
            {
              $or: [
                { completedAt: null },
                { completedAt: { $lte: settleAfter } },
              ],
            },
            {
              $or: [
                { lastRefundAttemptAt: null },
                { lastRefundAttemptAt: { $lte: retryBefore } },
              ],
            },
          ],
        }).limit(10);

        for (const b of failedRefunds) {
          await safely(`refund-retry ${b._id}`, async () => {
            await Booking.updateOne(
              { _id: b._id },
              {
                $inc: { refundAttempts: 1 },
                $set: { lastRefundAttemptAt: new Date() },
              },
            );

            // a fresher no-show is a PARTIAL settle. It must never be retried as a full refund.
            if (b.noShowBy === "fresher") {
              const out = await settleNoShowPayments(b);
              await Booking.updateOne(
                { _id: b._id },
                { $set: { refundStatus: out.result } },
              );
              if (out.result === "refunded") {
                const fresh = await Booking.findById(b._id).populate(
                  "mentor",
                  POPULATE_MENTOR,
                );
                if (fresh)
                  await notifyNoShowOutcome(fresh, out.payments, out.result);
              }
              return;
            }

            const { result } = await refundAll(b, "Retry: session refund", {
              to: "wallet",
            });

            // keep the status honest: "refunded" or "failed" (never left as "pending")
            await Booking.updateOne(
              { _id: b._id },
              { $set: { refundStatus: result } },
            );

            if (result === "refunded") {
              for (const mem of membersOf(b)) {
                if (!mem.fresher) continue;
                notify({
                  user: mem.fresher,
                  role: "fresher",
                  title: "Refund completed",
                  message: `Your refund of ₹${mem.amount || b.amount} has been added to your wallet.`,
                  type: "payment",
                  link: "/Home/bonus-wallet",
                });
                emitToUser(mem.fresher, "wallet:updated", {
                  amount: mem.amount || b.amount,
                });
                emitToUser(mem.fresher, "booking:updated", {
                  requestGroupId: b.requestGroupId,
                  refundStatus: "refunded",
                });
              }
            }
          });
        }
      });

      // 5) overdue running timers
      await safely("overdue-timers", async () => {
        const overdue = await Booking.find({
          status: "in_progress",
          "meeting.timerEndsAt": { $lte: now },
        }).select("requestGroupId");
        for (const b of overdue) {
          await safely(`overdue ${b.requestGroupId}`, () =>
            completeBooking(b.requestGroupId),
          );
        }
      });

      // 6) reminders: the room is open now -> email + WhatsApp everyone once
      await safely("reminders", async () => {
        const soon = await Booking.find({
          status: "accepted",
          reminderSent: false,
          startsAt: { $lte: new Date(now.getTime() + OPEN_BEFORE_MS) },
        });
        for (const b of soon) {
          const r = await Booking.updateOne(
            { _id: b._id, reminderSent: false },
            { $set: { reminderSent: true } },
          );
          if (r.modifiedCount) {
            const full = await Booking.findById(b._id).populate(
              "mentor",
              POPULATE_MENTOR,
            );
            if (full) emailBookingParties(full, "reminder");
          }
        }
      });

      // 7) money was taken (wallet OR Razorpay) but the booking / group join never happened -> give it back
      await safely("orphan-payments", async () => {
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
          await safely(`orphan ${p._id}`, async () => {
            if (await paymentUsed(p.razorpayPaymentId)) return;

            const result = await refundPayment(
              p,
              "Booking was not created",
              {},
            );
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
          });
        }
      });

      // 8) clean up old closed + refunded bookings
      await safely("cleanup", async () => {
        const oldClosed = await Booking.find({
          status: { $in: ["expired", "missed", "cancelled"] },
          refundStatus: "refunded",
          closedAt: {
            $ne: null,
            $lte: new Date(now.getTime() - CLOSED_RETENTION_MS),
          },
        })
          .select("_id")
          .limit(50)
          .lean();

        if (oldClosed.length) {
          await Booking.deleteMany({
            _id: { $in: oldClosed.map((b) => b._id) },
          });
        }
      });

      // 9) Razorpay money captured but verify never reached us / abandoned or failed checkouts (every 5 min)
      await safely("reconcile", async () => {
        if (Date.now() - lastReconcileAt > 5 * 60 * 1000) {
          lastReconcileAt = Date.now();
          await reconcileStaleOrders();
        }
      });
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

/* ============================ VIDEO TOKEN (LiveKit) ============================ */
// POST /api/bookings/:id/livekit-token   (fresher member OR the accepted mentor)
// Only people who PAID and joined (or the mentor who accepted) get a token.
// NOTE: taking a token does NOT count as "joined". Presence is stamped by livekitWebhook().
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

    const me = String(req.user.id);
    const isMentor =
      req.user.role === "mentor" && b.mentor && String(b.mentor) === me;
    const isMember =
      req.user.role === "fresher" && participantUserIds(b).includes(me);
    if (!isMentor && !isMember) return fail(res, 403, "Access denied");

    if (!["accepted", "in_progress"].includes(b.status))
      return fail(res, 409, "This session is not active");

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
      canPublish: true, // camera + mic + screen share (no source restriction)
      canSubscribe: true,
      canPublishData: true, // raise hand + reactions
    });

    const token = await at.toJwt();
    return res.json({ success: true, token, url: LIVEKIT_URL });
  } catch (error) {
    console.error("livekitToken error:", error);
    return fail(res, 500, "Could not create the meeting token");
  }
};

// POST /api/bookings/livekit-webhook   (called by LiveKit, not by a browser)
// Presence is stamped only when LiveKit says the person REALLY joined the room.
// Identity was set by our own server in livekitToken(): "mentor:<id>" / "fresher:<id>".
exports.livekitWebhook = async (req, res) => {
  try {
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return res.status(500).end();

    const { WebhookReceiver } = require("livekit-server-sdk");
    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    // throws if the signature is wrong
    const event = await receiver.receive(raw, req.get("Authorization"));

    if (event.event !== "participant_joined")
      return res.json({ success: true });

    const room = String(event.room?.name || "");
    const identity = String(event.participant?.identity || "");
    const field = identity.startsWith("mentor:")
      ? "mentorJoinedAt"
      : identity.startsWith("fresher:")
        ? "fresherJoinedAt"
        : null;
    if (!room || !field) return res.json({ success: true });

    await Booking.updateOne(
      {
        requestGroupId: room,
        status: { $in: ["accepted", "in_progress"] },
        [field]: null,
      },
      { $set: { [field]: new Date() } },
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("livekitWebhook error:", error.message);
    return res.status(401).json({ success: false });
  }
};
// GET /api/bookings/prices : the ONLY place the frontend reads prices from
exports.getPrices = (req, res) => {
  const durations = [30, 60, 90, 120, 150, 180, 210, 240];
  const table = (mode) =>
    Object.fromEntries(durations.map((m) => [m, expectedPrice(m, mode)]));

  return res.json({
    success: true,
    singlePerHour: RATE_PER_HOUR,
    groupPerHour: GROUP_RATE_PER_HOUR,
    maxGroup: MAX_GROUP,
    minMembers: GROUP_MIN_MEMBERS,
    single: table("single"),
    group: table("group"),
  });
};