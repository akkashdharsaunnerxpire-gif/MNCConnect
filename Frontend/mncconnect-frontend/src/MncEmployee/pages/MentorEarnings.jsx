import React, { useMemo, useState } from "react";
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
  MoreVertical,
  Search,
  CreditCard,
} from "lucide-react";

/* ============================================================
   MAIN COMPONENT
============================================================ */

const MentorEarnings = () => {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  /* ============================================================
     TRANSACTION DATA
  ============================================================ */

  const transactions = [
    {
      id: 1,
      fresher: "Arun Kumar",
      session: "Career Guidance",
      date: "Sep 01, 2026",
      amount: 499,
      status: "Completed",
    },
    {
      id: 2,
      fresher: "Rahul Raj",
      session: "Technical Discussion",
      date: "Aug 30, 2026",
      amount: 699,
      status: "Completed",
    },
    {
      id: 3,
      fresher: "Priya S",
      session: "Portfolio Review",
      date: "Aug 28, 2026",
      amount: 399,
      status: "Completed",
    },
    {
      id: 4,
      fresher: "Vignesh M",
      session: "Mock Interview",
      date: "Aug 27, 2026",
      amount: 599,
      status: "Pending",
    },
    {
      id: 5,
      fresher: "Sanjay K",
      session: "Career Guidance",
      date: "Aug 25, 2026",
      amount: 499,
      status: "Completed",
    },
  ];

  /* ============================================================
     FILTER TRANSACTIONS
  ============================================================ */

  const filteredTransactions = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !keyword ||
        transaction.fresher.toLowerCase().includes(keyword) ||
        transaction.session.toLowerCase().includes(keyword);

      const matchesTab =
        activeTab === "All" ||
        transaction.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [search, activeTab]);

  /* ============================================================
     EARNINGS CALCULATIONS
  ============================================================ */

  const completedAmount = transactions
    .filter((item) => item.status === "Completed")
    .reduce((sum, item) => sum + item.amount, 0);

  const pendingAmount = transactions
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">

      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">

        <div className="absolute w-[500px] h-[500px] -top-52 -left-52 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="absolute w-[500px] h-[500px] -bottom-52 -right-52 rounded-full bg-sky-300/20 blur-3xl" />

      </div>

      <main className="relative z-10 w-full max-w-7xl px-4 py-8 mx-auto sm:px-6 lg:px-8">

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <div className="flex flex-col justify-between gap-5 mb-8 sm:flex-row sm:items-end">

          <div>

            <p className="mb-2 text-xs font-semibold tracking-widest text-blue-600 uppercase">
              Mentor Finance
            </p>

            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Your Earnings
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Manage your mentoring income, payouts and transactions.
            </p>

          </div>

          <Link
            to="/mentor/home"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 transition border rounded-xl border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 shadow-sm"
          >
            Back to Home
            <ArrowLeft size={16} />
          </Link>

        </div>

        {/* =================================================
            EARNINGS CARDS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">

          <EarningCard
            icon={<Wallet size={22} />}
            label="Available Balance"
            value="₹12,450"
            description="Ready for withdrawal"
          />

          <EarningCard
            icon={<TrendingUp size={22} />}
            label="Total Earnings"
            value="₹28,750"
            description="All time earnings"
          />

          <EarningCard
            icon={<Clock3 size={22} />}
            label="Pending"
            value={`₹${pendingAmount.toLocaleString("en-IN")}`}
            description="Processing earnings"
          />

          <EarningCard
            icon={<IndianRupee size={22} />}
            label="This Month"
            value="₹8,950"
            description="September 2026"
          />

        </div>

        {/* =================================================
            BALANCE + PAYOUT
        ================================================= */}

        <div className="grid grid-cols-1 gap-5 mb-8 lg:grid-cols-3">

          {/* AVAILABLE BALANCE */}

          <div className="relative p-6 overflow-hidden border lg:col-span-2 rounded-3xl border-blue-200 bg-white shadow-sm">

            <div className="absolute w-56 h-56 rounded-full -right-20 -top-24 bg-blue-300/20 blur-3xl" />

            <div className="absolute w-40 h-40 rounded-full -bottom-20 -left-10 bg-sky-300/15 blur-3xl" />

            <div className="relative">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm font-medium text-slate-500">
                    Available for withdrawal
                  </p>

                  <h3 className="mt-2 text-4xl font-bold text-slate-900">
                    ₹12,450
                  </h3>

                </div>

                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100">

                  <Wallet
                    size={27}
                    className="text-blue-600"
                  />

                </div>

              </div>

              <div className="flex flex-wrap items-center gap-3 mt-7">

                <button
                  type="button"
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition rounded-xl bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-200"
                >
                  <ArrowDownToLine size={17} />
                  Withdraw Earnings
                </button>

                <button
                  type="button"
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-600 transition border rounded-xl border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600"
                >
                  <CreditCard size={17} />
                  Payment Method
                </button>

              </div>

            </div>

          </div>

          {/* PAYOUT STATUS */}

          <div className="p-6 border rounded-3xl border-slate-200 bg-white shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100">

                <CheckCircle2
                  size={21}
                  className="text-emerald-500"
                />

              </div>

              <div>

                <h3 className="font-semibold text-slate-900">
                  Payout Status
                </h3>

                <p className="text-xs text-slate-500">
                  Everything looks good
                </p>

              </div>

            </div>

            <div className="mt-6 space-y-4">

              <InfoRow
                label="Next payout"
                value="Sep 07, 2026"
              />

              <InfoRow
                label="Minimum withdrawal"
                value="₹500"
              />

              <InfoRow
                label="Processing time"
                value="2–3 business days"
              />

            </div>

          </div>

        </div>

        {/* =================================================
            TRANSACTION HISTORY
        ================================================= */}

        <div className="border rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* HEADER */}

          <div className="p-5 border-b sm:p-6 border-slate-200">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <h3 className="text-lg font-semibold text-slate-900">
                  Transaction History
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Your recent mentoring payments
                </p>

              </div>

              {/* SEARCH */}

              <div className="flex items-center gap-2 px-3 border rounded-xl border-slate-200 bg-slate-50 lg:w-[280px]">

                <Search
                  size={17}
                  className="text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full py-3 text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                />

              </div>

            </div>

            {/* TABS */}

            <div className="flex gap-2 mt-5 overflow-x-auto">

              {["All", "Completed", "Pending"].map((tab) => (

                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition ${
                    activeTab === tab
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {tab}
                </button>

              ))}

            </div>

          </div>

          {/* TRANSACTIONS */}

          <div>

            {filteredTransactions.length === 0 ? (

              <div className="py-16 text-center">

                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50">

                  <Wallet
                    size={25}
                    className="text-blue-500"
                  />

                </div>

                <h4 className="mt-4 font-semibold text-slate-900">
                  No Transactions Found
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  Try another search.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-slate-100">

                {filteredTransactions.map((transaction) => (

                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                  />

                ))}

              </div>

            )}

          </div>

        </div>

        {/* =================================================
            FOOTER SUMMARY
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-3">

          <MiniSummary
            label="Completed Transactions"
            value={
              transactions.filter(
                (item) => item.status === "Completed"
              ).length
            }
          />

          <MiniSummary
            label="Completed Earnings"
            value={`₹${completedAmount.toLocaleString("en-IN")}`}
          />

          <MiniSummary
            label="Pending Earnings"
            value={`₹${pendingAmount.toLocaleString("en-IN")}`}
          />

        </div>

      </main>

    </div>
  );
};

/* ============================================================
   EARNING CARD
============================================================ */

const EarningCard = ({
  icon,
  label,
  value,
  description,
}) => {

  return (

    <div className="p-5 transition border rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200">

      <div className="flex items-center justify-between">

        <div className="flex items-center justify-center w-11 h-11 text-blue-600 rounded-xl bg-blue-50 border border-blue-100">
          {icon}
        </div>

        <TrendingUp
          size={16}
          className="text-emerald-500"
        />

      </div>

      <p className="mt-5 text-xs font-medium text-slate-500">
        {label}
      </p>

      <h3 className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>

    </div>

  );
};

/* ============================================================
   INFO ROW
============================================================ */

const InfoRow = ({
  label,
  value,
}) => {

  return (

    <div className="flex items-center justify-between gap-3">

      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs font-semibold text-slate-700">
        {value}
      </span>

    </div>

  );
};

/* ============================================================
   TRANSACTION ROW
============================================================ */

const TransactionRow = ({
  transaction,
}) => {

  const isCompleted =
    transaction.status === "Completed";

  return (

    <div className="flex flex-col gap-4 p-5 transition sm:flex-row sm:items-center sm:justify-between hover:bg-blue-50/40">

      {/* USER */}

      <div className="flex items-center gap-4">

        <div className="flex items-center justify-center w-11 h-11 text-sm font-bold text-blue-600 rounded-xl bg-blue-50 border border-blue-100">

          {transaction.fresher
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)}

        </div>

        <div>

          <h4 className="text-sm font-semibold text-slate-900">
            {transaction.fresher}
          </h4>

          <p className="mt-1 text-xs text-slate-500">
            {transaction.session}
          </p>

        </div>

      </div>

      {/* DATE */}

      <div className="flex items-center gap-2 text-xs text-slate-500">

        <CalendarDays size={15} />

        {transaction.date}

      </div>

      {/* STATUS */}

      <div>

        <span
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border ${
            isCompleted
              ? "text-emerald-600 bg-emerald-50 border-emerald-100"
              : "text-amber-600 bg-amber-50 border-amber-100"
          }`}
        >
          {transaction.status}
        </span>

      </div>

      {/* AMOUNT */}

      <div className="flex items-center gap-3 sm:min-w-[120px] sm:justify-end">

        <span
          className={`text-sm font-bold ${
            isCompleted
              ? "text-emerald-600"
              : "text-amber-600"
          }`}
        >
          +₹{transaction.amount.toLocaleString("en-IN")}
        </span>

        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreVertical size={16} />
        </button>

      </div>

    </div>

  );
};

/* ============================================================
   MINI SUMMARY
============================================================ */

const MiniSummary = ({
  label,
  value,
}) => {

  return (

    <div className="p-4 border rounded-2xl border-slate-200 bg-white shadow-sm">

      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {value}
      </p>

    </div>

  );
};

/* ============================================================
   EXPORT
============================================================ */

export default MentorEarnings;