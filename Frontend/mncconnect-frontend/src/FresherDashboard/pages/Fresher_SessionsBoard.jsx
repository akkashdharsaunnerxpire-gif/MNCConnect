import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, CheckCircle2, ChevronRight, IndianRupee, Loader2,
  ShieldCheck, Send, UserRound, Briefcase, Mail, TimerReset, AlertTriangle, RotateCcw, X,
} from "lucide-react";
import useUserEvents from "../../hooks/useUserEvents";
import {
  api, ENDPOINTS, EVENTS, DURATIONS, durationLabel, priceFor, getUser, getUserId,
  toApiDate, toApiTime, startFrom, inr,
} from "../../services/fresherApi";

const SESSION_TYPES = [
  { value: "company_prep", label: "How to get into this company" },
  { value: "interview_ideas", label: "Interview preparation" },
  { value: "referral", label: "Referral guidance" },
  { value: "road_map", label: "Road map & skills" },
  { value: "any_queries", label: "Any queries" },
];

const ROLE_OPTIONS = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst",
  "Data Scientist", "DevOps Engineer", "Cloud Engineer", "UI/UX Designer", "Product Manager", "QA Engineer", "Other",
];
const GENDER_OPTIONS = [{ value: "", label: "No preference" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }];
const LANGUAGE_OPTIONS = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"];

