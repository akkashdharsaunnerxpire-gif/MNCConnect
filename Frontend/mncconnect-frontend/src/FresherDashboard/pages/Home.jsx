import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  Search,
  Users,
  Star,
  ShieldCheck,
  Building2,
  BriefcaseBusiness,
  Filter,
  Award,
  BarChart3,
  BadgeCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// Import company catalog
import companyCatalog from "../mncLogos/Companylogos";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const categories = [
  "All Companies",
  "Technology",
  "Finance",
  "Consulting",
  "Product",
  "Design",
  "Marketing",
];

// ============================================================
// NORMALIZE COMPANY NAME
// ============================================================

const normalizeCompanyName = (name = "") => {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[._-]/g, "");
};

// ============================================================
// FIND COMPANY DETAILS
// ============================================================

const findCompanyDetails = (companyName) => {
  const normalizedName = normalizeCompanyName(companyName);

  return companyCatalog.find(
    (company) => normalizeCompanyName(company.name) === normalizedName,
  );
};

// ============================================================
// GROUP EMPLOYEES BY COMPANY
// ============================================================

const groupMentorsByCompany = (mentors) => {
  const grouped = {};

  mentors.forEach((mentor) => {
    const companyName = mentor.companyName?.trim();

    if (!companyName) return;

    const normalizedName = normalizeCompanyName(companyName);

    if (!grouped[normalizedName]) {
      grouped[normalizedName] = {
        companyName,
        mentors: [],
      };
    }

    grouped[normalizedName].mentors.push(mentor);
  });

  return Object.values(grouped);
};

// ============================================================
// BUILD COMPANY DATA
// ============================================================

