import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

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
  ArrowDown,
  X,
  LayoutGrid,
  List,
  RotateCcw,
  Clock3,
  CalendarCheck2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
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
  "bg-blue-100 text-blue-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700",
];

const RECENT_KEY = "mnc_recent_searches";

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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
};

const writeRecent = (list) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* storage can be blocked, ignore */
  }
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

// "View" ALWAYS goes to the booking page only. There is no direct link to the meeting room.
// A company that was already booked can be booked again the same way.
const sessionLink = (company) =>
  `/Home/sessionboard/${encodeURIComponent(company.companyName || "")}`;

// ============================================================
// MAIN COMPONENT
// ============================================================

const BrowseMentors = () => {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Companies");
  const [sort, setSort] = useState("Popular");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [view, setView] = useState("grid");

  // search box UX
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const [showFab, setShowFab] = useState(false);

  const searchRef = useRef(null);
  const searchSectionRef = useRef(null);
  const resultsRef = useRef(null);

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

  // scroll to the search card and focus the input
  const goToSearch = useCallback(() => {
    searchSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 450);
  }, []);

  // scroll straight to the company cards (used by the "Find your company" button)
  const goToCards = useCallback(() => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // "/" or Ctrl/Cmd+K anywhere -> jump to the search box
  useEffect(() => {
    const onKeyDown = (e) => {
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      const isK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (!isSlash && !isK) return;

      const tag = document.activeElement?.tagName;
      if (
        isSlash &&
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
      )
        return;

      e.preventDefault();
      goToSearch();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToSearch]);

  // floating "Search" button: show it once the search card has scrolled out of view (upwards)
  useEffect(() => {
    const el = searchSectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;

    const io = new IntersectionObserver(
      ([entry]) =>
        setShowFab(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
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

  // top companies by employee count -> quick-pick chips under the search box
  const popularCompanies = useMemo(
    () =>
      [...companies]
        .sort((a, b) => (b.mentorCount || 0) - (a.mentorCount || 0))
        .slice(0, 6),
    [companies]
  );

  const keyword = search.trim();

  // autocomplete suggestions (company names that match what is typed)
  const suggestions = useMemo(() => {
    const k = keyword.toLowerCase();
    if (!k) return [];
    return companies
      .filter((c) =>
        [c.companyName, c.industry].join(" ").toLowerCase().includes(k)
      )
      .sort((a, b) => {
        const aStart = a.companyName.toLowerCase().startsWith(k) ? 0 : 1;
        const bStart = b.companyName.toLowerCase().startsWith(k) ? 0 : 1;
        return aStart - bStart || (b.mentorCount || 0) - (a.mentorCount || 0);
      })
      .slice(0, 5);
  }, [companies, keyword]);

  const filteredCompanies = useMemo(() => {
    const k = keyword.toLowerCase();

    const data = companies.filter((company) => {
      if (!matchesCategory(company, activeCategory)) return false;
      if (onlineOnly && !(company.onlineCount > 0)) return false;

      if (k) {
        const haystack = [company.companyName, company.industry, company.category]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(k)) return false;
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
    else
      data.sort(
        (a, b) =>
          Number(b.onlineCount > 0) - Number(a.onlineCount > 0) || // online first
          byEmployees(a, b) ||
          byOnline(a, b)
      ); // Popular

    return data;
  }, [companies, keyword, activeCategory, sort, onlineOnly]);

  const clearAll = () => {
    setSearch("");
    setActiveCategory("All Companies");
    setSort("Popular");
    setOnlineOnly(false);
  };

  const saveRecent = (text) => {
    const t = String(text || "").trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())];
    setRecent(next.slice(0, 5));
    writeRecent(next);
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const pickSuggestion = (company) => {
    saveRecent(company.companyName);
    setFocused(false);
    navigate(sessionLink(company));
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        pickSuggestion(suggestions[activeIdx]);
      } else {
        saveRecent(keyword);
        setFocused(false);
        searchRef.current?.blur();
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (e.key === "Escape") {
      setFocused(false);
      searchRef.current?.blur();
    }
  };

  const activeFilters = [];
  if (keyword)
    activeFilters.push({
      key: "search",
      label: `“${keyword}”`,
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
  const showDropdown =
    focused && (suggestions.length > 0 || (!keyword && recent.length > 0));

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{`
        @keyframes mc-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes mc-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes mc-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
        @keyframes mc-shine { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
        .mc-rise { animation: mc-rise .5s cubic-bezier(.2,.7,.2,1) both; }
        .mc-float { animation: mc-float 7s ease-in-out infinite; }
        .mc-bounce { animation: mc-bounce 1.4s ease-in-out infinite; }
        .mc-shine { background-size: 200% auto; animation: mc-shine 5s linear infinite; }
        .mc-no-scrollbar { scrollbar-width: none; }
        .mc-no-scrollbar::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .mc-rise, .mc-float, .mc-bounce, .mc-shine { animation: none; }
        }
      `}</style>

      {/* ======================================================
          HERO  (title + live stats only. Search is BELOW)
      ====================================================== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />
          <div className="mc-float absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
          <div
            className="mc-float absolute -right-28 top-6 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl"
            style={{ animationDelay: "2s" }}
          />
          <div className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,rgba(37,99,235,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-14 text-center sm:px-8 sm:pb-28 sm:pt-16">
          <span className="mc-rise inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700 shadow-sm">
            <BadgeCheck size={14} /> Learn from the best
          </span>

          <h1
            className="mc-rise mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            Browse{" "}
            <span className="mc-shine bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 bg-clip-text text-transparent">
              MNC Employees
            </span>
          </h1>

          <p
            className="mc-rise mx-auto mt-4 max-w-xl text-base text-slate-500 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Book 1:1 sessions with verified professionals from the world's
            leading companies.
          </p>

          {/* CTA -> scrolls straight down to the company cards */}
          <div
            className="mc-rise mt-7 flex flex-col items-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <button
              type="button"
              onClick={goToCards}
              className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:shadow-xl active:scale-95"
            >
              <Search size={16} />
              Find your company
              <ArrowDown size={16} className="mc-bounce" />
            </button>
            <p className="text-xs text-slate-400">
              Search is just below · press{" "}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-500">
                /
              </kbd>{" "}
              anytime
            </p>
          </div>

          {/* live stats */}
          <div
            className="mc-rise mx-auto mt-9 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4"
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
          SEARCH CARD  (floats over the hero's bottom edge)
      ====================================================== */}
      <section
        ref={searchSectionRef}
        id="search"
        className="relative z-20 mx-auto -mt-12 max-w-4xl scroll-mt-24 px-5 sm:px-8"
      >
        <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-100/80 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Search size={16} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Search companies
                </h2>
                <p className="text-xs text-slate-500">
                  Type a company name or industry
                </p>
              </div>
            </div>
            {!loading && !error && (
              <span className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline-flex">
                <Sparkles size={12} /> {totals.companies} companies ready
              </span>
            )}
          </div>

          {/* input + autocomplete */}
          <div className="relative">
            <label
              htmlFor="company-search"
              className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 transition ${
                focused
                  ? "border-blue-500 ring-4 ring-blue-100"
                  : "border-slate-200 hover:border-blue-300"
              }`}
            >
              <Search
                size={20}
                className={`shrink-0 transition ${focused ? "text-blue-600" : "text-slate-400"}`}
              />
              <input
                id="company-search"
                ref={searchRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIdx(-1);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search company or industry…  e.g. TCS, Infosys, Finance"
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls="company-suggestions"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
              {search ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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

            {showDropdown && (
              <div
                id="company-suggestions"
                role="listbox"
                onMouseDown={(e) => e.preventDefault()}
                className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80"
              >
                {suggestions.length > 0 ? (
                  <>
                    <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Companies
                    </p>
                    {suggestions.map((c, i) => (
                      <button
                        key={c.companyName}
                        type="button"
                        role="option"
                        aria-selected={i === activeIdx}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => pickSuggestion(c)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                          i === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <Logo company={c} size="h-9 w-9" rounded="rounded-lg" small />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            <Highlight text={c.companyName} query={keyword} />
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {c.industry} · {c.mentorCount || 0}{" "}
                            {(c.mentorCount || 0) === 1 ? "employee" : "employees"}
                          </span>
                        </span>
                        {c.onlineCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {c.onlineCount} online
                          </span>
                        )}
                        <ArrowRight size={15} className="text-slate-300" />
                      </button>
                    ))}
                    <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
                      ↑ ↓ to move · Enter to open · Esc to close
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-4 pb-1 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Recent searches
                      </p>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="text-[11px] font-medium text-blue-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setSearch(r);
                          searchRef.current?.focus();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <Clock3 size={15} className="text-slate-400" />
                        {r}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* quick picks */}
          {popularCompanies.length > 0 && !keyword && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                <TrendingUp size={13} /> Popular:
              </span>
              {popularCompanies.map((c) => (
                <button
                  key={c.companyName}
                  type="button"
                  onClick={() => {
                    setSearch(c.companyName);
                    saveRecent(c.companyName);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                >
                  {c.companyName}
                </button>
              ))}
            </div>
          )}

          {/* category chips (part of the search card, so filters live with search) */}
          <div
            className="mc-no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1"
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
                      ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  }`}
                >
                  {item}
                  {!loading && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {categoryCounts[item] ?? 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================================================
          TRUSTED LOGOS (only companies that have a logo)
      ====================================================== */}
      {logoCompanies.length > 0 && (
        <section className="mt-10 border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 overflow-x-auto px-5 py-4 mc-no-scrollbar sm:px-8">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Employees from
            </span>
            <div className="flex items-center gap-5">
              {logoCompanies.slice(0, 10).map((company) => (
                <button
                  key={company.companyName}
                  type="button"
                  title={`Search ${company.companyName}`}
                  onClick={() => {
                    setSearch(company.companyName);
                    resultsRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center opacity-60 grayscale transition duration-200 hover:scale-110 hover:opacity-100 hover:grayscale-0"
                >
                  <img
                    src={company.logo}
                    alt={company.companyName}
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
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
      <main
        ref={resultsRef}
        className="mx-auto max-w-[1400px] scroll-mt-24 px-5 py-8 sm:px-8 sm:py-10"
      >
        {/* toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300"
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
              {totals.online > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-emerald-700">
                  {totals.online}
                </span>
              )}
            </button>

            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition focus-within:border-blue-400 hover:border-blue-300">
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
                      ? "bg-blue-50 text-blue-700"
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
                className="group inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
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
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="mx-auto max-w-md rounded-3xl border border-dashed border-slate-300 px-8 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Building2 size={28} />
              </div>
              <h2 className="mt-5 text-xl font-semibold">No companies found</h2>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search or remove a filter.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
              >
                Clear filters
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCompanies.map((company, index) => (
                <CompanyCard
                  key={company.companyName}
                  company={company}
                  index={index}
                  query={keyword}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCompanies.map((company, index) => (
                <CompanyRow
                  key={company.companyName}
                  company={company}
                  index={index}
                  query={keyword}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ======================================================
          HOW IT WORKS
      ====================================================== */}
      <section className="mx-auto max-w-[1400px] px-5 pb-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Step
            n="1"
            icon={<MousePointerClick size={20} />}
            title="Pick a company"
            desc="Search or browse and open the company you want to learn from."
          />
          <Step
            n="2"
            icon={<CalendarCheck2 size={20} />}
            title="Choose your time"
            desc="Select a slot, pay securely, and your request goes to matching employees."
          />
          <Step
            n="3"
            icon={<BadgeCheck size={20} />}
            title="Get matched & meet"
            desc="Once an employee accepts, join the live session. Not accepted? You get a wallet refund."
          />
        </div>
      </section>

      {/* ======================================================
          TRUST FEATURES
      ====================================================== */}
      <section className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8">
        <div className="grid gap-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/70 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
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

      {/* floating "Search" button (appears after you scroll past the search card) */}
      <button
        type="button"
        onClick={goToSearch}
        aria-label="Go to search"
        className={`fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-300/60 transition-all duration-300 hover:bg-blue-700 active:scale-95 ${
          showFab
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <Search size={16} /> Search
      </button>
    </div>
  );
};

// ============================================================
// SMALL PIECES
// ============================================================

// bold the part of the text that matches what the user typed
const Highlight = ({ text = "", query = "" }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const parts = String(text).split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-blue-100 px-0.5 font-semibold text-blue-800"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const StatPill = ({ icon, value, label }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
    <div className="flex h-5 items-center text-blue-600">{icon}</div>
    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
      {value}
    </p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

const Feature = ({ icon, title, desc }) => (
  <div className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-white">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
      {icon}
    </div>
    <div className="min-w-0">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </div>
  </div>
);

const Step = ({ n, icon, title, desc }) => (
  <div className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100">
    <span className="absolute right-4 top-3 text-4xl font-black text-blue-50 transition group-hover:text-blue-100">
      {n}
    </span>
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
      {icon}
    </div>
    <h4 className="mt-4 text-sm font-semibold text-slate-900">{title}</h4>
    <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
  </div>
);

const Logo = ({
  company,
  size = "h-14 w-14",
  rounded = "rounded-2xl",
  small = false,
}) => {
  const [failed, setFailed] = useState(false);
  const name = company.companyName || "";

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden ${rounded} border border-slate-200 bg-white ${
        small ? "" : "shadow-md"
      }`}
    >
      {company.logo && !failed ? (
        <img
          src={company.logo}
          alt={`${name} logo`}
          className={`h-full w-full object-contain ${small ? "p-1" : "p-2"}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`font-bold text-blue-600 ${small ? "text-xs" : "text-base"}`}
        >
          {initialsOf(name)}
        </span>
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

const isMentorOnline = (m = {}) =>
  m.isOnline === true || m.online === true || m.status === "online";

const MiniAvatar = ({ mentor }) => {
  const [failed, setFailed] = useState(false);
  const photo = mentorPhoto(mentor);
  const name = mentor.name || mentor.fullName || "";
  const online = isMentorOnline(mentor);

  return (
    <span
      className="relative inline-flex"
      title={`${name || "Employee"}${online ? " · online" : " · offline"}`}
    >
      {photo && !failed ? (
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
      )}
      {/* green dot = this employee is online right now */}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      )}
    </span>
  );
};

// real employees only; online ones come first so you SEE who is available
const AvatarStack = ({ mentors = [], total = 0, max = 4 }) => {
  const sorted = [...mentors].sort(
    (a, b) => Number(isMentorOnline(b)) - Number(isMentorOnline(a))
  );
  const shown = sorted.slice(0, max);
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

// Solid badges so they are readable on top of ANY cover photo
const OnlineBadge = ({ count }) =>
  count > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white/80">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      {count} online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/65 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
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
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
      New
    </span>
  );
};

// ============================================================
// GRID CARD
// ============================================================

const CompanyCard = ({ company, index, query }) => {
  const name = company.companyName || "";

  return (
    <Link
      to={sessionLink(company)}
      aria-label={`Book a session with ${name}`}
      className="mc-rise group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
            <h3 className="truncate text-base font-semibold text-slate-900">
              <Highlight text={name} query={query} />
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              <Highlight text={company.industry || ""} query={query} />
            </p>
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            Book
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

const CompanyRow = ({ company, index, query }) => {
  const name = company.companyName || "";

  return (
    <Link
      to={sessionLink(company)}
      aria-label={`Book a session with ${name}`}
      className="mc-rise group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-row sm:items-center"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <Logo company={company} size="h-14 w-14" rounded="rounded-xl" />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-slate-900">
          <Highlight text={name} query={query} />
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          <Highlight text={company.industry || ""} query={query} />
        </p>
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

      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white sm:ml-2">
        Book
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