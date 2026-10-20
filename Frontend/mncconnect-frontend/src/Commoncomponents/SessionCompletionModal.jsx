// src/Commoncomponents/SessionCompletionModal.jsx
import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Star } from "lucide-react";
import { api } from "../services/fresherApi";

export default function SessionCompletionModal({ booking, variant = "confirm", onDone, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (accepted) => {
    setBusy(true);
    setError("");
    try {
      await api(`/bookings/${booking.requestGroupId}/confirm`, {
        method: "PATCH",
        body: { accepted },
      });
      
      // ✅ Page redirect to fix UI glitches and Double Click 400 Errors
      if (accepted) {
        window.location.href = `/Home/review/${booking.requestGroupId}`; 
      } else {
        window.location.href = `/Home/my-bookings`;
      }
      
      onDone?.(accepted);
    } catch (e) {
      setError(e?.message || "Unable to confirm. Please try again.");
      setBusy(false); // Re-enable only on error
    }
  };

  if (variant === "prompt") {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 px-4 backdrop-blur">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
            <h2 className="text-lg font-bold">5 minutes left</h2>
            <p className="mt-1 text-sm text-amber-50">Please wrap up your session and prepare to end the call.</p>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span>Summarise what you discussed</span></li>
              <li className="flex items-start gap-2"><Star size={15} className="mt-0.5 shrink-0 text-amber-500" /><span>Politely ask the fresher to confirm the session went well</span></li>
              <li className="flex items-start gap-2"><Star size={15} className="mt-0.5 shrink-0 text-amber-500" /><span>Ask them to leave a review afterwards</span></li>
            </ul>
            <button onClick={onClose} className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800">Got it, continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 px-4 backdrop-blur">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">Did the session go well?</h2>
          <p className="mt-1 text-sm text-blue-100">Your confirmation releases the mentor's payment.</p>
        </div>
        <div className="px-6 py-5">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Session with</p>
            <p className="mt-1 font-semibold text-slate-900">{booking?.mentor?.name || "Your mentor"}</p>
            {booking?.date && <p className="mt-1 text-xs text-slate-500">{booking.date} at {booking.time}</p>}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Only click <b>Yes</b> if the mentor attended and helped you. If they didn't join, click <b>No</b> — you'll be refunded.</span>
            </div>
          </div>

          {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => submit(false)} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />} No, refund me
            </button>
            <button onClick={() => submit(true)} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Yes, all good
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}