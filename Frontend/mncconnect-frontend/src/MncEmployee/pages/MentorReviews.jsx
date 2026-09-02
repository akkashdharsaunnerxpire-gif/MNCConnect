import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  MessageSquare,
  Search,
  ThumbsUp,
  User,
  Filter,
  ChevronDown,
  CheckCircle2,
  Clock3,
} from "lucide-react";

/* ============================================================
   SAMPLE REVIEW DATA
============================================================ */

const initialReviews = [
  {
    id: 1,
    name: "Arun Kumar",
    role: "Final Year CSE Student",
    rating: 5,
    date: "2 days ago",
    session: "Frontend Development",
    review:
      "The session was very useful. The mentor explained everything clearly and gave practical career guidance.",
    helpful: 12,
    replied: false,
  },
  {
    id: 2,
    name: "Priya S",
    role: "Software Engineering Fresher",
    rating: 5,
    date: "5 days ago",
    session: "Interview Preparation",
    review:
      "Excellent session. I got a much better understanding of how to prepare for technical interviews.",
    helpful: 9,
    replied: true,
  },
  {
    id: 3,
    name: "Rahul M",
    role: "CSE Graduate",
    rating: 4,
    date: "1 week ago",
    session: "Career Guidance",
    review:
      "Very good interaction and useful suggestions. The roadmap shared during the session was helpful.",
    helpful: 7,
    replied: false,
  },
  {
    id: 4,
    name: "Divya R",
    role: "Engineering Student",
    rating: 5,
    date: "2 weeks ago",
    session: "React Development",
    review:
      "Really enjoyed the session. The mentor answered all my doubts patiently.",
    helpful: 15,
    replied: true,
  },
  {
    id: 5,
    name: "Vignesh K",
    role: "Junior Developer",
    rating: 4,
    date: "3 weeks ago",
    session: "Full Stack Development",
    review:
      "Good technical discussion and valuable suggestions for improving my projects.",
    helpful: 5,
    replied: false,
  },
];

/* ============================================================
   MAIN COMPONENT
============================================================ */

