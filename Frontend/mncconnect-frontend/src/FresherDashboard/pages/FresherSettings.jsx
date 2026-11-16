import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Palette, ShieldCheck, Lock, Bell, KeyRound, LogOut, Loader2, Check, X,
  AlertTriangle, Wallet, CalendarDays, ArrowRight, Download, Trash2, Eye, UserCircle, Pencil,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../Commoncomponents/ThemeToggle";
import { REQUIRED_PERCENT, getRawAvatarUrl, getProfileStatus } from "../../utils/profileCompletion";

const API = import.meta?.env?.VITE_API_URL || "http://localhost:5000/api";
const ENDPOINTS = {
  ME: `${API}/auth/me`,
  UPDATE: `${API}/auth/update`,
  LOGOUT: `${API}/auth/logout`,
  DELETE: `${API}/auth/account`, // DELETE -> removes the account (backend needed)
};
const jsonHeaders = { "Content-Type": "application/json" };

const DEFAULT_SETTINGS = {
  privacy: { profileVisibility: "mentors", showEmail: false, showPhone: false, showLocation: true, allowMessages: true },
  notifications: { bookingUpdates: true, sessionReminders: true, refunds: true, chatMessages: true, promotions: false, emailDigest: false },
};

const mergeSettings = (s = {}) => ({
  privacy: { ...DEFAULT_SETTINGS.privacy, ...(s.privacy || {}) },
  notifications: { ...DEFAULT_SETTINGS.notifications, ...(s.notifications || {}) },
});

const BTN_PRIMARY = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_OUTLINE = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";
const CARD = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "booking", label: "Booking & shortcuts", icon: ShieldCheck },
  { id: "security", label: "Account & security", icon: KeyRound },
];

/* ---------- small parts ---------- */
const Switch = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
  </button>
);

const Row = ({ title, desc, children }) => (
  <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
    </div>
    {children}
  </div>
);

const Panel = ({ icon: Icon, title, subtitle, children }) => (
  <section className={CARD}>
    <div className="mb-5">
      <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={18} /></span>
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
    </div>
    <div className="divide-y divide-slate-100">{children}</div>
  </section>
);

const Shortcut = ({ to, icon: Icon, title, desc }) => (
  <Link to={to} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-slate-50">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={18} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      <span className="block truncate text-xs text-slate-500">{desc}</span>
    </span>
    <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
  </Link>
);

