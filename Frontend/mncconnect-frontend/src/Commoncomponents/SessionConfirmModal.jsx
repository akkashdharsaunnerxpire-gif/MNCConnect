// Commoncomponents/SessionConfirmModal.jsx
// Yes / No confirmation.
//  Yes -> onYes()
//  No  -> reason (validated) -> "Are you sure?" (OK / Cancel) -> onNo(reason)
import React, { useState } from "react";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { API_URL } from "../services/fresherApi";

const MIN_CHARS = 20;
const MIN_WORDS = 4;
const JUNK = new Set([
  "no", "nothing", "bad", "test", "testing", "asdf", "none", "na", "n/a",
  "not good", "not ok", "idk", "dont know", "no reason", "reason",
]);

// returns "" when valid, otherwise the error text
export const validateReason = (text = "") => {
  const t = String(text).trim().replace(/\s+/g, " ");
  if (!t) return "Reason is required.";
  if (JUNK.has(t.toLowerCase())) return "Please give a proper reason.";
  if (t.length < MIN_CHARS) return `Reason must be at least ${MIN_CHARS} characters.`;
  const words = t.split(" ").filter((w) => w.length > 1);
  if (words.length < MIN_WORDS) return `Please explain in at least ${MIN_WORDS} words.`;
  if (/(.)\1{4,}/.test(t)) return "Please write a valid reason (no repeated characters).";
  const uniq = new Set(t.toLowerCase().replace(/[^a-z\u0B80-\u0BFF]/g, "")).size;
  if (uniq < 6) return "Please write a valid reason.";
  return "";
};

// post-meeting confirmation (REST)
export const confirmSessionApi = async (bookingId, accepted, reason = "") => {
  const res = await fetch(`${API_URL}/bookings/${bookingId}/confirm-session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted, reason: reason.trim() }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.success === false) throw new Error(d.message || "Could not save. Try again.");
  return d;
};

const SessionConfirmModal = ({
  title = "Did the session go well?",
  subtitle = "Please confirm your session.",
  onYes, // async () => void
  onNo, // async (reason) => void
  zIndex = "z-[60]",
}) => {
  const [step, setStep] = useState("ask"); // ask | reason | sure
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reasonErr = validateReason(reason);

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e?.message || "Something went wrong. Try again.");
      setStep((s) => (s === "sure" ? "reason" : s));
    } finally {
      setBusy(false);
    }
  };

  const goSure = () => {
    setTouched(true);
    if (reasonErr) return;
    setStep("sure");
  };

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/70 px-4`}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        {step === "ask" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="text-emerald-600" size={30} />
            </div>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
            <div className="mt-5 flex gap-3">
              <button
                disabled={busy}
                onClick={() => { setErr(""); setStep("reason"); }}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                No
              </button>
              <button
                disabled={busy}
                onClick={() => run(onYes)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Yes
              </button>
            </div>
          </>
        )}

        {step === "reason" && (
          <>
            <h3 className="text-lg font-bold">Why was it not successful?</h3>
            <p className="mt-1 text-sm text-slate-500">
              A valid reason is required to mark the session as not successful.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={4}
              maxLength={500}
              placeholder="Explain what went wrong (min 20 characters)"
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-left text-sm outline-none focus:border-blue-400"
            />
            {(touched && reasonErr) || err ? (
              <p className="mt-2 text-left text-xs text-red-600">{err || reasonErr}</p>
            ) : (
              <p className="mt-2 text-right text-[11px] text-slate-400">{reason.trim().length}/500</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setStep("ask"); setErr(""); }}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
              >
                Back
              </button>
              <button
                onClick={goSure}
                disabled={Boolean(reasonErr)}
                className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "sure" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="text-amber-600" size={28} />
            </div>
            <h3 className="mt-4 text-lg font-bold">Are you sure?</h3>
            <p className="mt-1 text-sm text-slate-500">
              The session will be marked as <b>not successful</b> and your reason will be sent for review.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                disabled={busy}
                onClick={() => setStep("reason")}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => onNo(reason.trim()))}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionConfirmModal;