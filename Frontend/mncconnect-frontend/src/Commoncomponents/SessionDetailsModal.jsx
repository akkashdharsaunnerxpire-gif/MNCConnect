// src/Commoncomponents/SessionDetailsModal.jsx
import React, { useEffect } from "react";
import {
  Briefcase, CalendarDays, CheckCircle2, Clock3, IndianRupee,
  MessageSquare, Timer, User, Video, X,
} from "lucide-react";

const Row = ({ icon: Icon, label, value, green }) =>
  value ? (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5 text-slate-500">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`text-right text-sm font-semibold ${green ? "text-emerald-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  ) : null;

export default function SessionDetailsModal({ session, onClose, onMessage }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!session) return null;

  const s = session;
  const duration = s.duration ? `${parseInt(s.duration, 10) || s.duration} mins` : "";
  const earn = s.earning ?? s.mentorEarning;
  const time = s.time || (s.startsAt ? new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Session details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-140px)] space-y-2 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
              {(s.name || "F").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{s.name}</p>
              <p className="text-xs text-slate-500">Fresher</p>
            </div>
            {s.status && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 size={12} /> {s.status}
              </span>
            )}
          </div>

          <Row icon={User} label="Topic" value={s.topic} />
          <Row icon={Briefcase} label="Role" value={s.role === "Other" && s.otherRole ? s.otherRole : s.role} />
          <Row icon={CalendarDays} label="Date" value={s.date} />
          <Row icon={Clock3} label="Time" value={time} />
          <Row icon={Timer} label="Duration" value={duration} />
          <Row icon={Video} label="Mode" value="Video call" />
          <Row icon={IndianRupee} label="You earned" value={earn != null ? `₹${earn}` : ""} green />

          {s.message && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-700">
                <MessageSquare size={13} /> Fresher's note
              </div>
              <p className="text-sm leading-6 text-slate-700">{s.message}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          {onMessage && (
            <button
              type="button"
              onClick={() => onMessage(s)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <MessageSquare size={15} /> Message
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