/* ---------- page ---------- */
const FresherSettings = () => {
  const navigate = useNavigate();
  const { logout, refresh } = useAuth();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [section, setSection] = useState("appearance");
  const [toast, setToast] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(ENDPOINTS.ME, { credentials: "include", headers: jsonHeaders });
        if (r.status === 401) return navigate("/login", { replace: true });
        const d = await r.json();
        const u = d?.user ?? d;
        setUser(u);
        setSettings(mergeSettings(u?.settings));
      } catch { showToast("error", "Could not load settings."); }
    })();
  }, [navigate, showToast]);

  // optimistic save, rolls back if the server refuses
  const update = async (group, key, value) => {
    const previous = settings;
    const next = { ...settings, [group]: { ...settings[group], [key]: value } };
    setSettings(next);
    try {
      const r = await fetch(ENDPOINTS.UPDATE, { method: "PATCH", credentials: "include", headers: jsonHeaders, body: JSON.stringify({ settings: next }) });
      if (!r.ok) throw new Error();
      showToast("success", "Saved.");
    } catch {
      setSettings(previous);
      showToast("error", "Could not save. Try again.");
    }
  };

  const profile = useMemo(() => getProfileStatus(user, { hasPhoto: Boolean(getRawAvatarUrl(user)) }), [user]);
  const percent = Math.max(0, Math.min(100, Number(profile?.percent) || 0));
  const missing = Array.isArray(profile?.missing) ? profile.missing : [];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (typeof logout === "function") await logout();
      else {
        const r = await fetch(ENDPOINTS.LOGOUT, { method: "POST", credentials: "include", headers: jsonHeaders });
        if (!r.ok) throw new Error();
        if (typeof refresh === "function") await refresh();
      }
      navigate("/login", { replace: true });
    } catch { showToast("error", "Could not log out. Try again."); setLoggingOut(false); }
  };

  const downloadData = () => {
    const { password, token, ...safe } = user || {};
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-mncconnect-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const p = settings.privacy;
  const n = settings.notifications;

  const VIS = [
    ["public", "Everyone", "Any logged-in user can view"],
    ["mentors", "Mentors only", "Only mentors you book with"],
    ["private", "Only me", "Hidden from everyone"],
  ];

  return (
    <div className="min-h-screen bg-[#f4f7f9] pb-20">
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Manage privacy, notifications and your account.</p>
          </div>
          <Link to="/Home/profile" className={BTN_OUTLINE}><ArrowLeft size={15} /> Profile</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
          {/* NAV */}
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] lg:sticky lg:top-24 lg:flex-col lg:self-start [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${section === id ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-6">

              {section === "appearance" && (
                <Panel icon={Palette} title="Appearance" subtitle="Choose how MNCConnect looks. Saved on this device.">
                  <div className="pt-1"><ThemeToggle /></div>
                </Panel>
              )}

              {section === "privacy" && (
                <>
                  <Panel icon={Eye} title="Profile visibility" subtitle="Control who can see your profile.">
                    <div className="grid gap-3 pt-1 sm:grid-cols-3">
                      {VIS.map(([val, title, desc]) => (
                        <button key={val} type="button" onClick={() => update("privacy", "profileVisibility", val)}
                          className={`rounded-xl border p-4 text-left transition ${p.profileVisibility === val ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-slate-200 hover:bg-slate-50"}`}>
                          <span className="flex items-center justify-between text-sm font-semibold text-slate-900">{title}{p.profileVisibility === val && <Check size={15} className="text-blue-600" />}</span>
                          <span className="mt-1 block text-xs text-slate-500">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </Panel>

                  <Panel icon={Lock} title="What mentors can see" subtitle="Hide details you don't want to share.">
                    <Row title="Show email" desc="Visible on your profile card"><Switch checked={p.showEmail} onChange={(v) => update("privacy", "showEmail", v)} label="Show email" /></Row>
                    <Row title="Show phone number" desc="Visible after a session is booked"><Switch checked={p.showPhone} onChange={(v) => update("privacy", "showPhone", v)} label="Show phone" /></Row>
                    <Row title="Show location"><Switch checked={p.showLocation} onChange={(v) => update("privacy", "showLocation", v)} label="Show location" /></Row>
                    <Row title="Allow chat messages" desc="Mentors can message you before a session"><Switch checked={p.allowMessages} onChange={(v) => update("privacy", "allowMessages", v)} label="Allow messages" /></Row>
                  </Panel>

                  <Panel icon={Download} title="Your data">
                    <Row title="Download my data" desc="Get a copy of your profile as a JSON file">
                      <button onClick={downloadData} disabled={!user} className={BTN_OUTLINE}><Download size={15} /> Download</button>
                    </Row>
                  </Panel>
                </>
              )}

              {section === "notifications" && (
                <Panel icon={Bell} title="Notifications" subtitle="Choose which updates you receive.">
                  <Row title="Booking updates" desc="Confirmed, rescheduled or cancelled sessions"><Switch checked={n.bookingUpdates} onChange={(v) => update("notifications", "bookingUpdates", v)} label="Booking updates" /></Row>
                  <Row title="Session reminders" desc="Reminder before your session starts"><Switch checked={n.sessionReminders} onChange={(v) => update("notifications", "sessionReminders", v)} label="Session reminders" /></Row>
                  <Row title="Refunds and wallet" desc="Refund status and bonus credits"><Switch checked={n.refunds} onChange={(v) => update("notifications", "refunds", v)} label="Refunds" /></Row>
                  <Row title="Chat messages" desc="New messages from mentors"><Switch checked={n.chatMessages} onChange={(v) => update("notifications", "chatMessages", v)} label="Chat messages" /></Row>
                  <Row title="Weekly email digest" desc="A summary of your activity"><Switch checked={n.emailDigest} onChange={(v) => update("notifications", "emailDigest", v)} label="Email digest" /></Row>
                  <Row title="Offers and tips" desc="Product news and promotions"><Switch checked={n.promotions} onChange={(v) => update("notifications", "promotions", v)} label="Promotions" /></Row>
                </Panel>
              )}

              {section === "booking" && (
                <>
                  <section className={CARD}>
                    <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck size={18} /></span>
                      Booking readiness
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">You need a profile photo and at least {REQUIRED_PERCENT}% of your details to book a session.</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{percent}% complete</span>
                      <span className={`font-semibold ${profile?.ok ? "text-emerald-600" : "text-amber-600"}`}>{profile?.ok ? "Ready to book" : "Not ready yet"}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all duration-500 ${profile?.ok ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${percent}%` }} />
                    </div>
                    {missing.length > 0 && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-800">Still missing</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-600">{missing.map((m) => <li key={m.key}>• {m.label}</li>)}</ul>
                        <Link to="/Home/profile" className={`${BTN_PRIMARY} mt-3`}><Pencil size={14} /> Complete my profile</Link>
                      </div>
                    )}
                  </section>

                  <section className={CARD}>
                    <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-slate-900">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserCircle size={18} /></span>
                      Quick links
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Shortcut to="/Home/bonus-wallet" icon={Wallet} title="Bonus wallet" desc="Balance, referral code" />
                      <Shortcut to="/Home/my-bookings" icon={CalendarDays} title="My bookings" desc="Upcoming and past sessions" />
                      <Shortcut to="/Home/notifications" icon={Bell} title="Notifications" desc="Booking updates, refunds" />
                      <Shortcut to="/Home/profile" icon={UserCircle} title="My profile" desc="Edit your details" />
                    </div>
                  </section>
                </>
              )}

              {section === "security" && (
                <>
                  <Panel icon={KeyRound} title="Account and security">
                    <Row title="Change password" desc={`We email a reset link to ${user?.email || "your email"}.`}>
                      <Link to="/forgot-password" className={BTN_OUTLINE}><KeyRound size={15} /> Reset</Link>
                    </Row>
                    <Row title="Log out" desc="Sign out of MNCConnect on this device.">
                      <button onClick={handleLogout} disabled={loggingOut}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                        {loggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Log out
                      </button>
                    </Row>
                  </Panel>

                  <section className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
                    <h2 className="flex items-center gap-2 text-base font-bold text-red-700"><AlertTriangle size={18} /> Danger zone</h2>
                    <p className="mt-2 text-sm text-slate-600">Deleting your account permanently removes your profile, bookings and wallet balance. This cannot be undone.</p>
                    <button onClick={() => setDeleteOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 size={15} /> Delete account
                    </button>
                  </section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {deleteOpen && <DeleteModal email={user?.email} onClose={() => setDeleteOpen(false)} onDeleted={() => navigate("/login", { replace: true })} showToast={showToast} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-6 right-6 z-[110]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
                {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} strokeWidth={3} />}
              </span>
              <p className="text-sm font-medium text-slate-800">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeleteModal = ({ email, onClose, onDeleted, showToast }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch(ENDPOINTS.DELETE, { method: "DELETE", credentials: "include", headers: jsonHeaders });
      if (!r.ok) throw new Error();
      onDeleted();
    } catch { showToast("error", "Could not delete account. Contact support."); setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <motion.div initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Delete account</h2>
          <button onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600">This will permanently delete <span className="font-semibold">{email}</span>. Type <span className="font-bold">DELETE</span> to confirm.</p>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE"
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10" />
        <div className="mt-5 flex gap-2.5">
          <button onClick={onClose} disabled={busy} className={`${BTN_OUTLINE} flex-1`}>Cancel</button>
          <button onClick={confirm} disabled={text !== "DELETE" || busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} Delete forever
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FresherSettings;