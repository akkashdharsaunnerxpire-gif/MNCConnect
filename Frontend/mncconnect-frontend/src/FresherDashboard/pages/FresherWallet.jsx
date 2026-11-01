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
  const bonusKey = `mc_welcome_bonus_seen_${userId}`;

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
  // Welcome bonus animation:  +₹25 pops up -> flies into the
  // balance card -> balance counts up.  Shows once per account.
  // ---------------------------------------------------------
  const [phase, setPhase] = useState("idle"); // idle | pop | fly | done
  const [fly, setFly] = useState({ dx: 0, dy: 0 });
  const [displayBalance, setDisplayBalance] = useState(0);

  const balanceRef = useRef(null);
  const balanceValueRef = useRef(0);
  const shownRef = useRef(0);
  const rafRef = useRef(0);
  const startedRef = useRef(false);
  const bonusActiveRef = useRef(false);
  const referralHoldRef = useRef(false); // true while the referral coin is still flying (Header)

  balanceValueRef.current = balance;

  const countTo = (target, ms = 700) => {
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

  // referral reward animation (played by Header): keep the old balance until the coin lands
  useEffect(() => {
    const onStart = (e) => {
      const base = Number(e.detail?.base);
      if (!Number.isFinite(base)) return;
      referralHoldRef.current = true;
      cancelAnimationFrame(rafRef.current);
      shownRef.current = base;
      setDisplayBalance(base);
    };

    const onLand = () => {
      referralHoldRef.current = false;
      countTo(balanceValueRef.current, 800);
    };

    window.addEventListener("referral-bonus:start", onStart);
    window.addEventListener("referral-bonus:land", onLand);
    return () => {
      window.removeEventListener("referral-bonus:start", onStart);
      window.removeEventListener("referral-bonus:land", onLand);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // decide once whether to play the welcome animation
  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;

    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(bonusKey));
    } catch {
      seen = true;
    }

    const isNew =
      user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

    if (!seen && isNew && user.welcomeBonusClaimed && balance >= WELCOME_BONUS) {
      const base = balance - WELCOME_BONUS;
      bonusActiveRef.current = true;
      shownRef.current = base;
      setDisplayBalance(base);
      setPhase("pop");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // pop -> fly -> done
  useEffect(() => {
    if (phase === "pop") {
      const t = setTimeout(() => {
        const el = balanceRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          setFly({
            dx: r.left + r.width / 2 - window.innerWidth / 2,
            dy: r.top + r.height / 2 - window.innerHeight / 2,
          });
        }
        setPhase("fly");
      }, 1400);
      return () => clearTimeout(t);
    }

    if (phase === "fly") {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(bonusKey, "1");
        } catch {
          /* ignore */
        }
        bonusActiveRef.current = false;
        setPhase("done");
      }, 850);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // keep the shown number in sync with the real balance (live updates too)
  useEffect(() => {
    if (!startedRef.current || bonusActiveRef.current || referralHoldRef.current) return;
    countTo(balance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, phase, user]);

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

  const flying = phase === "pop" || phase === "fly";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style>{`
        @keyframes mc-coin-pop {
          0%   { opacity: 0; transform: scale(.3) rotate(-12deg); }
          60%  { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes mc-bump {
          0%, 100% { transform: scale(1); }
          40%      { transform: scale(1.035); box-shadow: 0 0 0 6px rgba(99,102,241,.25); }
        }
        .mc-coin-pop { animation: mc-coin-pop .6s cubic-bezier(.2,.8,.2,1) both; }
        .mc-bump { animation: mc-bump .7s ease-out 1; }
        @media (prefers-reduced-motion: reduce) {
          .mc-coin-pop, .mc-bump { animation: none; }
        }
      `}</style>

      {/* welcome bonus overlay */}
      {flying && (
        <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
          <div
            className="absolute inset-0 bg-slate-900/40 transition-opacity duration-700"
            style={{ opacity: phase === "fly" ? 0 : 1 }}
          />
          <div className="absolute left-1/2 top-1/2">
            <div
              style={{
                transform:
                  phase === "fly"
                    ? `translate(calc(-50% + ${fly.dx}px), calc(-50% + ${fly.dy}px)) scale(.2)`
                    : "translate(-50%, -50%)",
                opacity: phase === "fly" ? 0.35 : 1,
                transition:
                  phase === "fly"
                    ? "transform 800ms cubic-bezier(.6,0,.3,1), opacity 800ms ease-in"
                    : "none",
              }}
            >
              <div className="mc-coin-pop flex flex-col items-center rounded-3xl bg-white px-10 py-7 text-center shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-lg">
                  <Gift size={30} />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-indigo-600">
                  Welcome bonus
                </p>
                <p className="mt-1 text-5xl font-black text-slate-900">+{inr(WELCOME_BONUS)}</p>
                <p className="mt-2 text-sm text-slate-500">Added to your wallet</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bonus Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Earn rewards through referrals and use them to book sessions.
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          <div
            className={`rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-lg ${
              phase === "done" ? "mc-bump" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-100">Available Balance</p>
                <h2 ref={balanceRef} className="mt-2 text-4xl font-bold tabular-nums">
                  {inr(displayBalance)}
                </h2>
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
                <h2 className="mt-2 text-3xl font-bold text-slate-900">{inr(user?.referralEarnings)}</h2>
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