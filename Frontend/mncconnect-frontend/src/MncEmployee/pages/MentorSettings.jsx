import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Bell,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  LogOut,
  Trash2,
  ChevronRight,
  Mail,
  Smartphone,
  Loader2,
  Check,
  AlertTriangle,
  X,
  CalendarCheck,
  MessageSquare,
  UserPlus,
  FileText,
  Wifi,
  Clock,
  KeyRound,
  MonitorSmartphone,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { performLogout } from "../../utils/logout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* ---------------------------------------------------------------------------
   BACKEND ROUTES used by this page. Change them here if your server uses
   different paths. Nothing else in the file needs to be touched.

   GET  settings  -> { settings: {...prefs}, passwordChangedAt: "ISO date" | null }
   PUT  settings  -> body = prefs object
   PUT  password  -> { currentPassword, newPassword }
                     (optional response: { passwordChangedAt: "ISO date" })
   POST logoutAll -> logs the account out of every device (optional route)
   DELETE account -> removes the account
--------------------------------------------------------------------------- */
const ROUTES = {
  settings: `${API_URL}/mentor/settings`,
  password: `${API_URL}/auth/change-password`,
  logoutAll: `${API_URL}/auth/logout-all`,
  deleteAccount: `${API_URL}/auth/account`,
};

const DEFAULT_PREFS = {
  // notifications
  emailNotifications: true,
  pushNotifications: true,
  sessionReminders: true,
  newRequestAlerts: true,
  messageAlerts: true,
  weeklySummary: false,
  // privacy + availability
  profileVisibility: true,
  acceptNewBookings: true,
  showOnlineStatus: true,
};

const PREF_KEYS = Object.keys(DEFAULT_PREFS);

const INPUT_CLASS =
  "w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm text-slate-800 caret-blue-600 outline-none placeholder:text-slate-400 transition focus:ring-2";

const errMsg = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

/* only keep the keys we know about, so extra server fields never get echoed back */
const pickPrefs = (source = {}) => {
  const out = { ...DEFAULT_PREFS };
  PREF_KEYS.forEach((key) => {
    if (typeof source[key] === "boolean") out[key] = source[key];
  });
  return out;
};

