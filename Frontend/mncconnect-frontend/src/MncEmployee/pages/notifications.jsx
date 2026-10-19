import React, { useMemo, useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, Info, IndianRupee, Star, CalendarDays, AlertTriangle, Loader2, Radio } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useLive from "../../hooks/useLive";
import { api, ENDPOINTS, EVENTS, NOTIFICATIONS_CHANGED, timeAgo } from "../../services/mentorApi";

const STYLE = {
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  payment: { icon: IndianRupee, cls: "bg-emerald-50 text-emerald-600" },
  review: { icon: Star, cls: "bg-amber-50 text-amber-600" },
  session: { icon: CalendarDays, cls: "bg-blue-50 text-blue-600" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-600" },
  error: { icon: AlertTriangle, cls: "bg-red-50 text-red-600" },
  info: { icon: Info, cls: "bg-blue-50 text-blue-600" },
};

// Only follow in-app links. A link coming from the server must never send the mentor to another site.
const isInternalLink = (link) =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//");

const MentorNotifications = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const { data, loading, error, connected, reload, setData } = useLive({
    fetcher: () => api(ENDPOINTS.notifications),
    events: [EVENTS.notification],
  });

  const items = useMemo(
    () =>
      (data?.notifications || []).map((n) => ({
        id: n.id || n._id,
        title: n.title,
        message: n.message,
        type: n.type || "info",
        link: n.link || "",
        read: Boolean(n.read),
        createdAt: n.createdAt,
      })),
    [data]
  );

  const unread = items.filter((n) => !n.read).length;

  const patchLocal = (fn) =>
    setData((d) => ({ ...(d || {}), notifications: (d?.notifications || []).map(fn) }));

  const openNotification = async (n) => {
    if (!n.read) {
      patchLocal((x) => ((x.id || x._id) === n.id ? { ...x, read: true } : x)); // instant
      try {
        await api(ENDPOINTS.notificationRead(n.id), { method: "PATCH" });
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      } catch {
        reload(); // roll back to the server state
      }
    }
    if (isInternalLink(n.link)) navigate(n.link);
  };

  const markAll = async () => {
    setBusy(true);
    patchLocal((x) => ({ ...x, read: true }));
    try {
      await api(ENDPOINTS.notificationsReadAll, { method: "PATCH" });
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-5 md:p-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/mentor/home" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={17} /> Back to home
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Bell size={20} /></div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Notifications</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                Updates about your requests, sessions and payouts.
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}>
                  <Radio size={12} /> {connected ? "Live" : "Reconnecting…"}
                </span>
              </p>
            </div>
          </div>
          {unread > 0 && (
            <button onClick={markAll} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
              Mark all as read ({unread})
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error} <button onClick={reload} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Bell size={22} /></div>
            <h3 className="mt-4 font-semibold">You're all caught up</h3>
            <p className="mt-1 text-sm text-slate-500">New session bookings, payments and reviews show up here instantly.</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {items.map((n) => {
              const { icon: Icon, cls } = STYLE[n.type] || STYLE.info;
              return (
                <li key={n.id}>
                  {/* <button> may only contain inline content, so spans (not div / h3) go inside it */}
                  <button
                    type="button" onClick={() => openNotification(n)}
                    className={`flex w-full gap-4 border-b border-slate-100 p-5 text-left transition last:border-b-0 hover:bg-slate-50 md:p-6 ${n.read ? "" : "bg-blue-50/40"}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon size={20} /></span>
                    <span className="block min-w-0 flex-1">
                      <span className="flex justify-between gap-4">
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          {n.title}
                          {!n.read && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                        </span>
                        <span className="whitespace-nowrap text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="mt-1.5 block text-sm leading-6 text-slate-500">{n.message}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MentorNotifications;