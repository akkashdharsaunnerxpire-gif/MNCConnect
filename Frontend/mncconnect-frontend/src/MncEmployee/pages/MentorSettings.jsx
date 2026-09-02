import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
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
} from "lucide-react";

const MentorSettings = () => {
  const navigate = useNavigate();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call can be added here later
      await new Promise((resolve) => setTimeout(resolve, 700));
      alert("Settings saved successfully!");
    } catch (error) {
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      alert("New password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      // API call can be added here
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      alert("Failed to update password.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mnc_mentor_token");
    navigate("/mentor/login", { replace: true });
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete your account? This action cannot be undone."
      )
    ) {
      // API call for account deletion
      alert("Account deletion request sent.");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5faff" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-[1100px] px-5 py-4 mx-auto sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/mentor/profile"
              className="flex items-center justify-center w-10 h-10 transition border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600"
            >
              <ArrowLeft size={19} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Settings</h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Manage your mentor account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white transition rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1100px] px-5 py-8 mx-auto sm:px-6 lg:px-8">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50">
              <Settings size={23} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Account Settings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Control your notifications, privacy and security.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <section className="mb-6 overflow-hidden bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="p-5 border-b border-slate-100 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50">
                <Bell size={19} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Choose how you want to receive updates.
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingToggle
              icon={<Mail size={18} />}
              title="Email Notifications"
              description="Receive important account updates through email."
              enabled={emailNotifications}
              onChange={setEmailNotifications}
            />
            <SettingToggle
              icon={<Smartphone size={18} />}
              title="Push Notifications"
              description="Get instant notifications about your account."
              enabled={pushNotifications}
              onChange={setPushNotifications}
            />
            <SettingToggle
              icon={<Bell size={18} />}
              title="Session Reminders"
              description="Receive reminders before scheduled sessions."
              enabled={sessionReminders}
              onChange={setSessionReminders}
            />
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-6 overflow-hidden bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="p-5 border-b border-slate-100 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50">
                <Eye size={19} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Privacy</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Control how freshers can discover you.
                </p>
              </div>
            </div>
          </div>
          <SettingToggle
            icon={<Eye size={18} />}
            title="Profile Visibility"
            description="Allow freshers to find your mentor profile."
            enabled={profileVisibility}
            onChange={setProfileVisibility}
          />
        </section>

        {/* Security */}
        <section className="mb-6 overflow-hidden bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="p-5 border-b border-slate-100 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50">
                <ShieldCheck size={19} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Security</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Keep your mentor account secure.
                </p>
              </div>
            </div>
          </div>
          <form onSubmit={handlePasswordChange} className="p-5 space-y-5 sm:p-6">
            <PasswordField
              label="Current Password"
              value={currentPassword}
              setValue={setCurrentPassword}
              show={showCurrent}
              setShow={setShowCurrent}
              placeholder="Enter current password"
            />
            <PasswordField
              label="New Password"
              value={newPassword}
              setValue={setNewPassword}
              show={showNew}
              setShow={setShowNew}
              placeholder="Minimum 8 characters"
            />
            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              setValue={setConfirmPassword}
              show={showConfirm}
              setShow={setShowConfirm}
              placeholder="Confirm new password"
            />
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                <Lock size={16} />
                Update Password
              </button>
            </div>
          </form>
        </section>

        {/* Account */}
        <section className="overflow-hidden bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="p-5 border-b border-slate-100 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100">
                <Settings size={18} className="text-slate-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Account</h3>
                <p className="mt-0.5 text-xs text-slate-400">Manage your account actions.</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3 sm:p-6">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-between w-full p-4 text-left transition border border-slate-100 rounded-xl bg-slate-50 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white border border-slate-100 rounded-xl">
                  <LogOut size={18} className="text-orange-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Logout</h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Sign out from your mentor account.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center justify-between w-full p-4 text-left transition border border-rose-100 rounded-xl bg-rose-50 hover:bg-rose-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white border border-rose-100 rounded-xl">
                  <Trash2 size={18} className="text-rose-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-rose-600">Delete Account</h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Permanently delete your mentor account.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400">MNCConnect Mentor Platform</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Your privacy and security matter to us.
          </p>
        </div>
      </main>
    </div>
  );
};

// Setting Toggle
// Sizing/position are set with inline styles (not Tailwind utility classes)
// so the switch renders at a fixed, correct size no matter how the host
// project's Tailwind is configured or purged.
const TOGGLE_WIDTH = 44;
const TOGGLE_HEIGHT = 24;
const KNOB_SIZE = 18;
const KNOB_MARGIN = 3;

const SettingToggle = ({ icon, title, description, enabled, onChange }) => {
  const knobTravel = TOGGLE_WIDTH - KNOB_SIZE - KNOB_MARGIN * 2;

  return (
    <div className="flex items-center justify-between gap-5 p-5 sm:p-6">
      <div className="flex items-center min-w-0 gap-3">
        <div className="flex items-center justify-center w-10 h-10 text-slate-500 rounded-xl bg-slate-50 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-slate-800">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        aria-label={title}
        style={{
          position: "relative",
          display: "inline-block",
          flexShrink: 0,
          width: TOGGLE_WIDTH,
          height: TOGGLE_HEIGHT,
          padding: 0,
          border: "none",
          borderRadius: TOGGLE_HEIGHT / 2,
          backgroundColor: enabled ? "#2563eb" : "#e2e8f0",
          cursor: "pointer",
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

// Password Field
const PasswordField = ({ label, value, setValue, show, setShow, placeholder }) => {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 transition border outline-none rounded-xl border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-0 top-0 flex items-center justify-center w-12 h-full text-slate-400 hover:text-slate-600"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

export default MentorSettings;