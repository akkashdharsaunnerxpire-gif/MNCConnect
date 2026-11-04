// src/pages/FresherWallet.jsx
import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users, Copy, Check, Share2, Gift, IndianRupee, Sparkles } from "lucide-react";
import { api, getUserId, EVENTS } from "../../services/fresherApi";
import useLive from "../../hooks/useLive";

const WELCOME_BONUS = 25;
const REFERRAL_REWARD = 10;

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const FresherWallet = () => {
  const userId = getUserId();

  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const { data, loading, reload } = useLive({
    fetcher: () => api("/auth/me"),
    events: [EVENTS.notification, "wallet:updated"],
    userId,
  });

  const user = data?.user || data;
  const balance = Number(user?.walletBalance) || 0;
  const referralCode = user?.referralCode || "LOADING";

  // ---------------------------------------------------------
  // Balance count-up + referral-reward sync.
  // (Welcome-bonus animation REMOVED from this page: it already
  //  plays once on Home through Header -> WelcomeBonus.)
  // While the referral coin (Header -> ReferralBonus) is flying, BOTH the
  // balance card and the Referral Earnings card keep the OLD number, and
  // update together the moment the coin lands.
  // ---------------------------------------------------------
  const [displayBalance, setDisplayBalance] = useState(0);
  const [earnHold, setEarnHold] = useState(null); // null = show real earnings

  const balanceValueRef = useRef(0);
  const shownRef = useRef(0);
  const rafRef = useRef(0);
  const initRef = useRef(false);
  const referralHoldRef = useRef(false);

  balanceValueRef.current = balance;

  const countTo = (target, ms = 600) => {
    const from = shownRef.current;
    if (from === target) return;
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      shownRef.current = v;
      setDisplayBalance(v);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // referral reward animation (played by Header)
  useEffect(() => {
    const onStart = (e) => {
      const base = Number(e.detail?.base);
      if (!Number.isFinite(base)) return;
      initRef.current = true;
      referralHoldRef.current = true;
      cancelAnimationFrame(rafRef.current);
      shownRef.current = base;
      setDisplayBalance(base);

      const eb = Number(e.detail?.earningsBase);
      if (Number.isFinite(eb)) setEarnHold(eb);
    };

    const onLand = () => {
      referralHoldRef.current = false;
      setEarnHold(null);
      countTo(balanceValueRef.current, 600);
    };

    window.addEventListener("referral-bonus:start", onStart);
    window.addEventListener("referral-bonus:land", onLand);
    return () => {
      window.removeEventListener("referral-bonus:start", onStart);
      window.removeEventListener("referral-bonus:land", onLand);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the shown number in sync with the real balance
  useEffect(() => {
    if (!user || referralHoldRef.current) return;

    // first load: show the number directly, no count-up from 0
    if (!initRef.current) {
      initRef.current = true;
      shownRef.current = balance;
      setDisplayBalance(balance);
      return;
    }
    countTo(balance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, user]);

  const shownEarnings = earnHold ?? user?.referralEarnings;

  // ---------------------------------------------------------
  // actions
  // ---------------------------------------------------------
  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Unable to copy referral code");
      setMessageType("error");
    }
  };

  const shareReferralCode = async () => {
    const text = `Join MNCConnect using my referral code ${referralCode} and get ₹${WELCOME_BONUS} free!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MNCConnect Referral", text });
      } catch {
        return;
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Referral message copied");
        setMessageType("success");
      } catch {
        setMessage("Unable to copy referral message");
        setMessageType("error");
      }
    }
  };

  const applyReferral = async () => {
    if (applying) return;
    const enteredCode = referralInput.trim().toUpperCase();
    if (enteredCode.length !== 6) {
      setMessage("Referral code must contain 6 characters");
      setMessageType("error");
      return;
    }

    setApplying(true);
    try {
      await api("/auth/apply-referral", { method: "POST", body: { referralCode: enteredCode } });
      setMessage(`Referral applied! The code owner received ${inr(REFERRAL_REWARD)}.`);
      setMessageType("success");
      setReferralInput("");
      reload();
    } catch (err) {
      setMessage(err.message || "Invalid referral code.");
      setMessageType("error");
    } finally {
      setApplying(false);
    }
  };

  if (loading && !user) {
    return <div className="p-8 text-center text-slate-500">Loading wallet...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style>{`
        @keyframes mc-bump {
          0%, 100% { transform: scale(1); }
          40%      { transform: scale(1.035); box-shadow: 0 0 0 6px rgba(99,102,241,.25); }
        }
        .mc-bump { animation: mc-bump .7s ease-out 1; }
        @media (prefers-reduced-motion: reduce) {
          .mc-bump { animation: none; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bonus Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Earn rewards through referrals and use them to book sessions.
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-100">Available Balance</p>
                <h2 className="mt-2 text-4xl font-bold tabular-nums">{inr(displayBalance)}</h2>
              </div>
              <div className="rounded-2xl bg-white/20 p-4">
                <Wallet size={30} />
              </div>
            </div>
            <p className="mt-5 text-xs text-indigo-100">
              Used automatically when you pay for a session with your wallet.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Refunds</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">{inr(user?.totalRefunds)}</h2>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <IndianRupee size={25} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Refunded amounts added to wallet</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Referral Earnings</p>
                <h2 className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {inr(shownEarnings)}
                </h2>
              </div>
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <Users size={25} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{inr(REFERRAL_REWARD)} for each successful referral</p>
          </div>
        </div>

        {/* Referral Code */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-100 p-3 text-green-600">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Referral Code</h2>
              <p className="text-sm text-slate-500">Share your code and earn {inr(REFERRAL_REWARD)}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 p-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500">Referral Code</p>
              <p className="mt-1 text-2xl font-black tracking-[0.3em] text-indigo-700">{referralCode}</p>
            </div>
            <button
              onClick={copyReferralCode}
              className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm hover:bg-indigo-100"
              aria-label="Copy referral code"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <button
              onClick={shareReferralCode}
              className="rounded-xl bg-indigo-600 p-3 text-white hover:bg-indigo-700"
              aria-label="Share referral code"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Apply Referral */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
              <Gift size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Use a Referral Code</h2>
              <p className="text-sm text-slate-500">
                {user?.hasUsedReferral
                  ? "You have already used a referral code."
                  : "Enter another user's referral code"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              maxLength={6}
              disabled={user?.hasUsedReferral}
              placeholder="Enter 6-character code"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              onClick={applyReferral}
              disabled={applying || user?.hasUsedReferral}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying && <Sparkles size={16} className="animate-pulse" />} Apply Code
            </button>
          </div>

          {message && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                messageType === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FresherWallet;