const buildCompanyData = (apiData) => {
  if (!Array.isArray(apiData)) {
    return [];
  }

  // CASE 1: API already returns company objects
  const looksLikeCompanyData =
    apiData.length > 0 &&
    apiData.some(
      (item) =>
        item.mentorCount !== undefined ||
        item.onlineCount !== undefined ||
        item.averageRating !== undefined,
    );

  if (looksLikeCompanyData) {
    return apiData.map((company) => {
      const details = findCompanyDetails(company.companyName);

      return {
        ...company,
        logo: details?.logo || null,
        companyImage: details?.companyImage || null,
        mentors: company.mentors || [],
        mentorCount:
          company.mentorCount || company.mentors?.length || 0,
        onlineCount: company.onlineCount || 0,
        averageRating: company.averageRating || 0,
        ratingCount: company.ratingCount || "1.2K",
        industry:
          company.industry || details?.industry || "Technology",
        category:
          company.category || details?.category || "Industry",
      };
    });
  }

  // CASE 2: API returns individual mentors
  const grouped = groupMentorsByCompany(apiData);

  return grouped.map((company) => {
    const details = findCompanyDetails(company.companyName);

    const onlineMentors = company.mentors.filter(
      (mentor) =>
        mentor.isOnline === true ||
        mentor.online === true ||
        mentor.status === "online",
    );

    const ratings = company.mentors
      .map(
        (mentor) =>
          Number(mentor.averageRating) ||
          Number(mentor.rating) ||
          0,
      )
      .filter((rating) => rating > 0);

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) /
          ratings.length
        : 0;

    return {
      companyName: company.companyName,
      logo: details?.logo || null,
      companyImage: details?.companyImage || null,
      mentors: company.mentors,
      mentorCount: company.mentors.length,
      onlineCount: onlineMentors.length,
      averageRating,
      ratingCount: "1.2K",
      industry: details?.industry || "Technology",
      category: details?.category || "Industry",
    };
  });
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const BrowseMentors = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState("All Companies");

  const [sort, setSort] = useState("Popular");

  // FILTER DRAWER
  const [filterOpen, setFilterOpen] = useState(false);

  // ============================================================
  // FETCH COMPANIES
  // ============================================================

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/mentor/companies`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load companies",
        );
      }

      const apiCompanies = data.companies || [];

      const finalCompanies = buildCompanyData(apiCompanies);

      // Remove duplicates
      const uniqueCompanies = [];
      const seenNames = new Set();

      finalCompanies.forEach((company) => {
        const name = company.companyName
          ?.trim()
          .toLowerCase();

        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueCompanies.push(company);
        }
      });

      setCompanies(uniqueCompanies);
    } catch (err) {
      console.error("Company fetch error:", err);

      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FILTER + SEARCH + SORT
  // ============================================================

  const filteredCompanies = useMemo(() => {
    let data = [...companies];

    // SEARCH
    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      data = data.filter((company) => {
        const companyName =
          company.companyName?.toLowerCase() || "";

        const industry =
          company.industry?.toLowerCase() || "";

        const category =
          company.category?.toLowerCase() || "";

        return (
          companyName.includes(keyword) ||
          industry.includes(keyword) ||
          category.includes(keyword)
        );
      });
    }

    // CATEGORY
    if (activeCategory !== "All Companies") {
      const category = activeCategory.toLowerCase();

      data = data.filter((company) => {
        const industry =
          company.industry?.toLowerCase() || "";

        const companyCategory =
          company.category?.toLowerCase() || "";

        return (
          industry.includes(category) ||
          companyCategory.includes(category)
        );
      });
    }

    // SORT
    if (sort === "Rating") {
      data.sort(
        (a, b) =>
          (b.averageRating || 0) -
          (a.averageRating || 0),
      );
    }

    if (sort === "Mentors") {
      data.sort(
        (a, b) =>
          (b.mentorCount || 0) -
          (a.mentorCount || 0),
      );
    }

    return data;
  }, [companies, search, activeCategory, sort]);

  // ============================================================
  // LOCK BODY SCROLL
  // ============================================================

  useEffect(() => {
    if (filterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  // ============================================================
  // CLOSE FILTER
  // ============================================================

  const closeFilter = () => {
    setFilterOpen(false);
  };

  // ============================================================
  // SELECT CATEGORY
  // ============================================================

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setFilterOpen(false);
  };

  // ============================================================
  // SELECT SORT
  // ============================================================

  const handleSortChange = (sortValue) => {
    setSort(sortValue);
    setFilterOpen(false);
  };

  // ============================================================
  // CLEAR FILTERS
  // ============================================================

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("All Companies");
    setSort("Popular");
    setFilterOpen(false);
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2e]">
        <div className="text-center">
          <div className="relative flex items-center justify-center w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 rounded-full border-purple-500/20 border-t-purple-500 animate-spin" />

            <Sparkles
              size={24}
              className="text-purple-400"
            />
          </div>

          <p className="mt-6 text-sm tracking-wide text-gray-400">
            Loading premium mentors...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-5 text-white bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2e]">
        <div className="w-full max-w-md p-10 text-center border rounded-3xl border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-purple-500/10">
            <Building2
              size={32}
              className="text-purple-400"
            />
          </div>

          <h2 className="mt-6 text-2xl font-semibold">
            Something went wrong
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            {error}
          </p>

          <button
            onClick={fetchCompanies}
            className="px-7 py-3.5 mt-7 font-semibold transition rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2e]">

      {/* ======================================================
          ANIMATED BACKGROUND
      ====================================================== */}

      <div className="fixed inset-0 z-0 pointer-events-none">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.15),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.12),transparent_40%),radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.05),transparent_50%)]" />

        <div className="absolute inset-0 opacity-[0.03]">

          <div className="absolute w-64 h-64 bg-purple-600 rounded-full top-1/4 left-1/4 blur-3xl animate-pulse" />

          <div className="absolute w-64 h-64 delay-1000 bg-blue-600 rounded-full bottom-1/4 right-1/4 blur-3xl animate-pulse" />

          <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full top-1/2 left-1/2 w-96 h-96 bg-violet-600 blur-3xl animate-pulse delay-2000" />

        </div>

        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.3)_1px,transparent_1px)] bg-[size:60px_60px]" />

      </div>

      {/* ======================================================
          HERO SECTION
      ====================================================== */}

      <section className="relative z-10 w-full">

        <div className="relative min-h-[500px] sm:min-h-[530px] lg:min-h-[450px] xl:min-h-[470px] overflow-hidden border-b border-white/[0.08]">

          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2e]" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.12),transparent_50%)]" />

          <div className="absolute top-0 left-0 w-[450px] h-[450px] rounded-full bg-violet-600/10 blur-[120px]" />

          <div className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full bg-blue-600/10 blur-[120px]" />

          <div className="relative z-20 flex flex-col items-center justify-center min-h-[500px] sm:min-h-[530px] lg:min-h-[450px] xl:min-h-[470px] px-5 sm:px-8 text-center">

            <div className="inline-block px-4 py-1 mb-4 text-xs font-semibold tracking-widest text-purple-300 uppercase border rounded-full bg-purple-500/10 border-purple-500/20 backdrop-blur-sm">
              LEARN FROM THE BEST
            </div>

            <h1 className="mt-2 text-4xl font-bold leading-none tracking-tight sm:mt-3 sm:text-5xl md:text-6xl xl:text-7xl">

              Browse{" "}

              <span className="text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-300 bg-clip-text">
                MNC EMPLOYEES
              </span>

            </h1>

            <p className="max-w-xl mt-4 text-sm text-gray-300 sm:text-base lg:text-lg">
              Connect with professionals from the world's leading companies
            </p>

            <div className="grid grid-cols-2 mt-7 overflow-hidden border md:grid-cols-4 sm:mt-8 rounded-2xl border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.2)]">

              <Stat
                icon={<BriefcaseBusiness size={20} />}
                value="500+"
                label="Companies"
              />

              <Stat
                icon={<Users size={20} />}
                value="2000+"
                label="Mnc Employees"
              />

              <Stat
                icon={<BadgeCheck size={20} />}
                value="10K+"
                label="Sessions"
              />

              <Stat
                icon={<Star size={20} />}
                value="4.9"
                label="Avg Rating"
              />

            </div>

          </div>

        </div>

      </section>

      {/* ======================================================
          ONE COMBINED SEARCH BLOCK
          FILTER + SEARCH + TOP COMPANIES
      ====================================================== */}

      <section className="relative z-30  px-5 mx-auto sm:px-6">

        <div className="flex items-center w-full gap-3 p-2 mt-4 overflow-hidden border rounded-2xl border-purple-500/30 bg-[#0d091b]/90 backdrop-blur-xl shadow-[0_0_40px_rgba(139,92,246,0.12)]">

          {/* ==================================================
              FILTER BUTTON
          ================================================== */}

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
            className="flex items-center w-[12rem] justify-center h-[58px] gap-2 px-5 text-sm font-medium text-gray-200 transition-all duration-200 border rounded-xl border-purple-500/50 bg-[#100b20] hover:bg-purple-500/20 hover:border-purple-400/70 active:scale-[0.97] shrink-0"
          >

            <Filter
              size={18}
              className="text-purple-300"
            />

            <span className="hidden sm:inline">
              Filters
            </span>

          </button>

          {/* ==================================================
              SEARCH BAR
          ================================================== */}

          <div className="flex items-center flex-1 min-w-0 h-[58px] gap-2 px-2 border rounded-xl border-purple-500/40 bg-black/40">

            <Search
              size={21}
              className="ml-2 text-gray-400 shrink-0"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or industry..."
              className="flex-1 min-w-0 px-2 text-sm text-gray-200 bg-transparent outline-none sm:px-3 sm:text-base placeholder:text-gray-500"
            />

          </div>

          {/* ==================================================
              TOP COMPANIES - SAME BLOCK
          ================================================== */}

          <div className="flex items-center h-[58px] gap-2 pl-3 pr-2 border-l border-white/10 shrink-0">

            {/* TOP COMPANY ICONS */}

            <div className="flex items-center">

              {companyCatalog
                .slice(0, 5)
                .map((company, index) => {

                  const initials =
                    company.name
                      ?.split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                  return (
                    <div
                      key={`${company.name}-${index}`}
                      title={company.name}
                      className={`relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 overflow-hidden bg-white border-2 rounded-full border-[#100b20] shadow-md transition-transform duration-200 hover:z-20 hover:scale-110 ${
                        index !== 0 ? "-ml-2" : ""
                      }`}
                    >

                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="object-contain w-full h-full p-1.5 rounded-full"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-purple-600">
                          {initials}
                        </span>
                      )}

                    </div>
                  );
                })}

              {/* + CIRCLE */}

              <div className="relative z-10 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 -ml-2 text-xs font-bold text-white border-2 rounded-full border-[#100b20] bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg shadow-purple-500/20">

                +
                {Math.max(
                  (companyCatalog?.length || 0) - 5,
                  0,
                )}

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ======================================================
          FILTER DRAWER
      ====================================================== */}

      <div
        className={`fixed inset-0 z-[100] ${
          filterOpen
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
      >

        {/* OVERLAY */}

        <div
          onClick={closeFilter}
          className={`absolute inset-0 bg-black/65 transition-opacity duration-300 ease-out ${
            filterOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
        />

        {/* FILTER PANEL */}

        <aside
          className={`absolute top-0 bottom-0 left-0 w-[390px] max-w-[88vw] bg-[#0b0918] border-r border-purple-500/20 shadow-[20px_0_60px_rgba(0,0,0,0.45)] transform-gpu will-change-transform transition-transform duration-300 ease-out ${
            filterOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >

          {/* ==================================================
              FILTER HEADER
          ================================================== */}

          <div className="flex items-center h-[76px] px-5 border-b border-white/10">

            {/* BOOTSTRAP BACK ARROW */}

            <button
              type="button"
              onClick={closeFilter}
              aria-label="Back"
              className="flex items-center justify-center w-10 h-10 mr-3 text-gray-400 transition-all duration-200 rounded-xl hover:text-white hover:bg-white/10 active:scale-95"
            >
              <i className="bi bi-arrow-left text-xl"></i>
            </button>

            <div>

              <h2 className="text-lg font-semibold text-white">
                Filters
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Refine your search
              </p>

            </div>

          </div>

          {/* FILTER CONTENT */}

          <div className="h-[calc(100vh-76px)] px-5 py-6 overflow-y-auto overscroll-contain">

            {/* COMPANY CATEGORY */}

            <div>

              <p className="mb-4 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Company Category
              </p>

              <div className="space-y-2">

                {categories.map((item) => {

                  const active =
                    activeCategory === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        handleCategoryChange(item)
                      }
                      className={`flex items-center justify-between w-full px-4 py-3.5 text-sm font-medium text-left rounded-xl border transition-colors duration-150 ${
                        active
                          ? "bg-gradient-to-r from-violet-600 to-purple-500 border-transparent text-white shadow-lg shadow-purple-500/20"
                          : "bg-white/[0.035] border-white/[0.08] text-gray-300 hover:bg-white/[0.07] hover:border-purple-500/30"
                      }`}
                    >

                      <span>{item}</span>

                      {active && (
                        <span className="text-sm font-bold">
                          ✓
                        </span>
                      )}

                    </button>
                  );
                })}

              </div>

            </div>

            {/* DIVIDER */}

            <div className="my-7 border-t border-white/[0.08]" />

            {/* SORT */}

            <div>

              <p className="mb-4 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Sort By
              </p>

              <div className="space-y-2">

                {[
                  "Popular",
                  "Rating",
                  "Mentors",
                ].map((item) => {

                  const active = sort === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        handleSortChange(item)
                      }
                      className={`flex items-center justify-between w-full px-4 py-3.5 text-sm font-medium text-left rounded-xl border transition-colors duration-150 ${
                        active
                          ? "bg-purple-500/15 border-purple-500/50 text-purple-200"
                          : "bg-white/[0.035] border-white/[0.08] text-gray-300 hover:bg-white/[0.07] hover:border-purple-500/30"
                      }`}
                    >

                      <span>
                        Sort: {item}
                      </span>

                      {active && (
                        <span className="text-sm font-bold text-purple-300">
                          ✓
                        </span>
                      )}

                    </button>
                  );
                })}

              </div>

            </div>

            {/* CLEAR */}

            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-4 py-3.5 mt-8 text-sm font-semibold text-purple-300 transition-colors duration-150 border rounded-xl border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 hover:border-purple-500/50"
            >
              Clear All Filters
            </button>

          </div>

        </aside>

      </div>

      {/* ======================================================
          COMPANY CARDS
          UNCHANGED
      ====================================================== */}

      <main className="relative z-10 max-w-[1540px] px-5 sm:px-6 lg:px-8 mx-auto py-8 sm:py-10 lg:py-12">

        {filteredCompanies.length === 0 ? (

          <div className="py-20 text-center">

            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-white/5">
              <Building2
                size={34}
                className="text-gray-600"
              />
            </div>

            <h2 className="mt-6 text-2xl font-semibold">
              No Companies Found
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Try searching another company.
            </p>

            <button
              onClick={clearFilters}
              className="px-6 py-3 mt-6 text-sm font-medium transition shadow-lg bg-gradient-to-r from-purple-600 to-violet-600 rounded-xl hover:scale-105 shadow-purple-500/20"
            >
              Clear Filters
            </button>

          </div>

        ) : (

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

            {filteredCompanies.map((company) => (
              <CompanyCard
                key={company.companyName}
                company={company}
              />
            ))}

          </div>

        )}

      </main>

      {/* ======================================================
          BOTTOM FEATURES
      ====================================================== */}

      <section className="relative z-10 max-w-[1300px] px-5 mx-auto pb-10 sm:pb-14">

        <div className="grid grid-cols-1 gap-5 p-5 border sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 rounded-3xl border-purple-500/20 bg-gradient-to-r from-[#1a0a2e]/80 via-[#2a1a3e]/80 to-[#0a1a3e]/80 backdrop-blur-xl sm:p-6 lg:p-5">

          <Feature
            icon={<Award />}
            title="Learn from Top 1%"
            desc="Industry leading professionals"
          />

          <Feature
            icon={<Users />}
            title="1:1 Personalized Sessions"
            desc="Get personalized guidance"
          />

          <Feature
            icon={<BarChart3 />}
            title="Career Growth"
            desc="Accelerate your career"
          />

          <Feature
            icon={<ShieldCheck />}
            title="Verified MNC Employees"
            desc="Background verified"
          />

        </div>

      </section>

    </div>
  );
};

