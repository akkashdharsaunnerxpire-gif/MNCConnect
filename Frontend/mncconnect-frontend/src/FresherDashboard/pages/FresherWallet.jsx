// src/pages/FresherWallet.jsx
import React, { useEffect, useState } from "react";
import { Wallet, Users, CalendarCheck, Copy, Check, Share2, Gift, IndianRupee } from "lucide-react";
import { api, ENDPOINTS, getUserId, EVENTS } from "../../services/fresherApi";
import useLive from "../../hooks/useLive";

const FresherWallet = () => {
  const userId = getUserId();
  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // ✅ Fetch live wallet data from backend
  const { data, loading, error, reload, setData } = useLive({
    fetcher: () => api("/auth/me"), // Adjust endpoint if your `/auth/me` doesn't return wallet data
    events: [EVENTS.notification, "wallet:updated"],
    userId,
  });

  const user = data?.user || data;
  const balance = user?.walletBalance || 0;
  const referralCode = user?.referralCode || "LOADING";

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
    const text = `Join MNCConnect using my referral code: ${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MNCConnect Referral", text });
      } catch { return; }
    } else {
      await navigator.clipboard.writeText(text);
      setMessage("Referral message copied");
      setMessageType("success");
    }
  };

  const applyReferral = async () => {
    const enteredCode = referralInput.trim().toUpperCase();
    if (!enteredCode || enteredCode.length !== 6) {
      setMessage("Referral code must contain 6 characters");
      setMessageType("error");
      return;
    }

    try {
      // Send code to backend to verify and apply
      await api("/auth/apply-referral", {
        method: "POST",
        body: { referralCode: enteredCode },
      });

      setMessage("Referral applied successfully! The code owner received ₹10.");
      setMessageType("success");
      setReferralInput("");
      reload(); // Refresh user data
    } catch (err) {
      setMessage(err.message || "Invalid referral code.");
      setMessageType("error");
    }
  };

  if (loading && !user) {
    return <div className="p-8 text-center text-slate-500">Loading wallet...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bonus Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">Earn rewards through referrals and completed mentoring sessions.</p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-100">Available Balance</p>
                <h2 className="mt-2 text-4xl font-bold">₹{balance}</h2>
              </div>
              <div className="rounded-2xl bg-white/20 p-4">
                <Wallet size={30} />
              </div>
            </div>
            <p className="mt-5 text-xs text-indigo-100">Use this balance to book sessions.</p>
          </div>

          {/* Refund Info Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Refunds</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">₹{user?.totalRefunds || 0}</h2>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <IndianRupee size={25} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Refunded amounts added to wallet</p>
          </div>

          {/* Referral Info Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Referral Earnings</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">₹{user?.referralEarnings || 0}</h2>
              </div>
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <Users size={25} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">₹10 for each successful referral</p>
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
              <p className="text-sm text-slate-500">Share your code and earn ₹10</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 p-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500">Referral Code</p>
              <p className="mt-1 text-2xl font-black tracking-[0.3em] text-indigo-700">{referralCode}</p>
            </div>
            <button onClick={copyReferralCode} className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm hover:bg-indigo-100">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <button onClick={shareReferralCode} className="rounded-xl bg-indigo-600 p-3 text-white hover:bg-indigo-700">
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
              <p className="text-sm text-slate-500">Enter another user's referral code</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Enter 6-character code"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button onClick={applyReferral} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
              Apply Code
            </button>
          </div>

          {message && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${messageType === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FresherWallet;