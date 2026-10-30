import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  Search,
  Users,
  Star,
  ShieldCheck,
  Building2,
  BriefcaseBusiness,
  Award,
  BarChart3,
  BadgeCheck,
  ArrowRight,
  X,
  LayoutGrid,
  List,
  RotateCcw,
} from "lucide-react";

import { socket } from "../../utils/socket";

// Company logo / cover now come from the backend (admin uploads) — no local catalog.
import {
  API_URL,
  normalizeCompanyName,
  gradientFor,
  fetchCompanyProfiles,
} from "../../utils/companyProfiles";

const categories = [
  "All Companies",
  "Technology",
  "IT Services",
  "Finance",
  "Consulting",
  "Product",
  "Design",
  "Marketing",
  "Healthcare",
  "Pharma",
  "E-commerce",
  "Retail",
  "Manufacturing",
  "Automotive",
  "Telecom",
  "Education",
  "Media",
  "Energy",
  "Logistics",
  "Real Estate",
  "Other",
];

const SORT_OPTIONS = ["Popular", "Rating", "Employees", "Online now"];

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

// ============================================================
// HELPERS
// ============================================================

const initialsOf = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const mentorPhoto = (m = {}) =>
  m.profilePic || m.image || m.avatar || m.profileImage || "";

const hashIndex = (text = "", mod = AVATAR_COLORS.length) => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % mod;
};

// Categories that have their own chip. Anything else (custom text typed by
// the admin, e.g. "Aerospace") is shown under the "Other" chip.
const KNOWN_CATEGORIES = categories
  .filter((c) => c !== "All Companies" && c !== "Other")
  .map((c) => c.toLowerCase());

const matchesCategory = (company, category) => {
  if (category === "All Companies") return true;

  if (category === "Other") {
    const cat = (company.category || "").toLowerCase().trim();
    return cat === "other" || !KNOWN_CATEGORIES.includes(cat);
  }

  const key = category.toLowerCase();

  return (
    (company.industry || "").toLowerCase().includes(key) ||
    (company.category || "").toLowerCase().includes(key)
  );
};

// ============================================================
// GROUP EMPLOYEES BY COMPANY
// ============================================================

const groupMentorsByCompany = (mentors, profiles = {}) => {
  const grouped = new Map();

  mentors.forEach((mentor) => {
    const registeredName = String(
      mentor.companyName || mentor.currentCompany || ""
    ).trim();

    if (!registeredName) return;

    const key = normalizeCompanyName(registeredName);
    const profile = profiles[key];

    // If an admin profile exists, use its current name as the group identity.
    const groupKey = profile ? normalizeCompanyName(profile.name) : key;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        companyName: profile?.name || registeredName,
        profile,
        mentors: [],
        registeredNames: new Set(),
      });
    }

    const group = grouped.get(groupKey);

    group.mentors.push(mentor);
    group.registeredNames.add(registeredName);
  });

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    registeredNames: Array.from(group.registeredNames),
  }));
};

// ============================================================
// BUILD COMPANY DATA
// profiles = { [normalizedName]: { logo, coverImage, industry, category } }
// ============================================================

