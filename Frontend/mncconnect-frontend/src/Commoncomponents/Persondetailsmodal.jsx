// src/Commoncomponents/PersonDetailsModal.jsx
// Shows the OTHER person of a booking.
//  - fresher page  -> mentor (MncEmployee) details
//  - mentor page   -> fresher details
// The data comes from GET <booking>/counterpart (see bookingController.getCounterpart)
// Props are unchanged: { title, fetcher, onClose }
//
// THEME: full white surfaces + light-dark (slate) text / accents.
// PERFORMANCE: no backdrop-blur, memoized, small avatar image, light animation.
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Phone,
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
  BookOpen,
  Target,
  Award,
  Copy,
  Check,
  Video,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Users,
  FileText,
  ZoomIn,
} from "lucide-react";

/* ---------------------------- helpers ---------------------------- */

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

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

// first non-empty value among several possible field names
const pick = (o, keys) => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

const fullUrl = (u) =>
  u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : "";

// ask the image host for a resized copy (small = fast decode, no scroll jank)
const hd = (url, width = 256) => {
  if (!url || typeof url !== "string") return url;
  // Cloudinary
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (/\/upload\/[^/]*(w_|q_|f_)/.test(url)) return url;
    return url.replace(
      "/upload/",
      `/upload/f_auto,q_auto,w_${width},c_limit/`,
    );
  }
  // Google profile photos (=s96-c  ->  =sN-c)
  if (/googleusercontent\.com/.test(url)) {
    return url.replace(/=s\d+(-c)?$/, `=s${width}-c`);
  }
  return url;
};

/* Brand icons were removed from newer lucide-react versions, so we draw our own */
const GithubIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);

const LinkedinIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
);

/* ---------------------------- small parts ---------------------------- */

const Skeleton = () => (
  <div className="animate-pulse">
    <div className="h-36 bg-slate-100" />
    <div className="px-6 pb-6">
      <div className="-mt-14 h-28 w-28 rounded-full border-4 border-white bg-slate-200" />
      <div className="mt-4 h-5 w-48 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-64 rounded bg-slate-100" />
      <div className="mt-6 space-y-2">
        <div className="h-14 rounded-2xl bg-slate-50" />
        <div className="h-14 rounded-2xl bg-slate-50" />
        <div className="h-14 rounded-2xl bg-slate-50" />
      </div>
    </div>
  </div>
);

const Stat = ({ icon, value, label, tone, small }) => (
  <div className={`rounded-2xl px-3 py-3 text-center ${tone}`}>
    <p
      className={`flex items-center justify-center gap-1 font-bold leading-none ${
        small ? "text-sm" : "text-lg"
      }`}
    >
      {icon}
      {value}
    </p>
    <p className="mt-1.5 text-[11px] font-medium opacity-80">{label}</p>
  </div>
);

const InfoRow = ({ icon, label, children }) => {
  if (!children) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="break-words text-sm font-semibold text-slate-800">
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
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}
        >
          {x}
        </span>
      ))}
    </div>
  );
};

const Block = ({ title, icon, children }) => (
  <section className="mt-6">
    <h4 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-800">
      {icon && <span className="text-slate-400">{icon}</span>}
      {title}
    </h4>
    {children}
  </section>
);

