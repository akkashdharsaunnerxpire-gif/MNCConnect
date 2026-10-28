import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Clock3,
  IndianRupee,
  ArrowDownToLine,
  CalendarDays,
  CheckCircle2,
  Search,
  Loader2,
  X,
  Radio,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import { api, ENDPOINTS, EVENTS, inr } from "../../services/mentorApi";

const MIN_WITHDRAWAL = 500;

const MentorEarnings = () => {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const { data, loading, error, connected, reload } = useLive({
    fetcher: () => api(ENDPOINTS.wallet),
    events: [EVENTS.walletUpdated],
    pollMs: 60000,
  });

  // tick so a session flips Pending -> Completed without a refresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const wallet = {
    available: 0,
    pending: 0,
    lifetime: 0,
    week: 0,
    month: 0,
    withdrawn: 0,
    ...(data?.wallet || {}),
  };

  const withdrawals = data?.withdrawals || [];
  const hasPendingWithdrawal = withdrawals.some(
    (w) => w.status === "requested",
  );

  const transactions = useMemo(() => {
    const list = data?.payments || data?.transactions || [];
    return list.map((p) => {
      const released = p.sessionStatus === "completed";
      return {
        id: p._id || p.id,
        fresher: p.fresherName || "Fresher",
        session: p.topic || "Mentoring session",
        date: new Date(p.paidAt || p.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        amount: Number(p.mentorEarning) || 0,
        status: released ? "Completed" : "Pending",
      };
    });
  }, [data, now]);

  const filtered = useMemo(() => {
    const kw = search.toLowerCase().trim();
    return transactions.filter(
      (t) =>
        (activeTab === "All" || t.status === activeTab) &&
        (!kw ||
          t.fresher.toLowerCase().includes(kw) ||
          t.session.toLowerCase().includes(kw)),
    );
  }, [transactions, activeTab, search]);

  const monthName = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  const withdrawDisabled =
    wallet.available < MIN_WITHDRAWAL || hasPendingWithdrawal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">
              Mentor Finance
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Your Earnings
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              Updates live as sessions end. You earn{" "}
              {data?.mentorSharePercent ?? 75}% of every session.
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}
              >
                <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
              </span>
            </p>
          </div>
          <Link
            to="/mentor/home"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-600"
          >
            Back to Home <ArrowLeft size={16} />
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button onClick={reload} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EarningCard
            icon={<Wallet size={22} />}
            label="Available Balance"
            value={inr(wallet.available)}
            description="Ready for withdrawal"
          />
          <EarningCard
            icon={<TrendingUp size={22} />}
            label="Total Earnings"
            value={inr(wallet.lifetime)}
            description="All time earnings"
          />
          <EarningCard
            icon={<Clock3 size={22} />}
            label="Pending"
            value={inr(wallet.pending)}
            description="Released after the fresher confirms (auto in 24h)"
          />
          <EarningCard
            icon={<IndianRupee size={22} />}
            label="This Month"
            value={inr(wallet.month)}
            description={monthName}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Available for withdrawal
                </p>
                <h3 className="mt-2 text-4xl font-bold text-slate-900">
                  {inr(wallet.available)}
                </h3>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
                <Wallet size={27} className="text-blue-600" />
              </div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                disabled={withdrawDisabled}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownToLine size={17} /> Withdraw Earnings
              </button>
              {hasPendingWithdrawal ? (
                <span className="text-xs text-amber-600">
                  A withdrawal request is being processed
                </span>
              ) : (
                wallet.available < MIN_WITHDRAWAL && (
                  <span className="text-xs text-slate-500">
                    Minimum withdrawal is {inr(MIN_WITHDRAWAL)}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
                <CheckCircle2 size={21} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Payout Status</h3>
                <p className="text-xs text-slate-500">
                  Money is released after each session
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <InfoRow
                label="Withdrawn / requested"
                value={inr(wallet.withdrawn)}
              />
              <InfoRow label="Earned this week" value={inr(wallet.week)} />
              <InfoRow label="Minimum withdrawal" value={inr(MIN_WITHDRAWAL)} />
              <InfoRow label="Processing time" value="2–3 business days" />
            </div>
          </div>
        </div>

        {/* ---------------- Transaction history ---------------- */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Transaction History
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Your mentoring payments
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 lg:w-[280px]">
                <Search size={17} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto">
              {["All", "Completed", "Pending"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition ${
                    activeTab === tab
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <Wallet size={25} className="text-blue-500" />
              </div>
              <h4 className="mt-4 font-semibold text-slate-900">
                No transactions yet
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Accepted sessions will show up here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </div>
          )}
        </div>

        {/* ---------------- Withdrawal requests (live) ---------------- */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Withdrawal Requests
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Status updates live when we process your payout
            </p>
          </div>
          {withdrawals.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              No withdrawal requests yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {withdrawals.map((w) => (
                <WithdrawalRow key={w._id} w={w} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniSummary
            label="Completed Transactions"
            value={transactions.filter((t) => t.status === "Completed").length}
          />
          <MiniSummary
            label="Completed Earnings"
            value={inr(wallet.lifetime)}
          />
          <MiniSummary label="Pending Earnings" value={inr(wallet.pending)} />
        </div>
      </main>

      {withdrawOpen && (
        <WithdrawModal
          available={wallet.available}
          onClose={() => setWithdrawOpen(false)}
          onDone={() => {
            setWithdrawOpen(false);
            showToast(
              "success",
              "Withdrawal requested. We'll pay it to your UPI soon.",
            );
            reload();
          }}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-red-200 text-red-700"
              : "border-emerald-200 text-emerald-700"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

const WithdrawModal = ({ available, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(available));
  const [upiId, setUpiId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL)
      return setErr(`Minimum withdrawal is ${inr(MIN_WITHDRAWAL)}.`);
    if (value > available)
      return setErr("Amount is more than your available balance.");
    if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId.trim()))
      return setErr("Enter a valid UPI ID (e.g. name@okbank).");

    setBusy(true);
    setErr("");
    try {
      await api(ENDPOINTS.withdraw, {
        method: "POST",
        body: { amount: value, upiId: upiId.trim() },
      });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Withdraw earnings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Amount (max {inr(available)})
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
        />
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          UPI ID
        </label>
        <input
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          placeholder="name@okbank"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
        />
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Request
          </button>
        </div>
      </form>
    </div>
  );
};

const EarningCard = ({ icon, label, value, description }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
      {icon}
    </div>
    <p className="mt-5 text-xs font-medium text-slate-500">{label}</p>
    <h3 className="mt-1 text-2xl font-bold text-slate-900">{value}</h3>
    <p className="mt-1 text-xs text-slate-400">{description}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="text-xs font-semibold text-slate-700">{value}</span>
  </div>
);

const TransactionRow = ({ transaction }) => {
  const done = transaction.status === "Completed";
  return (
    <div className="flex flex-col gap-4 p-5 transition hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-sm font-bold text-blue-600">
          {transaction.fresher
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {transaction.fresher}
          </h4>
          <p className="mt-1 text-xs text-slate-500">{transaction.session}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarDays size={15} />
        {transaction.date}
      </div>
      <span
        className={`w-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
          done
            ? "border-emerald-100 bg-emerald-50 text-emerald-600"
            : "border-amber-100 bg-amber-50 text-amber-600"
        }`}
      >
        {transaction.status}
      </span>
      <span
        className={`text-sm font-bold sm:min-w-[100px] sm:text-right ${done ? "text-emerald-600" : "text-amber-600"}`}
      >
        +{inr(transaction.amount)}
      </span>
    </div>
  );
};

const WITHDRAW_STYLE = {
  requested: "border-amber-100 bg-amber-50 text-amber-600",
  paid: "border-emerald-100 bg-emerald-50 text-emerald-600",
  rejected: "border-red-100 bg-red-50 text-red-600",
};

const WITHDRAW_LABEL = {
  requested: "Processing",
  paid: "Paid",
  rejected: "Rejected",
};

const WithdrawalRow = ({ w }) => (
  <div className="flex flex-col gap-3 p-5 transition hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-900">{w.upiId}</p>
      <p className="mt-1 text-xs text-slate-500">
        {new Date(w.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {w.note ? ` · ${w.note}` : ""}
      </p>
    </div>
    <span
      className={`w-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${WITHDRAW_STYLE[w.status] || WITHDRAW_STYLE.requested}`}
    >
      {WITHDRAW_LABEL[w.status] || w.status}
    </span>
    <span className="text-sm font-bold text-slate-900 sm:min-w-[100px] sm:text-right">
      {inr(w.amount)}
    </span>
  </div>
);

const MiniSummary = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
  </div>
);

export default MentorEarnings;
