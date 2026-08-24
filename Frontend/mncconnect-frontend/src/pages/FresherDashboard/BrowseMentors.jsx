import React, { useEffect, useState } from "react";
import {
  Search,
  Users,
  Star,
  ShieldCheck,
  ChevronRight,
  Building2,
  Wifi,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_URL =
      import.meta.env.VITE_API_URL || "http://localhost:5000";

const BrowseMentors = () => {
  const [companies, setCompanies] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/mentors/companies`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to load companies"
        );
      }

      setCompanies(
        data.companies || []
      );

    } catch (error) {
      console.error(error);
      setError(error.message);

    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies =
    companies.filter((company) =>
      company.companyName
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">

        <div className="text-center">

          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />

          <p className="mt-4 text-gray-500">
            Finding companies...
          </p>

        </div>

      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">

        <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center">

          <h2 className="text-xl font-semibold">
            Something went wrong
          </h2>

          <p className="text-gray-500 mt-2">
            {error}
          </p>

          <button
            onClick={fetchCompanies}
            className="mt-5 px-5 py-2.5 bg-black text-white rounded-xl"
          >
            Try again
          </button>

        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="bg-white border-b border-gray-200">

        <div className="max-w-7xl mx-auto px-5 md:px-10 py-8">

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">

            <div>

              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                MNCConnect
              </p>

              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2">
                Browse Mentors
              </h1>

              <p className="text-gray-500 mt-3 max-w-xl">
                Learn directly from professionals
                working at leading companies.
              </p>

            </div>

            <div className="text-sm text-gray-500">
              {companies.length} companies
            </div>

          </div>

        </div>

      </header>


      {/* ==================================================
          SEARCH
      ================================================== */}

      <section className="max-w-7xl mx-auto px-5 md:px-10 pt-7">

        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-3">

          <Search
            size={20}
            className="text-gray-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search company..."
            className="w-full outline-none text-sm"
          />

        </div>

      </section>


      {/* ==================================================
          COMPANY BLOCKS
      ================================================== */}

      <main className="max-w-7xl mx-auto px-5 md:px-10 py-8">

        {filteredCompanies.length === 0 ? (

          <div className="bg-white rounded-3xl border border-gray-200 p-16 text-center">

            <Building2
              size={40}
              className="mx-auto text-gray-300"
            />

            <h2 className="font-semibold text-xl mt-5">
              No companies found
            </h2>

            <p className="text-gray-400 mt-2">
              Try another company name.
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {filteredCompanies.map(
              (company) => (

                <CompanyCard
                  key={
                    company.companyName
                  }
                  company={company}
                />

              )
            )}

          </div>

        )}

      </main>

    </div>
  );
};


// ============================================================
// COMPANY CARD
// ============================================================

const CompanyCard = ({
  company,
}) => {

  const initials =
    company.companyName
      .split(" ")
      .map(
        (word) => word[0]
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="group bg-white border border-gray-200 rounded-3xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300">

      <div className="p-6">

        {/* COMPANY HEADER */}

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-4">

            {/* LOGO */}

            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">

              {company.logo ? (

                <img
                  src={company.logo}
                  alt={company.companyName}
                  className="w-full h-full object-contain p-2"
                />

              ) : (

                <span className="text-lg font-bold text-gray-600">
                  {initials}
                </span>

              )}

            </div>


            <div>

              <h2 className="text-xl font-semibold">
                {company.companyName}
              </h2>

              <div className="flex items-center gap-1.5 mt-1">

                <ShieldCheck
                  size={14}
                  className="text-blue-500"
                />

                <span className="text-xs text-gray-400">
                  Verified mentors
                </span>

              </div>

            </div>

          </div>

        </div>


        {/* STATS */}

        <div className="grid grid-cols-2 gap-3 mt-7">

          <div className="bg-gray-50 rounded-2xl p-4">

            <div className="flex items-center gap-2 text-gray-400">

              <Users size={16} />

              <span className="text-xs">
                Mentors
              </span>

            </div>

            <p className="text-2xl font-semibold mt-2">
              {company.mentorCount}
            </p>

          </div>


          <div className="bg-gray-50 rounded-2xl p-4">

            <div className="flex items-center gap-2 text-gray-400">

              <Wifi size={16} />

              <span className="text-xs">
                Online
              </span>

            </div>

            <p className="text-2xl font-semibold mt-2">
              {company.onlineCount}
            </p>

          </div>

        </div>


        {/* MINI GRAPH */}

        <div className="mt-6">

          <div className="flex items-center justify-between">

            <span className="text-xs text-gray-400">
              Mentor growth
            </span>

            <span className="text-xs text-gray-400">
              2026
            </span>

          </div>

          <div className="h-14 mt-3 flex items-end gap-1.5">

            {createGraphBars(
              company.mentorCount
            ).map(
              (height, index) => (

                <div
                  key={index}
                  className="flex-1 bg-black rounded-t-sm transition-all duration-500 group-hover:bg-gray-600"
                  style={{
                    height: `${height}%`,
                  }}
                />

              )
            )}

          </div>

        </div>


        {/* FOOTER */}

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">

          <div>

            <p className="text-xs text-gray-400">
              Average rating
            </p>

            <div className="flex items-center gap-1 mt-1">

              <Star
                size={15}
                className="fill-yellow-400 text-yellow-400"
              />

              <span className="font-semibold text-sm">
                {company.averageRating
                  ? company.averageRating.toFixed(
                      1
                    )
                  : "New"}
              </span>

            </div>

          </div>


          <Link
            to={`/browse-mentors/${encodeURIComponent(
              company.companyName
            )}`}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            View mentors
            <ChevronRight
              size={16}
            />
          </Link>

        </div>

      </div>

    </div>
  );
};


// ============================================================
// GRAPH DATA
// ============================================================

const createGraphBars = (
  count
) => {

  const base =
    Math.max(
      15,
      Math.min(90, count)
    );

  return [
    base * 0.35,
    base * 0.45,
    base * 0.55,
    base * 0.62,
    base * 0.70,
    base * 0.78,
    base * 0.88,
    base,
  ];
};

export default BrowseMentors;