/* ---------- date helpers ---------- */
const formatDateTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const timeAgo = (iso, now = Date.now()) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""} ago`;
};

/* ---------- password strength ---------- */
const getStrength = (value) => {
  if (!value) return { score: 0, label: "", bar: "bg-slate-200" };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 2) return { score: 1, label: "Weak", bar: "bg-red-500" };
  if (score === 3) return { score: 2, label: "Okay", bar: "bg-amber-500" };
  if (score === 4) return { score: 3, label: "Good", bar: "bg-emerald-500" };
  return { score: 4, label: "Strong", bar: "bg-emerald-600" };
};

/* =========================================================================
   PAGE
========================================================================= */

const MentorSettings = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  /* ---------- toast ---------- */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* ---------- preferences (loaded from + saved to the server) ---------- */
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [savedPrefs, setSavedPrefs] = useState(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [passwordChangedAt, setPasswordChangedAt] = useState(null);

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(savedPrefs),
    [prefs, savedPrefs],
  );
  const setPref = (key) => (value) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let alive = true;
    axios
      .get(ROUTES.settings, { withCredentials: true })
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        const incoming = data.settings || data.preferences || {};
        const merged = pickPrefs(incoming);
        setPrefs(merged);
        setSavedPrefs(merged);
        setPasswordChangedAt(
          data.passwordChangedAt ||
            incoming.passwordChangedAt ||
            data.user?.passwordChangedAt ||
            null,
        );
      })
      .catch(() => {
        /* keep defaults: the page still works */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* warn before leaving the tab with unsaved changes */
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSavePrefs = async () => {
    if (savingPrefs || !dirty) return;
    setSavingPrefs(true);
    try {
      await axios.put(ROUTES.settings, prefs, { withCredentials: true });
      setSavedPrefs(prefs);
      showToast("success", "Settings saved.");
    } catch (err) {
      showToast("error", errMsg(err, "Could not save settings."));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleDiscard = () => setPrefs(savedPrefs);

  /* ---------- password ---------- */
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwShow, setPwShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwErrors, setPwErrors] = useState({});
  const [changingPw, setChangingPw] = useState(false);

  // re-render every minute so "x min ago" stays fresh
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const strength = getStrength(pw.next);

  const setPwField = (key) => (value) => {
    setPw((prev) => ({ ...prev, [key]: value }));
    setPwErrors((prev) => ({ ...prev, [key]: "" }));
  };
  const togglePw = (key) => () =>
    setPwShow((prev) => ({ ...prev, [key]: !prev[key] }));

  const validatePassword = () => {
    const errors = {};
    if (!pw.current) errors.current = "Enter your current password.";
    if (pw.next.length < 8) errors.next = "Use at least 8 characters.";
    else if (pw.next === pw.current)
      errors.next = "New password must be different from the current one.";
    if (pw.confirm !== pw.next) errors.confirm = "Passwords do not match.";
    return errors;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (changingPw) return;

    const errors = validatePassword();
    setPwErrors(errors);
    if (Object.keys(errors).length) return;

    setChangingPw(true);
    try {
      const res = await axios.put(
        ROUTES.password,
        { currentPassword: pw.current, newPassword: pw.next },
        { withCredentials: true },
      );

      // Use the server time if it sends one, otherwise stamp it right now.
      const serverStamp =
        res?.data?.passwordChangedAt ||
        res?.data?.user?.passwordChangedAt ||
        res?.data?.settings?.passwordChangedAt ||
        null;
      setPasswordChangedAt(serverStamp || new Date().toISOString());
      setNow(Date.now());

      setPw({ current: "", next: "", confirm: "" });
      setPwShow({ current: false, next: false, confirm: false });
      showToast("success", "Password updated.");
    } catch (err) {
      const message = errMsg(err, "Could not update password.");
      // wrong current password comes back as 400/401: show it on that field
      if ([400, 401, 403].includes(err?.response?.status)) {
        setPwErrors({ current: message });
      } else {
        showToast("error", message);
      }
    } finally {
      setChangingPw(false);
    }
  };

  /* ---------- logout (same flow as the profile page) ---------- */
  const [loggingOut, setLoggingOut] = useState(false);

  const leaveToLogin = async () => {
    try {
      await refresh(); // AuthContext -> logged out
    } catch {
      /* ignore */
    }
    navigate("/mentor/login", { replace: true });
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performLogout(); // server clears cookie + socket closes
    } catch {
      /* we still leave the page below */
    }
    await leaveToLogin();
  };

  /* ---------- log out of all devices ---------- */
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const handleLogoutAll = async () => {
    if (loggingOutAll) return;
    setLoggingOutAll(true);
    try {
      await axios.post(ROUTES.logoutAll, {}, { withCredentials: true });
      try {
        await performLogout();
      } catch {
        /* ignore */
      }
      await leaveToLogin();
    } catch (err) {
      showToast("error", errMsg(err, "Could not log out of all devices."));
      setLoggingOutAll(false);
    }
  };

  /* ---------- delete account ---------- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteText("");
  };

  useEffect(() => {
    if (!deleteOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !deleting) {
        setDeleteOpen(false);
        setDeleteText("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteOpen, deleting]);

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE" || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(ROUTES.deleteAccount, { withCredentials: true });
      try {
        await performLogout();
      } catch {
        /* ignore */
      }
      try {
        await refresh();
      } catch {
        /* ignore */
      }
      navigate("/", { replace: true });
    } catch (err) {
      showToast("error", errMsg(err, "Could not delete the account."));
      setDeleting(false);
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/mentor/profile"
              aria-label="Back to profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft size={19} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
                Settings
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Notifications, privacy and security
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {dirty && !savingPrefs && (
              <button
                type="button"
                onClick={handleDiscard}
                className="hidden rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:block"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={!dirty || savingPrefs || loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPrefs ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {savingPrefs ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Availability */}
        <Card
          icon={<CalendarCheck size={19} className="text-violet-600" />}
          tone="bg-violet-50"
          title="Availability"
          subtitle="Pause bookings without hiding your profile."
        >
          <SettingToggle
            icon={<UserPlus size={18} />}
            title="Accept new bookings"
            description="Turn off to stop new session requests while you are busy or away."
            enabled={prefs.acceptNewBookings}
            onChange={setPref("acceptNewBookings")}
            disabled={loading}
          />
        </Card>

        {/* Notifications */}
        <Card
          icon={<Bell size={19} className="text-blue-600" />}
          tone="bg-blue-50"
          title="Notifications"
          subtitle="Choose how you want to receive updates."
        >
          <div className="divide-y divide-slate-100">
            <SettingToggle
              icon={<Mail size={18} />}
              title="Email notifications"
              description="Important account updates by email."
              enabled={prefs.emailNotifications}
              onChange={setPref("emailNotifications")}
              disabled={loading}
            />
            <SettingToggle
              icon={<Smartphone size={18} />}
              title="Push notifications"
              description="Instant alerts on this device."
              enabled={prefs.pushNotifications}
              onChange={setPref("pushNotifications")}
              disabled={loading}
            />
            <SettingToggle
              icon={<UserPlus size={18} />}
              title="New session requests"
              description="Get notified when a fresher requests a session with you."
              enabled={prefs.newRequestAlerts}
              onChange={setPref("newRequestAlerts")}
              disabled={loading}
            />
            <SettingToggle
              icon={<MessageSquare size={18} />}
              title="New messages"
              description="Alerts when a fresher sends you a message."
              enabled={prefs.messageAlerts}
              onChange={setPref("messageAlerts")}
              disabled={loading}
            />
            <SettingToggle
              icon={<Clock size={18} />}
              title="Session reminders"
              description="A reminder before each scheduled session."
              enabled={prefs.sessionReminders}
              onChange={setPref("sessionReminders")}
              disabled={loading}
            />
            <SettingToggle
              icon={<FileText size={18} />}
              title="Weekly summary"
              description="One email each week with your sessions and earnings."
              enabled={prefs.weeklySummary}
              onChange={setPref("weeklySummary")}
              disabled={loading}
            />
          </div>
        </Card>

        {/* Privacy */}
        <Card
          icon={<Eye size={19} className="text-emerald-600" />}
          tone="bg-emerald-50"
          title="Privacy"
          subtitle="Control how freshers can find and see you."
        >
          <div className="divide-y divide-slate-100">
            <SettingToggle
              icon={<Eye size={18} />}
              title="Profile visibility"
              description="Let freshers find your mentor profile in search."
              enabled={prefs.profileVisibility}
              onChange={setPref("profileVisibility")}
              disabled={loading}
            />
            <SettingToggle
              icon={<Wifi size={18} />}
              title="Show online status"
              description="Let freshers see when you are online."
              enabled={prefs.showOnlineStatus}
              onChange={setPref("showOnlineStatus")}
              disabled={loading}
            />
          </div>
        </Card>

        {/* Security */}
        <Card
          icon={<ShieldCheck size={19} className="text-amber-600" />}
          tone="bg-amber-50"
          title="Change password"
          subtitle="Use a password you do not use anywhere else."
        >
          {/* Password last updated */}
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-amber-600">
                <KeyRound size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Password last updated
                </p>
                <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
                  {loading
                    ? "Checking…"
                    : passwordChangedAt
                      ? `${formatDateTime(passwordChangedAt)} (${timeAgo(
                          passwordChangedAt,
                          now,
                        )})`
                      : "You have not changed your password yet."}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handlePasswordChange}
            noValidate
            className="space-y-5 p-5 sm:p-6"
          >
            <PasswordField
              label="Current password"
              value={pw.current}
              onChange={setPwField("current")}
              show={pwShow.current}
              onToggle={togglePw("current")}
              placeholder="Enter current password"
              autoComplete="current-password"
              error={pwErrors.current}
            />

            <div>
              <PasswordField
                label="New password"
                value={pw.next}
                onChange={setPwField("next")}
                show={pwShow.next}
                onToggle={togglePw("next")}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={pwErrors.next}
              />
              {pw.next && (
                <div className="mt-2.5" aria-live="polite">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? strength.bar : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Strength: {strength.label}. Mix upper and lower case,
                    numbers and symbols.
                  </p>
                </div>
              )}
            </div>

            <PasswordField
              label="Confirm new password"
              value={pw.confirm}
              onChange={setPwField("confirm")}
              show={pwShow.confirm}
              onToggle={togglePw("confirm")}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              error={pwErrors.confirm}
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changingPw}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {changingPw ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Lock size={16} />
                )}
                {changingPw ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </Card>

        {/* Account */}
        <Card
          icon={<LogOut size={18} className="text-slate-500" />}
          tone="bg-slate-100"
          title="Account"
          subtitle="Sign out or remove your account."
        >
          <div className="space-y-3 p-5 sm:p-6">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut || loggingOutAll}
              className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:bg-slate-100 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white">
                  {loggingOut ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-orange-500"
                    />
                  ) : (
                    <LogOut size={18} className="text-orange-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {loggingOut ? "Logging out…" : "Log out"}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Sign out of your mentor account on this device.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={loggingOut || loggingOutAll}
              className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:bg-slate-100 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white">
                  {loggingOutAll ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-slate-500"
                    />
                  ) : (
                    <MonitorSmartphone size={18} className="text-slate-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {loggingOutAll ? "Logging out…" : "Log out of all devices"}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Use this if you think someone else has your password.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-rose-100 bg-rose-50 p-4 text-left transition hover:bg-rose-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-white">
                  <Trash2 size={18} className="text-rose-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-rose-600">
                    Delete account
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Permanently remove your account and data.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </div>
        </Card>
      </main>

      {/* Delete confirmation */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 text-slate-800 shadow-2xl [color-scheme:light] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <Trash2 size={20} className="text-rose-600" />
              </div>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={17} />
              </button>
            </div>

            <h2
              id="delete-title"
              className="mt-4 text-lg font-bold text-slate-900"
            >
              Delete your account?
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Your profile, sessions and earnings history will be removed. This
              cannot be undone.
            </p>

            <label
              htmlFor="delete-confirm"
              className="mt-5 block text-xs font-medium text-slate-500"
            >
              Type <span className="font-bold text-slate-800">DELETE</span> to
              confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              autoComplete="off"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 caret-rose-600 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteText !== "DELETE" || deleting}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 left-4 right-4 z-[110] sm:left-auto sm:right-6 sm:bottom-6"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5 sm:max-w-sm sm:px-5 sm:py-4">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {toast.type === "success" ? (
                <Check size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {toast.type === "success" ? "Done" : "Something went wrong"}
              </p>
              <p className="break-words text-xs text-slate-500">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   SMALL PARTS
========================================================================= */

const Card = ({ icon, tone, title, subtitle, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

// Toggle sizing/position use inline styles so the switch renders the same
// no matter how the host project's Tailwind is configured or purged.
const TOGGLE_WIDTH = 44;
const TOGGLE_HEIGHT = 24;
const KNOB_SIZE = 18;
const KNOB_MARGIN = 3;

const SettingToggle = ({
  icon,
  title,
  description,
  enabled,
  onChange,
  disabled = false,
}) => {
  const knobTravel = TOGGLE_WIDTH - KNOB_SIZE - KNOB_MARGIN * 2;

  return (
    <div className="flex items-center justify-between gap-5 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-800">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        style={{
          position: "relative",
          display: "inline-block",
          flexShrink: 0,
          width: TOGGLE_WIDTH,
          height: TOGGLE_HEIGHT,
          padding: 0,
          border: "none",
          borderRadius: TOGGLE_HEIGHT / 2,
          backgroundColor: enabled ? "#2563eb" : "#cbd5e1",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "background-color 0.2s ease",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: KNOB_MARGIN,
            left: KNOB_MARGIN,
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            transform: `translateX(${enabled ? knobTravel : 0}px)`,
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
};

const PasswordField = ({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
  error,
}) => (
  <div>
    <label className="mb-2 block text-sm font-medium text-slate-700">
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={`${INPUT_CLASS} ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
        }`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
    {error && (
      <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
        {error}
      </p>
    )}
  </div>
);

export default MentorSettings;