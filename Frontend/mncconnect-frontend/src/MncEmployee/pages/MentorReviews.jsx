import React, { useMemo, useState } from "react";
import {
  Star,
  MessageSquare,
  Search,
  CheckCircle2,
  Loader2,
  Heart,
  CalendarClock,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import { api, ENDPOINTS, EVENTS } from "../../services/mentorApi";

/* ============================================================
   LINE CLAMP HELPERS (no Tailwind plugin needed)
============================================================ */

const clamp2 = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const clamp3 = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/* ============================================================
   ATTENDED DATE & TIME FORMATTER
   Output example: "12 Mar 2026 · 4:30 PM – 5:00 PM"
============================================================ */

const IST = "Asia/Kolkata";

const fmtDateIST = (d) =>
  d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });

const fmtTimeIST = (d) =>
  d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });

const formatSessionRange = (startsAt, endsAt, fallbackDate, fallbackTime) => {
  const start = startsAt ? new Date(startsAt) : null;

  // No real timestamp -> show the saved text as it is (no timezone guessing)
  if (!start || Number.isNaN(start.getTime())) {
    return [fallbackDate, fallbackTime].filter(Boolean).join(" · ");
  }

  const end = endsAt ? new Date(endsAt) : null;
  const endTime =
    end && !Number.isNaN(end.getTime()) ? ` – ${fmtTimeIST(end)}` : "";

  return `${fmtDateIST(start)} · ${fmtTimeIST(start)}${endTime}`;
};

/* ============================================================
   AVATAR (shows fresher profile photo, falls back to initial)
============================================================ */

const Avatar = ({ src, name, size = "h-11 w-11", ring = "border-slate-100" }) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || "Fresher"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${size} shrink-0 rounded-full border-2 ${ring} object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold uppercase text-blue-600`}
    >
      {name?.charAt(0) || "F"}
    </div>
  );
};

/* ============================================================
   SKELETON
============================================================ */

const Bone = ({ className = "" }) => (
  <div className={`rounded-md bg-slate-200 ${className}`} />
);

const ReviewCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
      <div className="flex items-center gap-3 md:w-56 md:shrink-0">
        <Bone className="h-11 w-11 !rounded-full" />
        <div className="space-y-2">
          <Bone className="h-3.5 w-28" />
          <Bone className="h-3 w-16" />
        </div>
      </div>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Bone key={i} className="h-3.5 w-3.5" />
        ))}
      </div>

      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3 w-1/3" />
      </div>

      <Bone className="h-10 w-24 !rounded-full" />
    </div>
  </div>
);

const ReviewsSkeleton = () => (
  <div className="min-h-screen bg-white">
    <main className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7 grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <div className="rounded-3xl border border-slate-200 p-6">
          <Bone className="mx-auto h-12 w-24" />
          <Bone className="mx-auto mt-3 h-5 w-32" />
        </div>

        <div className="rounded-3xl border border-slate-200 p-6">
          <Bone className="mb-5 h-4 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="mb-4 h-3 w-full" />
          ))}
        </div>
      </section>

      <Bone className="mb-6 h-8 w-48" />

      <section className="space-y-4">
        {[0, 1, 2].map((i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </section>
    </main>
  </div>
);

/* ============================================================
   FIVE STAR MARQUEE
============================================================ */

// Marquee shows only when there are MANY real 5-star reviews
const MARQUEE_MIN_REVIEWS = 6;

const FiveStarMarquee = ({ reviews }) => {
  const fiveStarReviews = reviews.filter(
    (review) => Number(review.rating) === 5
  );

  if (fiveStarReviews.length < MARQUEE_MIN_REVIEWS) return null;

  // two identical halves -> translateX(-50%) loops seamlessly
  const items = [...fiveStarReviews, ...fiveStarReviews];

  return (
    <section className="mb-8 overflow-hidden">
      <style>{`
        @keyframes review-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        .review-marquee-track {
          display: flex;
          width: max-content;
          animation: review-marquee 40s linear infinite;
          will-change: transform;
        }

        .review-marquee:hover .review-marquee-track {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .review-marquee-track {
            animation: none;
          }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Loved by Freshers
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Highlights from 5-star session experiences
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-2">
          <Star size={14} fill="currentColor" className="text-amber-400" />

          <span className="text-xs font-semibold text-amber-700">
            5 Star Reviews
          </span>
        </div>
      </div>

      <div className="review-marquee relative">
        <div className="review-marquee-track gap-4">
          {items.map((review, index) => (
            <article
              key={`${review.id}-${index}`}
              className="w-[310px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={review.avatar}
                  name={review.name}
                  ring="border-blue-100"
                />

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-slate-900">
                    {review.name}
                  </h4>

                  <p className="truncate text-xs text-slate-500">
                    {review.role || "Fresher"}
                  </p>
                </div>

                <div className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                  5.0 ★
                </div>
              </div>

              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    fill="currentColor"
                    className="text-amber-400"
                  />
                ))}
              </div>

              <p
                className="mt-3 min-h-[60px] text-sm leading-5 text-slate-600"
                style={clamp3}
              >
                "{review.review}"
              </p>

              <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-blue-600">
                {review.session || "Session"}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ============================================================
   REVIEW CARD  (SINGLE ROW LAYOUT)
   Profile -> Stars + Rating -> Description -> Heart (last)
============================================================ */

const ReviewCard = ({ review, onLike, likeLoading }) => {
  const liked = Boolean(review.liked);
  const count = Number(review.likesCount || 0);

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:px-5">
      {/* SINGLE ROW */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        {/* 1. PROFILE */}
        <div className="flex min-w-0 items-center gap-3 md:w-56 md:shrink-0">
          <Avatar src={review.avatar} name={review.name} />

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {review.name}
            </h3>
            <p className="truncate text-xs text-slate-500">
              {review.role || "Fresher"}
            </p>
          </div>
        </div>

        {/* 2. RATING */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                fill={star <= review.rating ? "currentColor" : "none"}
                className={
                  star <= review.rating ? "text-amber-400" : "text-slate-200"
                }
              />
            ))}
          </div>

          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
            {review.rating.toFixed(1)}
          </span>
        </div>

        {/* 3. DESCRIPTION (+ session & time) */}
        <div className="min-w-0 flex-1">
          <p
            className="break-words text-sm leading-5 text-slate-600"
            style={clamp2}
            title={review.review}
          >
            {review.review || "No written feedback."}
          </p>

          <p className="mt-1 truncate text-xs">
            <span className="font-medium text-blue-600">
              {review.session || "Session"}
            </span>
          </p>

          {review.attendedAt && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
              <CalendarClock size={12} className="shrink-0 text-slate-400" />
              <span>Attended: {review.attendedAt}</span>
            </p>
          )}
        </div>

        {/* 4. HEART LIKE (LAST) */}
        <button
          type="button"
          onClick={() => onLike(review)}
          disabled={likeLoading}
          aria-pressed={liked}
          aria-label={liked ? "Unlike review" : "Like review"}
          className={`group/like inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border px-4 py-2 transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 md:self-center ${
            liked
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
          }`}
        >
          {likeLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Heart
              size={17}
              fill={liked ? "currentColor" : "none"}
              className={`transition-transform duration-200 ${
                liked ? "scale-110" : "group-hover/like:scale-110"
              }`}
            />
          )}

          <span className="text-xs font-semibold">
            {liked ? "Liked" : "Like"}
          </span>

          <span className="text-xs tabular-nums">{count}</span>
        </button>
      </div>

      {/* REPLY (below the row) */}
      {review.reply && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-xs font-semibold text-blue-700">Your reply</p>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            {review.reply}
          </p>
        </div>
      )}
    </article>
  );
};

