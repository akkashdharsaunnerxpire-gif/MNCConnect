import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const initialUserForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
};

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

export default function Auth({ closeModal = () => {}, isModal = false }) {
  const navigate = useNavigate();

  const [authChoice, setAuthChoice] = useState("choice");
  const [userMode, setUserMode] = useState("login");
  const [userForm, setUserForm] = useState(initialUserForm);

  const updateUser = (field, value) => {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleFresherSubmit = (event) => {
    event.preventDefault();

    if (
      userMode === "register" &&
      userForm.password !== userForm.confirmPassword
    ) {
      window.alert("Passwords do not match.");
      return;
    }

    closeModal();
    navigate("/user-dashboard");
  };

  const openEmployeeProfile = () => {
    closeModal();
    navigate("/employee-profile");
  };

  const goBackToChoice = () => {
    setAuthChoice("choice");
  };

  const switchMode = (mode) => {
    setUserMode(mode);

    // Prevent stale registration values from carrying into login.
    if (mode === "login") {
      setUserForm((current) => ({
        ...current,
        name: "",
        mobile: "",
        confirmPassword: "",
      }));
    }
  };

  if (authChoice === "choice") {
    return (
      <div className="w-full bg-white">
        <div className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-600">
                MNC CONNECT
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Choose your path
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
                One network. Two roles. Freshers connect with industry.
                MNC employees build professional influence.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAuthChoice("fresher")}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition duration-150 hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Users className="h-5 w-5" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-indigo-600" />
                </div>

                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                  PATH 01
                </p>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Fresher
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create your account, discover MNC professionals and book
                  1:1 video mentorship sessions.
                </p>

                <span className="mt-4 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                  Normal Account
                </span>
              </button>

              <button
                type="button"
                onClick={openEmployeeProfile}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition duration-150 hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-emerald-600" />
                </div>

                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  PATH 02
                </p>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  MNC Employee
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create your professional profile, submit employment proof
                  and enter the verification flow.
                </p>

                <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Professional Profile
                </span>
              </button>
            </div>

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[8px] font-bold tracking-[0.2em] text-slate-400">
                SECURE ENTRY
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                Fresher Account
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {userMode === "login"
                  ? "Welcome back"
                  : "Create your account"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Your fresher account is separate from MNC employee profiles.
              </p>
            </div>

            {isModal && (
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                userMode === "login"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                userMode === "register"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleFresherSubmit} className="mt-6 space-y-4">
            {userMode === "register" && (
              <input
                required
                value={userForm.name}
                onChange={(event) =>
                  updateUser("name", event.target.value)
                }
                placeholder="Full name"
                autoComplete="name"
                className={inputBase}
              />
            )}

            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  updateUser("email", event.target.value)
                }
                placeholder="Email address"
                autoComplete="email"
                className={`${inputBase} pl-10`}
              />
            </div>

            {userMode === "register" && (
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="tel"
                  value={userForm.mobile}
                  onChange={(event) =>
                    updateUser("mobile", event.target.value)
                  }
                  placeholder="Mobile number"
                  autoComplete="tel"
                  className={`${inputBase} pl-10`}
                />
              </div>
            )}

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                required
                type="password"
                value={userForm.password}
                onChange={(event) =>
                  updateUser("password", event.target.value)
                }
                placeholder="Password"
                autoComplete={
                  userMode === "login" ? "current-password" : "new-password"
                }
                className={`${inputBase} pl-10`}
              />
            </div>

            {userMode === "register" && (
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(event) =>
                    updateUser("confirmPassword", event.target.value)
                  }
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className={`${inputBase} pl-10`}
                />
              </div>
            )}

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition duration-150 hover:bg-indigo-700 active:translate-y-px"
            >
              {userMode === "login"
                ? "Login"
                : "Create Fresher Account"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goBackToChoice}
              className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Choose a different account type
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}