const MIN_LEAD_MIN = 15;
const makeRequestId = () => `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY_FORM = {
  sessionType: SESSION_TYPES[0].value, reason: "", date: "", time: "",
  role: "", otherRole: "", gender: "", language: "", minutes: 60,
};

const inputCls =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const Label = ({ children }) => <label className="mb-2 block text-sm font-medium text-slate-700">{children}</label>;

export default function SessionBoard() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const company = params.companyName || params.company;
  const companyName = useMemo(() => {
    try { return decodeURIComponent(company || ""); } catch { return company || ""; }
  }, [company]);

  const user = useMemo(() => getUser(), []);
  const userId = useMemo(() => getUserId(), []);

  // "Book again" from My Bookings -> { mentorId, mentorName, companyName }
  const [rebook, setRebook] = useState(location.state?.rebook || null);

  // Keep rebook in sync if we arrive here again with different navigation state
  // (e.g. Book again with another mentor while this page is already mounted).
  useEffect(() => {
    setRebook(location.state?.rebook || null);
  }, [location.state]);

  const [f, setF] = useState(EMPTY_FORM);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const [stage, setStage] = useState(null); // paying | sending | waiting | accepted | expired | error
  const [booking, setBooking] = useState(null);
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [error, setError] = useState("");

  const reqIdRef = useRef(null);
  const paymentIdRef = useRef(null);

  const price = priceFor(f.minutes);
  const type = SESSION_TYPES.find((t) => t.value === f.sessionType) || SESSION_TYPES[0];

  /* ---------- validation ---------- */
  const problems = useMemo(() => {
    const p = [];
    if (f.reason.trim().length < 10) p.push("Tell us why you want to attend (at least 10 characters)");
    if (!f.date || !f.time) p.push("Choose a date and time");
    else if (startFrom(f.date, f.time).getTime() < Date.now() + MIN_LEAD_MIN * 60000)
      p.push(`Choose a time at least ${MIN_LEAD_MIN} minutes from now`);
    // role / language / gender only matter when the request goes to everyone
    if (!rebook) {
      if (!f.role) p.push("Select a role");
      if (f.role === "Other" && !f.otherRole.trim()) p.push("Enter your role");
      if (!f.language) p.push("Select your language before paying");
    }
    return p;
  }, [f, rebook]);

  /* ---------- live booking updates ---------- */
  const applyBooking = useCallback((b) => {
    if (!b || b.requestGroupId !== reqIdRef.current) return;
    setBooking((prev) => ({ ...(prev || {}), ...b }));
    if (b.status === "accepted") setStage("accepted");
    else if (["expired", "missed", "cancelled"].includes(b.status)) setStage("expired");
  }, []);

  useUserEvents(userId, { [EVENTS.booking]: applyBooking });

  useEffect(() => {
    if (stage !== "waiting") return undefined;
    const t = setInterval(() => {
      api(ENDPOINTS.booking(reqIdRef.current)).then((r) => applyBooking(r.booking)).catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, [stage, applyBooking]);

  /* ---------- send the request (after payment) ---------- */
  const submitBooking = useCallback(async () => {
    setStage("sending");
    setError("");
    try {
      const res = await api(ENDPOINTS.createBooking, {
        method: "POST",
        body: {
          requestGroupId: reqIdRef.current,
          razorpayPaymentId: paymentIdRef.current,
          companyName,
          preferredMentorId: rebook?.mentorId || undefined, // book again -> only this mentor gets it
          requester: { fullName: user.fullName || user.name || "Fresher", email: user.email || "", image: user.image || user.avatar || "" },
          sessionDetails: {
            sessionType: type.label,
            sessionTypeValue: type.value,
            reason: f.reason.trim(),
            role: f.role,
            otherRole: f.role === "Other" ? f.otherRole.trim() : "",
            gender: f.gender,
            language: f.language,
            duration: f.minutes,
            amount: price,
            date: toApiDate(f.date),
            time: toApiTime(f.time),
          },
        },
      });
      setNotifiedCount(res.notifiedCount || 0);
      setBooking(res.booking);
      setStage(res.booking.status === "accepted" ? "accepted" : "waiting");
    } catch (e) {
      setError(e.message);
      setStage("error");
      paymentIdRef.current = e.status && e.status !== 402 ? null : paymentIdRef.current; // 4xx = server refunded
    }
  }, [companyName, user, type, f, price, rebook]);

  /* ---------- pay ---------- */
  const startPayment = async () => {
    if (problems.length) return;
    setError("");

    try {
      if (!window.Razorpay) throw new Error("Payment gateway failed to load. Please refresh the page.");

      reqIdRef.current = makeRequestId(); // ovvoru booking-kum pudhu id, so rebook pannalaam
      paymentIdRef.current = null;
      setStage("paying");

      const order = await api(ENDPOINTS.createOrder, { method: "POST", body: { amount: price } });

      const rz = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "MNCConnect",
        description: `${durationLabel(f.minutes)} session · ${companyName}`,
        order_id: order.id,
        prefill: { name: user.fullName || user.name || "", email: user.email || "" },
        theme: { color: "#2563eb" },
        handler: async (response) => {
          try {
            const verified = await api(ENDPOINTS.verifyPayment, {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            paymentIdRef.current = verified.paymentId || response.razorpay_payment_id;
            await submitBooking();
          } catch (e) {
            setError(e.message);
            setStage("error");
          }
        },
        modal: { ondismiss: () => setStage((s) => (s === "paying" ? null : s)) },
      });
      rz.open();
    } catch (e) {
      setError(e.message);
      setStage(null);
    }
  };

  const closeAll = () => {
    setStage(null);
    setBooking(null);
    reqIdRef.current = null;
    paymentIdRef.current = null;
    setError("");
  };

  // Already book pannina apram vera session book panna: form + state full reset
  const bookAnother = () => {
    closeAll();
    setF(EMPTY_FORM);
    setNotifiedCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mentor = booking?.mentor;
  const when = f.date && f.time ? `${toApiDate(f.date)} at ${toApiTime(f.time)}` : "Not selected";

  const summaryRows = [
    ["Company", companyName],
    ["Purpose", type.label],
    ["When", when],
    ["Duration", durationLabel(f.minutes)],
    ...(rebook
      ? [["Mentor", rebook.mentorName || "Selected mentor"]]
      : [
          ["Role", f.role === "Other" ? f.otherRole || "Other" : f.role || "Not selected"],
          ["Language", f.language || "Not selected"],
        ]),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-7 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/Home" className="hover:text-slate-900">Home</Link>
          <ChevronRight size={16} />
          <span>{companyName}</span>
          <ChevronRight size={16} />
          <span className="font-semibold text-slate-900">Book a session</span>
        </div>

        {/* BOOK AGAIN BANNER */}
        {rebook && (
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><RotateCcw size={18} /></div>
              <div>
                <p className="text-sm font-bold text-blue-900">Booking again with {rebook.mentorName || "your mentor"}</p>
                <p className="text-xs text-blue-700">Your request goes only to this mentor. If they can't take it, you are refunded.</p>
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

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-7">
            {/* PURPOSE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Why do you want to attend?</h2>
              <p className="mt-1 text-sm text-slate-500">
                {rebook ? `${rebook.mentorName || "Your mentor"} from ${companyName} will guide you.` : `An employee from ${companyName} will guide you.`}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {SESSION_TYPES.map((t) => (
                  <button
                    key={t.value} type="button" onClick={() => set("sessionType", t.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      f.sessionType === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <Label>Reason (what do you want to learn?)</Label>
                <textarea
                  value={f.reason} onChange={(e) => set("reason", e.target.value)} rows={4} maxLength={1000}
                  placeholder="e.g. I'm a 2026 CSE graduate. I want to know the hiring process, which skills to prepare and how a referral works."
                  className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* WHEN */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950"><CalendarDays size={20} /> When?</h2>
              <p className="mt-1 text-sm text-slate-500">The meeting room opens 5 minutes before your start time.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Date</Label>
                  <input type="date" min={todayISO()} value={f.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <Label>Start time (IST)</Label>
                  <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="mt-6">
                <Label>Duration (₹400 per hour)</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {DURATIONS.map((m) => (
                    <button
                      key={m} type="button" onClick={() => set("minutes", m)}
                      className={`rounded-xl border px-3 py-3 text-center transition ${
                        f.minutes === m ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 text-slate-700 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-sm font-bold">{durationLabel(m)}</div>
                      <div className="mt-0.5 text-xs">{inr(priceFor(m))}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PREFERENCES (hidden for book again: the mentor is already chosen) */}
            {!rebook && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Who should guide you?</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Role you want guidance for</Label>
                    <select value={f.role} onChange={(e) => set("role", e.target.value)} className={inputCls}>
                      <option value="">Select role</option>
                      {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  {f.role === "Other" && (
                    <div>
                      <Label>Enter your role</Label>
                      <input value={f.otherRole} onChange={(e) => set("otherRole", e.target.value)} className={inputCls} placeholder="Role" />
                    </div>
                  )}
                  <div>
                    <Label>Preferred language</Label>
                    <select value={f.language} onChange={(e) => set("language", e.target.value)} className={inputCls}>
                      <option value="">Select language</option>
                      {LANGUAGE_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                    <p className="mt-1.5 text-xs text-slate-400">Only employees who speak this language get your request.</p>
                  </div>
                  <div>
                    <Label>Gender preference</Label>
                    <select value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                      {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* HOW IT WORKS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck size={20} /></div>
                <div className="space-y-2 text-sm text-slate-500">
                  <h3 className="text-sm font-bold text-slate-900">How it works</h3>
                  {rebook ? (
                    <>
                      <p><b className="text-slate-900">1.</b> Pay. Your request goes only to {rebook.mentorName || "your mentor"}.</p>
                      <p><b className="text-slate-900">2.</b> When they accept, your session is confirmed.</p>
                    </>
                  ) : (
                    <>
                      <p><b className="text-slate-900">1.</b> Pay. Your request goes to every matching employee who is online.</p>
                      <p><b className="text-slate-900">2.</b> The first employee to accept gets your session.</p>
                    </>
                  )}
                  <p><b className="text-slate-900">3.</b> You both get an alert 5 minutes before. Read the instructions first. Your camera turns on and the timer starts only after both of you accept.</p>
                  <p><b className="text-slate-900">4.</b> If nobody accepts before your start time, you are refunded automatically.</p>
                  <p><b className="text-slate-900">5.</b> After the session, confirm and leave your review inside the meeting.</p>
                </div>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Summary</h2>
              <dl className="mt-5 space-y-3 text-sm">
                {summaryRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-semibold text-slate-900">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="text-2xl font-extrabold text-slate-950">{inr(price)}</dd>
                </div>
              </dl>

              {problems.length > 0 && (
                <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  {problems.map((p) => <li key={p}>• {p}</li>)}
                </ul>
              )}
              {error && !stage && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                type="button" onClick={startPayment} disabled={problems.length > 0 || Boolean(stage)}
                className={`mt-5 w-full rounded-xl py-3.5 text-sm font-bold transition ${
                  problems.length === 0 && !stage ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                Pay {inr(price)} & send request
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">Secure payment · automatic refund if nobody accepts</p>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- status modals ---------- */}
      {(stage === "paying" || stage === "sending") && (
        <Overlay>
          <Loader2 size={34} className="mx-auto animate-spin text-blue-600" />
          <h3 className="mt-5 text-xl font-bold text-slate-900">{stage === "paying" ? "Opening secure payment…" : "Sending your request…"}</h3>
          <p className="mt-2 text-sm text-slate-500">Please don't close this page.</p>
        </Overlay>
      )}

      {stage === "waiting" && (
        <Overlay>
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
            <div className="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />
            <Send size={30} className="text-blue-600" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Request sent</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            {rebook
              ? notifiedCount > 0
                ? `Sent to ${rebook.mentorName || "your mentor"}. Your session is confirmed as soon as they accept.`
                : `${rebook.mentorName || "Your mentor"} is not online right now. They will see your request when they come online, before your start time.`
              : notifiedCount > 0
                ? `Sent to ${notifiedCount} online ${companyName} employee${notifiedCount > 1 ? "s" : ""}. The first one to accept gets your session.`
                : `No ${companyName} employee is online right now. We'll offer it to anyone who comes online before your start time.`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            <Loader2 size={16} className="animate-spin" /> {rebook ? `Waiting for ${rebook.mentorName || "your mentor"} to accept…` : "Waiting for an employee to accept…"}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <TimerReset size={14} /> Not accepted before {toApiTime(f.time)}? You're refunded automatically.
          </p>
          <button type="button" onClick={() => navigate("/Home/my-bookings")} className="mt-5 text-sm font-semibold text-blue-600 hover:underline">
            You can leave this page, track it in My Bookings
          </button>
        </Overlay>
      )}

      {stage === "accepted" && (
        <Overlay>
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Session confirmed</h2>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            {mentor?.image ? (
              <img src={mentor.image} alt={mentor.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200"><UserRound className="text-slate-500" /></div>
            )}
            <div className="min-w-0 text-sm">
              <p className="text-base font-bold text-slate-900">{mentor?.name || "Employee"}</p>
              {mentor?.designation && <p className="flex items-center gap-1.5 text-slate-500"><Briefcase size={13} />{mentor.designation}</p>}
              {mentor?.email && <p className="flex items-center gap-1.5 break-all text-slate-500"><Mail size={13} />{mentor.email}</p>}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {booking?.date} at {booking?.time}. The meeting room opens 5 minutes before, and we'll send you an alert.
          </p>
          <button type="button" onClick={() => navigate("/Home/my-bookings")} className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">
            Go to My Bookings
          </button>
          <button type="button" onClick={bookAnother} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Book another session
          </button>
        </Overlay>
      )}

      {stage === "expired" && (
        <Overlay>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50"><IndianRupee size={34} className="text-amber-600" /></div>
          <h2 className="mt-5 text-2xl font-bold text-slate-900">Amount refunded</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            {rebook ? `${rebook.mentorName || "Your mentor"} could not take this session.` : "Nobody accepted your request in time."}{" "}
            {inr(booking?.amount || price)} is being refunded to your payment method.
          </p>
          <button type="button" onClick={closeAll} className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">OK</button>
        </Overlay>
      )}

      {stage === "error" && (
        <Overlay>
          <AlertTriangle size={40} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">We couldn't send your request</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          {paymentIdRef.current ? (
            <>
              <p className="mt-2 text-xs text-slate-400">Your payment is safe. Retry, or it will be refunded.</p>
              <button type="button" onClick={submitBooking} className="mt-5 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Retry</button>
              <button type="button" onClick={closeAll} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">Close</button>
            </>
          ) : (
            <button type="button" onClick={closeAll} className="mt-5 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">OK</button>
          )}
        </Overlay>
      )}
    </div>
  );
}

const Overlay = ({ children }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl bg-white px-7 py-9 text-center shadow-2xl">{children}</div>
  </div>
);