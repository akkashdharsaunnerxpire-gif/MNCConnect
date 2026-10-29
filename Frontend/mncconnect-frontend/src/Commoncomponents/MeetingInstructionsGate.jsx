// src/Commoncomponents/MeetingInstructionsGate.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { socket } from "../utils/socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
  { code: "ml", label: "മലയാളം" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
];

export default function MeetingInstructionsGate({
  bookingId,
  role,
  peerAccepted = false,
  alreadyAccepted = false,
}) {
  const [lang, setLang] = useState("en");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(alreadyAccepted);
  const [submitting, setSubmitting] = useState(alreadyAccepted);

  // server-la already accept pannirundha (refresh), locked state-la kaattu
  useEffect(() => {
    if (alreadyAccepted) {
      setChecked(true);
      setSubmitting(true);
    }
  }, [alreadyAccepted]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    // auth = HttpOnly cookie (no token in JS, no localStorage)
    fetch(`${API_URL}/instructions?lang=${lang}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) setItems(d.instructions || []);
        else setError(d.message || "Unable to load instructions.");
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load instructions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const submit = () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    socket.emit("meeting:instructions-accepted", { bookingId });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">Before we start</h2>
          <p className="mt-1 text-sm text-blue-100">
            Read the {role === "mentor" ? "mentor" : "fresher"} guidelines below.
            Your camera turns on and the meeting starts only after both of you accept.
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Language:</label>
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-blue-400"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No instructions available.
            </p>
          ) : (
            <ol className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {items.map((it, i) => (
                <li
                  key={it._id || i}
                  className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {i + 1}
                  </span>
                  <span>{it.text}</span>
                </li>
              ))}
            </ol>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              checked={checked}
              disabled={submitting}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              I have read and understood all the instructions above.
            </span>
          </label>

          <button
            onClick={submit}
            disabled={!checked || submitting || items.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? "Accepted. Waiting for the other person…" : "Accept & continue"}
          </button>

          {peerAccepted && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-600">
              ✓ The other person has accepted.{submitting ? "" : " Waiting for you…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}