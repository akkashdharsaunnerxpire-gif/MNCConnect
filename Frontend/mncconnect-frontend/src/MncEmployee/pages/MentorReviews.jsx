import React, { useMemo, useState } from "react";
import {
  Star, MessageSquare, Search, User, Filter, ChevronDown, CheckCircle2, Clock3, Loader2, Radio,
} from "lucide-react";
import useLive from "../../hooks/useLive";
import { api, ENDPOINTS, EVENTS, timeAgo } from "../../services/mentorApi";

const MentorReviews = () => {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Latest");
  const [replyId, setReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");

  const { data, loading, error, connected, reload } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
    pollMs: 60000,
  });

  const reviews = useMemo(
    () =>
      (data?.reviews || []).map((r) => ({
        id: r._id || r.id,
        name: r.fresherName || "Fresher",
        role: r.fresherRole || "Fresher",
        rating: Number(r.rating) || 0,
        createdAt: r.createdAt,
        session: r.session || "Mentoring session",
        review: r.comment || "",
        reply: r.reply?.text || "",
      })),
    [data]
  );

  const stats = useMemo(() => {
    const total = reviews.length;
    const count = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => { if (count[r.rating] !== undefined) count[r.rating] += 1; });
    const average = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { total, count, average: average.toFixed(1) };
  }, [reviews]);

  const filtered = useMemo(() => {
    let list = [...reviews];
    const kw = search.toLowerCase().trim();
    if (kw) {
      list = list.filter((r) =>
        [r.name, r.role, r.session, r.review].some((v) => String(v).toLowerCase().includes(kw))
      );
    }
    if (ratingFilter !== "All") list = list.filter((r) => r.rating === Number(ratingFilter));
    if (sortBy === "Highest") list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "Lowest") list.sort((a, b) => a.rating - b.rating);
    else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [reviews, search, ratingFilter, sortBy]);

  const sendReply = async (id) => {
    if (!replyText.trim()) return;
    setSending(true);
    setReplyError("");
    try {
      await api(ENDPOINTS.reviewReply(id), { method: "POST", body: { text: replyText.trim() } });
      setReplyId(null);
      setReplyText("");
      reload();
    } catch (e) {
      setReplyError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Mentor Workspace</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Your Reviews</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            New reviews appear the moment a fresher posts them.
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}>
              <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error} <button onClick={reload} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}

        <section className="mb-7 grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-5xl font-bold text-slate-900">{stats.average}</div>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={20} fill={s <= Math.round(Number(stats.average)) ? "currentColor" : "none"} className="text-yellow-400" />
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">Based on {stats.total} review{stats.total !== 1 ? "s" : ""}</p>
            {stats.total >= 3 && Number(stats.average) >= 4.5 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={15} /> Trusted Mentor
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-sm font-semibold text-slate-900">Rating Breakdown</h3>
            <div className="space-y-4">
              {[5, 4, 3, 2, 1].map((rating) => {
                const c = stats.count[rating];
                const pct = stats.total ? (c / stats.total) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex w-12 items-center gap-1 text-xs font-medium text-slate-600">
                      <span>{rating}</span><Star size={12} fill="currentColor" className="text-yellow-400" />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-7 text-right text-xs text-slate-400">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reviews..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 lg:w-40"
              >
                <option value="All">All Ratings</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative">
              <select
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 lg:w-40"
              >
                <option value="Latest">Latest</option>
                <option value="Highest">Highest Rated</option>
                <option value="Lowest">Lowest Rated</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </section>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Reviews</h3>
          <p className="mt-1 text-xs text-slate-500">{filtered.length} review{filtered.length !== 1 ? "s" : ""} found</p>
        </div>

        <section className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <MessageSquare size={30} className="text-blue-500" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                {reviews.length === 0 ? "No reviews yet" : "No reviews found"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {reviews.length === 0
                  ? "Reviews from freshers will appear here as soon as they are posted."
                  : "Try changing your search or filter."}
              </p>
            </div>
          ) : (
            filtered.map((r) => (
              <article key={r.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                      <User size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{r.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{r.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400"><Clock3 size={13} />{timeAgo(r.createdAt)}</div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={16} fill={s <= r.rating ? "currentColor" : "none"} className={s <= r.rating ? "text-yellow-400" : "text-slate-200"} />
                    ))}
                  </div>
                  <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600">{r.session}</span>
                </div>

                {r.review && <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-600">"{r.review}"</p>}

                {r.reply && (
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Your reply</p>
                    <p className="text-sm leading-6 text-slate-600">{r.reply}</p>
                  </div>
                )}

                {!r.reply && replyId !== r.id && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => { setReplyId(r.id); setReplyText(""); setReplyError(""); }}
                      className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                    >
                      <MessageSquare size={14} /> Reply
                    </button>
                  </div>
                )}

                {replyId === r.id && (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <MessageSquare size={15} className="text-blue-500" />
                      <span className="text-xs font-semibold text-slate-700">Reply to {r.name}</span>
                    </div>
                    <textarea
                      value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} maxLength={1000}
                      placeholder="Write a professional reply..."
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    {replyError && <p className="mt-2 text-xs text-red-600">{replyError}</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => { setReplyId(null); setReplyText(""); }} className="rounded-lg px-4 py-2 text-xs font-medium text-slate-500 hover:bg-white">Cancel</button>
                      <button
                        type="button" onClick={() => sendReply(r.id)} disabled={!replyText.trim() || sending}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sending && <Loader2 size={13} className="animate-spin" />} Send Reply
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
