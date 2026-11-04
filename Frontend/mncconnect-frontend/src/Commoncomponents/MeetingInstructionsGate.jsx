// src/Commoncomponents/MeetingInstructionsGate.jsx
// Full-page "Before we start" screen. White + black theme.
// Opens 5 min before the session. Even after accepting, the person enters the
// meeting only in the last 20 seconds before the start time (entryInMs hits 0).
import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Circle,
  ShieldCheck,
  Clock3,
} from "lucide-react";
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

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const StatusRow = ({ label, done }) => (
  <div className="flex items-center justify-between rounded-xl border border-white/15 px-4 py-3">
    <span className="text-sm font-medium text-white/90">{label}</span>
    {done ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
        <CheckCircle2 size={16} /> Accepted
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50">
        <Circle size={16} /> Pending
      </span>
    )}
  </div>
);

export default function MeetingInstructionsGate({
  bookingId,
  role,
  peerAccepted = false,
  alreadyAccepted = false,
  entryInMs = null, // ms left until the meeting door opens (null = unknown yet)
}) {
  const [lang, setLang] = useState("en");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(alreadyAccepted);
  const [submitting, setSubmitting] = useState(alreadyAccepted);

  // already accepted on the server (page refresh) -> show locked state
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

  const isMentor = role === "mentor";
  const youLabel = isMentor ? "You (Employee)" : "You (Fresher)";
  const otherLabel = isMentor ? "Fresher" : "Employee";
  const waitingForDoor = entryInMs !== null && entryInMs > 0;

  return (
    <div className="fixed inset-0 z-[130] flex h-[100dvh] flex-col overflow-hidden bg-white text-slate-900 md:flex-row">
      {/* ---------------- left / top: black panel ---------------- */}
      <aside className="flex shrink-0 flex-col bg-black px-6 py-6 text-white md:w-[380px] md:px-10 md:py-10 lg:w-[440px]">
        <p className="text-sm font-bold tracking-wide">
          MNC<span className="text-white/60">Connect</span>
        </p>

        <div className="mt-6 md:mt-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
            <ShieldCheck size={13} /> Meeting guidelines
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
            Before we start
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Please read the {isMentor ? "employee" : "fresher"} guidelines and
            accept them. You will enter the meeting automatically in the last
            20 seconds before the start time.
          </p>
        </div>

        {/* countdown to the meeting door */}
        {entryInMs !== null && (
          <div className="mt-6 rounded-xl border border-white/20 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
              <Clock3 size={13} />
              {waitingForDoor ? "Meeting opens in" : "Opening now"}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
              {mmss(entryInMs)}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {submitting
                ? "Accepted. You will go in automatically."
                : "Read and accept before the timer ends."}
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2.5 md:mt-8">
          <StatusRow label={youLabel} done={submitting} />
          <StatusRow label={otherLabel} done={peerAccepted} />
        </div>

        <div className="mt-6 md:mt-auto md:pt-10">
          <label
            htmlFor="gate-lang"
            className="text-xs font-semibold uppercase tracking-wider text-white/50"
          >
            Language
          </label>
          <div className="relative mt-2">
            <select
              id="gate-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/20 bg-black py-3 pl-4 pr-10 text-sm font-medium text-white outline-none focus:border-white"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60"
            />
          </div>
        </div>
      </aside>

      {/* ---------------- right / bottom: white panel ---------------- */}
      <main className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 md:px-10 md:py-6">
          <h2 className="text-lg font-bold text-slate-900 md:text-xl">
            Guidelines
          </h2>
          {!loading && items.length > 0 && (
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              {items.length} points
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 md:px-10 md:py-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-slate-900" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              No instructions available.
            </p>
          ) : (
            <ol className="mx-auto max-w-3xl divide-y divide-slate-100">
              {items.map((it, i) => (
                <li key={it._id || i} className="flex gap-4 py-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-[15px] leading-7 text-slate-700">
                    {it.text}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* footer: accept */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-10 md:py-5">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checked}
                disabled={submitting}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-400 accent-black"
              />
              <span className="text-sm text-slate-700">
                I have read and understood all the instructions.
              </span>
            </label>

            <button
              onClick={submit}
              disabled={!checked || submitting || items.length === 0}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-8 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {submitting
                ? waitingForDoor
                  ? `Accepted. Entering in ${mmss(entryInMs)}`
                  : "Accepted. Entering…"
                : "Accept & continue"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}