const buildCompanyData = (apiData, profiles = {}) => {
  if (!Array.isArray(apiData)) return [];

  const profileOf = (companyName) =>
    profiles[normalizeCompanyName(companyName)];

  const looksLikeCompanyData =
    apiData.length > 0 &&
    apiData.some(
      (item) =>
        item.mentorCount !== undefined ||
        item.onlineCount !== undefined ||
        item.averageRating !== undefined
    );

  if (looksLikeCompanyData) {
    return apiData.map((company) => {
      const registeredName = company.companyName || company.name || "";

      const profile = profileOf(registeredName);

      return {
        ...company,
        // Admin-edited name takes priority.
        companyName: profile?.name || registeredName,
        logo: profile?.logo || null,
        companyImage: profile?.coverImage || null,
        mentors: company.mentors || [],
        mentorCount: company.mentorCount || company.mentors?.length || 0,
        onlineCount: company.onlineCount || 0,
        averageRating: company.averageRating || 0,
        ratingCount: company.ratingCount ?? null,
        industry: profile?.industry || company.industry || "Technology",
        category: profile?.category || company.category || "Technology",
      };
    });
  }

  return groupMentorsByCompany(apiData, profiles).map((company) => {
    const profile = company.profile;
    const onlineMentors = company.mentors.filter(
      (mentor) =>
        mentor.isOnline === true ||
        mentor.online === true ||
        mentor.status === "online"
    );

    const ratings = company.mentors
      .map(
        (mentor) => Number(mentor.averageRating) || Number(mentor.rating) || 0
      )
      .filter((rating) => rating > 0);

    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0;

    return {
      companyName: profile?.name || company.companyName,
      registeredNames: company.registeredNames,
      logo: profile?.logo || null,
      companyImage: profile?.coverImage || null,
      mentors: company.mentors,
      mentorCount: company.mentors.length,
      onlineCount: onlineMentors.length,
      averageRating,
      ratingCount: ratings.length || null,
      industry: profile?.industry || "Technology",
      category: profile?.category || "Technology",
    };
  });
};

// ============================================================
// MERGE COMPANIES
// Two registered spellings (e.g. INFOYSIS + CapeStart) can point to the
// same admin profile. Merge them into ONE card instead of dropping one.
// ============================================================

const mergeCompanies = (list = []) => {
  const merged = new Map();

  list.forEach((company) => {
    const key = normalizeCompanyName(company.companyName);
    if (!key) return;

    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...company, mentors: [...(company.mentors || [])] });
      return;
    }

    // employees: add only the ones we haven't seen yet
    const seenIds = new Set(
      existing.mentors.map((m) => String(m._id || m.id || ""))
    );

    (company.mentors || []).forEach((m) => {
      const id = String(m._id || m.id || "");
      if (!id || !seenIds.has(id)) {
        existing.mentors.push(m);
        if (id) seenIds.add(id);
      }
    });

    // weighted average rating
    const prevRated = existing.ratingCount || 0;
    const nextRated = company.ratingCount || 0;
    const totalRated = prevRated + nextRated;

    existing.averageRating = totalRated
      ? ((existing.averageRating || 0) * prevRated +
          (company.averageRating || 0) * nextRated) /
        totalRated
      : Math.max(existing.averageRating || 0, company.averageRating || 0);

    existing.ratingCount = totalRated || null;
    existing.onlineCount =
      (existing.onlineCount || 0) + (company.onlineCount || 0);

    existing.registeredNames = Array.from(
      new Set([
        ...(existing.registeredNames || []),
        ...(company.registeredNames || []),
      ])
    );

    // keep a logo / cover if the first entry didn't have one
    existing.logo = existing.logo || company.logo || null;
    existing.companyImage = existing.companyImage || company.companyImage || null;

    existing.mentorCount =
      existing.mentors.length ||
      (existing.mentorCount || 0) + (company.mentorCount || 0);
  });

  return Array.from(merged.values());
};

// "View" ALWAYS booking page-ku mattum. Meeting room-ku direct link kidayadhu.
// Already book pannina company-um thirumba book panna idhu thaan vazhi.
const sessionLink = (company) =>
  `/Home/sessionboard/${encodeURIComponent(company.companyName || "")}`;

// ============================================================
// MAIN COMPONENT
// ============================================================

