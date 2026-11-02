// src/FresherDashboard/pages/JoinGroup.jsx
// Route:  /Home/join/:code     (friend opens the invite link, pays own share, joins the group)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, Clock3, Loader2, Users, Wallet, UserRound,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import {
  api, ENDPOINTS, EVENTS, durationLabel, getUser, getUserId, inr,
} from "../../services/fresherApi";

const WALLET_PAY_ENDPOINT = ENDPOINTS.payWithWallet || "/payments/pay-with-wallet";

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const userId = useMemo(() => getUserId(), []);

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [stage, setStage] = useState(null); // paying | joining | joined | error
  const [error, setError] = useState("");

  const paymentIdRef = useRef(null);
  const canRetryRef = useRef(false);

  /* ---------- wallet ---------- */
  const { data: meData, reload: reloadMe } = useLive({
    fetcher: () => api("/auth/me"),
    events: [EVENTS.notification, "wallet:updated"],
    userId,
  });
  const me = meData?.user || meData || null;
  const walletBalance = Math.max(0, Number(me?.walletBalance) || 0);
  const price = Number(invite?.perPersonAmount) || 0;

  const [useWallet, setUseWallet] = useState(true);
  const canWallet = Boolean(invite) && walletBalance >= price;
  const payWallet = useWallet && canWallet;

  const refreshWallet = useCallback(() => {
    if (typeof reloadMe === "function") reloadMe();
    window.dispatchEvent(new Event("profile:updated"));
  }, [reloadMe]);

  /* ---------- load invite ---------- */
  const loadInvite = useCallback(async () => {
    try {
      const r = await api(`/bookings/invite/${encodeURIComponent(code || "")}`);
      setInvite(r.invite);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "This invite link is not valid.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setLoading(true);
    loadInvite();
  }, [loadInvite]);

  /* ---------- join (AFTER payment) ---------- */
  const joinNow = useCallback(async () => {
    setStage("joining");
    setError("");
    try {
      await api("/bookings/join", {
        method: "POST",
        body: { inviteCode: code, razorpayPaymentId: paymentIdRef.current },
      });
      canRetryRef.current = false;
      setStage("joined");
      refreshWallet();
      loadInvite();
    } catch (e) {
      setError(e.message);
      setStage("error");
      // 4xx (except 402) = the server already refunded -> nothing to retry
      const s = Number(e.status) || 0;
      canRetryRef.current = !(s >= 400 && s < 500 && s !== 402);
      if (!canRetryRef.current) paymentIdRef.current = null;
      refreshWallet();
    }
  }, [code, refreshWallet, loadInvite]);

  /* ---------- pay ---------- */
  const startPayment = async () => {
    if (!invite?.open) return;
    setError("");
    paymentIdRef.current = null;
    canRetryRef.current = false;

    /* A) wallet */
    if (payWallet) {
      setStage("joining");
      try {
        const paid = await api(WALLET_PAY_ENDPOINT, {
          method: "POST",
          body: { amount: price, topic: invite.companyName },
        });
        paymentIdRef.current = paid.paymentId;
        canRetryRef.current = true;
        refreshWallet();
      } catch (e) {
        setError(e.message);
        setStage("error");
        refreshWallet();
        return;
      }
      await joinNow();
      return;
    }

    /* B) Razorpay */
    try {
      if (!window.Razorpay) throw new Error("Payment gateway failed to load. Please refresh the page.");
      setStage("paying");

      const order = await api(ENDPOINTS.createOrder, { method: "POST", body: { amount: price } });

      const rz = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "MNCConnect",
        description: `Group session · ${invite.companyName}`,
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
            canRetryRef.current = true;
            await joinNow();
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

  const closeError = () => {
    setStage(null);
    setError("");
    paymentIdRef.current = null;
    canRetryRef.current = false;
    loadInvite();
  };

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto text-amber-500" size={40} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Invite link problem</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError || "This invite link is not valid."}</p>
          <Link to="/Home" className="mt-6 inline-block rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const statusText = invite.alreadyJoined
    ? "You are already in this group."
    : invite.spotsLeft <= 0
      ? "This group is full."
      : !invite.open
        ? "This group is closed (session started, cancelled or finished)."
        : "";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Users size={13} /> Group session invite
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {invite.hostName} invited you
          </h1>
          <p className="mt-1 text-sm text-slate-500">Join together and learn from a {invite.companyName} employee.</p>

          <dl className="mt-6 space-y-3 text-sm">
            <Row icon={<Building2 size={16} />} k="Company" v={invite.companyName} />
            <Row icon={<UserRound size={16} />} k="Purpose" v={invite.sessionType || "Session"} />
            <Row icon={<CalendarDays size={16} />} k="Date" v={invite.date} />
            <Row icon={<Clock3 size={16} />} k="Time" v={`${invite.time} · ${durationLabel(invite.durationMinutes)}`} />
            <Row
              icon={<Users size={16} />}
              k="Members"
              v={`${invite.joined}/${invite.maxMembers} joined · ${invite.spotsLeft} spot${invite.spotsLeft === 1 ? "" : "s"} left`}
            />
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <dt className="text-slate-500">Your share</dt>
              <dd className="text-2xl font-extrabold text-slate-950">{inr(price)}</dd>
            </div>
          </dl>

          {statusText ? (
            <div className="mt-6">
              <div className="rounded-xl bg-amber-50 p-4 text-center text-sm font-medium text-amber-800">{statusText}</div>
              {invite.alreadyJoined && (
                <button
                  type="button"
                  onClick={() => navigate(`/Home/meeting/${invite.requestGroupId}`)}
                  className="mt-3 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Open meeting room
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`mt-5 rounded-xl border p-3 ${payWallet ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
                <label className={`flex items-start gap-3 ${canWallet ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
                  <input
                    type="checkbox"
                    checked={payWallet}
                    disabled={!canWallet || Boolean(stage)}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                      <span className="flex items-center gap-1.5"><Wallet size={15} className="text-indigo-600" /> Pay from wallet</span>
                      <span className="tabular-nums text-indigo-700">{me ? inr(walletBalance) : "₹–"}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {!me
                        ? "Checking your wallet…"
                        : !canWallet
                          ? "Wallet balance is not enough. You will pay by card / UPI."
                          : payWallet
                            ? `${inr(price)} will be deducted from your wallet.`
                            : "Wallet will not be used. You will pay by card / UPI."}
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={startPayment}
                disabled={Boolean(stage)}
                className={`mt-5 w-full rounded-xl py-3.5 text-sm font-bold transition ${
                  stage ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                {payWallet ? `Pay ${inr(price)} from wallet & join` : `Pay ${inr(price)} & join`}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                If the session is cancelled, your payment is refunded automatically.
              </p>
            </>
          )}

          {error && !stage && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {(stage === "paying" || stage === "joining") && (
        <Overlay>
          <Loader2 size={34} className="mx-auto animate-spin text-blue-600" />
          <h3 className="mt-5 text-xl font-bold text-slate-900">{stage === "paying" ? "Opening secure payment…" : "Joining the group…"}</h3>
          <p className="mt-2 text-sm text-slate-500">Please don't close this page.</p>
        </Overlay>
      )}

      {stage === "joined" && (
        <Overlay>
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">You're in!</h2>
          <p className="mt-2 text-sm text-slate-500">
            You joined {invite.hostName}'s group on {invite.date} at {invite.time}. You'll get an alert before the meeting room opens.
          </p>
          <button type="button" onClick={() => navigate("/Home/my-bookings")} className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">
            Go to My Bookings
          </button>
          <button type="button" onClick={() => navigate(`/Home/meeting/${invite.requestGroupId}`)} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Open meeting room
          </button>
        </Overlay>
      )}

      {stage === "error" && (
        <Overlay>
          <AlertTriangle size={40} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">We couldn't add you to the group</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          {canRetryRef.current ? (
            <>
              <p className="mt-2 text-xs text-slate-400">Your money is safe. Retry, or it will be refunded.</p>
              <button type="button" onClick={joinNow} className="mt-5 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Retry</button>
              <button type="button" onClick={closeError} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">Close</button>
            </>
          ) : (
            <button type="button" onClick={closeError} className="mt-5 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white hover:bg-slate-800">OK</button>
          )}
        </Overlay>
      )}
    </div>
  );
}

const Row = ({ icon, k, v }) => (
  <div className="flex items-start justify-between gap-4">
    <dt className="flex items-center gap-2 text-slate-500">{icon} {k}</dt>
    <dd className="text-right font-semibold text-slate-900">{v}</dd>
  </div>
);

const Overlay = ({ children }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl bg-white px-7 py-9 text-center shadow-2xl">{children}</div>
  </div>
);