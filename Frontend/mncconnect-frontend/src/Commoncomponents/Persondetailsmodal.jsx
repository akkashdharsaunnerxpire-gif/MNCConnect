// src/Commoncomponents/PersonDetailsModal.jsx
// Shows the OTHER person of a booking.
//  - fresher page  -> mentor (MncEmployee) details
//  - mentor page   -> fresher details
// The data comes from GET <booking>/counterpart (see bookingController.getCounterpart)
import React, { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  Languages,
  ExternalLink,
  Star,
  UserRound,
  CalendarDays,
  Clock3,
  MessageSquare,
  BadgeCheck,
  GraduationCap,
} from "lucide-react";

const toList = (v) =>
  Array.isArray(v)
    ? v.map((x) => String(x || "").trim()).filter(Boolean)
    : typeof v === "string"
      ? v
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

const cap = (s) =>
  String(s || "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const Row = ({ icon, label, children }) => {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="break-words text-sm font-semibold text-slate-700">
          {children}
        </p>
      </div>
    </div>
  );
};

const Chips = ({ items, tone = "blue" }) => {
  if (!items.length) return null;
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-100 text-slate-600";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${cls}`}
        >
          {x}
        </span>
      ))}
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mt-5">
    <h4 className="mb-2 text-xs font-semibold text-slate-500">{title}</h4>
    {children}
  </div>
);

const PersonDetailsModal = ({ title, fetcher, onClose }) => {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });

    Promise.resolve()
      .then(fetcher)
      .then((d) => {
        if (cancelled) return;
        if (!d || d.success === false || !d.person) {
          setState({
            loading: false,
            error: d?.message || "Details are not available yet.",
            data: null,
          });
          return;
        }
        setState({ loading: false, error: "", data: d });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: e?.message || "Unable to load details.",
          data: null,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close with Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { loading, error, data } = state;
  const p = data?.person || {};
  const s = data?.session || {};
  const isMentor = data?.kind === "mentor";

  const linkedin = p.linkedinProfile
    ? /^https?:\/\//i.test(p.linkedinProfile)
      ? p.linkedinProfile
      : `https://${p.linkedinProfile}`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-14">
            <Loader2 className="animate-spin text-blue-600" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            {/* header */}
            <div className="flex items-center gap-4">
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  className="h-16 w-16 rounded-full border-2 border-blue-100 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                  <UserRound className="h-8 w-8 text-blue-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-lg font-bold text-slate-900">
                  {p.name || "-"}
                  {p.isVerified && (
                    <BadgeCheck size={16} className="shrink-0 text-blue-600" />
                  )}
                </p>
                {isMentor ? (
                  <p className="truncate text-sm text-slate-500">
                    {[p.designation, p.company].filter(Boolean).join(" at ")}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Fresher</p>
                )}
              </div>
            </div>

            {/* mentor numbers */}
            {isMentor && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="flex items-center justify-center gap-1 text-base font-bold text-amber-700">
                    <Star size={14} /> {Number(p.rating || 0).toFixed(1)}
                  </p>
                  <p className="text-[11px] text-amber-700">Rating</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-base font-bold text-blue-700">
                    {p.totalReviews || 0}
                  </p>
                  <p className="text-[11px] text-blue-700">Reviews</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-base font-bold text-emerald-700">
                    {p.totalSessions || 0}
                  </p>
                  <p className="text-[11px] text-emerald-700">Sessions</p>
                </div>
              </div>
            )}

            {/* person info */}
            <Section title={isMentor ? "About the employee" : "About the fresher"}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Row icon={<Mail size={15} />} label="Email">
                  {p.email}
                </Row>
                <Row icon={<UserRound size={15} />} label="Gender">
                  {cap(p.gender)}
                </Row>
                {isMentor && (
                  <>
                    <Row icon={<Building2 size={15} />} label="Company">
                      {p.company}
                    </Row>
                    <Row icon={<Briefcase size={15} />} label="Role">
                      {[p.designation, p.department]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(" · ")}
                    </Row>
                    <Row icon={<MapPin size={15} />} label="Office location">
                      {p.officeLocation}
                    </Row>
                    <Row icon={<GraduationCap size={15} />} label="Experience">
                      {p.yearsOfExperience
                        ? `${p.yearsOfExperience} year${p.yearsOfExperience > 1 ? "s" : ""}`
                        : ""}
                    </Row>
                  </>
                )}
              </div>
            </Section>

            {isMentor && toList(p.languages).length > 0 && (
              <Section title="Languages">
                <div className="mb-1 flex items-center gap-2 text-slate-400">
                  <Languages size={14} />
                </div>
                <Chips items={toList(p.languages)} tone="slate" />
              </Section>
            )}

            {isMentor && toList(p.skills).length > 0 && (
              <Section title="Skills">
                <Chips items={toList(p.skills)} />
              </Section>
            )}

            {isMentor && p.bio && (
              <Section title="Bio">
                <p className="whitespace-pre-line text-sm text-slate-600">
                  {p.bio}
                </p>
              </Section>
            )}

            {isMentor && linkedin && (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                <ExternalLink size={15} /> LinkedIn profile
              </a>
            )}

            {/* booking info (same for both sides) */}
            <Section title="This booking">
              <div className="grid gap-2 sm:grid-cols-2">
                <Row icon={<Briefcase size={15} />} label="Session type">
                  {s.sessionType}
                </Row>
                <Row icon={<CalendarDays size={15} />} label="Date">
                  {s.date}
                </Row>
                <Row icon={<Clock3 size={15} />} label="Time">
                  {[s.time, s.durationMinutes ? `${s.durationMinutes} min` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </Row>
                <Row icon={<Languages size={15} />} label="Language">
                  {s.language}
                </Row>
                {!isMentor && (
                  <Row icon={<Briefcase size={15} />} label="Role asked for">
                    {s.role}
                  </Row>
                )}
              </div>
              {s.reason && (
                <div className="mt-2 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <MessageSquare size={15} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-[11px] text-slate-400">
                      {isMentor ? "Fresher's message" : "Your message"}
                    </p>
                    <p className="whitespace-pre-line text-sm text-slate-700">
                      {s.reason}
                    </p>
                  </div>
                </div>
              )}
            </Section>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PersonDetailsModal;