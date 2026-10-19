import React, { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { api, ENDPOINTS } from "../../services/fresherApi";

// Mandatory review: no close button. Shown after every finished session.
const ReviewModal = ({ booking, onDone }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!booking) return null;

  const submit = async () => {
    if (!rating) return setError("Please select a star rating.");
    setBusy(true);
    setError("");
    try {
      await api(ENDPOINTS.review, {
        method: "POST",
        body: { mentorId: booking.mentor?.id, requestGroupId: booking.requestGroupId, rating, comment },
      });
      onDone?.();
    } catch (e) {
      if (e.status === 409) onDone?.(); // already reviewed
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Review required</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">How was your session?</h2>
        <p className="mt-1 text-sm text-slate-500">
          with {booking.mentor?.name || "your mentor"}
          {booking.companyName ? ` · ${booking.companyName}` : ""}
        </p>

        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s} type="button" onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setRating(s)}
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
            >
              <Star size={34} className={s <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-300"} />
            </button>
          ))}
        </div>

        <textarea
          value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1000}
          placeholder="Tell us what was helpful (optional)"
          className="mt-5 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="button" onClick={submit} disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Submit review
        </button>
      </div>
    </div>
  );
};

export default ReviewModal;