import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Gift,
  Users,
  CalendarCheck,
  Copy,
  Check,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
  CheckCircle2,
} from "lucide-react";

const WALLET_KEY = "fresherCoins";
const TRANSACTIONS_KEY = "fresher_bonus_transactions";
const REFERRAL_CODE_KEY = "fresher_referral_code";
const REFERRAL_USED_KEY = "fresher_used_referral";

const WELCOME_BONUS = 25;
const REFERRAL_BONUS = 25;
const SESSION_BONUS = 25;

const generateReferralCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

const getDate = () => {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getBalance = () => {
  return Number(localStorage.getItem(WALLET_KEY) || 0);
};

const saveBalance = (amount) => {
  localStorage.setItem(WALLET_KEY, String(amount));
  window.dispatchEvent(new Event("fresherCoinsUpdated"));
};

const addTransaction = ({
  title,
  description,
  amount,
  type = "credit",
}) => {
  const existing = JSON.parse(
    localStorage.getItem(TRANSACTIONS_KEY) || "[]"
  );

  const transaction = {
    id: `${Date.now()}-${Math.random()}`,
    title,
    description,
    amount,
    type,
    status: "Completed",
    date: getDate(),
  };

  localStorage.setItem(
    TRANSACTIONS_KEY,
    JSON.stringify([transaction, ...existing])
  );
};

const FresherWallet = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [referralCode, setReferralCode] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const loadWallet = () => {
    setBalance(getBalance());

    const savedTransactions = JSON.parse(
      localStorage.getItem(TRANSACTIONS_KEY) || "[]"
    );

    setTransactions(savedTransactions);

    let savedReferralCode = localStorage.getItem(REFERRAL_CODE_KEY);

    if (!savedReferralCode) {
      savedReferralCode = generateReferralCode();
      localStorage.setItem(REFERRAL_CODE_KEY, savedReferralCode);
    }

    setReferralCode(savedReferralCode);
  };

  useEffect(() => {
    loadWallet();

    window.addEventListener("fresherCoinsUpdated", loadWallet);
    window.addEventListener("storage", loadWallet);

    return () => {
      window.removeEventListener("fresherCoinsUpdated", loadWallet);
      window.removeEventListener("storage", loadWallet);
    };
  }, []);

  const completedRewards = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.type === "credit" &&
          transaction.status === "Completed"
      )
      .reduce((total, transaction) => total + Number(transaction.amount), 0);
  }, [transactions]);

  const referralRewards = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.title === "Referral Bonus" &&
          transaction.status === "Completed"
      )
      .reduce((total, transaction) => total + Number(transaction.amount), 0);
  }, [transactions]);

  const sessionRewards = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.title === "Session Completed Bonus" &&
          transaction.status === "Completed"
      )
      .reduce((total, transaction) => total + Number(transaction.amount), 0);
  }, [transactions]);

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setMessage("Unable to copy referral code");
      setMessageType("error");
    }
  };

  const shareReferralCode = async () => {
    const text = `Join MNCConnect using my referral code: ${referralCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "MNCConnect Referral",
          text,
        });
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(text);

      setMessage("Referral message copied");
      setMessageType("success");
    }
  };

  const applyReferral = () => {
    const enteredCode = referralInput.trim().toUpperCase();

    if (!enteredCode) {
      setMessage("Enter a referral code");
      setMessageType("error");
      return;
    }

    if (enteredCode.length !== 6) {
      setMessage("Referral code must contain 6 characters");
      setMessageType("error");
      return;
    }

    if (enteredCode === referralCode) {
      setMessage("You cannot use your own referral code");
      setMessageType("error");
      return;
    }

    const alreadyUsed = localStorage.getItem(REFERRAL_USED_KEY);

    if (alreadyUsed === "true") {
      setMessage("You have already used a referral code");
      setMessageType("error");
      return;
    }

    localStorage.setItem(REFERRAL_USED_KEY, "true");
    localStorage.setItem("pending_referral_code", enteredCode);

    setReferralInput("");

    setMessage(
      "Referral code submitted. The code owner will receive ₹25 after verification."
    );

    setMessageType("success");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Bonus Wallet
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Earn rewards through referrals and completed mentoring sessions.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-100">
                  Available Balance
                </p>

                <h2 className="mt-2 text-4xl font-bold">
                  ₹{balance}
                </h2>
              </div>

              <div className="rounded-2xl bg-white/20 p-4">
                <Wallet size={30} />
              </div>
            </div>

            <p className="mt-5 text-xs text-indigo-100">
              Your MNCConnect bonus balance
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Referral Earnings
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  ₹{referralRewards}
                </h2>
              </div>

              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <Users size={25} />
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              ₹25 for each successful referral
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Session Earnings
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  ₹{sessionRewards}
                </h2>
              </div>

              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <CalendarCheck size={25} />
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              ₹25 for every completed session
            </p>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-600">
                <Gift size={24} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Welcome Bonus
                </h2>

                <p className="text-sm text-slate-500">
                  One-time bonus for joining MNCConnect
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-indigo-50 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-700">
                  Welcome Reward
                </span>

                <span className="text-xl font-bold text-indigo-700">
                  +₹25
                </span>
              </div>

              <p className="mt-2 text-xs text-indigo-600">
                This bonus is credited only once during your first
                registration/login.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <Users size={24} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Your Referral Code
                </h2>

                <p className="text-sm text-slate-500">
                  Share your code and earn ₹25
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 p-4">
              <div className="flex-1">
                <p className="text-xs text-slate-500">
                  Referral Code
                </p>

                <p className="mt-1 text-2xl font-black tracking-[0.3em] text-indigo-700">
                  {referralCode}
                </p>
              </div>

              <button
                onClick={copyReferralCode}
                className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm transition hover:bg-indigo-100"
              >
                {copied ? (
                  <Check size={20} />
                ) : (
                  <Copy size={20} />
                )}
              </button>

              <button
                onClick={shareReferralCode}
                className="rounded-xl bg-indigo-600 p-3 text-white transition hover:bg-indigo-700"
              >
                <Share2 size={20} />
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              When another user successfully uses your referral code,
              you receive ₹25.
            </p>

          </div>

        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
              <Users size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Use a Referral Code
              </h2>

              <p className="text-sm text-slate-500">
                Enter another user's referral code
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">

            <input
              type="text"
              value={referralInput}
              onChange={(e) =>
                setReferralInput(e.target.value.toUpperCase())
              }
              maxLength={6}
              placeholder="Enter 6-character code"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            <button
              onClick={applyReferral}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Apply Code
            </button>

          </div>

          {message && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                messageType === "error"
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
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