// ============================================================
// STAT
// ============================================================

const Stat = ({ icon, value, label }) => {
  return (
    <div className="relative px-4 py-4 border-r sm:px-6 sm:py-5 border-white/10 last:border-r-0">

      <div className="flex justify-center text-purple-400">
        {icon}
      </div>

      <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        {value}
      </h3>

      <p className="mt-1 text-[10px] sm:text-xs text-gray-400">
        {label}
      </p>

    </div>
  );
};

// ============================================================
// FEATURE
// ============================================================

const Feature = ({ icon, title, desc }) => {
  return (
    <div className="flex items-center gap-4 lg:px-5 lg:border-r lg:last:border-r-0 border-white/10">

      <div className="flex items-center justify-center text-purple-300 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/15 shrink-0">
        {icon}
      </div>

      <div className="min-w-0">

        <h4 className="text-sm font-semibold sm:text-base">
          {title}
        </h4>

        <p className="mt-1 text-xs text-gray-400 sm:text-sm">
          {desc}
        </p>

      </div>

    </div>
  );
};

// ============================================================
// COMPANY CARD
// ============================================================

const CompanyCard = ({ company }) => {

  const companyName = company.companyName || "";

  const initials = companyName
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rating = company.averageRating
    ? Number(company.averageRating).toFixed(1)
    : "4.9";

  const ratingCount =
    company.ratingCount || "1.2K";

  const mentorCount =
    company.mentorCount || 0;

  const onlineCount =
    company.onlineCount || 0;

  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-[#1a0a2e] to-[#0a1a2e] shadow-[0_15px_45px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-2 hover:border-purple-500/40 hover:shadow-[0_20px_60px_rgba(139,92,246,0.2)]">

      {/* Company Image */}

      <div className="relative h-[140px] overflow-hidden">

        {company.companyImage ? (

          <img
            src={company.companyImage}
            alt={`${companyName} office`}
            className="object-cover w-full h-full transition duration-500 group-hover:scale-105"
          />

        ) : (

          <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-800 to-gray-900">

            <Building2
              size={45}
              className="text-gray-600"
            />

          </div>

        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-transparent to-black/10" />

      </div>

      {/* Content */}

      <div className="relative px-4 pt-3 pb-5 sm:px-5">

        {/* Company Logo */}

        <div className="absolute flex items-center justify-center w-[50px] h-[50px] overflow-hidden bg-white/90 backdrop-blur-sm border-2 border-white/20 shadow-xl rounded-xl -top-6 left-4">

          {company.logo ? (

            <img
              src={company.logo}
              alt={`${companyName} logo`}
              className="object-contain w-full h-full p-1.5"
            />

          ) : (

            <span className="text-lg font-bold text-gray-700">
              {initials}
            </span>

          )}

        </div>

        <div className="pt-2">

          {/* Mentors and Rating */}

          <div className="flex items-center justify-between gap-2 mt-6 text-xs sm:text-sm">

            <div className="flex items-center gap-1.5 text-gray-300">

              <Users
                size={15}
                className="text-gray-400"
              />

              <span className="font-medium">
                {mentorCount} Employees
              </span>

            </div>

            <div className="flex items-center gap-1">

              <Star
                size={15}
                fill="currentColor"
                className="text-yellow-400"
              />

              <span className="font-medium text-white">
                {rating}
              </span>

              <span className="text-gray-500">
                ({ratingCount})
              </span>

            </div>

          </div>

          {/* Mentor Avatars */}

          <div className="flex mt-4 -space-x-3">

            {[1, 2, 3, 4, 5].map((i) => (

              <img
                key={i}
                src={`https://i.pravatar.cc/100?img=${i + 10}`}
                className="object-cover w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-[#0a0a1a]"
                alt="Mentor"
                onError={(e) => {
                  e.target.src =
                    `https://ui-avatars.com/api/?name=M${i}&background=7c3aed&color=fff&size=32&bold=true`;
                }}
              />

            ))}

            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 text-[10px] sm:text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-violet-600 border-2 border-[#0a0a1a] shadow-lg shadow-purple-500/30 text-white">

              +{onlineCount || 0}

            </div>

          </div>

          {/* View Mentors Button */}

          <Link
            to={`/Home/sessionboard/${encodeURIComponent(
              companyName,
            )}`}
            className="flex items-center justify-center w-full gap-2.5 py-2.5 sm:py-3 mt-4 text-sm font-semibold text-purple-300 transition-all border border-purple-500/30 rounded-xl hover:bg-gradient-to-r hover:from-purple-600 hover:to-violet-600 hover:text-white hover:border-transparent hover:shadow-[0_0_25px_rgba(139,92,246,0.3)] group"
          >

            {company.logo ? (

              <span className="relative flex items-center justify-center w-10 h-10 overflow-hidden transition-all bg-white border rounded-full sm:w-7 sm:h-7 border-purple-500/30 group-hover:border-white/50">

                <img
                  src={company.logo}
                  alt={`${companyName} logo`}
                  className="object-contain w-full h-full p-0.5"
                  onError={(e) => {
                    e.target.style.display =
                      "none";

                    e.target.parentElement.innerHTML =
                      `<span class="text-[10px] font-bold text-purple-600">${initials}</span>`;
                  }}
                />

              </span>

            ) : (

              <span className="flex items-center justify-center w-6 h-6 transition-all border rounded-full sm:w-7 sm:h-7 bg-purple-500/20 border-purple-500/30 group-hover:border-white/50 group-hover:bg-white/20">

                <Building2
                  size={14}
                  className="group-hover:text-white"
                />

              </span>

            )}

            <span className="truncate max-w-[140px] sm:max-w-[160px]">
              Employees
            </span>

            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1 shrink-0"
            />

          </Link>

        </div>

      </div>

    </div>
  );
};

export default BrowseMentors;