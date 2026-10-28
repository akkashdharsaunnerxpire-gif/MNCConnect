import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserRound,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  KeyRound,
  Loader2,
  Check,
  Globe,
} from "lucide-react";
import { saveSession } from "../../utils/auth";
import { LoadingContext } from "../../context/LoadingContext";
import { useAuth } from "../../context/AuthContext";
import { reconnectSocket } from "../../utils/socket";
import { COUNTRY_CODES } from "../../data/countryCodes";

// must include /api  (backend mounts auth at /api/auth)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const INTRO_MS = 1300;
const INTRO_KEY = "mnc_intro_seen";

const initialForm = {
  name: "",
  email: "",
  mobileNumber: "",
  countryCode: "+91",
  password: "",
  confirmPassword: "",
  otp: "",
};

// show the intro only once per browser session
const shouldShowIntro = () => {
  try {
    return !sessionStorage.getItem(INTRO_KEY);
  } catch {
    return true;
  }
};

export default function LoginRegister() {
  const navigate = useNavigate();
  const { start, stop } = useContext(LoadingContext);
  const { refresh } = useAuth();

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showIntro, setShowIntro] = useState(shouldShowIntro);

  const [showOtpBox, setShowOtpBox] = useState(false);
  const [otp, setOtp] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");

  const isRegister = mode === "register";

  // country list is static, so build the <option>s only once
  const countryOptions = useMemo(
    () =>
      COUNTRY_CODES.map((c) => (
        <option key={c.name} value={c.code}>
          {c.label}
        </option>
      )),
    [],
  );

  useEffect(() => {
    if (!showIntro) return undefined;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => setShowIntro(false), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setShowOtpBox(false);
    setIsEmailVerified(false);
    setOtp("");
    setOtpError("");
  };

  // SEND OTP (register only)
  const handleSendOtp = async () => {
    if (!form.email.trim()) {
      setOtpError("Please enter your email first.");
      return;
    }
    setSendingOtp(true);
    setOtpError("");
    try {
      const response = await fetch(`${API_URL}/auth/fresher/send-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      setShowOtpBox(true);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setSendingOtp(false);
    }
  };

  // VERIFY OTP (register only)
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpError("OTP must be 6 digits.");
      return;
    }
    setVerifyingOtp(true);
    setOtpError("");
    try {
      const response = await fetch(`${API_URL}/auth/fresher/verify-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), otp: otp.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid OTP");
      setIsEmailVerified(true);
      setShowOtpBox(false);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.email.trim() || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isRegister) {
      if (!form.name.trim()) return setError("Please enter your full name.");
      if (!form.mobileNumber.trim())
        return setError("Please enter your mobile number.");
      if (!/^[0-9]{10}$/.test(form.mobileNumber.trim()))
        return setError("Please enter a valid 10-digit mobile number.");
      if (form.password.length < 8)
        return setError("Password must contain at least 8 characters.");
      if (form.password !== form.confirmPassword)
        return setError("Passwords do not match.");

      // email verification is needed ONLY while registering
      if (!isEmailVerified) {
        return setError(
          "Please verify your email address before creating an account.",
        );
      }
    }

    start();

    try {
      const endpoint = isRegister
        ? `${API_URL}/auth/fresher/register`
        : `${API_URL}/auth/fresher/login`;

      const body = isRegister
        ? {
            name: form.name.trim(),
            email: form.email.trim(),
            mobile: form.mobileNumber.trim(),
            countryCode: form.countryCode,
            password: form.password,
          }
        : { email: form.email.trim(), password: form.password };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      if (!data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      // ---------- REGISTER ----------
      if (isRegister) {
        if (data.requiresVerification) {
          setSuccess(data.message || "Please verify your email.");
          return;
        }

        if (data.user) {
          saveSession({ ...data.user, role: "fresher" });
          reconnectSocket();
        }

        // update AuthContext BEFORE navigating
        const me = await refresh();
        if (!me) {
          throw new Error(
            "Account created, but the session could not be started. Please login.",
          );
        }

        // reward popup is shown on the next page
        navigate("/Home", {
          replace: true,
          state: {
            showWelcomeReward: true,
            walletAmount: data.user?.walletBalance ?? 25,
          },
        });
        return;
      }

      // ---------- LOGIN ----------
      if (data.user) {
        saveSession({ ...data.user, role: "fresher" });
        reconnectSocket();
      }

      // update AuthContext BEFORE navigating
      const me = await refresh();
      if (!me) {
        // login API said OK but /auth/me says not logged in
        // = cookie was not saved / not sent (see checklist)
        throw new Error(
          "Login worked but your session was not saved. Please enable cookies and try again.",
        );
      }

      setSuccess("Login successful!");
      navigate("/Home", { replace: true });
    } catch (authError) {
      console.error("Authentication error:", authError);
      setError(authError.message || "Unable to connect to the server.");
    } finally {
      stop();
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition duration-300 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 selection:bg-cyan-100 selection:text-slate-900">
      {/* Background (radial gradients instead of heavy blur filters = fast paint) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-40 -top-36 h-[28rem] w-[28rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(37,99,235,0.20) 0%, rgba(37,99,235,0) 70%)",
          }}
        />
        <div
          className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0) 70%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.2)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 rounded-xl text-left"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20 transition duration-300 group-hover:rotate-3 group-hover:scale-105">
            <GraduationCap className="h-6 w-6 text-white" />
          </span>
          <span>
            <span className="block text-lg font-black tracking-tight">
              MNC<span className="text-cyan-600">CONNECT</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Your career network
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to home</span>
          <span className="sm:hidden">Home</span>
        </button>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-7xl items-start gap-12 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:px-12 lg:pb-16">
        <section className="hidden lg:block pt-0">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-700">
            <Sparkles className="h-4 w-4" /> Built for the next generation
          </div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-tight xl:text-6xl">
            Your next big
            <span className="mt-2 block bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
              opportunity starts here.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
            Connect with MNC Employees, discover career opportunities, and build
            the future you want — one step at a time.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <p className="font-bold">Learn from MNC Employees</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Get guidance from experienced professionals.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="font-bold">Grow with confidence</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Keep your career journey in one place.
              </p>
            </div>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-[490px]"
          style={{
            animation: "mncCardEnter .45s cubic-bezier(.2,.8,.2,1) both",
          }}
        >
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="hidden lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-700">
                Fresher portal
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === "login"
                  ? "Pick up where your career journey left off."
                  : "Join the MNCConnect fresher community."}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "login" ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "register" ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
              >
                Create account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {isRegister && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-700">
                    Full name
                  </span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      placeholder="Enter your full name"
                      className={inputClass}
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-700">
                  Email address
                </span>
                <div className="relative flex items-center">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      updateForm("email", e.target.value);
                      setIsEmailVerified(false);
                    }}
                    placeholder="you@example.com"
                    className={`${inputClass} ${isRegister ? "pr-24" : ""}`}
                    disabled={isRegister && isEmailVerified}
                  />

                  {/* Verify button: REGISTER only */}
                  {isRegister && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {isEmailVerified ? (
                        <span className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-bold text-emerald-600">
                          <Check size={14} /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={sendingOtp}
                          className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50"
                        >
                          {sendingOtp ? "Sending..." : "Verify"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isRegister && showOtpBox && !isEmailVerified && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-2">
                    <KeyRound size={16} className="ml-1 text-cyan-600" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setOtpError("");
                      }}
                      placeholder="Enter 6-digit OTP"
                      className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-cyan-600/50"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || otp.length !== 6}
                      className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {verifyingOtp ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </button>
                  </div>
                )}
                {isRegister && otpError && (
                  <p className="mt-1 text-xs text-red-600">{otpError}</p>
                )}
              </label>

              {isRegister && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-700">
                    Mobile number
                  </span>
                  <div className="flex gap-2">
                    <div className="relative">
                      <select
                        value={form.countryCode}
                        onChange={(e) =>
                          updateForm("countryCode", e.target.value)
                        }
                        className="w-32 appearance-none rounded-2xl border border-slate-200 bg-white py-3.5 pl-9 pr-6 text-sm font-medium text-slate-900 outline-none transition duration-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      >
                        {countryOptions}
                      </select>
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.mobileNumber}
                      onChange={(e) =>
                        updateForm(
                          "mobileNumber",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="Enter 10-digit number"
                      className={`${inputClass} flex-1`}
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-700">
                  Password
                </span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                    placeholder={
                      isRegister ? "At least 8 characters" : "Enter password"
                    }
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              {isRegister && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-700">
                    Confirm password
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) =>
                        updateForm("confirmPassword", e.target.value)
                      }
                      placeholder="Re-enter password"
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>
              )}

              <button
                type="submit"
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-4 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                {mode === "login"
                  ? "Login to your account"
                  : "Create fresher account"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </section>
      </main>

      {showIntro && (
        <div className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden">
          <div
            className="absolute inset-0 bg-white"
            style={{
              animation: `mncCurtain ${INTRO_MS}ms ease-out forwards`,
              willChange: "opacity",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              style={{
                animation: `mncZoom ${INTRO_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
                willChange: "transform, opacity",
              }}
            >
              <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-[clamp(30px,10vw,120px)] font-black leading-none tracking-[-0.12em] text-transparent">
                MNC
              </div>
            </div>
          </div>
        </div>
      )}

      {/* all keyframes in one place */}
      <style>{`
        @keyframes mncZoom { 0% { transform: scale(.85); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes mncCurtain { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes mncCardEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}