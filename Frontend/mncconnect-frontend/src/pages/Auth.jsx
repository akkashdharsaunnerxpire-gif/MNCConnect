import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  ChevronDown,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Users,
  X,
  Check,
} from "lucide-react";
import { LoadingContext } from "../App";

const initialUserForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
  countryCode: "+91",
};
const API_URL =
      import.meta.env.VITE_API_URL || "http://localhost:5000";

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

// Fallback country data if API fails
const FALLBACK_COUNTRIES = [
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+1", name: "USA", flag: "🇺🇸" },
  { code: "+44", name: "UK", flag: "🇬🇧" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
];

export default function Auth({ closeModal = () => {}, isModal = false }) {
  const navigate = useNavigate();
  const { setIsLoading } = useContext(LoadingContext);

  const [authChoice, setAuthChoice] = useState("choice");
  const [userMode, setUserMode] = useState("login");
  const [userForm, setUserForm] = useState(initialUserForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(FALLBACK_COUNTRIES[0]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const dropdownRef = useRef(null);

  // Fetch countries from API
  useEffect(() => {
  setCountries(FALLBACK_COUNTRIES);
  setSelectedCountry(FALLBACK_COUNTRIES[0]);
  setIsLoadingCountries(false);

  setUserForm((prev) => ({
    ...prev,
    countryCode: FALLBACK_COUNTRIES[0].code,
  }));
}, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateUser = (field, value) => {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setUserForm(prev => ({ ...prev, countryCode: country.code }));
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.includes(searchTerm)
  );

  const handleFresherSubmit = async (event) => {
  event.preventDefault();
  setErrorMessage("");
  setSuccessMessage("");

  if (
    userMode === "register" &&
    userForm.password !== userForm.confirmPassword
  ) {
    setErrorMessage("Passwords do not match.");
    return;
  }

  // Start loading - Linear progress shows
  setIsLoading(true);

  try {
  
    const endpoint =
      userMode === "register"
        ? `${API_URL}/api/auth/fresher/register`
        : `${API_URL}/api/auth/fresher/login`;

    // FIX: Send only the 10-digit mobile number, not with country code
    const body =
      userMode === "register"
        ? {
            name: userForm.name,
            email: userForm.email,
            mobile: userForm.mobile, // Send only 10-digit number
            countryCode: userForm.countryCode,
            password: userForm.password,
          }
        : {
            email: userForm.email,
            password: userForm.password,
          };

    console.log("Sending body:", body);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      setErrorMessage(data.message || "Something went wrong.");
      setIsLoading(false);
      return;
    }

    // Save login token
    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    // Save user
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    setSuccessMessage(
      userMode === "register"
        ? "Account created successfully! Redirecting..."
        : "Login successful! Redirecting..."
    );

    // Wait a moment to show success, then navigate
    setTimeout(() => {
      setIsLoading(false);
      closeModal();
      navigate("/user-dashboard");
    }, 1000);

  } catch (error) {
    console.error("Authentication error:", error);
    setErrorMessage(
      "Unable to connect to server. Please check whether backend is running."
    );
    setIsLoading(false);
  }
};

  const openEmployeeProfile = () => {
    closeModal();
    navigate("/employee-profile");
  };

  const goBackToChoice = () => {
    setAuthChoice("choice");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const switchMode = (mode) => {
    setUserMode(mode);
    setErrorMessage("");
    setSuccessMessage("");

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
          </div>

          {/* Error & Success Messages */}
          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-600">{errorMessage}</p>
            </div>
          )}
          
          {successMessage && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-600">{successMessage}</p>
            </div>
          )}

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
                disabled={!!successMessage}
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
                disabled={!!successMessage}
              />
            </div>

            {userMode === "register" && (
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <div className="flex">
                  {/* Country Code Dropdown */}
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex items-center gap-1 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 hover:bg-slate-100 transition"
                      disabled={!!successMessage}
                    >
                      <span className="text-lg">{selectedCountry.flag}</span>
                      <span className="font-medium">{selectedCountry.code}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-72 max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="p-2 border-b border-slate-100">
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {isLoadingCountries ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                            </div>
                          ) : filteredCountries.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                              No country found
                            </div>
                          ) : (
                            filteredCountries.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => handleCountrySelect(country)}
                                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 transition ${
                                  selectedCountry.code === country.code ? 'bg-indigo-50' : ''
                                }`}
                              >
                                <span className="text-xl">{country.flag}</span>
                                <span className="flex-1 text-slate-800">{country.name}</span>
                                <span className="text-sm text-slate-400">{country.code}</span>
                                {selectedCountry.code === country.code && (
                                  <Check className="h-4 w-4 text-indigo-600" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile Number Input */}
                  <input
                    required
                    type="tel"
                    value={userForm.mobile}
                    onChange={(event) =>
                      updateUser("mobile", event.target.value.replace(/\D/g, ''))
                    }
                    placeholder="Mobile number"
                    autoComplete="tel"
                    className={`${inputBase} rounded-l-none pl-4`}
                    disabled={!!successMessage}
                  />
                </div>
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
                disabled={!!successMessage}
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
                  disabled={!!successMessage}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!!successMessage}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition duration-150 hover:bg-indigo-700 active:translate-y-px ${
                successMessage ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {userMode === "login"
                ? "Login"
                : "Create Fresher Account"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goBackToChoice}
              disabled={!!successMessage}
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