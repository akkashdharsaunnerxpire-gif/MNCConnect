// src/Commoncomponents/PersonDetailsModal.jsx
// Shows the OTHER person of a booking.
//  - fresher page  -> mentor (MncEmployee) details   (single profile + RATING & REVIEWS)
//  - mentor page   -> fresher details                (two-pane candidate card)
// The data comes from GET <booking>/counterpart (see bookingController.getCounterpart)
// Props are unchanged: { title, fetcher, onClose }
//
// SECURITY: this modal NEVER shows email / phone / LinkedIn of the other person.
// Contact details are stripped here (scrub) even if the backend sends them by mistake.
// Reason: contact sharing lets people book outside the platform (commission bypass).
//
// Mentor reviews are read from:  data.person.reviews  (or data.reviews)
//   review = { id, name, role, rating, comment, session, reply, createdAt }
// Rating / count are read from:  person.rating, person.reviewCount
// (if missing, they are calculated from the reviews array)
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Building2,
  Briefcase,
  MapPin,
  Languages,
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
  Video,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Users,
  FileText,
  ZoomIn,
  CheckCircle2,
} from "lucide-react";
import { timeAgo } from "../services/mentorApi";

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
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`);
  }
  // Google profile photos (=s96-c  ->  =sN-c)
  if (/googleusercontent\.com/.test(url)) {
    return url.replace(/=s\d+(-c)?$/, `=s${width}-c`);
  }
  return url;
};

/* Contact details are never shown. Even if the backend sends them, drop them here. */
const CONTACT_KEYS = [
  "email",
  "phone",
  "mobile",
  "phoneNumber",
  "whatsapp",
  "whatsappNumber",
  "mobileNumber",
  "contactNumber",
  "contact",
  "linkedinProfile",
  "linkedin",
  "linkedinUrl",
];

const scrub = (p) => {
  const o = { ...(p || {}) };
  CONTACT_KEYS.forEach((k) => delete o[k]);
  return o;
};

/* ---------------------------- small parts ---------------------------- */

const Skeleton = () => (
  <div className="animate-pulse">
    <div className="h-28 bg-slate-100" />
    <div className="px-6 pb-6">
      <div className="-mt-12 h-24 w-24 rounded-full border-4 border-white bg-slate-200" />
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

const InfoRow = ({ icon, label, children, className = "" }) => {
  if (!children) return null;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 ${className}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-blue-600">
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

/* Row of 5 stars (filled up to `value`) */
const Stars = ({ value = 0, size = 14 }) => {
  const filled = Math.round(Number(value) || 0);
  return (
    <div className="flex gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= filled ? "currentColor" : "none"}
          className={n <= filled ? "text-yellow-400" : "text-slate-200"}
        />
      ))}
    </div>
  );
};

/* One review card */
const ReviewCard = ({ r }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 ring-1 ring-blue-100">
          {initials(r.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {r.name}
          </p>
          {r.role && (
            <p className="truncate text-[11px] text-slate-400">{r.role}</p>
          )}
        </div>
      </div>
      {r.createdAt && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
          <Clock3 size={11} />
          {timeAgo(r.createdAt)}
        </span>
      )}
    </div>

    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <Stars value={r.rating} />
      {r.session && (
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          {r.session}
        </span>
      )}
    </div>

    {r.comment && (
      <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-slate-600">
        “{r.comment}”
      </p>
    )}

    {r.reply && (
      <div className="mt-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 size={12} /> Mentor reply
        </p>
        <p className="mt-0.5 text-sm leading-6 text-slate-600">{r.reply}</p>
      </div>
    )}
  </div>
);

/* Avatar: small optimized image, falls back to initials if the image fails */
const Avatar = memo(({ src, name, onZoom, big }) => {
  const [failed, setFailed] = useState(false);
  const dim = big ? "h-32 w-32" : "h-24 w-24";

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
  const [zoom, setZoom] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

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
        // SECURITY: contact details are removed before anything is rendered
        setState({
          loading: false,
          error: "",
          data: {
            ...d,
            person: scrub(d.person),
            people: Array.isArray(d.people) ? d.people.map(scrub) : [],
          },
        });
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
  const image = pick(p, ["image", "profilePic", "avatar", "photo"]);
  const company = pick(p, ["company", "currentCompany"]);
  const location = isMentor
    ? pick(p, ["officeLocation", "location"])
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
  const resume = fullUrl(pick(p, ["resume", "resumeUrl", "resumeLink"]));
  const skills = toList(p.skills);
  const languages = toList(p.languages);

  const experience = p.yearsOfExperience
    ? `${p.yearsOfExperience} year${p.yearsOfExperience > 1 ? "s" : ""}`
    : "";

  /* ---- mentor rating + reviews ---- */
  const rawReviews = Array.isArray(p.reviews)
    ? p.reviews
    : Array.isArray(data?.reviews)
      ? data.reviews
      : [];

  // normalise (supports both `comment` and `review`, `name` and `fresherName`)
  const reviews = rawReviews.map((r, i) => ({
    id: r._id || r.id || i,
    name: r.name || r.fresherName || "Fresher",
    role: r.role || r.fresherRole || "",
    rating: Number(r.rating) || 0,
    comment: r.comment || r.review || "",
    session: r.session || "",
    reply: r.reply?.text || (typeof r.reply === "string" ? r.reply : ""),
    createdAt: r.createdAt,
  }));

  const reviewCount =
    Number(p.reviewCount ?? data?.reviewCount) || reviews.length;
  const avgRating =
    Number(p.rating ?? data?.rating) ||
    (reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0);

  // 5..1 star breakdown (from the reviews we have)
  const breakdown = [5, 4, 3, 2, 1].map((n) => ({
    n,
    c: p.ratingBreakdown
      ? Number(p.ratingBreakdown[n]) || 0
      : reviews.filter((r) => r.rating === n).length,
  }));
  const REVIEWS_PREVIEW = 3;
  const visibleReviews = showAllReviews
    ? reviews
    : reviews.slice(0, REVIEWS_PREVIEW);

  const roleLine = isMentor
    ? [p.designation, company].filter(Boolean).join(" at ")
    : [degree, college].filter(Boolean).join(" · ") ||
      (s.role ? `Fresher · Looking for ${s.role}` : "Fresher");

  const hasEducation = !!(college || degree || branch || gradYear || cgpa);
  const hasLinks = !!resume;
  const fresherHasExtras =
    hasEducation ||
    !!(
      location ||
      targetRole ||
      bio ||
      skills.length ||
      languages.length ||
      hasLinks
    );

  const wide = !loading && !error && !!data && !isMentor;

  /* =====================================================================
     FRESHER VIEW (what the mentor sees): two-pane "candidate card"
       left  = identity + actions + quick info   (light grey panel)
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
      { icon: <MapPin size={15} />, text: location },
      { icon: <UserRound size={15} />, text: cap(p.gender) },
    ].filter((x) => x.text);

    return (
      <div className="flex flex-col md:h-[min(640px,78vh)] md:flex-row">
        {/* ---------- left: identity ---------- */}
        <aside className="pdm-scroll relative border-b border-slate-200 bg-slate-50 p-6 text-slate-800 md:w-72 md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-b-0 md:border-r">
          <div className="relative flex flex-col items-center text-center">
            <Avatar big src={image} name={p.name} onZoom={openZoom} />

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
                <InfoRow
                  icon={<CalendarDays size={16} />}
                  label="Graduation year"
                >
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

  /* =====================================================================
     MENTOR VIEW (what the fresher sees): ONE profile page with
     rating + reviews included. No tabs, no booking section, NO contact info.
     ===================================================================== */
  const renderMentor = () => (
    <>
      {/* ---------- slim light banner ---------- */}
      <div className="relative z-0 h-24 border-b border-slate-200 bg-gradient-to-br from-slate-100 via-blue-50 to-white">
        <p className="absolute left-5 top-4 text-xs font-semibold text-slate-500">
          {title}
        </p>
      </div>

      <div className="relative z-10 px-5 pb-6 sm:px-6">
        {/* avatar half overlaps the banner */}
        <div className="-mt-12 flex items-end justify-between gap-3">
          <Avatar src={image} name={p.name} onZoom={openZoom} />
        </div>

        {/* name + role */}
        <div className="mt-3 min-w-0">
          <h3 className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
            <span className="truncate">{p.name || "-"}</span>
            {p.isVerified && (
              <BadgeCheck
                size={19}
                className="shrink-0 text-blue-600"
                aria-label="Verified"
              />
            )}
          </h3>
          {roleLine && (
            <p className="mt-0.5 text-sm text-slate-500">{roleLine}</p>
          )}
        </div>

        {/* numbers */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat
            icon={<Star size={15} />}
            value={avgRating.toFixed(1)}
            label={`Rating · ${reviewCount} review${reviewCount !== 1 ? "s" : ""}`}
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

        {bio && (
          <Block title="Bio">
            <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {bio}
            </p>
          </Block>
        )}

        <Block title="Details">
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow icon={<Building2 size={16} />} label="Company">
              {company}
            </InfoRow>
            <InfoRow icon={<Briefcase size={16} />} label="Role">
              {[p.designation, p.department]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(" · ")}
            </InfoRow>
            <InfoRow icon={<MapPin size={16} />} label="Office location">
              {location}
            </InfoRow>
            <InfoRow icon={<UserRound size={16} />} label="Gender">
              {cap(p.gender)}
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

        {/* ---------- RATING & REVIEWS ---------- */}
        <Block title="Ratings & reviews" icon={<Star size={15} />}>
          {reviews.length === 0 && reviewCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No reviews yet
            </p>
          ) : (
            <>
              {/* summary: big average + 5..1 breakdown */}
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 flex-col items-center sm:w-32">
                  <span className="text-4xl font-bold text-slate-900">
                    {avgRating.toFixed(1)}
                  </span>
                  <div className="mt-1.5">
                    <Stars value={avgRating} size={16} />
                  </div>
                  <span className="mt-1.5 text-xs text-slate-500">
                    {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {reviews.length > 0 && (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {breakdown.map(({ n, c }) => {
                      const pct = reviewCount ? (c / reviewCount) * 100 : 0;
                      return (
                        <div key={n} className="flex items-center gap-2.5">
                          <span className="flex w-8 items-center gap-1 text-xs font-medium text-slate-600">
                            {n}
                            <Star
                              size={11}
                              fill="currentColor"
                              className="text-yellow-400"
                            />
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-200">
                            <div
                              className="h-full rounded-full bg-yellow-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-5 text-right text-xs text-slate-400">
                            {c}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* review list */}
              {reviews.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {visibleReviews.map((r) => (
                    <ReviewCard key={r.id} r={r} />
                  ))}

                  {reviews.length > REVIEWS_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setShowAllReviews((v) => !v)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      {showAllReviews
                        ? "Show fewer reviews"
                        : `Show all ${reviews.length} reviews`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </Block>
      </div>
    </>
  );

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
          wide ? "max-w-4xl" : "max-w-xl"
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
          {!loading && data && isMentor && renderMentor()}
        </div>
      </div>

      {/* ---------- full-size photo viewer (big image loads only now) ---------- */}
      {zoom && image && (
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
            src={hd(image, 1200)}
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