const LinkBtn = ({ href, icon, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
  >
    {icon}
    {children}
    <ExternalLink size={13} className="opacity-50" />
  </a>
);

/* Avatar: small optimized image, falls back to initials if the image fails */
const Avatar = memo(({ src, name, onZoom, big }) => {
  const [failed, setFailed] = useState(false);
  const dim = big ? "h-32 w-32" : "h-28 w-28";

  if (!src || failed) {
    return (
      <div
        className={`relative z-10 flex ${dim} items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-100 to-blue-200 text-3xl font-bold text-blue-700 shadow-md ring-1 ring-slate-200`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label="View photo full size"
      className={`group relative z-10 ${dim} shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-md ring-1 ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <img
        src={hd(src, 256)}
        alt={name}
        width={128}
        height={128}
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-white opacity-0 transition-opacity group-hover:bg-slate-900/40 group-hover:opacity-100">
        <ZoomIn size={22} />
      </span>
    </button>
  );
});
Avatar.displayName = "Avatar";

/* ---------------------------- main ---------------------------- */

const PersonDetailsModal = ({ title, fetcher, onClose }) => {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tab, setTab] = useState("profile");
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(false);

  // keep latest fetcher without re-running the effect on every parent render
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });

    Promise.resolve()
      .then(() => fetcherRef.current())
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
  }, []);

  useEffect(() => load(), [load]);

  // Esc: closes the photo first, then the modal. Page behind does not scroll.
  const zoomRef = useRef(false);
  zoomRef.current = zoom;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomRef.current) setZoom(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const openZoom = useCallback(() => setZoom(true), []);

  const { loading, error, data } = state;
  const p = data?.person || {};
  const s = data?.session || {};
  const isMentor = data?.kind === "mentor";

  /* ---- values (several possible field names, so it works with your schema) ---- */
  const phone = pick(p, ["phone", "mobile", "phoneNumber", "mobileNumber"]);
  const location = isMentor
    ? pick(p, ["officeLocation"])
    : pick(p, ["location", "city", "currentLocation", "address", "state"]);
  const college = pick(p, [
    "college",
    "collegeName",
    "university",
    "institute",
    "institution",
  ]);
  const degree = pick(p, ["degree", "course", "qualification"]);
  const branch = pick(p, ["branch", "specialization", "stream", "major"]);
  const gradYear = pick(p, [
    "graduationYear",
    "passingYear",
    "passoutYear",
    "yearOfPassing",
    "batch",
  ]);
  const cgpa = pick(p, ["cgpa", "gpa", "percentage"]);
  const targetRole = pick(p, [
    "targetRole",
    "interestedRole",
    "preferredRole",
    "desiredRole",
    "careerGoal",
  ]);
  const bio = pick(p, ["bio", "about", "summary", "headline"]);
  const linkedin = fullUrl(pick(p, ["linkedinProfile", "linkedin"]));
  const github = fullUrl(pick(p, ["githubProfile", "github"]));
  const resume = fullUrl(pick(p, ["resume", "resumeUrl", "resumeLink"]));
  const skills = toList(p.skills);
  const languages = toList(p.languages);

  const experience = p.yearsOfExperience
    ? `${p.yearsOfExperience} year${p.yearsOfExperience > 1 ? "s" : ""}`
    : "";

  const roleLine = isMentor
    ? [p.designation, p.company].filter(Boolean).join(" at ")
    : [degree, college].filter(Boolean).join(" · ") ||
      (s.role ? `Fresher · Looking for ${s.role}` : "Fresher");

  const hasEducation = !!(college || degree || branch || gradYear || cgpa);
  const hasLinks = !!(linkedin || github || resume);
  const fresherHasExtras =
    hasEducation ||
    !!(phone || location || targetRole || bio || skills.length || languages.length || hasLinks);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(p.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  const tabs = [
    { id: "profile", label: isMentor ? "Profile" : "About" },
    { id: "booking", label: "Booking" },
  ];

  const wide = !loading && !error && !!data && !isMentor;

  /* =====================================================================
     FRESHER VIEW (what the mentor sees): two-pane "candidate card"
       left  = identity + actions + quick contact   (light grey panel)
       right = session request + profile sections   (white)
     ===================================================================== */
  const renderFresher = () => {
    const asked = [targetRole, s.role]
      .filter(Boolean)
      .map(String)
      .filter((v, i, a) => a.indexOf(v) === i);

    const eduLine = [degree, college].filter(Boolean).join(" · ");

    const sideBtn =
      "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

    const sideInfo = [
      { icon: <Mail size={15} />, text: p.email },
      { icon: <Phone size={15} />, text: phone },
      { icon: <MapPin size={15} />, text: location },
      { icon: <UserRound size={15} />, text: cap(p.gender) },
    ].filter((x) => x.text);

    return (
      <div className="flex flex-col md:h-[min(640px,78vh)] md:flex-row">
        {/* ---------- left: identity ---------- */}
        <aside className="pdm-scroll relative border-b border-slate-200 bg-slate-50 p-6 text-slate-800 md:w-72 md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-b-0 md:border-r">
          <div className="relative flex flex-col items-center text-center">
            <Avatar big src={p.image} name={p.name} onZoom={openZoom} />

            <h3 className="mt-4 flex max-w-full items-center gap-1.5 text-xl font-bold text-slate-900">
              <span className="truncate">{p.name || "-"}</span>
              {p.isVerified && (
                <BadgeCheck size={18} className="shrink-0 text-blue-600" />
              )}
            </h3>

            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
              <GraduationCap size={13} /> Fresher
            </span>

            {eduLine && (
              <p className="mt-3 text-sm text-slate-500">{eduLine}</p>
            )}
          </div>

          <div className="relative mt-6 space-y-2">
            {p.email && (
              <button
                type="button"
                onClick={copyEmail}
                className={`${sideBtn} bg-slate-800 text-white hover:bg-slate-700`}
              >
                {copied ? (
                  <>
                    <Check size={15} className="text-emerald-300" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={15} /> Copy email
                  </>
                )}
              </button>
            )}
            {linkedin && (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className={`${sideBtn} bg-blue-600 text-white hover:bg-blue-700`}
              >
                <LinkedinIcon size={15} /> LinkedIn
              </a>
            )}
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                className={`${sideBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
              >
                <GithubIcon size={15} /> GitHub
              </a>
            )}
            {resume && (
              <a
                href={resume}
                target="_blank"
                rel="noopener noreferrer"
                className={`${sideBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
              >
                <FileText size={15} /> Resume
              </a>
            )}
          </div>

          {sideInfo.length > 0 && (
            <ul className="relative mt-6 space-y-3 border-t border-slate-200 pt-5">
              {sideInfo.map((x) => (
                <li
                  key={x.text}
                  className="flex items-center gap-2.5 text-sm text-slate-600"
                >
                  <span className="shrink-0 text-slate-400">{x.icon}</span>
                  <span className="min-w-0 break-words">{x.text}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ---------- right: request + profile ---------- */}
        <main className="pdm-scroll min-w-0 flex-1 bg-white p-5 sm:p-6 md:overflow-y-auto md:overscroll-contain">
          <h2 className="pr-10 text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            What this fresher asked for in this booking.
          </p>

          {/* session overview */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                <Video size={16} className="text-blue-600" />
                {s.sessionType || "Session"}
              </span>
              {s.language && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                  <Languages size={13} /> {s.language}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              <Stat
                small
                icon={<CalendarDays size={15} className="text-blue-600" />}
                value={s.date || "-"}
                label="Date"
                tone="bg-white text-slate-800 ring-1 ring-inset ring-slate-200"
              />
              <Stat
                small
                icon={<Clock3 size={15} className="text-blue-600" />}
                value={s.time || "-"}
                label="Start time"
                tone="bg-white text-slate-800 ring-1 ring-inset ring-slate-200"
              />
              <Stat
                small
                icon={<Video size={15} className="text-blue-600" />}
                value={s.durationMinutes ? `${s.durationMinutes} min` : "-"}
                label="Duration"
                tone="bg-white text-slate-800 ring-1 ring-inset ring-slate-200"
              />
            </div>
          </div>

          {/* message */}
          {s.reason ? (
            <Block title="Why they booked" icon={<MessageSquare size={15} />}>
              <blockquote className="whitespace-pre-line rounded-2xl border-l-4 border-blue-500 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {s.reason}
              </blockquote>
            </Block>
          ) : null}

          {asked.length > 0 && (
            <Block title="Looking for" icon={<Target size={15} />}>
              <Chips items={asked} />
            </Block>
          )}

          {bio && (
            <Block title="About">
              <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {bio}
              </p>
            </Block>
          )}

          {hasEducation && (
            <Block title="Education" icon={<GraduationCap size={15} />}>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow icon={<Building2 size={16} />} label="College">
                  {college}
                </InfoRow>
                <InfoRow icon={<BookOpen size={16} />} label="Degree">
                  {[degree, branch].filter(Boolean).join(" · ")}
                </InfoRow>
                <InfoRow icon={<CalendarDays size={16} />} label="Graduation year">
                  {gradYear && String(gradYear)}
                </InfoRow>
                <InfoRow icon={<Award size={16} />} label="CGPA / %">
                  {cgpa && String(cgpa)}
                </InfoRow>
              </div>
            </Block>
          )}

          {skills.length > 0 && (
            <Block title="Skills">
              <Chips items={skills} />
            </Block>
          )}

          {languages.length > 0 && (
            <Block title="Languages" icon={<Languages size={15} />}>
              <Chips items={languages} tone="slate" />
            </Block>
          )}

          {!fresherHasExtras && (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              College, skills and links will show here once the fresher
              completes their profile.
            </p>
          )}
        </main>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <style>{`
        @keyframes pdm-in { from { opacity: 0; transform: translate3d(0,14px,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        .pdm-in { animation: pdm-in .18s ease-out; }
        .pdm-scroll { scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
        .pdm-scroll::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .pdm-in { animation: none; } }
      `}</style>

      <div
        className={`pdm-in relative flex max-h-[92vh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl [transform:translateZ(0)] sm:rounded-3xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* floating close button (always visible) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X size={18} />
        </button>

        <div
          className={`pdm-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain ${
            wide ? "md:overflow-hidden" : ""
          }`}
        >
          {loading && <Skeleton />}

          {!loading && error && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Could not load details
              </h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                {error}
              </p>
              <button
                type="button"
                onClick={load}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          )}

          {!loading && data && !isMentor && renderFresher()}

          {!loading && data && isMentor && (
            <>
              {/* ---------- banner (light) ---------- */}
              <div className="relative z-0 h-32 border-b border-slate-200 bg-gradient-to-br from-slate-100 via-blue-50 to-white">
                <p className="absolute left-6 top-4 text-xs font-semibold text-slate-500">
                  {title}
                </p>
              </div>

              <div className="relative z-10 px-5 pb-6 sm:px-6">
                {/* avatar sits ABOVE the banner (z-10), half overlapping */}
                <div className="-mt-14 flex items-end justify-between gap-3">
                  <Avatar src={p.image} name={p.name} onZoom={openZoom} />

                  <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
                    {p.email && (
                      <button
                        type="button"
                        onClick={copyEmail}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {copied ? (
                          <>
                            <Check size={14} className="text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copy email
                          </>
                        )}
                      </button>
                    )}
                    {linkedin && (
                      <a
                        href={linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        <LinkedinIcon size={14} />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4 min-w-0">
                  <h3 className="flex items-center gap-1.5 text-2xl font-bold text-slate-900">
                    <span className="truncate">{p.name || "-"}</span>
                    {p.isVerified && (
                      <BadgeCheck
                        size={20}
                        className="shrink-0 text-blue-600"
                        aria-label="Verified"
                      />
                    )}
                  </h3>
                  {roleLine && (
                    <p className="mt-0.5 text-sm text-slate-500">{roleLine}</p>
                  )}
                </div>

                {/* ---------- mentor numbers ---------- */}
                {isMentor && (
                  <div className="mt-5 grid grid-cols-3 gap-2.5">
                    <Stat
                      icon={<Star size={15} />}
                      value={Number(p.rating || 0).toFixed(1)}
                      label="Rating"
                      tone="bg-amber-50 text-amber-700"
                    />
                    <Stat
                      icon={<Users size={15} />}
                      value={p.totalSessions || 0}
                      label="Sessions"
                      tone="bg-emerald-50 text-emerald-700"
                    />
                    <Stat
                      icon={<Sparkles size={15} />}
                      value={experience ? experience.split(" ")[0] : "-"}
                      label="Yrs experience"
                      tone="bg-blue-50 text-blue-700"
                    />
                  </div>
                )}

                {/* ---------- tabs ---------- */}
                <div
                  role="tablist"
                  className="mt-6 flex gap-1 rounded-2xl bg-slate-100 p-1"
                >
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        tab === t.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ---------- PROFILE TAB ---------- */}
                {tab === "profile" && (
                  <div role="tabpanel">
                    {bio && (
                      <Block title="Bio">
                        <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                          {bio}
                        </p>
                      </Block>
                    )}

                    <Block title="Contact & details">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <InfoRow icon={<Mail size={16} />} label="Email">
                          {p.email}
                        </InfoRow>
                        <InfoRow icon={<Phone size={16} />} label="Phone">
                          {phone}
                        </InfoRow>
                        <InfoRow icon={<UserRound size={16} />} label="Gender">
                          {cap(p.gender)}
                        </InfoRow>
                        <InfoRow
                          icon={<MapPin size={16} />}
                          label="Office location"
                        >
                          {location}
                        </InfoRow>
                        <InfoRow icon={<Building2 size={16} />} label="Company">
                          {p.company}
                        </InfoRow>
                        <InfoRow icon={<Briefcase size={16} />} label="Role">
                          {[p.designation, p.department]
                            .filter(Boolean)
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .join(" · ")}
                        </InfoRow>
                        <InfoRow
                          icon={<GraduationCap size={16} />}
                          label="Experience"
                        >
                          {experience}
                        </InfoRow>
                      </div>
                    </Block>

                    {skills.length > 0 && (
                      <Block title="Skills">
                        <Chips items={skills} />
                      </Block>
                    )}

                    {languages.length > 0 && (
                      <Block title="Languages" icon={<Languages size={15} />}>
                        <Chips items={languages} tone="slate" />
                      </Block>
                    )}

                    {hasLinks && (
                      <Block title="Links">
                        <div className="flex flex-wrap gap-2">
                          {linkedin && (
                            <LinkBtn href={linkedin} icon={<LinkedinIcon size={15} />}>
                              LinkedIn
                            </LinkBtn>
                          )}
                          {github && (
                            <LinkBtn href={github} icon={<GithubIcon size={15} />}>
                              GitHub
                            </LinkBtn>
                          )}
                          {resume && (
                            <LinkBtn href={resume} icon={<FileText size={15} />}>
                              Resume
                            </LinkBtn>
                          )}
                        </div>
                      </Block>
                    )}
                  </div>
                )}

                {/* ---------- BOOKING TAB ---------- */}
                {tab === "booking" && (
                  <div role="tabpanel">
                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3 text-slate-800">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <Video size={16} className="text-blue-600" />
                          {s.sessionType || "Session"}
                        </span>
                        {s.durationMinutes ? (
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                            {s.durationMinutes} min
                          </span>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-slate-100 bg-white">
                        <div className="p-4">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                            <CalendarDays size={13} /> Date
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {s.date || "Not specified"}
                          </p>
                        </div>
                        <div className="p-4">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                            <Clock3 size={13} /> Time
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {s.time || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {s.language && (
                        <div className="flex flex-wrap gap-2 border-t border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                            <Languages size={13} /> {s.language}
                          </span>
                        </div>
                      )}
                    </div>

                    {s.reason ? (
                      <Block
                        title="Your message"
                        icon={<MessageSquare size={15} />}
                      >
                        <blockquote className="whitespace-pre-line rounded-2xl border-l-4 border-blue-500 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                          {s.reason}
                        </blockquote>
                      </Block>
                    ) : (
                      <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-400">
                        No message was added with this booking.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- full-size photo viewer (big image loads only now) ---------- */}
      {zoom && p.image && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setZoom(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom(false);
            }}
            aria-label="Close photo"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:bg-slate-100"
          >
            <X size={20} />
          </button>
          <img
            src={hd(p.image, 1200)}
            alt={p.name}
            decoding="async"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>,
    document.body,
  );
};

/*
  memo: the parent pages (MyBookings / MentorSessions) re-render every second
  because of their live clock. `fetcher` is an inline arrow there (new function
  each render), but we read it through a ref, so it is safe to ignore it.
  The modal now only re-renders when title / onClose change.
*/
export default memo(
  PersonDetailsModal,
  (prev, next) => prev.title === next.title && prev.onClose === next.onClose,
);