// Commoncomponents/PendingConfirmationGate.jsx
// OUTSIDE the meeting:
//   1. "Was your session successful?"  (Yes / No)
//   2. Yes -> review popup (stars + feedback)      <- review only after YES
//      No  -> review is NOT asked
// INSIDE the meeting room this gate shows nothing (the meeting handles everything).
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Star } from "lucide-react";
import { API_URL } from "../services/fresherApi";
import SessionConfirmModal, { confirmSessionApi } from "./SessionConfirmModal";

// true  = stars + 10 chars feedback compulsory
// false = stars compulsory, feedback optional, and a "Skip" link is shown
const REVIEW_REQUIRED = false;

/* ---------- review popup (shown only after the fresher clicked YES) ---------- */
const ReviewModal = ({ booking, onDone }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit =
    rating >= 1 && (!REVIEW_REQUIRED || comment.trim().length >= 10) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestGroupId: booking.requestGroupId,
          rating,
          comment: comment.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if ((res.ok && d.success) || res.status === 409)
        onDone(); // 409 = already reviewed
      else setErr(d.message || "Could not submit. Try again.");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
          {REVIEW_REQUIRED ? "Review required" : "Review"}
        </p>
        <h3 className="mt-1 text-xl font-bold">How was your session?</h3>
        <p className="mt-1 text-xs text-slate-500">
          {booking.mentor?.name
            ? `with ${booking.mentor.name}`
            : "Your session"}
          {booking.companyName ? ` · ${booking.companyName}` : ""}
        </p>

        <div className="mt-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star
                size={34}
                className={
                  (hover || rating) >= n
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-slate-300"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder={
            REVIEW_REQUIRED
              ? "Write your feedback (min 10 characters)"
              : "Tell us what was helpful (optional)"
          }
          className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400"
        />

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit review"}
        </button>

        {!REVIEW_REQUIRED && (
          <button
            type="button"
            onClick={onDone}
            className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------- the gate ---------- */
const PendingConfirmationGate = () => {
  const { pathname } = useLocation();
  const [list, setList] = useState([]);
  // booking that was just confirmed with YES and now needs its review.
  // kept in its own state so the 60s refresh can't remove the popup.
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/bookings/pending-confirmation`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setList(d.bookings || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // inside the meeting room the meeting itself handles everything
  if (pathname.toLowerCase().includes("/meeting")) return null;

  // step 2: review (only after YES)
  if (reviewing) {
    return (
      <ReviewModal
        key={`review-${reviewing._id}`}
        booking={reviewing}
        onDone={() => setReviewing(null)}
      />
    );
  }

  // step 1: confirm
  const current = list.find((b) => b._id !== reviewing?._id);
  if (!current) return null;

  const removeCurrent = () =>
    setList((l) => l.filter((b) => b._id !== current._id));

  return (
    <SessionConfirmModal
      key={current._id}
      zIndex="z-[100]"
      title="Was your session successful?"
      subtitle={`Your session${
        current.mentor?.name ? ` with ${current.mentor.name}` : ""
      }${current.companyName ? ` (${current.companyName})` : ""} has finished. Please confirm.`}
      onYes={async () => {
        await confirmSessionApi(current._id, true);
        removeCurrent();
        // already reviewed inside the meeting -> do not ask again
        if (!current.reviewed && !current.myReviewed) {
          setReviewing(current); // YES -> ask review
        }
      }}
      onNo={async (reason) => {
        await confirmSessionApi(current._id, false, reason);
        removeCurrent(); // NO -> no review
      }}
    />
  );
};

export default PendingConfirmationGate;