/* ============================================================
   MAIN PAGE
============================================================ */

const MentorReviews = () => {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Latest");

  const [likeLoading, setLikeLoading] = useState({});
  const [likeError, setLikeError] = useState("");

  const { data, loading, error, reload, setData } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
    pollMs: 60000,
  });

  /* REAL REVIEWS */

  const reviews = useMemo(
    () =>
      (data?.reviews || []).map((r) => ({
        id: r._id || r.id,
        name: r.fresherName || "Fresher",
        role: r.fresherRole || "Fresher",
        rating: Number(r.rating) || 0,
        createdAt: r.createdAt,
        session: r.session || "Session",

        // Session time (IST). Falls back to the review date if nothing else exists.
        attendedAt:
          formatSessionRange(
            r.sessionStartsAt || r.attendedAt || r.startsAt,
            r.sessionEndsAt || r.endsAt,
            r.sessionDate || r.booking?.date || r.date,
            r.sessionTime || r.booking?.time || r.time
          ) ||
          (r.createdAt ? fmtDateIST(new Date(r.createdAt)) : ""),

        review: r.comment || "",
        reply: r.reply?.text || "",
        avatar:
          r.fresherAvatar ||
          r.fresherProfileImage ||
          r.fresherProfilePicture ||
          r.fresherPhoto ||
          r.fresherImage ||
          r.avatar ||
          r.profileImage ||
          r.profilePicture ||
          r.photo ||
          r.image ||
          r.fresher?.avatar ||
          r.fresher?.profileImage ||
          r.fresher?.profilePicture ||
          r.fresher?.photo ||
          r.fresher?.image ||
          r.fresherId?.avatar ||
          r.fresherId?.profileImage ||
          r.fresherId?.profilePicture ||
          r.user?.avatar ||
          r.user?.profileImage ||
          "",

        likesCount: Number(
          r.likesCount ?? r.likedBy?.length ?? r.likes?.length ?? 0
        ),
        liked: Boolean(r.isLiked ?? r.likedByMentor ?? r.liked),
      })),
    [data]
  );

  /* RATING STATS */

  const stats = useMemo(() => {
    const total = reviews.length;
    const count = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((r) => {
      if (count[r.rating] !== undefined) {
        count[r.rating] += 1;
      }
    });

    const average = total
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    return {
      total,
      count,
      average: average.toFixed(1),
    };
  }, [reviews]);

  /* MARQUEE (real 5-star reviews only) */

  const marqueeReviews = useMemo(
    () => reviews.filter((r) => r.rating === 5),
    [reviews]
  );

  /* FILTER + SORT */

  const filtered = useMemo(() => {
    let list = [...reviews];

    const kw = search.toLowerCase().trim();

    if (kw) {
      list = list.filter((r) =>
        [r.name, r.role, r.session, r.review].some((v) =>
          String(v).toLowerCase().includes(kw)
        )
      );
    }

    if (ratingFilter !== "All") {
      list = list.filter((r) => r.rating === Number(ratingFilter));
    }

    if (sortBy === "Highest") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Lowest") {
      list.sort((a, b) => a.rating - b.rating);
    } else {
      list.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
    }

    return list;
  }, [reviews, search, ratingFilter, sortBy]);

  /* OPTIMISTIC LIKE / UNLIKE */

  const toggleReviewLike = async (review) => {
    if (!review?.id || likeLoading[review.id]) return;

    setLikeError("");

    const previousLiked = Boolean(review.liked);
    const previousCount = Number(review.likesCount || 0);

    const nextLiked = !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

    // Optimistic update
    setData((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        reviews: (previous.reviews || []).map((r) => {
          const id = r._id || r.id;

          if (id !== review.id) return r;

          return {
            ...r,
            likedByMentor: nextLiked,
            isLiked: nextLiked,
            likesCount: nextCount,
          };
        }),
      };
    });

    setLikeLoading((prev) => ({
      ...prev,
      [review.id]: true,
    }));

    try {
      // Backend toggle endpoint
      const result = await api(`/reviews/${review.id}/like`, {
        method: "POST",
      });

      // Sync with actual backend response
      if (
        result &&
        (typeof result.liked === "boolean" || result.likesCount != null)
      ) {
        setData((previous) => {
          if (!previous) return previous;

          return {
            ...previous,
            reviews: (previous.reviews || []).map((r) => {
              const id = r._id || r.id;

              if (id !== review.id) return r;

              const actualLiked =
                typeof result.liked === "boolean" ? result.liked : nextLiked;

              const actualCount =
                result.likesCount != null
                  ? Number(result.likesCount)
                  : nextCount;

              return {
                ...r,
                likedByMentor: actualLiked,
                isLiked: actualLiked,
                likesCount: actualCount,
              };
            }),
          };
        });
      }
    } catch (e) {
      // Rollback on failure
      setData((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          reviews: (previous.reviews || []).map((r) => {
            const id = r._id || r.id;

            if (id !== review.id) return r;

            return {
              ...r,
              likedByMentor: previousLiked,
              isLiked: previousLiked,
              likesCount: previousCount,
            };
          }),
        };
      });

      setLikeError(e.message || "Unable to update review like.");
    } finally {
      setLikeLoading((prev) => ({
        ...prev,
        [review.id]: false,
      }));
    }
  };

  if (loading && !data) {
    return <ReviewsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button onClick={reload} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {/* MARQUEE */}

        <FiveStarMarquee reviews={marqueeReviews} />

        {/* RATING SUMMARY */}

        <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* AVERAGE */}

          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-5xl font-bold text-slate-900">
              {stats.average}
            </div>

            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={20}
                  fill={
                    s <= Math.round(Number(stats.average))
                      ? "currentColor"
                      : "none"
                  }
                  className="text-yellow-400"
                />
              ))}
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Based on {stats.total} real review
              {stats.total !== 1 ? "s" : ""}
            </p>

            {stats.total >= 3 && Number(stats.average) >= 4.5 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={15} />
                Trusted Mentor
              </div>
            )}
          </div>

          {/* BREAKDOWN */}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-sm font-semibold text-slate-900">
              Rating Breakdown
            </h3>

            <div className="space-y-4">
              {[5, 4, 3, 2, 1].map((rating) => {
                const c = stats.count[rating];
                const pct = stats.total ? (c / stats.total) * 100 : 0;

                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex w-12 items-center gap-1 text-xs font-medium text-slate-600">
                      <span>{rating}</span>

                      <Star
                        size={12}
                        fill="currentColor"
                        className="text-yellow-400"
                      />
                    </div>

                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <span className="w-7 text-right text-xs text-slate-400">
                      {c}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* REVIEWS */}

        <section>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Fresher Reviews
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Feedback from freshers who attended your sessions.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {/* SEARCH */}

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reviews..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 sm:w-64"
                />
              </div>

              {/* RATING */}

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="All">All ratings</option>
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>

              {/* SORT */}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="Latest">Latest</option>
                <option value="Highest">Highest rating</option>
                <option value="Lowest">Lowest rating</option>
              </select>
            </div>
          </div>

          {likeError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <span>{likeError}</span>

              <button
                type="button"
                onClick={() => setLikeError("")}
                className="font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* REVIEW LIST */}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <MessageSquare className="mx-auto text-slate-300" size={30} />

              <h3 className="mt-3 font-semibold text-slate-800">
                No reviews found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Reviews from your sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onLike={toggleReviewLike}
                  likeLoading={Boolean(likeLoading[review.id])}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MentorReviews;