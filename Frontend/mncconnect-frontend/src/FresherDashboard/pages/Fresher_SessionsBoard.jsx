import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Send,
  UserRound,
  Briefcase,
  Mail,
  TimerReset,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  X,
  Wallet,
  Users,
  Copy,
  Share2,
  Check,
  Lock,
  CreditCard,
  Circle,
  Info,
  WifiOff,
} from "lucide-react";
import useUserEvents from "../../hooks/useUserEvents";
import useLive from "../../hooks/useLive";
import {
  api,
  ENDPOINTS,
  EVENTS,
  DURATIONS,
  durationLabel,
  priceFor,
  getUser,
  getUserId,
  toApiDate,
  toApiTime,
  startFrom,
  inr,
} from "../../services/fresherApi";

const SESSION_TYPES = [
  { value: "company_prep", label: "How to get into this company" },
  { value: "interview_ideas", label: "Interview preparation" },
  { value: "referral", label: "Referral guidance" },
  { value: "road_map", label: "Road map & skills" },
  { value: "any_queries", label: "Any queries" },
];

// GROUP meeting: the host chooses. "" = no preference (any employee)
const GROUP_GENDER_OPTIONS = [
  { value: "", label: "No preference (any employee)" },
  { value: "male", label: "Male employee" },
  { value: "female", label: "Female employee" },
];
// old accounts that have no gender saved yet (single meeting)
const SINGLE_GENDER_FALLBACK = [
  { value: "", label: "Select your gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];
const LANGUAGE_OPTIONS = [
  "English",
  "Tamil",
  "Hindi",
  "Malayalam",
  "Telugu",
  "Kannada",
];

// ---- GROUP pricing: PER PERSON. Keep the same as GROUP_RATE_PER_HOUR / MAX_GROUP_MEMBERS in the backend .env ----
const GROUP_RATE_PER_HOUR = 50;
const MAX_GROUP = 60; // college batch = up to 60 students
const groupPriceFor = (minutes) =>
  Math.round((GROUP_RATE_PER_HOUR * minutes) / 60);

const MIN_LEAD_MIN = 30;
const OPEN_BEFORE_MIN = 2;

const WALLET_PAY_ENDPOINT =
  ENDPOINTS.payWithWallet || "/payments/pay-with-wallet";

const makeRequestId = () =>
  `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hasEnoughLead = (date, time) => {
  const start = startFrom(date, time);
  const ms = start ? start.getTime() : NaN;
  return Number.isFinite(ms) && ms >= Date.now() + MIN_LEAD_MIN * 60000;
};

const pad2 = (n) => String(n).padStart(2, "0");

// earliest date/time the person is allowed to pick right now
const earliestSlot = () => {
  const d = new Date(Date.now() + (MIN_LEAD_MIN + 1) * 60000);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    label: d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
  };
};

// a clear, specific reason why the chosen date / time is not allowed ("" = fine)
const whenProblem = (date, time) => {
  if (!date && !time) return "Choose a date and a start time";
  if (!date) return "Choose a date";
  if (!time) return "Choose a start time";
  const start = startFrom(date, time);
  const ms = start ? start.getTime() : NaN;
  if (!Number.isFinite(ms)) return "This date or time is not valid";
  if (ms < Date.now())
    return "This time has already passed. Choose a time in the future.";
  if (ms < Date.now() + MIN_LEAD_MIN * 60000)
    return `Too soon. Choose a time at least ${MIN_LEAD_MIN} minutes from now.`;
  return "";
};

const cleanGender = (v) => {
  const g = String(v || "")
    .trim()
    .toLowerCase();
  return g === "male" || g === "female" ? g : "";
};

const makeEmptyForm = (user) => ({
  mode: "single", // "single" | "group"
  members: 3, // group size INCLUDING you (2..MAX_GROUP)
  sessionType: SESSION_TYPES[0].value,
  reason: "",
  date: "",
  time: "",
  role: "",
  gender: cleanGender(user?.gender),
  language: "",
  minutes: 60,
});

/* ---------- turn raw / technical errors into simple "what to do" help ---------- */
const explainError = (message = "", status = 0) => {
  const m = String(message || "").toLowerCase();

  if (m.includes("gateway failed to load") || m.includes("razorpay")) {
    return {
      title: "Payment window could not open",
      tips: [
        "Check that your internet is working",
        "Refresh this page, then tap Pay again",
        "Turn off ad-blockers or VPN if you use them",
      ],
      moneySafe: true,
    };
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("timeout")
  ) {
    return {
      title: "No internet connection",
      tips: [
        "Check your Wi-Fi or mobile data",
        "Then tap Try again",
      ],
      moneySafe: true,
      offline: true,
    };
  }
  if (status === 401 || m.includes("unauthor") || m.includes("token")) {
    return {
      title: "Please log in again",
      tips: [
        "Your login has expired",
        "Log in again and come back to this page",
      ],
      moneySafe: true,
    };
  }
  if (status === 402 || m.includes("insufficient")) {
    return {
      title: "Not enough wallet balance",
      tips: [
        "Choose UPI / Card as the payment method",
        "Or add money to your wallet first",
      ],
      moneySafe: true,
    };
  }
  if (m.includes("payment failed") || m.includes("declined")) {
    return {
      title: "Your payment did not go through",
      tips: [
        "Try a different UPI app or card",
        "Check that your bank account has enough balance",
        "If money was deducted, it is refunded automatically in 5-7 days",
      ],
      moneySafe: true,
    };
  }
  if (status >= 500) {
    return {
      title: "Our server had a problem",
      tips: [
        "This is not your mistake",
        "Wait a minute and tap Try again",
      ],
      moneySafe: true,
    };
  }
  return {
    title: "Something went wrong",
    tips: [
      "Check the details you entered and try again",
      "If money was deducted, it is refunded automatically",
    ],
    moneySafe: true,
  };
};

/* ---------- small UI helpers ---------- */
const inputBase =
  "h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-800 outline-none transition focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400";
const inputCls = (hasError) =>
  `${inputBase} ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
  }`;

const Label = ({ children, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="mb-2 block text-sm font-medium text-slate-700"
  >
    {children}
  </label>
);

const FieldError = ({ msg }) =>
  msg ? (
    <p
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600"
    >
      <AlertCircle size={14} className="mt-px shrink-0" />
      {msg}
    </p>
  ) : null;

const Section = ({ step, title, subtitle, done, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
          done
            ? "bg-emerald-500 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {done ? <Check size={16} /> : step}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

const PayAlert = ({ info, message, onClose, onRetry }) => (
  <div
    role="alert"
    className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-left"
  >
    <div className="flex items-start gap-3">
      {info.offline ? (
        <WifiOff size={18} className="mt-0.5 shrink-0 text-red-600" />
      ) : (
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-800">{info.title}</p>
        {message && (
          <p className="mt-0.5 break-words text-xs text-red-700/80">
            {message}
          </p>
        )}
        <p className="mt-2 text-xs font-semibold text-red-800">What to do:</p>
        <ul className="mt-1 space-y-0.5 text-xs text-red-700">
          {info.tips.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function SessionBoard() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const company = params.companyName || params.company;
  const companyName = useMemo(() => {
    try {
      return decodeURIComponent(company || "");
    } catch {
      return company || "";
    }
  }, [company]);

  // always open this page from the TOP (Home's scroll position must not carry over)
  useLayoutEffect(() => {
    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    toTop();
    const id = requestAnimationFrame(toTop);
    return () => cancelAnimationFrame(id);
  }, [companyName]);

  const user = useMemo(() => getUser(), []);
  const userId = useMemo(() => getUserId(), []);

  const [rebook, setRebook] = useState(location.state?.rebook || null);
  useEffect(() => {
    setRebook(location.state?.rebook || null);
  }, [location.state]);

  const [f, setF] = useState(() => makeEmptyForm(user));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // switching single <-> group resets the gender choice (group default = no preference)
  const chooseMode = (m) =>
    setF((p) =>
      p.mode === m
        ? p
        : {
            ...p,
            mode: m,
            gender: m === "group" ? "" : cleanGender(user?.gender),
          },
    );

  const [stage, setStage] = useState(null);
  const [booking, setBooking] = useState(null);
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [showErrors, setShowErrors] = useState(false); // show red field errors after a pay attempt
  const [payStep, setPayStep] = useState(0);
  const [payMode, setPayMode] = useState("online"); // "wallet" | "online"

  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState("");

  const reqIdRef = useRef(null);
  const paymentStartingRef = useRef(false);
  const paymentIdRef = useRef(null);
  const paidByWalletRef = useRef(false);
  const canRetryRef = useRef(false);
  const submittingRef = useRef(false);
  const paidTotalRef = useRef(0);
  const payModeRef = useRef("online");
  const lastFailRef = useRef("");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const isGroup = f.mode === "group";
  const price = isGroup ? groupPriceFor(f.minutes) : priceFor(f.minutes);
  const groupTotal = price * f.members;
  const type =
    SESSION_TYPES.find((t) => t.value === f.sessionType) || SESSION_TYPES[0];

  /* ---------- wallet + profile ---------- */
  const { data: meData, reload: reloadMe } = useLive({
    fetcher: () => api("/auth/me"),
    events: [EVENTS.notification, "wallet:updated"],
    userId,
  });
  const me = meData?.user || meData || null;
  const walletBalance = Math.max(0, Number(me?.walletBalance) || 0);

  const profileGender = cleanGender(me?.gender) || cleanGender(user?.gender);
  const effectiveGender = isGroup
    ? cleanGender(f.gender)
    : profileGender || cleanGender(f.gender);
  const genderLocked = !isGroup && Boolean(profileGender);

  const [useWallet, setUseWallet] = useState(true);
  const canWallet = walletBalance >= price;
  const payWallet = useWallet && canWallet;
  const walletAfter = payWallet ? walletBalance - price : walletBalance;

  /* ---------- convenience fee quote (card / UPI only, never wallet) ---------- */
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    api(`/payments/fee-quote?amount=${price}`)
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [price]);

  const convenienceFee = payWallet ? 0 : Number(quote?.convenienceFee) || 0;
  const bearerManaged = !payWallet && Boolean(quote?.bearerManaged);
  const totalPayable = payWallet ? price : price + convenienceFee;

  const refreshWallet = useCallback(() => {
    if (typeof reloadMe === "function") reloadMe();
    window.dispatchEvent(new Event("profile:updated"));
  }, [reloadMe]);

  /* ---------- roles of this company ---------- */
  useEffect(() => {
    if (!companyName) {
      setDepartments([]);
      setDeptLoading(false);
      return undefined;
    }

    let cancelled = false;
    setDeptLoading(true);
    setDeptError("");

    api(`/mentor/company-departments/${encodeURIComponent(companyName)}`)
      .then((r) => {
        if (cancelled) return;
        setDepartments(Array.isArray(r?.departments) ? r.departments : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setDepartments([]);
        setDeptError(e.message || "Could not load roles");
      })
      .finally(() => {
        if (!cancelled) setDeptLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyName]);

  useEffect(() => {
    if (deptLoading) return;
    setF((p) =>
      p.role && !departments.includes(p.role) ? { ...p, role: "" } : p,
    );
  }, [departments, deptLoading]);

  /* ---------- validation: every problem knows which field it belongs to ---------- */
  const problems = useMemo(() => {
    const p = [];
    if (f.reason.trim().length < 10)
      p.push({
        key: "reason",
        msg: "Write at least 10 characters about what you want to learn",
      });
    {
      const wp = whenProblem(f.date, f.time);
      if (wp) p.push({ key: "when", msg: wp });
    }
    if (isGroup && (f.members < 2 || f.members > MAX_GROUP))
      p.push({ key: "members", msg: `Group size must be 2 to ${MAX_GROUP}` });
    if (!rebook) {
      if (!deptLoading && departments.length === 0)
        p.push({
          key: "role",
          msg: deptError || `No ${companyName} employees have registered yet`,
        });
      else if (!f.role) p.push({ key: "role", msg: "Select a role" });
      if (!isGroup && !effectiveGender)
        p.push({ key: "gender", msg: "Select your gender" });
      if (!f.language)
        p.push({ key: "language", msg: "Select a language" });
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    f,
    rebook,
    departments,
    deptLoading,
    deptError,
    companyName,
    tick,
    isGroup,
    effectiveGender,
  ]);

  // "when" errors show live as soon as date AND time are filled; others after a pay attempt
  const errFor = (key) => {
    const live = key === "when" && Boolean(f.date && f.time);
    return showErrors || live
      ? problems.find((x) => x.key === key)?.msg || ""
      : "";
  };
  const isDone = (key) => !problems.some((x) => x.key === key);

  const reasonDone = isDone("reason");
  const whenDone = isDone("when");
  const guideDone = rebook
    ? true
    : isDone("role") && isDone("language") && isDone("gender");

  const checklist = [
    { key: "reason", label: "Why you want to attend", done: reasonDone },
    { key: "when", label: "Date and time", done: whenDone },
    ...(rebook
      ? []
      : [
          { key: "role", label: "Role", done: isDone("role") },
          { key: "language", label: "Language", done: isDone("language") },
          ...(!isGroup
            ? [{ key: "gender", label: "Your gender", done: isDone("gender") }]
            : []),
        ]),
  ];

  const scrollToField = (key) => {
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.focus?.({ preventScroll: true }), 350);
  };

  /* ---------- live booking updates ---------- */
  const applyBooking = useCallback(
    (b) => {
      if (!b || b.requestGroupId !== reqIdRef.current) return;
      setBooking((prev) => ({ ...(prev || {}), ...b }));
      if (b.status === "accepted") setStage("accepted");
      else if (["expired", "missed", "cancelled"].includes(b.status)) {
        setStage("expired");
        refreshWallet();
      }
    },
    [refreshWallet],
  );

  useUserEvents(userId, { [EVENTS.booking]: applyBooking });

  useEffect(() => {
    if (stage !== "waiting") return undefined;
    const t = setInterval(() => {
      api(ENDPOINTS.booking(reqIdRef.current))
        .then((r) => applyBooking(r.booking))
        .catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, [stage, applyBooking]);

  /* ---------- send the request (after payment / wallet) ---------- */
  const submitBooking = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStage("sending");
    setPayStep(payModeRef.current === "wallet" ? 1 : 2);
    setError("");
    setErrorStatus(0);
    try {
      const res = await api(ENDPOINTS.createBooking, {
        method: "POST",
        body: {
          requestGroupId: reqIdRef.current,
          razorpayPaymentId: paymentIdRef.current,
          companyName,
          preferredMentorId: rebook?.mentorId || undefined,
          requester: {
            fullName: user.fullName || user.name || "Fresher",
            email: user.email || "",
            image: user.image || user.avatar || "",
          },
          sessionDetails: {
            sessionType: type.label,
            sessionTypeValue: type.value,
            reason: f.reason.trim(),
            role: f.role,
            otherRole: "",
            gender: effectiveGender,
            language: f.language,
            duration: f.minutes,
            amount: price, // ORIGINAL session price (never includes the convenience fee)
            date: toApiDate(f.date),
            time: toApiTime(f.time),
            mode: f.mode,
            maxMembers: isGroup ? f.members : 1,
          },
        },
      });
      setNotifiedCount(res.notifiedCount || 0);
      setBooking(res.booking);
      setStage(res.booking.status === "accepted" ? "accepted" : "waiting");
      canRetryRef.current = false;
      refreshWallet();
    } catch (e) {
      setError(e.message);
      setErrorStatus(Number(e.status) || 0);
      setStage("error");
      const s = Number(e.status) || 0;
      canRetryRef.current = !(s >= 400 && s < 500 && s !== 402);
      if (!canRetryRef.current) paymentIdRef.current = null;
      refreshWallet();
    } finally {
      submittingRef.current = false;
    }
  }, [
    companyName,
    user,
    type,
    f,
    price,
    rebook,
    refreshWallet,
    isGroup,
    effectiveGender,
  ]);

  /* ---------- pay ---------- */
  const startPayment = async () => {
    if (paymentStartingRef.current || stage) return;

    // Instead of a dead (disabled) button: show exactly what is missing and jump to it
    if (problems.length) {
      setShowErrors(true);
      scrollToField(problems[0].key);
      return;
    }

    setError("");
    setErrorStatus(0);

    if (!hasEnoughLead(f.date, f.time)) {
      setTick((n) => n + 1);
      setShowErrors(true);
      scrollToField("when");
      return;
    }

    paymentStartingRef.current = true;

    reqIdRef.current = makeRequestId();
    paymentIdRef.current = null;
    paidByWalletRef.current = false;
    canRetryRef.current = false;
    lastFailRef.current = "";
    paidTotalRef.current = totalPayable;
    payModeRef.current = payWallet ? "wallet" : "online";
    setPayMode(payModeRef.current);
    setPayStep(0);

    /* ---- A) wallet (no convenience fee) ---- */
    if (payWallet) {
      setStage("sending");
      try {
        const paid = await api(WALLET_PAY_ENDPOINT, {
          method: "POST",
          body: { amount: price, topic: companyName },
        });
        paymentIdRef.current = paid.paymentId;
        paidByWalletRef.current = true;
        canRetryRef.current = true;
        refreshWallet();
      } catch (e) {
        paymentStartingRef.current = false;
        setError(e.message);
        setErrorStatus(Number(e.status) || 0);
        setStage("error");
        canRetryRef.current = false;
        refreshWallet();
        return;
      }
      await submitBooking();
      return;
    }

    /* ---- B) Razorpay ---- */
    try {
      if (!window.Razorpay)
        throw new Error(
          "Payment gateway failed to load. Please refresh the page.",
        );

      setStage("paying");

      const order = await api(ENDPOINTS.createOrder, {
        method: "POST",
        body: { amount: price },
      });

      const serverCheckoutAmount = Number(
        order?.breakdown?.checkoutAmount ?? order?.checkoutAmount,
      );
      if (Number.isFinite(serverCheckoutAmount) && serverCheckoutAmount > 0) {
        paidTotalRef.current = serverCheckoutAmount;
      } else {
        paidTotalRef.current =
          Number(order?.amount) > 0 ? Number(order.amount) / 100 : totalPayable;
      }

      const rz = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "MNCConnect",
        description: `${isGroup ? "Group · " : ""}${durationLabel(f.minutes)} session · ${companyName}`,
        order_id: order.id,
        prefill: {
          name: user.fullName || user.name || "",
          email: user.email || "",
        },
        theme: { color: "#2563eb" },
        handler: async (response) => {
          lastFailRef.current = "";
          setStage("sending");
          setPayStep(1); // verifying payment
          try {
            const verified = await api(ENDPOINTS.verifyPayment, {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            paymentIdRef.current =
              verified.paymentId || response.razorpay_payment_id;
            canRetryRef.current = true;
            await submitBooking();
          } catch (e) {
            setError(e.message);
            setErrorStatus(Number(e.status) || 0);
            setStage("error");
          }
        },
        modal: {
          ondismiss: () => {
            paymentStartingRef.current = false;
            // if a payment attempt failed before the person closed the window, tell them clearly
            if (lastFailRef.current) {
              setError(`Payment failed: ${lastFailRef.current}`);
              setErrorStatus(0);
            }
            setStage((s) => (s === "paying" ? null : s));
          },
        },
      });

      rz.on("payment.failed", (r) => {
        lastFailRef.current = r?.error?.description || "Payment failed";
        api("/payments/failed", {
          method: "POST",
          body: {
            razorpay_order_id: order.id,
            reason: lastFailRef.current,
          },
        }).catch(() => {});
      });

      rz.open();
    } catch (e) {
      paymentStartingRef.current = false;
      setError(e.message);
      setErrorStatus(Number(e.status) || 0);
      setStage(null);
    }
  };

  const closeAll = () => {
    setStage(null);
    setBooking(null);
    reqIdRef.current = null;
    paymentIdRef.current = null;
    paidByWalletRef.current = false;
    canRetryRef.current = false;
    paidTotalRef.current = 0;
    submittingRef.current = false;
    paymentStartingRef.current = false; // lets the person pay again after closing an error
    lastFailRef.current = "";
    setError("");
    setErrorStatus(0);
  };

  const bookAnother = () => {
    closeAll();
    setF(makeEmptyForm(user));
    setShowErrors(false);
    setNotifiedCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mentor = booking?.mentor;
  const when =
    f.date && f.time
      ? `${toApiDate(f.date)} at ${toApiTime(f.time)}`
      : "Not selected";

  const genderSummary = effectiveGender
    ? `${effectiveGender === "male" ? "Male" : "Female"} employee`
    : isGroup
      ? "No preference"
      : "Not selected";

  const summaryRows = [
    ["Company", companyName],
    ["Purpose", type.label],
    ["Session", isGroup ? `Group (up to ${f.members})` : "Single (1:1)"],
    ["When", when],
    ["Duration", durationLabel(f.minutes)],
    ...(rebook
      ? [["Mentor", rebook.mentorName || "Selected mentor"]]
      : [
          ["Role", f.role || "Not selected"],
          ["Language", f.language || "Not selected"],
          ["Guide", genderSummary],
        ]),
  ];

  const actionWord = isGroup ? "create group" : "send request";
  const payLabel =
    problems.length > 0
      ? `${problems.length} more ${problems.length === 1 ? "detail" : "details"} needed`
      : payWallet
        ? `Pay ${inr(price)} from wallet`
        : `Pay ${inr(totalPayable)} with UPI / Card`;

  const refundedAmount = paidTotalRef.current || price;
  const errInfo = explainError(error, errorStatus);

  const payButtonCls = (disabled) =>
    `w-full rounded-xl py-3.5 text-sm font-bold transition ${
      disabled
        ? "cursor-not-allowed bg-slate-200 text-slate-400"
        : problems.length > 0
          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
          : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
    }`;

  const progressSteps =
    payMode === "wallet"
      ? ["Paying from wallet", "Sending your request"]
      : ["Completing payment", "Verifying payment", "Sending your request"];

  return (
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to="/Home" className="hover:text-slate-900">
            Home
          </Link>
          <ChevronRight size={16} />
          <span>{companyName}</span>
          <ChevronRight size={16} />
          <span className="font-semibold text-slate-900">Book a session</span>
        </div>

        {rebook && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <RotateCcw size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">
                  Booking again with {rebook.mentorName || "your mentor"}
                </p>
                <p className="text-xs text-blue-700">
                  Your request goes only to this mentor. If they can't take it,
                  you are refunded.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRebook(null)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <X size={14} /> Book with anyone instead
            </button>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7">
          <div className="space-y-6">
            {/* 1. SINGLE / GROUP */}
            <Section
              step={1}
              done
              title="How do you want to attend?"
              subtitle="Choose one-to-one, or bring friends and split the cost."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={Boolean(stage)}
                  onClick={() => chooseMode("single")}
                  aria-pressed={!isGroup}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    !isGroup
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${!isGroup ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    <UserRound size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      Single meeting
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Just you and the employee · {inr(priceFor(f.minutes))}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(stage)}
                  onClick={() => chooseMode("group")}
                  aria-pressed={isGroup}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    isGroup
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isGroup ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    <Users size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      Group meeting
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Bring friends · each person pays only{" "}
                      {inr(groupPriceFor(f.minutes))}
                    </span>
                  </span>
                </button>
              </div>

              {isGroup && (
                <div className="mt-5">
                  <Label htmlFor="field-members">
                    Group size (including you, max {MAX_GROUP})
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[2, 3, 4, 5, 10, 20, 30, 40, 60].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={Boolean(stage)}
                        onClick={() => set("members", n)}
                        className={`flex h-11 min-w-[3.25rem] items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition ${
                          f.members === n
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-700 hover:border-blue-300"
                        }`}
                      >
                        <Users size={14} /> {n}
                      </button>
                    ))}
                    <input
                      id="field-members"
                      type="number"
                      min={2}
                      max={MAX_GROUP}
                      value={f.members}
                      disabled={Boolean(stage)}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value) || 2);
                        set("members", Math.min(MAX_GROUP, Math.max(2, n)));
                      }}
                      className="h-11 w-24 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      aria-label="Custom group size"
                    />
                  </div>
                  <FieldError msg={errFor("members")} />
                  {f.members > 6 && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <Info size={14} className="mt-px shrink-0" />
                      Big group (more than 6): students join with camera and mic
                      OFF by default, and can switch them on during the session.
                    </p>
                  )}
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    <p>
                      <b className="text-slate-800">You pay {inr(price)}</b>{" "}
                      now. After booking you get a link. Each friend opens it
                      and pays their own {inr(price)}.
                    </p>
                    <p className="mt-1">
                      If all {f.members} join, the group total is{" "}
                      {inr(groupTotal)}. UPI / card may add a small fee. Wallet
                      payments never do.
                    </p>
                  </div>
                </div>
              )}
            </Section>

            {/* 2. PURPOSE */}
            <Section
              step={2}
              done={reasonDone}
              title="Why do you want to attend?"
              subtitle={
                rebook
                  ? `${rebook.mentorName || "Your mentor"} from ${companyName} will guide you.`
                  : `An employee from ${companyName} will guide ${isGroup ? "your group" : "you"}.`
              }
            >
              <div className="flex flex-wrap gap-2">
                {SESSION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("sessionType", t.value)}
                    aria-pressed={f.sessionType === t.value}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      f.sessionType === t.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-blue-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <Label htmlFor="field-reason">
                  What do you want to learn?
                </Label>
                <textarea
                  id="field-reason"
                  value={f.reason}
                  onChange={(e) => set("reason", e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="e.g. I'm a 2026 CSE graduate. I want to know the hiring process, which skills to prepare and how a referral works."
                  className={`w-full resize-none rounded-xl border p-4 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                    errFor("reason")
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <FieldError msg={errFor("reason")} />
                  </div>
                  <span
                    className={`shrink-0 text-xs ${
                      reasonDone ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {f.reason.trim().length}/10 minimum
                  </span>
                </div>
              </div>
            </Section>

            {/* 3. WHEN */}
            <Section
              step={3}
              done={whenDone}
              title="When?"
              subtitle={`Pick a time at least ${MIN_LEAD_MIN} minutes from now. The meeting room opens ${OPEN_BEFORE_MIN} minutes before your start time.`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="field-when">Date</Label>
                  <input
                    id="field-when"
                    type="date"
                    min={todayISO()}
                    value={f.date}
                    onChange={(e) => set("date", e.target.value)}
                    className={inputCls(Boolean(errFor("when")))}
                  />
                </div>
                <div>
                  <Label htmlFor="field-time">Start time (IST)</Label>
                  <input
                    id="field-time"
                    type="time"
                    value={f.time}
                    onChange={(e) => set("time", e.target.value)}
                    className={inputCls(Boolean(errFor("when")))}
                  />
                </div>
              </div>
              <FieldError msg={errFor("when")} />
              {errFor("when") && f.date && f.time && (
                <button
                  type="button"
                  onClick={() => {
                    const s = earliestSlot();
                    setF((p) => ({ ...p, date: s.date, time: s.time }));
                  }}
                  className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Use the earliest time ({earliestSlot().label})
                </button>
              )}

              <div className="mt-6">
                <Label>
                  {isGroup
                    ? `Duration (${inr(GROUP_RATE_PER_HOUR)} per person per hour)`
                    : `Duration (${inr(priceFor(60))} per hour)`}
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set("minutes", m)}
                      aria-pressed={f.minutes === m}
                      className={`rounded-xl border px-3 py-3 text-center transition ${
                        f.minutes === m
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 text-slate-700 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-sm font-bold">
                        {durationLabel(m)}
                      </div>
                      <div className="mt-0.5 text-xs">
                        {inr(isGroup ? groupPriceFor(m) : priceFor(m))}
                        {isGroup ? " / person" : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* 4. PREFERENCES */}
            {!rebook && (
              <Section
                step={4}
                done={guideDone}
                title={`Who should guide ${isGroup ? "your group" : "you"}?`}
                subtitle="We send your request only to employees who match these choices."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="field-role">
                      Role you want guidance for
                    </Label>
                    <select
                      id="field-role"
                      value={f.role}
                      onChange={(e) => set("role", e.target.value)}
                      disabled={deptLoading || departments.length === 0}
                      className={inputCls(Boolean(errFor("role")))}
                    >
                      <option value="">
                        {deptLoading
                          ? "Loading roles…"
                          : departments.length
                            ? "Select role"
                            : "No roles available"}
                      </option>
                      {departments.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <FieldError msg={errFor("role")} />
                    {!errFor("role") && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        {!deptLoading && departments.length === 0
                          ? deptError ||
                            `No ${companyName} employees have registered yet.`
                          : `Roles of ${companyName} employees on MNCConnect.`}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="field-language">Preferred language</Label>
                    <select
                      id="field-language"
                      value={f.language}
                      onChange={(e) => set("language", e.target.value)}
                      className={inputCls(Boolean(errFor("language")))}
                    >
                      <option value="">Select language</option>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <FieldError msg={errFor("language")} />
                    {!errFor("language") && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Only employees who speak this language get your request.
                      </p>
                    )}
                  </div>

                  {/* GENDER */}
                  {isGroup ? (
                    <div>
                      <Label htmlFor="field-gender">
                        Employee gender for your group
                      </Label>
                      <select
                        id="field-gender"
                        value={f.gender}
                        onChange={(e) => set("gender", e.target.value)}
                        className={inputCls(false)}
                      >
                        {GROUP_GENDER_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-slate-400">
                        You choose. "No preference" sends it to any employee.
                      </p>
                    </div>
                  ) : genderLocked ? (
                    <div>
                      <Label>Your gender</Label>
                      <div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold capitalize text-slate-700">
                        {profileGender}
                        <Lock size={15} className="text-slate-400" />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Matched with a {profileGender} employee (taken from your
                        account).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="field-gender">Your gender</Label>
                      <select
                        id="field-gender"
                        value={f.gender}
                        onChange={(e) => set("gender", e.target.value)}
                        className={inputCls(Boolean(errFor("gender")))}
                      >
                        {SINGLE_GENDER_FALLBACK.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      <FieldError msg={errFor("gender")} />
                      {!errFor("gender") && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          You are matched with an employee of the same gender.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* HOW IT WORKS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck size={20} />
                </div>
                <div className="space-y-2 text-sm text-slate-500">
                  <h3 className="text-sm font-bold text-slate-900">
                    What happens after you pay
                  </h3>
                  {rebook ? (
                    <>
                      <p>
                        <b className="text-slate-900">1.</b> Your request goes
                        only to {rebook.mentorName || "your mentor"}.
                      </p>
                      <p>
                        <b className="text-slate-900">2.</b> When they accept,
                        your session is confirmed.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <b className="text-slate-900">1.</b> Your request goes
                        to every matching employee who is online.
                      </p>
                      <p>
                        <b className="text-slate-900">2.</b> The first employee
                        to accept gets your session.
                      </p>
                    </>
                  )}
                  {isGroup && (
                    <p>
                      <b className="text-slate-900">+</b> Share your group link.
                      Each friend pays {inr(price)} and joins. Friends can join
                      until the session starts. Unfilled spots are left empty.
                    </p>
                  )}
                  <p>
                    <b className="text-slate-900">3.</b> You both get an alert{" "}
                    {OPEN_BEFORE_MIN} minutes before. Read the instructions
                    first. Your camera turns on and the timer starts only after
                    the employee and you (the host) accept.
                  </p>
                  <p>
                    <b className="text-slate-900">4.</b> If nobody accepts
                    before your start time, or the session does not start,{" "}
                    {isGroup ? "everyone in the group is" : "you are"} refunded
                    automatically.
                  </p>
                  <p>
                    <b className="text-slate-900">5.</b> After the session,{" "}
                    {isGroup ? "the host confirms" : "confirm"} and leave your
                    review inside the meeting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- SUMMARY + PAYMENT ---------- */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-slate-950">Your booking</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {summaryRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-semibold text-slate-900">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* WHAT IS LEFT */}
              <div
                className={`mt-5 rounded-xl border p-3 ${
                  problems.length === 0
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    problems.length === 0
                      ? "text-emerald-800"
                      : "text-slate-700"
                  }`}
                >
                  {problems.length === 0
                    ? "All set. You can pay now."
                    : `Before you pay (${checklist.filter((c) => c.done).length}/${checklist.length} done)`}
                </p>
                {problems.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {checklist.map((c) => (
                      <li key={c.key}>
                        <button
                          type="button"
                          disabled={c.done}
                          onClick={() => {
                            setShowErrors(true);
                            scrollToField(c.key);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs ${
                            c.done
                              ? "text-slate-400 line-through"
                              : "font-semibold text-slate-800 hover:bg-white"
                          }`}
                        >
                          {c.done ? (
                            <CheckCircle2
                              size={14}
                              className="shrink-0 text-emerald-500"
                            />
                          ) : (
                            <Circle
                              size={14}
                              className="shrink-0 text-amber-500"
                            />
                          )}
                          {c.label}
                          {!c.done && (
                            <span className="ml-auto text-blue-600">Fix</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* PAYMENT METHOD */}
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  How do you want to pay?
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!canWallet || Boolean(stage)}
                    onClick={() => setUseWallet(true)}
                    aria-pressed={payWallet}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      payWallet
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200"
                    } ${!canWallet ? "cursor-not-allowed opacity-70" : "hover:border-indigo-300"}`}
                  >
                    <Wallet size={18} className="mt-0.5 text-indigo-600" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between text-sm font-semibold text-slate-900">
                        Wallet
                        <span className="tabular-nums text-indigo-700">
                          {me ? inr(walletBalance) : "₹–"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {!me
                          ? "Checking your wallet…"
                          : !canWallet
                            ? walletBalance > 0
                              ? `Not enough balance. You need ${inr(price - walletBalance)} more.`
                              : "Your wallet is empty."
                            : `No extra fee. Balance after booking: ${inr(walletAfter)}`}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(stage)}
                    onClick={() => setUseWallet(false)}
                    aria-pressed={!payWallet}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      !payWallet
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <CreditCard size={18} className="mt-0.5 text-blue-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        UPI / Card / Net banking
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {bearerManaged
                          ? "A small fee is shown at checkout before you confirm."
                          : "You will pay in a secure window."}
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* PRICE BREAKDOWN */}
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Session price</span>
                  <span className="font-semibold text-slate-900">
                    {inr(price)}
                  </span>
                </div>
                {!payWallet && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Convenience fee</span>
                    <span className="font-semibold text-slate-900">
                      {inr(convenienceFee)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-medium text-slate-700">
                    {isGroup ? "You pay (per person)" : "Total to pay"}
                  </span>
                  <span className="text-2xl font-extrabold text-slate-950">
                    {inr(totalPayable)}
                  </span>
                </div>
                {isGroup && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {f.members} people × {inr(price)} = {inr(groupTotal)} when
                    everyone joins. Each friend pays their own share.
                  </p>
                )}
              </div>

              {/* PAYMENT ERROR (right next to the button) */}
              {error && !stage && (
                <PayAlert
                  info={errInfo}
                  message={error}
                  onClose={() => {
                    setError("");
                    setErrorStatus(0);
                  }}
                  onRetry={() => {
                    setError("");
                    setErrorStatus(0);
                    startPayment();
                  }}
                />
              )}

              <button
                type="button"
                onClick={startPayment}
                disabled={Boolean(stage)}
                className={`mt-5 hidden lg:block ${payButtonCls(Boolean(stage))}`}
              >
                {payLabel}
              </button>
              {problems.length === 0 && (
                <p className="mt-2 hidden text-center text-xs text-slate-500 lg:block">
                  Then we will {actionWord} to {companyName} employees
                </p>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                <ShieldCheck size={13} /> Secure payment · automatic refund if
                nobody accepts
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- sticky pay bar (mobile) ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] text-slate-500">
              {isGroup ? "You pay" : "Total"}
            </p>
            <p className="text-lg font-extrabold leading-tight text-slate-950">
              {inr(totalPayable)}
            </p>
          </div>
          <button
            type="button"
            onClick={startPayment}
            disabled={Boolean(stage)}
            className={payButtonCls(Boolean(stage))}
          >
            {payLabel}
          </button>
        </div>
      </div>

      {/* ---------- status modals ---------- */}
      {(stage === "paying" || stage === "sending") && (
        <Overlay>
          <Loader2 size={34} className="mx-auto animate-spin text-blue-600" />
          <h3 className="mt-5 text-xl font-bold text-slate-900">
            {stage === "paying"
              ? "Opening secure payment…"
              : "Almost done…"}
          </h3>

          {stage === "sending" && (
            <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
              {progressSteps.map((s, i) => {
                const state =
                  i < payStep ? "done" : i === payStep ? "active" : "todo";
                return (
                  <li key={s} className="flex items-center gap-2.5 text-sm">
                    {state === "done" ? (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-emerald-500"
                      />
                    ) : state === "active" ? (
                      <Loader2
                        size={18}
                        className="shrink-0 animate-spin text-blue-600"
                      />
                    ) : (
                      <Circle size={18} className="shrink-0 text-slate-300" />
                    )}
                    <span
                      className={
                        state === "todo"
                          ? "text-slate-400"
                          : "font-medium text-slate-800"
                      }
                    >
                      {s}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {stage === "paying" && (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Payment window did not appear? Allow pop-ups for this site, then
              try again.
            </p>
          )}
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Please don't close this page or press back.
          </p>
        </Overlay>
      )}

      {stage === "waiting" && (
        <Overlay>
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
            <div className="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />
            <Send size={30} className="text-blue-600" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">
            {isGroup ? "Group created" : "Request sent"}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            {rebook
              ? notifiedCount > 0
                ? `Sent to ${rebook.mentorName || "your mentor"}. Your session is confirmed as soon as they accept.`
                : `${rebook.mentorName || "Your mentor"} is not online right now. They will see your request when they come online, before your start time.`
              : notifiedCount > 0
                ? `Sent to ${notifiedCount} online ${companyName} employee${notifiedCount > 1 ? "s" : ""}. The first one to accept gets your session.`
                : `No matching ${companyName} employee is online right now. We'll offer it to anyone matching who comes online before your start time.`}
          </p>

          <InviteBox booking={booking} perPerson={price} />

          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            <Loader2 size={16} className="animate-spin" />{" "}
            {rebook
              ? `Waiting for ${rebook.mentorName || "your mentor"} to accept…`
              : "Waiting for an employee to accept…"}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <TimerReset size={14} /> Not accepted before {toApiTime(f.time)}?{" "}
            {isGroup ? "Everyone is" : "You're"} refunded automatically.
          </p>
          <button
            type="button"
            onClick={() => navigate("/Home/my-bookings")}
            className="mt-5 text-sm font-semibold text-blue-600 hover:underline"
          >
            You can leave this page. Track it in My Bookings
          </button>
        </Overlay>
      )}

      {stage === "accepted" && (
        <Overlay>
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            Session confirmed
          </h2>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            {mentor?.image ? (
              <img
                src={mentor.image}
                alt={mentor.name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200">
                <UserRound className="text-slate-500" />
              </div>
            )}
            <div className="min-w-0 text-sm">
              <p className="text-base font-bold text-slate-900">
                {mentor?.name || "Employee"}
              </p>
              {mentor?.designation && (
                <p className="flex items-center gap-1.5 text-slate-500">
                  <Briefcase size={13} />
                  {mentor.designation}
                </p>
              )}
              {mentor?.email && (
                <p className="flex items-center gap-1.5 break-all text-slate-500">
                  <Mail size={13} />
                  {mentor.email}
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {booking?.date} at {booking?.time}. The meeting room opens{" "}
            {OPEN_BEFORE_MIN} minutes before, and we'll send you an alert.
          </p>

          <InviteBox booking={booking} perPerson={price} />

          <button
            type="button"
            onClick={() => navigate("/Home/my-bookings")}
            className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Go to My Bookings
          </button>
          <button
            type="button"
            onClick={bookAnother}
            className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Book another session
          </button>
        </Overlay>
      )}

      {stage === "expired" && (
        <Overlay>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <IndianRupee size={34} className="text-amber-600" />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-slate-900">
            Amount refunded
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            {rebook
              ? `${rebook.mentorName || "Your mentor"} could not take this session.`
              : "Nobody accepted your request in time."}{" "}
            {paidByWalletRef.current
              ? `${inr(refundedAmount)} is back in your wallet.`
              : `${inr(refundedAmount)} (including any convenience fee) is being refunded to your wallet or original payment method.`}
            {isGroup && " Friends who joined are refunded to their wallets."}
          </p>
          <button
            type="button"
            onClick={closeAll}
            className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Book a new time
          </button>
        </Overlay>
      )}

      {stage === "error" && (
        <Overlay>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            {errInfo.offline ? (
              <WifiOff size={30} className="text-red-500" />
            ) : (
              <AlertTriangle size={30} className="text-red-500" />
            )}
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {errInfo.title}
          </h2>
          {error && (
            <p className="mt-2 break-words text-xs text-slate-500">{error}</p>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-xs font-bold text-slate-800">What to do</p>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
              {errInfo.tips.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </div>

          {canRetryRef.current ? (
            <>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700">
                <ShieldCheck size={14} /> Your payment is safe. Retry, or it
                will be refunded.
              </p>
              <button
                type="button"
                onClick={submitBooking}
                className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={closeAll}
                className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500">
                No money was taken. If any amount was deducted, it is refunded
                automatically.
              </p>
              <button
                type="button"
                onClick={closeAll}
                className="mt-5 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Go back and try again
              </button>
            </>
          )}
        </Overlay>
      )}
    </div>
  );
}

/* ---------- invite link (group only) ---------- */
const InviteBox = ({ booking, perPerson }) => {
  const [copied, setCopied] = useState(false);
  if (!booking || booking.mode !== "group" || !booking.inviteCode) return null;

  const link = `${window.location.origin}/Home/join/${booking.inviteCode}`;
  const joined = booking.members?.length || 1;
  const host = booking.members?.[0]?.name;
  const seatsLeft = Math.max(0, (booking.maxMembers || 0) - joined);

  // ONE message with the link inside it (do NOT send the link again as `url`,
  // otherwise WhatsApp shows it twice)
  const message = [
    `Hi! 👋 ${host ? `${host} here. ` : ""}I booked a live MNCConnect group meeting with an employee from ${booking.companyName || "a top company"} and I'd love for you to join me.`,
    "",
    `📌 Topic: ${booking.sessionType || "Career guidance"}`,
    `📅 Date: ${booking.date}`,
    `🕒 Time: ${booking.time} (${durationLabel(booking.durationMinutes)})`,
    `💰 Your share: only ${inr(perPerson)} per person`,
    `👥 Seats: ${seatsLeft > 0 ? `${seatsLeft} left` : "limited"} (max ${booking.maxMembers} people)`,
    "",
    "Tap the link below, pay your share and your seat is confirmed. You can join until the session starts:",
    link,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this message", message);
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "MNCConnect group session",
          text: message,
        });
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(message)}`,
          "_blank",
          "noopener",
        );
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-900">
          <Users size={15} /> Invite your friends
        </p>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          {joined}/{booking.maxMembers} joined
        </span>
      </div>
      <p className="mt-1 text-xs text-indigo-700">
        Each friend pays {inr(perPerson)} for their own seat.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
          {link}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          <Share2 size={13} /> Share
        </button>
      </div>
    </div>
  );
};

const Overlay = ({ children }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl bg-white px-6 py-8 text-center shadow-2xl sm:px-7 sm:py-9">
      {children}
    </div>
  </div>
);