const MentorReviews = () => {
  const [reviews, setReviews] = useState(initialReviews);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Latest");
  const [replyId, setReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");

  /* ==========================================================
     RATING STATISTICS
  ========================================================== */

  const ratingStats = useMemo(() => {
    const total = reviews.length;

    const count = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    const average =
      total > 0
        ? reviews.reduce(
            (sum, review) => sum + review.rating,
            0
          ) / total
        : 0;

    return {
      total,
      count,
      average: average.toFixed(1),
    };
  }, [reviews]);

  /* ==========================================================
     FILTER + SORT
  ========================================================== */

  const filteredReviews = useMemo(() => {
    let data = [...reviews];

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      data = data.filter(
        (review) =>
          review.name.toLowerCase().includes(keyword) ||
          review.role.toLowerCase().includes(keyword) ||
          review.session.toLowerCase().includes(keyword) ||
          review.review.toLowerCase().includes(keyword)
      );
    }

    if (ratingFilter !== "All") {
      data = data.filter(
        (review) => review.rating === Number(ratingFilter)
      );
    }

    if (sortBy === "Highest") {
      data.sort((a, b) => b.rating - a.rating);
    }

    if (sortBy === "Lowest") {
      data.sort((a, b) => a.rating - b.rating);
    }

    return data;
  }, [reviews, search, ratingFilter, sortBy]);

  /* ==========================================================
     HELPFUL
  ========================================================== */

  const handleHelpful = (id) => {
    setReviews((current) =>
      current.map((review) =>
        review.id === id
          ? {
              ...review,
              helpful: review.helpful + 1,
            }
          : review
      )
    );
  };

  /* ==========================================================
     REPLY
  ========================================================== */

  const handleReply = (id) => {
    if (!replyText.trim()) return;

    setReviews((current) =>
      current.map((review) =>
        review.id === id
          ? {
              ...review,
              replied: true,
            }
          : review
      )
    );

    setReplyText("");
    setReplyId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">

      {/* =====================================================
          BACKGROUND GLOW
      ===================================================== */}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">

        <div className="absolute w-[500px] h-[500px] -top-52 -left-52 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="absolute w-[500px] h-[500px] -bottom-52 -right-52 rounded-full bg-sky-300/20 blur-3xl" />

      </div>


      <main className="relative z-10 max-w-7xl px-5 py-8 mx-auto">

        {/* =================================================
            PAGE TITLE
        ================================================= */}

        <div className="mb-8">

          <p className="mb-2 text-xs font-semibold tracking-widest text-blue-600 uppercase">
            Mentor Workspace
          </p>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Your Reviews
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Build your mentor reputation through valuable sessions.
          </p>

        </div>

        {/* =================================================
            RATING OVERVIEW
        ================================================= */}

        <section className="grid grid-cols-1 gap-5 mb-7 lg:grid-cols-[300px_1fr]">

          {/* OVERALL RATING */}

          <div className="flex flex-col items-center justify-center p-6 transition border rounded-3xl border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200">

            <div className="text-5xl font-bold text-slate-900">
              {ratingStats.average}
            </div>

            <div className="flex gap-1 mt-3">

              {[1, 2, 3, 4, 5].map((star) => (

                <Star
                  key={star}
                  size={20}
                  fill={
                    star <=
                    Math.round(
                      Number(ratingStats.average)
                    )
                      ? "currentColor"
                      : "none"
                  }
                  className="text-yellow-400"
                />

              ))}

            </div>

            <p className="mt-3 text-sm text-slate-500">
              Based on {ratingStats.total} reviews
            </p>

            <div className="flex items-center gap-2 px-3 py-2 mt-4 text-xs font-medium text-emerald-600 rounded-xl bg-emerald-50 border border-emerald-100">

              <CheckCircle2 size={15} />

              Trusted Mentor

            </div>

          </div>

          {/* RATING BREAKDOWN */}

          <div className="p-6 transition border rounded-3xl border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200">

            <h3 className="mb-5 text-sm font-semibold text-slate-900">
              Rating Breakdown
            </h3>

            <div className="space-y-4">

              {[5, 4, 3, 2, 1].map((rating) => {

                const count =
                  ratingStats.count[rating];

                const percentage =
                  ratingStats.total > 0
                    ? (count / ratingStats.total) * 100
                    : 0;

                return (

                  <div
                    key={rating}
                    className="flex items-center gap-3"
                  >

                    <div className="flex items-center w-12 gap-1 text-xs font-medium text-slate-600">

                      <span>
                        {rating}
                      </span>

                      <Star
                        size={12}
                        fill="currentColor"
                        className="text-yellow-400"
                      />

                    </div>

                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-yellow-500 to-orange-400"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />

                    </div>

                    <span className="w-7 text-xs text-right text-slate-400">
                      {count}
                    </span>

                  </div>

                );
              })}

            </div>

          </div>

        </section>

        {/* =================================================
            SEARCH + FILTER
        ================================================= */}

        <section className="p-4 mb-6 transition border rounded-3xl border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-3 lg:flex-row">

            {/* SEARCH */}

            <div className="flex items-center flex-1 gap-3 px-4 py-3 border rounded-xl border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">

              <Search
                size={18}
                className="text-slate-400 shrink-0"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search reviews..."
                className="w-full text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
              />

            </div>

            {/* RATING FILTER */}

            <div className="relative">

              <Filter
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />

              <select
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(e.target.value)
                }
                className="w-full py-3 pl-9 pr-9 text-sm text-slate-600 border rounded-xl outline-none appearance-none border-slate-200 bg-slate-50 lg:w-40 focus:border-blue-400"
              >

                <option value="All">
                  All Ratings
                </option>

                <option value="5">
                  5 Stars
                </option>

                <option value="4">
                  4 Stars
                </option>

                <option value="3">
                  3 Stars
                </option>

                <option value="2">
                  2 Stars
                </option>

                <option value="1">
                  1 Star
                </option>

              </select>

              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />

            </div>

            {/* SORT */}

            <div className="relative">

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value)
                }
                className="w-full px-4 py-3 pr-9 text-sm text-slate-600 border rounded-xl outline-none appearance-none border-slate-200 bg-slate-50 lg:w-40 focus:border-blue-400"
              >

                <option value="Latest">
                  Latest
                </option>

                <option value="Highest">
                  Highest Rated
                </option>

                <option value="Lowest">
                  Lowest Rated
                </option>

              </select>

              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />

            </div>

          </div>

        </section>

        {/* =================================================
            REVIEW COUNT
        ================================================= */}

        <div className="flex items-center justify-between mb-4">

          <div>

            <h3 className="text-lg font-semibold text-slate-900">
              Recent Reviews
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {filteredReviews.length} review
              {filteredReviews.length !== 1
                ? "s"
                : ""}{" "}
              found
            </p>

          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">

            <MessageSquare size={14} />

            Mentor Feedback

          </div>

        </div>

        {/* =================================================
            REVIEWS
        ================================================= */}

        <section className="space-y-4">

          {filteredReviews.length === 0 ? (

            <div className="p-12 text-center border rounded-3xl border-slate-200 bg-white shadow-sm">

              <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50">

                <MessageSquare
                  size={30}
                  className="text-blue-500"
                />

              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                No Reviews Found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or filter.
              </p>

            </div>

          ) : (

            filteredReviews.map((review) => (

              <article
                key={review.id}
                className="p-5 transition-all duration-200 border rounded-3xl border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200"
              >

                {/* =================================================
                    REVIEW HEADER
                ================================================= */}

                <div className="flex items-start justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="flex items-center justify-center w-11 h-11 text-blue-600 border rounded-full bg-blue-50 border-blue-100">

                      <User size={19} />

                    </div>

                    <div>

                      <h3 className="text-sm font-semibold text-slate-900">
                        {review.name}
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {review.role}
                      </p>

                    </div>

                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-400">

                    <Clock3 size={13} />

                    {review.date}

                  </div>

                </div>

                {/* =================================================
                    RATING
                ================================================= */}

                <div className="flex flex-wrap items-center gap-3 mt-4">

                  <div className="flex gap-1">

                    {[1, 2, 3, 4, 5].map(
                      (star) => (

                        <Star
                          key={star}
                          size={16}
                          fill={
                            star <= review.rating
                              ? "currentColor"
                              : "none"
                          }
                          className={
                            star <= review.rating
                              ? "text-yellow-400"
                              : "text-slate-200"
                          }
                        />

                      )
                    )}

                  </div>

                  <span className="px-2.5 py-1 text-[11px] font-medium text-blue-600 rounded-lg bg-blue-50 border border-blue-100">

                    {review.session}

                  </span>

                </div>

                {/* =================================================
                    REVIEW TEXT
                ================================================= */}

                <p className="max-w-4xl mt-4 text-sm leading-6 text-slate-600">

                  "{review.review}"

                </p>

                {/* =================================================
                    ACTIONS
                ================================================= */}

                <div className="flex flex-wrap items-center gap-3 pt-4 mt-5 border-t border-slate-100">

                  {/* HELPFUL */}

                  <button
                    type="button"
                    onClick={() =>
                      handleHelpful(review.id)
                    }
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 transition border rounded-lg border-slate-200 bg-white hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100"
                  >

                    <ThumbsUp size={14} />

                    Helpful ({review.helpful})

                  </button>

                  {/* REPLIED */}

                  {review.replied ? (

                    <span className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 rounded-lg bg-emerald-50 border border-emerald-100">

                      <CheckCircle2 size={14} />

                      Replied

                    </span>

                  ) : (

                    <button
                      type="button"
                      onClick={() => {
                        setReplyId(review.id);
                        setReplyText("");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 transition border rounded-lg border-blue-100 bg-blue-50 hover:bg-blue-100"
                    >

                      <MessageSquare size={14} />

                      Reply

                    </button>

                  )}

                </div>

                {/* =================================================
                    REPLY BOX
                ================================================= */}

                {replyId === review.id && (

                  <div className="p-4 mt-4 border rounded-2xl border-blue-100 bg-blue-50/60">

                    <div className="flex items-center gap-2 mb-3">

                      <MessageSquare
                        size={15}
                        className="text-blue-500"
                      />

                      <span className="text-xs font-semibold text-slate-700">
                        Reply to {review.name}
                      </span>

                    </div>

                    <textarea
                      value={replyText}
                      onChange={(e) =>
                        setReplyText(e.target.value)
                      }
                      rows={3}
                      placeholder="Write a professional reply..."
                      className="w-full p-3 text-sm text-slate-800 border rounded-xl outline-none resize-none border-slate-200 bg-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />

                    <div className="flex justify-end gap-2 mt-3">

                      <button
                        type="button"
                        onClick={() => {
                          setReplyId(null);
                          setReplyText("");
                        }}
                        className="px-4 py-2 text-xs font-medium text-slate-500 transition rounded-lg hover:bg-white hover:text-slate-700"
                      >

                        Cancel

                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleReply(review.id)
                        }
                        disabled={!replyText.trim()}
                        className="px-4 py-2 text-xs font-semibold text-white transition rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >

                        Send Reply

                      </button>

                    </div>

                  </div>

                )}

              </article>

            ))

          )}

        </section>

      </main>

    </div>
  );
};

export default MentorReviews;