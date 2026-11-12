import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CornerDownLeft,
  Languages,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { api } from "../../services/fresherApi";
import { socket } from "../../utils/socket";

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (s) => String(s || "").trim().toLowerCase();

/* highlight the part that matches what was typed */
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
          className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200"
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
          {initials}
        </span>
      )}
      {m.isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </span>
  );
};

const SkeletonRow = () => (
  <div
    className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-3"
    aria-hidden="true"
  >
    <div className="h-10 w-10 rounded-full bg-neutral-200" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded bg-neutral-200" />
      <div className="h-3 w-1/2 rounded bg-neutral-100" />
    </div>
    <div className="h-8 w-20 rounded-lg bg-neutral-100" />
  </div>
);

/**
 * Popup to find ONE employee of ONE company (name / mentor ID like ARUN#4356356).
 * Shows only a few employees + the total count. The rest are found by searching.
 * Props:
 *   companyName : only this company's employees are shown
 *   onPick(m)   : called when an employee is selected
 *   onClose()   : close the popup
 */
export default function FindEmployeeModal({ companyName, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const qRef = useRef("");
  const reqRef = useRef(0); // ignore answers of old requests
  qRef.current = q.trim();

  // SAFETY: even if the server sends someone from another company, hide them.
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

  // autosearch: first load instant, typing debounced.
  // "Searching" state starts IMMEDIATELY when the person types.
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

  // focus input + lock background scroll
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc closes the popup from anywhere
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // keep the green "online" dots live
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

  // keep the arrow-key selection visible
  useEffect(() => {
    if (activeIdx < 0) return;
    listRef.current
      ?.querySelector(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const keyword = q.trim();

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && list.length) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % list.length);
    } else if (e.key === "ArrowUp" && list.length) {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (loading) return;
      const target = list[activeIdx] || (list.length === 1 ? list[0] : null);
      if (target) onPick(target);
    } else if (e.key === "Escape") {
      if (q) {
        e.stopPropagation();
        setQ("");
      }
    }
  };

  const refreshing = loading && list.length > 0; // old list stays, dimmed
  const hiddenCount = Math.max(0, total - list.length);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Find a ${companyName} employee`}
    >
      <style>{`@keyframes fe-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>

      <div className="relative flex h-[min(680px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10">
        {/* ---------- header ---------- */}
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-black">
              Find a {companyName} employee
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Search by name or employee ID, then select to book.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        {/* ---------- search ---------- */}
        <div className="px-6">
          <label
            htmlFor="employee-search"
            className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 transition focus-within:border-black focus-within:ring-4 focus-within:ring-black/10"
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
            {loading && (
              <span className="hidden shrink-0 text-xs font-medium text-neutral-500 sm:inline">
                Searching…
              </span>
            )}
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
        </div>

        {/* ---------- count + progress line ---------- */}
        <div className="relative mt-4 px-6">
          <div className="flex items-center justify-between pb-2">
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

        {/* ---------- results (only this part scrolls) ---------- */}
        <div
          ref={listRef}
          className={`flex-1 overflow-y-auto px-3 py-2 transition-opacity duration-150 sm:px-4 [scrollbar-width:thin] ${
            refreshing ? "opacity-40" : "opacity-100"
          }`}
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
          ) : list.length === 0 ? (
            <div className="mx-2 mt-2 rounded-xl border border-dashed border-neutral-300 px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                <Search size={22} />
              </div>
              <h3 className="mt-3 text-base font-semibold text-black">
                No {companyName} employee found
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Check the spelling, or search by the exact ID like
                ARUN#4356356.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-0.5">
                {list.map((m, i) => {
                  const role = [m.designation, m.department]
                    .filter(Boolean)
                    .join(" · ");
                  const active = i === activeIdx;

                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        data-idx={i}
                        onClick={() => onPick(m)}
                        onMouseEnter={() => setActiveIdx(i)}
                        className={`group flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition ${
                          active ? "bg-neutral-100" : "hover:bg-neutral-50"
                        }`}
                      >
                        <Avatar m={m} />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold text-black">
                              <Highlight text={m.name} query={keyword} />
                            </span>
                            {m.isOnline && (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Online
                              </span>
                            )}
                          </span>

                          <span className="mt-0.5 block truncate text-sm text-neutral-500">
                            {role || "Employee"}
                          </span>

                          {/* mentor ID: visible on every screen size */}
                          {m.code && (
                            <span className="mt-1 inline-block rounded-md border border-neutral-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-700">
                              <Highlight text={m.code} query={keyword} />
                            </span>
                          )}
                        </span>

                        {/* right side meta (big screens) */}
                        <span className="hidden shrink-0 items-center gap-2 md:flex">
                          {m.yearsOfExperience > 0 && (
                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                              {m.yearsOfExperience}{" "}
                              {m.yearsOfExperience === 1 ? "yr" : "yrs"}
                            </span>
                          )}
                          {m.languages?.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                              <Languages size={11} />
                              {m.languages.slice(0, 2).join(", ")}
                            </span>
                          )}
                        </span>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                            active
                              ? "bg-black text-white"
                              : "border border-neutral-300 bg-white text-black group-hover:border-black group-hover:bg-black group-hover:text-white"
                          }`}
                        >
                          Select
                          <ArrowRight size={14} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* the rest are found by searching */}
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

        {/* ---------- footer ---------- */}
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
              Select
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-sans text-[11px] text-neutral-600">
                Esc
              </kbd>
              Close
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-black transition hover:border-black hover:bg-black hover:text-white"
          >
            Skip, match me with any {companyName} employee
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}