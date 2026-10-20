import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  Mail,
  CheckCircle2,
  Wallet,
  AlertCircle,
  Eye,
  EyeOff,
  UserRound,
  Sparkles,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { LoadingContext } from "../../context/LoadingContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const initialForm = {
  name: "",
  email: "",
  mobileNumber: "",
  password: "",
  confirmPassword: "",
};

const getCoinStorageKey = (email) =>
  email ? `fresherwallet_cash_${email.toLowerCase().trim()}` : null;

export default function Login() {
  const navigate = useNavigate();
  const loadingContext = useContext(LoadingContext);
  const setIsLoading = loadingContext?.setIsLoading || (() => {});

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReward, setShowReward] = useState(false);
  const [walletAmount, setWalletAmount] = useState(25);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 2650);
    return () => window.clearTimeout(timer);
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.email.trim() || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "register") {
      if (!form.name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (!form.mobileNumber.trim()) {
        setError("Please enter your mobile number.");
        return;
      }
      if (!/^[6-9]\d{9}$/.test(form.mobileNumber.trim())) {
        setError("Please enter a valid 10-digit Indian mobile number.");
        return;
      }
      if (form.password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint =
        mode === "register"
          ? `${API_URL}/auth/fresher/register`
          : `${API_URL}/auth/fresher/login`;

      const body =
        mode === "register"
          ? {
              name: form.name.trim(),
              email: form.email.trim(),
              mobile: form.mobileNumber.trim(),
              countryCode: "+91",
              password: form.password,
            }
          : { email: form.email.trim(), password: form.password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Something went wrong. Please try again.");
        return;
      }

      if (data.token) localStorage.setItem("fresher_token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      let firstLoginReward = false;
      if (data.user) {
        const email = data.user.email || form.email;
        const coinKey = getCoinStorageKey(email);
        if (coinKey && localStorage.getItem(coinKey) === null) {
          localStorage.setItem(coinKey, "25");
          setWalletAmount(25);
          firstLoginReward = true;
        }
      }

      setSuccess(
        mode === "register"
          ? "Account created successfully!"
          : "Login successful!",
      );

      if (firstLoginReward) {
        setShowReward(true);
        return;
      }

      window.setTimeout(() => {
        navigate(mode === "login" ? "/Home" : "/user-dashboard");
      }, 900);
    } catch (authError) {
      console.error("Authentication error:", authError);
      setError(
        "Unable to connect to the server. Please check whether your backend is running.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const continueAfterWallet = () => {
    setShowReward(false);
    navigate(mode === "login" ? "/Home" : "/user-dashboard");
  };

  const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition duration-300 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";
  return (
   <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 selection:bg-cyan-100 selection:text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-36 h-[28rem] w-[28rem] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-cyan-500/15 blur-[110px]" />
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
            <span className="block text-lg font-black tracking-tight">MNC<span className="text-cyan-600">CONNECT</span></span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Your career network</span>
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
            <Sparkles className="h-4 w-4" />
            Built for the next generation
          </div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-tight xl:text-6xl">
            Your next big
            <span className="mt-2 block bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
              opportunity starts here.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
            Connect with MNC Employees, discover career opportunities, and build the future you want — one step at a time.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-600"><GraduationCap className="h-5 w-5" /></div>
              <p className="font-bold">Learn from MNC Employees</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Get guidance from experienced professionals.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-700"><ShieldCheck className="h-5 w-5" /></div>
              <p className="font-bold">Grow with confidence</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Keep your career journey in one place.</p>
            </div>
          </div>
          <div className="mt-9 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex -space-x-2"><span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-600" /><span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-cyan-300 to-teal-600" /><span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-violet-400 to-pink-500" /></span>
            <span>Start building your professional future today</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[490px] animate-[cardEnter_.7s_cubic-bezier(.2,.8,.2,1)_both]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="mb-7 lg:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-700">Fresher account</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Your future starts here.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Sign in or create an account to continue.</p>
            </div>
            <div className="hidden lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-700">Fresher portal</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{mode === "login" ? "Pick up where your career journey left off." : "Join the MNCConnect fresher community."}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <button type="button" onClick={() => switchMode("login")} className={`rounded-xl px-3 py-3 text-sm font-bold transition duration-300 ${mode === "login" ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 hover:text-slate-900"}`}>Login</button>
              <button type="button" onClick={() => switchMode("register")} className={`rounded-xl px-3 py-3 text-sm font-bold transition duration-300 ${mode === "register" ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 hover:text-slate-900"}`}>Create account</button>
            </div>

            {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
            {success && <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Full name</span><div className="relative"><UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input required value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Enter your full name" autoComplete="name" className={inputClass} disabled={!!success} /></div></label>}

              <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Email address</span><div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input required type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="you@example.com" autoComplete="email" className={inputClass} disabled={!!success} /></div></label>

              {mode === "register" && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-700">Mobile number</span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.mobileNumber}
                    onChange={(e) => updateForm("mobileNumber", e.target.value.replace(/\\D/g, "").slice(0, 10))}
                    placeholder="Enter your 10-digit mobile number"
                    autoComplete="tel"
                    className={inputClass}
                    disabled={!!success}
                  />
                </label>
              )}

              <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Password</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input required type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputClass} pr-12`} disabled={!!success} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>

              {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Confirm password</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input required type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => updateForm("confirmPassword", e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" className={`${inputClass} pr-12`} disabled={!!success} /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>}

              {mode === "login" && <div className="flex justify-end"><button type="button" onClick={() => navigate("/forgot-password")} className="text-xs font-semibold text-cyan-700 transition hover:text-cyan-900">Forgot password?</button></div>}

              <button type="submit" disabled={!!success} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-blue-500 to-cyan-400 px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                {mode === "login" ? "Login to your account" : "Create fresher account"}
                <ArrowRight className="h-4 w-4 transition duration-300 group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-xs leading-5 text-slate-600">New fresher accounts may receive a <span className="font-bold text-amber-800">₹25 welcome wallet balance</span> after their first successful authentication.</p></div>
            <p className="mt-6 text-center text-[10px] leading-5 text-slate-500"><LockKeyhole className="mr-1 inline h-3 w-3" />Your account details are handled securely.</p>
          </div>
        </section>
      </main>

      {showReward && <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/35 px-5 backdrop-blur-md"><div className="w-full max-w-md animate-[cardEnter_.45s_ease-out_both] rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-2xl"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50"><Wallet className="h-10 w-10 text-emerald-300" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Welcome wallet</p><h2 className="mt-3 text-3xl font-black">Your journey starts with a reward.</h2><p className="mt-5 text-6xl font-black text-emerald-600">₹{walletAmount}</p><p className="mt-3 text-sm text-slate-600">Your welcome wallet balance has been initialized.</p><button type="button" onClick={continueAfterWallet} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-4 text-sm font-bold text-white transition hover:brightness-110">Enter MNCConnect<ArrowRight className="h-4 w-4" /></button></div></div>}

      {showIntro && (
        <div className="fixed inset-0 z-[10000] overflow-hidden" aria-label="MNCConnect intro animation">
          <div
            className="absolute inset-0 bg-white"
            style={{
              animation: "mncCurtain 2.65s cubic-bezier(.77,0,.18,1) forwards",
              willChange: "opacity",
              backfaceVisibility: "hidden",
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              animation: "mncFadeLayer 2.65s cubic-bezier(.77,0,.18,1) forwards",
              willChange: "opacity",
              backfaceVisibility: "hidden",
            }}
          >
            <div
              className="relative"
              style={{
                animation: "mncZoomFull 2.65s cubic-bezier(.77,0,.18,1) forwards",
                willChange: "transform, opacity, filter",
                transformOrigin: "center center",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div
                className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-[clamp(30px,10vw,120px)] font-black leading-none tracking-[-0.12em] text-transparent"
                style={{
                  filter: "drop-shadow(0 14px 50px rgba(37,99,235,.18))",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                MNC
              </div>
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                style={{
                  animation: "mncSheen 1.1s ease-out .3s forwards",
                  transform: "translateX(-120%)",
                  willChange: "transform, opacity",
                  backfaceVisibility: "hidden",
                }}
              />
            </div>
          </div>
          <div
            className="absolute left-1/2 top-[62%] flex -translate-x-1/2 items-center gap-2"
            style={{
              animation: "mncDots 1.9s ease-out forwards",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          </div>
          <style>{`
            @keyframes mncZoomFull {
              0% { transform: scale(.72); opacity: 0; filter: blur(7px); }
              16% { transform: scale(1); opacity: 1; filter: blur(0); }
              48% { transform: scale(1.04); opacity: 1; }
              100% { transform: scale(18); opacity: 0; }
            }
            @keyframes mncCurtain {
              0%, 54% { opacity: 1; }
              74% { opacity: .98; }
              100% { opacity: 0; }
            }
            @keyframes mncFadeLayer {
              0% { opacity: 1; }
              72% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes mncSheen {
              0% { opacity: 0; transform: translateX(-120%); }
              25% { opacity: .85; }
              100% { opacity: 0; transform: translateX(120%); }
            }
            @keyframes mncDots {
              0% { opacity: 0; transform: translate(-50%, 8px); }
              18% { opacity: 1; transform: translate(-50%, 0); }
              70% { opacity: 1; }
              100% { opacity: 0; transform: translate(-50%, -5px); }
            }
            @media (prefers-reduced-motion: reduce) {
              * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
