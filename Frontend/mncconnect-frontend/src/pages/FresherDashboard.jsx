import React, { useState, useEffect } from "react";
import API from "../api";
import MeetingRoom from "../components/MeetingRoom"; // Import updated Jitsi MeetingRoom component

const FresherDashboard = () => {
  const companiesList = [
    {
      id: 1,
      name: "TCS",
      role: "System Architect & Software Lead",
      rating: "4.9",
      icon: "🏢",
      verifiedMentors: 24,
      badge: "High Acceptance",
    },
    {
      id: 2,
      name: "Infosys",
      role: "Principal Specialist Programmer",
      rating: "4.8",
      icon: "💻",
      verifiedMentors: 18,
      badge: "Popular",
    },
    {
      id: 3,
      name: "Zoho",
      role: "Product Development Engineer",
      rating: "4.95",
      icon: "🚀",
      verifiedMentors: 31,
      badge: "Top Rated",
    },
    {
      id: 4,
      name: "Accenture",
      role: "Advanced Application Engineer",
      rating: "4.7",
      icon: "⚡",
      verifiedMentors: 15,
      badge: "Fast Connect",
    },
  ];

  // Booking Modal States
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [language, setLanguage] = useState("Tamil");
  const [requirement, setRequirement] = useState("");
  const [duration, setDuration] = useState("30 mins");
  const [timeWindow, setTimeWindow] = useState("6:00 PM - 9:00 PM");
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Active Sessions, Meeting Room & Rating States
  const [myBookings, setMyBookings] = useState([]);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ratingModalBooking, setRatingModalBooking] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const amountToPay = duration === "30 mins" ? 299 : 499;

  // Real-time Clock Tick for exact slot unlock checking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Existing Bookings Once
  const fetchMyBookings = async () => {
    try {
      const res = await API.get("/bookings/my-bookings");
      setMyBookings(res.data || []);
    } catch (err) {
      console.error("Failed to load active bookings", err);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  // Razorpay Integration
  const handleRazorpayPayment = async () => {
    try {
      const orderRes = await API.post("/payments/create-order", {
        amount: amountToPay,
      });
      const order = orderRes.data;

      const options = {
        key: "rzp_test_TMPoYc7Ec7JZzz",
        amount: order.amount,
        currency: order.currency,
        name: "MNCConnect",
        description: `${selectedCompany.name} Mentorship Session (${duration})`,
        order_id: order.id,
        handler: async (response) => {
          try {
            const verifyRes = await API.post(
              "/payments/verify-payment",
              response
            );
            if (verifyRes.data.success) {
              setPaymentDetails(
                verifyRes.data.paymentId || response.razorpay_payment_id
              );
              alert("🎉 Payment Verified Successfully!");
            }
          } catch (err) {
            alert("Payment verification failed on backend!");
          }
        },
        prefill: {
          name: JSON.parse(localStorage.getItem("user") || "{}").name || "",
          email: JSON.parse(localStorage.getItem("user") || "{}").email || "",
        },
        theme: { color: "#2563eb" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Payment initialization failed!");
    }
  };

  // Submit First-Come First-Serve Request
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!paymentDetails) {
      alert("Please complete real-time payment first!");
      return;
    }

    try {
      await API.post("/bookings", {
        companyName: selectedCompany.name,
        requirements: requirement,
        languageChosen: language,
        requestedDuration: duration,
        preferredTimeWindow: timeWindow,
        paymentId: paymentDetails,
        paymentStatus: "paid",
        amountPaid: amountToPay,
      });

      alert(
        "🚀 Request Broadcasted to active employees of " + selectedCompany.name
      );
      setSelectedCompany(null);
      setPaymentDetails(null);
      setRequirement("");

      fetchMyBookings();
    } catch (err) {
      alert(
        `Booking request failed: ${
          err.response?.data?.message || err.message
        }`
      );
    }
  };

  // Process Auto-Refund Trigger
  const handleAutoRefund = async (bookingId) => {
    try {
      const res = await API.post("/bookings/cancel-refund", { bookingId });
      alert("⚠️ " + res.data.message);
      fetchMyBookings();
    } catch (err) {
      alert("Refund processing error!");
    }
  };

  // Submit Session Feedback
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/bookings/feedback", {
        bookingId: ratingModalBooking._id,
        rating: ratingScore,
        comment: reviewComment,
      });
      alert("⭐ Thank you for rating the mentor!");
      setRatingModalBooking(null);
      fetchMyBookings();
    } catch (err) {
      alert("Failed to submit review");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      {/* 📹 IN-APP LIVE MEETING ROOM OVERLAY */}
      {activeCallSession && (
        <MeetingRoom
          roomName={
            activeCallSession.meetingLink?.includes("http")
              ? activeCallSession.meetingLink.split("/").pop()
              : activeCallSession.meetingLink ||
                `MNCConnect-${activeCallSession._id}`
          }
          userName={
            JSON.parse(localStorage.getItem("user") || "{}").name || "Fresher"
          }
          durationInMinutes={
            parseInt(activeCallSession.requestedDuration) || 30
          }
          onLeave={() => setActiveCallSession(null)}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-10">
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div>
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-wider shadow-lg shadow-blue-500/20">
              Live Mentorship Hub
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
              1-on-1 MNC Mock Interviews
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Select target company → Instant Request Broadcast to active
              verified employees
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-200">
              First-Come Acceptance Active
            </span>
          </div>
        </div>

        {/* --- 1. ACTIVE BOOKINGS & LIVE ROOM STATUS SECTION --- */}
        {myBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>⚡</span> Your Active Sessions & Live Dashboard
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map((booking) => {
                const meetingTime = booking.confirmedMeetingTime
                  ? new Date(booking.confirmedMeetingTime)
                  : null;
                const durationMins =
                  parseInt(booking.requestedDuration) || 30;
                const slotEnd = meetingTime
                  ? new Date(meetingTime.getTime() + durationMins * 60 * 1000)
                  : null;

                // 🟢 Exact Scheduled Time Match Check (IST)
                const isReadyToJoin =
                  meetingTime &&
                  slotEnd &&
                  currentTime >= meetingTime &&
                  currentTime <= slotEnd;

                const isOverdue =
                  meetingTime &&
                  currentTime.getTime() - meetingTime.getTime() >
                    30 * 60 * 1000;

                return (
                  <div
                    key={booking._id}
                    className="bg-slate-900/90 border border-blue-500/30 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                          {booking.companyName}
                        </span>
                        <h4 className="text-lg font-extrabold text-white">
                          {booking.requirements}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                          booking.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : booking.status === "requested"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {booking.status === "requested"
                          ? "⏳ Waiting for Employee Claim"
                          : "✅ Mentor Confirmed"}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                      <p className="text-slate-300">
                        <strong>Duration:</strong> {booking.requestedDuration}{" "}
                        ({booking.languageChosen})
                      </p>
                      <p className="text-slate-300">
                        <strong>Preferred Window:</strong>{" "}
                        {booking.preferredTimeWindow}
                      </p>
                      {meetingTime && (
                        <p className="text-emerald-400 font-bold">
                          <strong>Confirmed Exact Slot:</strong>{" "}
                          {meetingTime.toLocaleDateString()} @{" "}
                          {meetingTime.toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    {booking.status === "accepted" && (
                      <div className="space-y-2 pt-1">
                        {/* 📹 Direct In-App Meeting Modal Launcher */}
                        <button
                          disabled={!isReadyToJoin}
                          onClick={() =>
                            isReadyToJoin && setActiveCallSession(booking)
                          }
                          className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isReadyToJoin
                              ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25 animate-pulse"
                              : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60"
                          }`}
                        >
                          <span>📹</span>{" "}
                          {isReadyToJoin
                            ? "Join Live Meeting Room Now"
                            : "Join Button Locked Until Scheduled Slot Time"}
                        </button>

                        {isOverdue && (
                          <button
                            onClick={() => handleAutoRefund(booking._id)}
                            className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            ⚠️ Mentor No-Show? Claim Instant 100% Refund
                          </button>
                        )}

                        <button
                          onClick={() => setRatingModalBooking(booking)}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          ⭐ Complete & Rate Mentor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 2. COMPANY CARDS GRID --- */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🏢</span> Top Tier Companies
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {companiesList.map((company) => (
              <div
                key={company.id}
                className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-6 rounded-3xl transition-all duration-300 flex flex-col justify-between shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 relative"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl group-hover:scale-110 transition-transform">
                      {company.icon}
                    </span>
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black px-2.5 py-1 rounded-full">
                      {company.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-white tracking-tight">
                    {company.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mb-3">
                    {company.role}
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-500/10 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-500/20">
                      ★ {company.rating}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      🟢 {company.verifiedMentors} Active Mentors
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCompany(company)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 active:scale-[0.98] cursor-pointer"
                >
                  Request Session
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- 3. ADVANCED BOOKING MODAL --- */}
        {selectedCompany && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedCompany.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Broadcast Request: {selectedCompany.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Target active employees in {selectedCompany.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Duration Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Session Duration
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {["30 mins", "60 mins"].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setDuration(dur)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          duration === dur
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {dur} ({dur === "30 mins" ? "₹299" : "₹499"})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred Flexible Time Window */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Flexible Time Window (When are you free?)
                  </label>
                  <select
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl focus:border-blue-500 outline-none"
                  >
                    <option value="6:00 PM - 9:00 PM">
                      Today Evening (6:00 PM - 9:00 PM)
                    </option>
                    <option value="9:00 PM - 11:00 PM">
                      Late Night (9:00 PM - 11:00 PM)
                    </option>
                    <option value="Tomorrow Morning">
                      Tomorrow Morning (9:00 AM - 12:00 PM)
                    </option>
                  </select>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Preferred Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl focus:border-blue-500 outline-none"
                  >
                    <option value="Tamil">Tamil (Thanglish)</option>
                    <option value="English">English</option>
                  </select>
                </div>

                {/* Requirement */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Mock Interview / Preparation Topic
                  </label>
                  <textarea
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    required
                    rows="3"
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl focus:border-blue-500 outline-none"
                    placeholder="E.g., Mock React/Node interview, Resume structural feedback, Salary Negotiation advice..."
                  />
                </div>

                {/* Payment Trigger */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRazorpayPayment}
                    className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all shadow-xl cursor-pointer ${
                      paymentDetails
                        ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:opacity-95"
                    }`}
                  >
                    {paymentDetails
                      ? `✓ Payment Verified (ID: ${paymentDetails.slice(
                          0,
                          10
                        )}...)`
                      : `Pay ₹${amountToPay} & Lock Slot Request`}
                  </button>
                </div>

                {/* Submit Action */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={!paymentDetails}
                    className="flex-1 py-3 bg-white disabled:opacity-40 text-slate-950 font-extrabold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Broadcast to Mentors
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCompany(null)}
                    className="py-3 px-5 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- 4. POST-SESSION RATING MODAL --- */}
        {ratingModalBooking && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <h3 className="text-lg font-bold text-white">
                Rate Mentor Session ({ratingModalBooking.companyName})
              </h3>

              <form onSubmit={handleRatingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Select Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        className={`flex-1 py-2 rounded-xl text-lg font-bold cursor-pointer ${
                          ratingScore >= star
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        ★ {star}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Feedback / Review
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows="3"
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-white text-xs rounded-xl outline-none focus:border-blue-500"
                    placeholder="How was the mock interview guidance?"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Submit Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatingModalBooking(null)}
                    className="py-2.5 px-4 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FresherDashboard;