const BrowseMentors = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Companies");
  const [sort, setSort] = useState("Popular");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [view, setView] = useState("grid");

  const searchRef = useRef(null);

  // ---------------- fetch ----------------
  // silent = background refresh (no skeleton flash, no error screen)

  const fetchCompanies = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      // company list + admin-uploaded logo/cover, fetched together
      const [response, profiles] = await Promise.all([
        fetch(`${API_URL}/mentor/companies`),
        fetchCompanyProfiles(),
      ]);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load companies");
      }

      const finalCompanies = buildCompanyData(data.companies || [], profiles);

      // Merge spellings that belong to the same company profile
      setCompanies(mergeCompanies(finalCompanies));
      setError("");
    } catch (err) {
      console.error("Company fetch error:", err);
      if (!silent) setError(err.message || "Something went wrong");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // initial load + live presence updates
  useEffect(() => {
    fetchCompanies();

    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchCompanies({ silent: true }), 400);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    socket.on("mentor-presence", refresh); // server emits when a mentor goes on/offline
    socket.on("connect", refresh); // re-sync after reconnect
    document.addEventListener("visibilitychange", onVisible);

    if (!socket.connected) socket.connect();

    // safety net: even if an event is missed, it self-heals within 15s
    const poll = setInterval(() => fetchCompanies({ silent: true }), 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      socket.off("mentor-presence", refresh);
      socket.off("connect", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      // don't disconnect: the socket is shared across pages
    };
  }, [fetchCompanies]);

  // press "/" anywhere to jump into the search box
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;

      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      e.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---------------- derived data ----------------

  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((c) => [
          c,
          companies.filter((co) => matchesCategory(co, c)).length,
        ])
      ),
    [companies]
  );

  const totals = useMemo(() => {
    const rated = companies.filter((c) => Number(c.averageRating) > 0);

    return {
      companies: companies.length,
      employees: companies.reduce((sum, c) => sum + (c.mentorCount || 0), 0),
      online: companies.reduce((sum, c) => sum + (c.onlineCount || 0), 0),
      avgRating: rated.length
        ? rated.reduce((sum, c) => sum + Number(c.averageRating), 0) /
          rated.length
        : 0,
    };
  }, [companies]);

  // only companies that already have an admin-uploaded logo go in the strip
  const logoCompanies = useMemo(
    () => companies.filter((c) => c.logo),
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    const data = companies.filter((company) => {
      if (!matchesCategory(company, activeCategory)) return false;
      if (onlineOnly && !(company.onlineCount > 0)) return false;

      if (keyword) {
        const haystack = [company.companyName, company.industry, company.category]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      return true;
    });

    const byEmployees = (a, b) => (b.mentorCount || 0) - (a.mentorCount || 0);
    const byOnline = (a, b) => (b.onlineCount || 0) - (a.onlineCount || 0);

    if (sort === "Rating")
      data.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    else if (sort === "Employees") data.sort(byEmployees);
    else if (sort === "Online now")
      data.sort((a, b) => byOnline(a, b) || byEmployees(a, b));
    else data.sort((a, b) => byEmployees(a, b) || byOnline(a, b)); // Popular

    return data;
  }, [companies, search, activeCategory, sort, onlineOnly]);

  const clearAll = () => {
    setSearch("");
    setActiveCategory("All Companies");
    setSort("Popular");
    setOnlineOnly(false);
  };

  const activeFilters = [];
  if (search.trim())
    activeFilters.push({
      key: "search",
      label: `“${search.trim()}”`,
      clear: () => setSearch(""),
    });
  if (activeCategory !== "All Companies")
    activeFilters.push({
      key: "cat",
      label: activeCategory,
      clear: () => setActiveCategory("All Companies"),
    });
  if (onlineOnly)
    activeFilters.push({
      key: "online",
      label: "Online now",
      clear: () => setOnlineOnly(false),
    });
  if (sort !== "Popular")
    activeFilters.push({
      key: "sort",
      label: `Sort: ${sort}`,
      clear: () => setSort("Popular"),
    });

  const dash = loading || error ? "–" : null;

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{`
        @keyframes mc-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .mc-rise { animation: mc-rise .5s cubic-bezier(.2,.7,.2,1) both; }
        .mc-no-scrollbar { scrollbar-width: none; }
        .mc-no-scrollbar::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .mc-rise { animation: none; } }
      `}</style>

      {/* ======================================================
          HERO
      ====================================================== */}
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-50/70 via-white to-white" />
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" />
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-5 pb-12 pt-14 text-center sm:px-8 sm:pt-16">
          <span className="mc-rise inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-violet-700 shadow-sm">
            <BadgeCheck size={14} /> Learn from the best
          </span>

          <h1
            className="mc-rise mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            Browse{" "}
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              MNC Employees
            </span>
          </h1>

          <p
            className="mc-rise mx-auto mt-4 max-w-xl text-base text-slate-500 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Book 1:1 sessions with verified professionals from the world's leading companies.
          </p>

          {/* search */}
          <div
            className="mc-rise mx-auto mt-8 max-w-2xl"
            style={{ animationDelay: "180ms" }}
          >
            <label
              htmlFor="company-search"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-lg shadow-slate-200/60 transition focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-100"
            >
              <Search size={20} className="shrink-0 text-slate-400" />
              <input
                id="company-search"
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or industry…"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 sm:block">
                  /
                </kbd>
              )}
            </label>
          </div>

          {/* live stats */}
          <div
            className="mc-rise mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4"
            style={{ animationDelay: "240ms" }}
          >
            <StatPill
              icon={<BriefcaseBusiness size={18} />}
              value={dash ?? totals.companies}
              label="Companies"
            />
            <StatPill
              icon={<Users size={18} />}
              value={dash ?? totals.employees}
              label="MNC employees"
            />
            <StatPill
              icon={
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              }
              value={dash ?? totals.online}
              label="Online now"
            />
            <StatPill
              icon={<Star size={18} />}
              value={dash ?? (totals.avgRating ? totals.avgRating.toFixed(1) : "–")}
              label="Avg. rating"
            />
          </div>
        </div>
      </section>

      {/* ======================================================
          TRUSTED LOGOS (only companies that have a logo)
      ====================================================== */}
      {logoCompanies.length > 0 && (
        <section className="border-b border-slate-100 bg-slate-50/50">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 overflow-x-auto px-5 py-4 mc-no-scrollbar sm:px-8">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Employees from
            </span>
            <div className="flex items-center gap-5">
              {logoCompanies.slice(0, 10).map((company) => (
                <div
                  key={company.companyName}
                  title={company.companyName}
                  className="flex h-8 w-8 shrink-0 items-center justify-center opacity-60 grayscale transition duration-200 hover:scale-110 hover:opacity-100 hover:grayscale-0"
                >
                  <img
                    src={company.logo}
                    alt={company.companyName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
              {logoCompanies.length > 10 && (
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  +{logoCompanies.length - 10} more
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ======================================================
          RESULTS
      ====================================================== */}
      <main className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
        {/* category chips */}
        <div
          className="mc-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Company category"
        >
          {categories.map((item) => {
            const active = activeCategory === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(item)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95 ${
                  active
                    ? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                {item}
                {!loading && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {categoryCounts[item] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* toolbar */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500" aria-live="polite">
            {loading ? (
              "Loading companies…"
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {filteredCompanies.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900">
                  {companies.length}
                </span>{" "}
                companies
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={onlineOnly}
              onClick={() => setOnlineOnly((v) => !v)}
              className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-violet-300"
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  onlineOnly ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    onlineOnly ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
              Online now
            </button>

            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition focus-within:border-violet-400 hover:border-violet-300">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="cursor-pointer bg-transparent font-medium text-slate-800 outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
              role="group"
              aria-label="View"
            >
              {[
                { id: "grid", icon: LayoutGrid, label: "Grid view" },
                { id: "list", icon: List, label: "List view" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-label={label}
                  aria-pressed={view === id}
                  className={`rounded-lg p-1.5 transition ${
                    view === id
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* active filter chips */}
        {activeFilters.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                className="group inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
              >
                {f.label}
                <X size={12} className="opacity-60 transition group-hover:opacity-100" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* content */}
        <div className="mt-6">
          {loading ? (
            <div
              className={
                view === "grid"
                  ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "space-y-3"
              }
              aria-busy="true"
            >
              {Array.from({ length: 8 }).map((_, i) =>
                view === "grid" ? <SkeletonCard key={i} /> : <SkeletonRow key={i} />
              )}
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md rounded-3xl border border-red-100 bg-red-50/50 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500">
                <Building2 size={28} />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Something went wrong</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => fetchCompanies()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700 active:scale-95"
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="mx-auto max-w-md rounded-3xl border border-dashed border-slate-300 px-8 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Building2 size={28} />
              </div>
              <h2 className="mt-5 text-xl font-semibold">No companies found</h2>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search or remove a filter.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700 active:scale-95"
              >
                Clear filters
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCompanies.map((company, index) => (
                <CompanyCard key={company.companyName} company={company} index={index} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCompanies.map((company, index) => (
                <CompanyRow key={company.companyName} company={company} index={index} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ======================================================
          TRUST FEATURES
      ====================================================== */}
      <section className="mx-auto max-w-[1400px] px-5 pb-14 sm:px-8">
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-violet-50/60 via-white to-sky-50/60 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <Feature
            icon={<Award size={20} />}
            title="Learn from the top 1%"
            desc="Industry-leading professionals"
          />
          <Feature
            icon={<Users size={20} />}
            title="1:1 personalised sessions"
            desc="Guidance built around you"
          />
          <Feature
            icon={<BarChart3 size={20} />}
            title="Accelerate your career"
            desc="Real, practical insight"
          />
          <Feature
            icon={<ShieldCheck size={20} />}
            title="Verified MNC employees"
            desc="Background verified"
          />
        </div>
      </section>
    </div>
  );
};

// ============================================================
// SMALL PIECES
// ============================================================

const StatPill = ({ icon, value, label }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex h-5 items-center text-violet-600">{icon}</div>
    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
      {value}
    </p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

const Feature = ({ icon, title, desc }) => (
  <div className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-white">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
      {icon}
    </div>
    <div className="min-w-0">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </div>
  </div>
);

const Logo = ({ company, size = "h-14 w-14", rounded = "rounded-2xl" }) => {
  const [failed, setFailed] = useState(false);
  const name = company.companyName || "";

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden ${rounded} border border-slate-200 bg-white shadow-md`}
    >
      {company.logo && !failed ? (
        <img
          src={company.logo}
          alt={`${name} logo`}
          className="h-full w-full object-contain p-2"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-base font-bold text-violet-600">{initialsOf(name)}</span>
      )}
    </div>
  );
};

// Cover image with graceful fallback: broken/missing image => gradient + initials
const CoverImage = ({ company }) => {
  const [failed, setFailed] = useState(false);
  const name = company.companyName || "";

  if (company.companyImage && !failed) {
    return (
      <img
        src={company.companyImage}
        alt={`${name} office`}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(name)}`}
    >
      <span className="text-5xl font-bold tracking-tight text-white/70">
        {initialsOf(name)}
      </span>
    </div>
  );
};

const MiniAvatar = ({ mentor }) => {
  const [failed, setFailed] = useState(false);
  const photo = mentorPhoto(mentor);
  const name = mentor.name || mentor.fullName || "";

  return photo && !failed ? (
    <img
      src={photo}
      alt={name || "Employee"}
      onError={() => setFailed(true)}
      className="h-8 w-8 rounded-full border-2 border-white object-cover"
    />
  ) : (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold ${AVATAR_COLORS[hashIndex(name)]}`}
    >
      {initialsOf(name)}
    </span>
  );
};

// real employees only; no placeholder faces
const AvatarStack = ({ mentors = [], total = 0, max = 4 }) => {
  const shown = mentors.slice(0, max);
  const extra = Math.max(total - shown.length, 0);

  if (!shown.length && !total) {
    return <span className="text-xs text-slate-400">No employees yet</span>;
  }

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m, i) => (
        <MiniAvatar key={m._id || m.id || i} mentor={m} />
      ))}
      {extra > 0 && (
        <span className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border-2 border-white bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
          +{extra}
        </span>
      )}
    </div>
  );
};

const OnlineBadge = ({ count }) =>
  count > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      {count} online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Offline
    </span>
  );

const RatingText = ({ company }) => {
  const rating =
    Number(company.averageRating) > 0
      ? Number(company.averageRating).toFixed(1)
      : null;

  return rating ? (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      {rating}
      {company.ratingCount ? (
        <span className="font-normal text-slate-400">({company.ratingCount})</span>
      ) : null}
    </span>
  ) : (
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
      New
    </span>
  );
};

// ============================================================
// GRID CARD
// ============================================================

const CompanyCard = ({ company, index }) => {
  const name = company.companyName || "";

  return (
    <Link
      to={sessionLink(company)}
      aria-label={`Book a session with ${name}`}
      className="mc-rise group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative h-32 overflow-hidden bg-slate-100">
        <CoverImage company={company} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 to-transparent" />
        <div className="absolute right-3 top-3">
          <OnlineBadge count={company.onlineCount || 0} />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-9">
        <div className="absolute -top-7 left-5">
          <Logo company={company} />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{name}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{company.industry}</p>
          </div>
          <RatingText company={company} />
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Users size={15} className="text-slate-400" />
          <span>
            <span className="font-semibold text-slate-900">
              {company.mentorCount || 0}
            </span>{" "}
            {(company.mentorCount || 0) === 1 ? "employee" : "employees"}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <AvatarStack mentors={company.mentors} total={company.mentorCount || 0} />
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700">
            View
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </div>
      </div>
    </Link>
  );
};

// ============================================================
// LIST ROW
// ============================================================

const CompanyRow = ({ company, index }) => {
  const name = company.companyName || "";

  return (
    <Link
      to={sessionLink(company)}
      aria-label={`Book a session with ${name}`}
      className="mc-rise group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:flex-row sm:items-center"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <Logo company={company} size="h-14 w-14" rounded="rounded-xl" />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-slate-900">{name}</h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">{company.industry}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Users size={15} className="text-slate-400" />
          <span className="font-semibold text-slate-900">
            {company.mentorCount || 0}
          </span>{" "}
          employees
        </span>
        <RatingText company={company} />
        <OnlineBadge count={company.onlineCount || 0} />
        <AvatarStack
          mentors={company.mentors}
          total={company.mentorCount || 0}
          max={3}
        />
      </div>

      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 sm:ml-2">
        View
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
};

// ============================================================
// SKELETONS
// ============================================================

const SkeletonCard = () => (
  <div
    className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white"
    aria-hidden="true"
  >
    <div className="h-32 bg-slate-100" />
    <div className="relative px-5 pb-5 pt-9">
      <div className="absolute -top-7 left-5 h-14 w-14 rounded-2xl border border-white bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
      <div className="mt-5 h-3 w-1/2 rounded bg-slate-100" />
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex -space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-full border-2 border-white bg-slate-100"
            />
          ))}
        </div>
        <div className="h-4 w-12 rounded bg-slate-100" />
      </div>
    </div>
  </div>
);

const SkeletonRow = () => (
  <div
    className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4"
    aria-hidden="true"
  >
    <div className="h-14 w-14 rounded-xl bg-slate-100" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/3 rounded bg-slate-100" />
      <div className="h-3 w-1/5 rounded bg-slate-100" />
    </div>
    <div className="h-4 w-24 rounded bg-slate-100" />
  </div>
);

export default BrowseMentors;