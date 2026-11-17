import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CornerDownLeft,
  Languages,
  Loader2,
  RotateCcw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import { api } from "../../services/fresherApi";
import { socket } from "../../utils/socket";

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (s) => String(s || "").trim().toLowerCase();

/* ---- tolerant field readers (backend names may differ) ---- */
const priceOf = (m) =>
  Number(m.price ?? m.sessionPrice ?? m.fee ?? m.ratePerSession ?? 0) || 0;
const ratingOf = (m) => Number(m.rating ?? m.avgRating ?? m.averageRating ?? 0) || 0;
const reviewsOf = (m) => Number(m.reviewsCount ?? m.totalReviews ?? m.ratingCount ?? 0) || 0;
const sessionsOf = (m) =>
  Number(m.sessionsCompleted ?? m.totalSessions ?? m.sessionsCount ?? 0) || 0;
const skillsOf = (m) =>
  (Array.isArray(m.skills) ? m.skills : [])
    .map((s) => (typeof s === "string" ? s : s?.name))
    .filter(Boolean);

const Highlight = ({ text = "", query = "" }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-black">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

const Avatar = ({ m }) => {
  const [failed, setFailed] = useState(false);
  const initials =
    String(m.name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <span className="relative inline-flex shrink-0">
      {m.image && !failed ? (
        <img
          src={m.image}
          alt={m.name}
          onError={() => setFailed(true)}
          className="h-12 w-12 rounded-full object-cover ring-1 ring-neutral-200"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
          {initials}
        </span>
      )}
      {m.isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </span>
  );
};

const SkeletonRow = () => (
  <div
    className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-4"
    aria-hidden="true"
  >
    <div className="h-12 w-12 rounded-full bg-neutral-200" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded bg-neutral-200" />
      <div className="h-3 w-1/2 rounded bg-neutral-100" />
    </div>
    <div className="h-9 w-20 rounded-lg bg-neutral-100" />
  </div>
);

/**
 * Find ONE employee of ONE company.
 * Props:
 *   companyName : only this company's employees are shown
 *   onPick(m)   : employee selected ("Book")
 *   onClose()   : close / skip
 *   variant     : "modal" (popup, default) | "page" (full page)
 */
export default function FindEmployeeModal({
  companyName,
  onPick,
  onClose,
  variant = "modal",
}) {
  const isPage = variant === "page";

  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [onlyOnline, setOnlyOnline] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const qRef = useRef("");
  const reqRef = useRef(0);
  qRef.current = q.trim();

  const onlyThisCompany = useCallback(
    (arr) =>
      arr.filter((m) => {
        const c = m.companyName || m.company || m.mncName;
        return !c || norm(c) === norm(companyName);
      }),
    [companyName],
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!companyName) return;
      const id = ++reqRef.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const r = await api(
          `/mentor/company-search/${encodeURIComponent(companyName)}?q=${encodeURIComponent(qRef.current)}`,
        );
        if (id !== reqRef.current) return;
        const arr = onlyThisCompany(Array.isArray(r?.mentors) ? r.mentors : []);
        setList(arr);
        setTotal(Number(r?.total) || arr.length);
        setError("");
      } catch (e) {
        if (id !== reqRef.current) return;
        if (!silent) {
          setList([]);
          setTotal(0);
          setError(e.message || "Could not load employees");
        }
      } finally {
        if (id === reqRef.current && !silent) setLoading(false);
      }
    },
    [companyName, onlyThisCompany],
  );

  const firstLoad = useRef(true);
  useEffect(() => {
    setActiveIdx(-1);
    if (firstLoad.current) {
      firstLoad.current = false;
      load();
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  // modal only: focus + lock scroll
  useEffect(() => {
    inputRef.current?.focus();
    if (isPage) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPage]);

  // modal only: Esc closes
  useEffect(() => {
    if (isPage || !onClose) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isPage, onClose]);

  // live online dots
  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load({ silent: true }), 400);
    };
    socket.on("mentor-presence", refresh);
    if (!socket.connected) socket.connect();
    const poll = setInterval(() => load({ silent: true }), 20000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      socket.off("mentor-presence", refresh);
    };
  }, [load]);

  const shown = useMemo(
    () => (onlyOnline ? list.filter((m) => m.isOnline) : list),
    [list, onlyOnline],
  );

  useEffect(() => {
    if (activeIdx < 0) return;
    listRef.current
      ?.querySelector(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const keyword = q.trim();

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && shown.length) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length) {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (loading) return;
      const target = shown[activeIdx] || (shown.length === 1 ? shown[0] : null);
      if (target) onPick(target);
    } else if (e.key === "Escape") {
      if (q) {
        e.stopPropagation();
        setQ("");
      }
    }
  };

  const refreshing = loading && list.length > 0;
  const hiddenCount = Math.max(0, total - list.length);

  const card = (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-white ring-1 ring-black/10 ${
        isPage
          ? "mx-auto min-h-[70vh] max-w-5xl rounded-2xl shadow-sm"
          : "h-[min(680px,90vh)] max-w-3xl rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]"
      }`}
    >
      <style>{`@keyframes fe-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>

      {/* header */}
      <div className="flex items-center justify-between px-6 pb-3 pt-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-black">
            Find a {companyName} employee
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Compare price, rating and skills, then book.
          </p>
        </div>
        {(!isPage || onClose) && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* search + online filter */}
      <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center">
        <label
          htmlFor="employee-search"
          className="flex flex-1 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 transition focus-within:border-black focus-within:ring-4 focus-within:ring-black/10"
        >
          {loading ? (
            <Loader2 size={18} className="shrink-0 animate-spin text-black" />
          ) : (
            <Search size={18} className="shrink-0 text-neutral-400" />
          )}
          <input
            id="employee-search"
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search by name or ID (e.g. ARUN#4356356)"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-black outline-none placeholder:text-neutral-400"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
            >
              <X size={15} />
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => setOnlyOnline((v) => !v)}
          aria-pressed={onlyOnline}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
            onlyOnline
              ? "border-black bg-black text-white"
              : "border-neutral-300 bg-white text-black hover:border-black"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Online only
        </button>
      </div>

      {/* count + progress */}
      <div className="relative mt-4 px-6">
        <div className="pb-2">
          <p
            className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
            aria-live="polite"
          >
            {loading
              ? "Searching…"
              : keyword
                ? `${total} ${total === 1 ? "result" : "results"} for “${keyword}”`
                : `${total} ${total === 1 ? "employee" : "employees"} at ${companyName}`}
          </p>
        </div>
        <div className="relative h-px w-full overflow-hidden bg-neutral-200">
          {loading && (
            <span
              className="absolute inset-y-0 left-0 w-1/3 bg-black"
              style={{ animation: "fe-slide 1s ease-in-out infinite" }}
            />
          )}
        </div>
      </div>

      {/* results */}
      <div
        ref={listRef}
        className={`flex-1 px-3 py-2 transition-opacity duration-150 sm:px-4 [scrollbar-width:thin] ${
          isPage ? "" : "overflow-y-auto"
        } ${refreshing ? "opacity-40" : "opacity-100"}`}
      >
        {loading && list.length === 0 ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mx-2 mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-sm font-semibold text-black">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <RotateCcw size={14} /> Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="mx-2 mt-2 rounded-xl border border-dashed border-neutral-300 px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Search size={22} />
            </div>
            <h3 className="mt-3 text-base font-semibold text-black">
              {onlyOnline && list.length > 0
                ? "No one is online right now"
                : `No ${companyName} employee found`}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {onlyOnline && list.length > 0
                ? "Turn off “Online only” to see everyone."
                : "Check the spelling, or search by the exact ID like ARUN#4356356."}
            </p>
          </div>
        ) : (
          <>
            <ul
              className={`gap-2 ${isPage ? "grid grid-cols-1 lg:grid-cols-2" : "space-y-1"}`}
            >
              {shown.map((m, i) => {
                const role = [m.designation, m.department]
                  .filter(Boolean)
                  .join(" · ");
                const active = i === activeIdx;
                const price = priceOf(m);
                const rating = ratingOf(m);
                const reviews = reviewsOf(m);
                const sessions = sessionsOf(m);
                const skills = skillsOf(m);

                return (
                  <li key={m.id}>
                    <div
                      data-idx={i}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex h-full flex-col gap-3 rounded-xl border px-4 py-4 transition ${
                        active
                          ? "border-neutral-300 bg-neutral-50"
                          : "border-transparent hover:bg-neutral-50"
                      } ${isPage ? "border-neutral-200" : ""}`}
                    >
                      <div className="flex items-start gap-3.5">
                        <Avatar m={m} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span className="truncate text-[15px] font-semibold text-black">
                              <Highlight text={m.name} query={keyword} />
                            </span>
                            {m.isOnline && (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Online
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-neutral-500">
                            {role || "Employee"}
                          </p>
                          {m.code && (
                            <span className="mt-1 inline-block rounded-md border border-neutral-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-700">
                              <Highlight text={m.code} query={keyword} />
                            </span>
                          )}
                        </div>

                        {price > 0 && (
                          <div className="shrink-0 text-right">
                            <p className="text-base font-bold text-black">
                              ₹{price.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] text-neutral-500">per session</p>
                          </div>
                        )}
                      </div>

                      {/* stats */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-neutral-600">
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5">
                          <Star
                            size={11}
                            className={
                              rating > 0
                                ? "fill-amber-400 text-amber-400"
                                : "text-neutral-400"
                            }
                          />
                          {rating > 0
                            ? `${rating.toFixed(1)}${reviews ? ` (${reviews})` : ""}`
                            : "New"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5">
                          <Users size={11} />
                          {sessions} {sessions === 1 ? "session" : "sessions"}
                        </span>
                        {m.yearsOfExperience > 0 && (
                          <span className="rounded-md bg-neutral-100 px-2 py-0.5">
                            {m.yearsOfExperience}{" "}
                            {m.yearsOfExperience === 1 ? "yr" : "yrs"} exp
                          </span>
                        )}
                        {m.languages?.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5">
                            <Languages size={11} />
                            {m.languages.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>

                      {/* skills */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {skills.slice(0, 5).map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] text-neutral-700"
                            >
                              {s}
                            </span>
                          ))}
                          {skills.length > 5 && (
                            <span className="px-1 text-[11px] text-neutral-500">
                              +{skills.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onPick(m)}
                        className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          active
                            ? "bg-black text-white"
                            : "border border-neutral-300 bg-white text-black hover:border-black hover:bg-black hover:text-white"
                        }`}
                      >
                        Book
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hiddenCount > 0 && (
              <div className="mx-2 my-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-center">
                <p className="text-sm font-semibold text-black">
                  Showing {list.length} of {total}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Type a name or ID in the search box to find the other{" "}
                  {hiddenCount} {hiddenCount === 1 ? "employee" : "employees"}.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-3">
        <div className="hidden items-center gap-4 text-xs text-neutral-500 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-sans text-[11px] text-neutral-600">
              ↑↓
            </kbd>
            Move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex items-center rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-neutral-600">
              <CornerDownLeft size={11} />
            </kbd>
            Book
          </span>
          {!isPage && (
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-sans text-[11px] text-neutral-600">
                Esc
              </kbd>
              Close
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-black transition hover:border-black hover:bg-black hover:text-white"
          >
            Skip, match me with any {companyName} employee
          </button>
        )}
      </div>
    </div>
  );

  if (isPage) {
    return <div className="w-full px-3 py-6 sm:px-6">{card}</div>;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Find a ${companyName} employee`}
    >
      {card}
    </div>,
    document.body,
  );
}