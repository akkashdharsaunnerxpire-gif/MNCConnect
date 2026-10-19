import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CalendarDays, CheckCheck, ChevronRight, IndianRupee, Loader2, Radio, Star, Video } from "lucide-react";
import useLive from "../../hooks/useLive";
import { api, ENDPOINTS, EVENTS, NOTIFICATIONS_CHANGED, getUserId, timeAgo } from "../../services/fresherApi";

const ICONS = { session: Video, payment: IndianRupee, review: Star, success: CalendarDays };

const Notifications = () => {
  const navigate = useNavigate();
  const userId = useMemo(() => getUserId(), []);
  const [filter, setFilter] = useState("all");

  const { data, loading, error, connected, reload, setData } = useLive({
    fetcher: () => api(ENDPOINTS.notifications),
    events: [EVENTS.notification],
    userId,
  });

  const items = useMemo(
    () => (data?.notifications || []).map((n) => ({ ...n, id: n.id || n._id })),
    [data]
  );
  const unread = items.filter((n) => !n.read).length;
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;

  const patch = (fn) => setData((d) => ({ ...(d || {}), notifications: (d?.notifications || []).map(fn) }));

  const open = async (n) => {
    if (!n.read) {
      patch((x) => ((x.id || x._id) === n.id ? { ...x, read: true } : x));
      api(ENDPOINTS.notificationRead(n.id), { method: "PATCH" })
        .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
        .catch(reload);
    }
    if (n.link) navigate(n.link);
  };

  const markAll = () => {
    patch((x) => ({ ...x, read: true }));
    api(ENDPOINTS.notificationsReadAll, { method: "PATCH" })
      .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
      .catch(reload);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center gap-4">
          <button type="button" onClick={() => navigate("/Home")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Notifications</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              Stay updated with your sessions.
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}><Radio size={12} />{connected ? "Live" : "Reconnecting…"}</span>
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[["all", "All"], ["unread", `Unread (${unread})`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === k ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>
            ))}
          </div>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              <CheckCheck size={17} /> Mark all as read
            </button>
          )}
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button onClick={reload} className="ml-2 font-semibold underline">Retry</button></div>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>
          ) : shown.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Bell size={30} /></div>
              <h2 className="text-lg font-bold text-slate-800">{filter === "unread" ? "No unread notifications" : "Nothing yet"}</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Booking updates, reminders and refunds show up here instantly.</p>
            </div>
          ) : (
            shown.map((n, i) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button key={n.id} type="button" onClick={() => open(n)}
                  className={`flex w-full gap-4 px-4 py-5 text-left transition sm:px-6 ${n.read ? "hover:bg-slate-50" : "bg-indigo-50/40 hover:bg-indigo-50/70"} ${i !== shown.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${n.read ? "bg-slate-100 text-slate-500" : "bg-indigo-100 text-indigo-600"}`}><Icon size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">{n.title}{!n.read && <span className="h-2 w-2 rounded-full bg-indigo-600" />}</h2>
                      <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">{n.message}</p>
                    {n.link && <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">Open <ChevronRight size={14} /></span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;