import React, {
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
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
  Check,
  Wallet,
  ShieldCheck,
} from "lucide-react";

import { LoadingContext } from "../../src/App";

/* =========================================================
   INITIAL FORM
========================================================= */

const initialUserForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
  countryCode: "+91",
};

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

/* =========================================================
   INPUT STYLE
========================================================= */

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100/70 disabled:cursor-not-allowed disabled:opacity-60";

/* =========================================================
   COUNTRIES
========================================================= */

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



const getCoinStorageKey = (email) => {
  if (!email) return null;

  return `fresherwallet_cash_${email
    .toLowerCase()
    .trim()}`;
};

const initializeFresherCoins = (email) => {
  const coinKey = getCoinStorageKey(email);

  if (!coinKey) {
    return {
      balance: 0,
      isFirstLogin: false,
    };
  }

  const existingCoins =
    localStorage.getItem(coinKey);

  /* FIRST SUCCESSFUL LOGIN */

  if (existingCoins === null) {
    localStorage.setItem(coinKey, "25");

    return {
      balance: 25,
      isFirstLogin: true,
    };
  }

  /* EXISTING USER */

  const balance = Number(existingCoins);

  return {
    balance: Number.isFinite(balance)
      ? balance
      : 0,
    isFirstLogin: false,
  };
};

/* =========================================================
   MAIN AUTH
========================================================= */

export default function Auth({
  closeModal = () => {},
  isModal = false,
}) {
  const navigate = useNavigate();

  const { setIsLoading } =
    useContext(LoadingContext);

  /* =======================================================
     AUTH STATE
  ======================================================= */

  const [authChoice, setAuthChoice] =
    useState("choice");

  const [userMode, setUserMode] =
    useState("login");

  const [userForm, setUserForm] =
    useState(initialUserForm);

  /* =======================================================
     MESSAGES
  ======================================================= */

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /* =======================================================
     COUNTRY
  ======================================================= */

  const [countries, setCountries] =
    useState(FALLBACK_COUNTRIES);

  const [isDropdownOpen, setIsDropdownOpen] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedCountry, setSelectedCountry] =
    useState(FALLBACK_COUNTRIES[0]);

  const [isLoadingCountries, setIsLoadingCountries] =
    useState(false);

  const dropdownRef = useRef(null);

  /* =======================================================
     WALLET REWARD
  ======================================================= */

  const [showWalletReward, setShowWalletReward] =
    useState(false);

  const [walletAmount, setWalletAmount] =
    useState(25);

  /* =======================================================
     COUNTRY INITIALIZATION
  ======================================================= */

  useEffect(() => {
    setCountries(FALLBACK_COUNTRIES);

    setSelectedCountry(
      FALLBACK_COUNTRIES[0]
    );

    setIsLoadingCountries(false);

    setUserForm((prev) => ({
      ...prev,
      countryCode:
        FALLBACK_COUNTRIES[0].code,
    }));
  }, []);

  /* =======================================================
     CLOSE COUNTRY DROPDOWN
  ======================================================= */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setIsDropdownOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =======================================================
     UPDATE USER
  ======================================================= */

  const updateUser = (
    field,
    value
  ) => {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  };

  /* =======================================================
     COUNTRY SELECT
  ======================================================= */

  const handleCountrySelect = (
    country
  ) => {
    setSelectedCountry(country);

    setUserForm((prev) => ({
      ...prev,
      countryCode: country.code,
    }));

    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  /* =======================================================
     FILTER COUNTRIES
  ======================================================= */

  const filteredCountries =
    countries.filter(
      (country) =>
        country.name
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          ) ||
        country.code.includes(
          searchTerm
        )
    );

  /* =======================================================
     NAVIGATE AFTER AUTH
  ======================================================= */

  const continueAfterWallet = () => {
    setShowWalletReward(false);
    setIsLoading(false);

    closeModal();

    if (userMode === "login") {
      navigate("/Home");
    } else {
      navigate("/user-dashboard");
    }
  };

  /* =======================================================
     FRESHER LOGIN / REGISTER
  ======================================================= */

  const handleFresherSubmit =
    async (event) => {
      event.preventDefault();

      setErrorMessage("");
      setSuccessMessage("");

      /* PASSWORD */

      if (
        userMode === "register" &&
        userForm.password !==
          userForm.confirmPassword
      ) {
        setErrorMessage(
          "Passwords do not match."
        );

        return;
      }

      /* MOBILE */

      if (
        userMode === "register" &&
        userForm.mobile.length !== 10
      ) {
        setErrorMessage(
          "Please enter a valid 10-digit mobile number."
        );

        return;
      }

      setIsLoading(true);

      try {
        /* =================================================
           ENDPOINT
        ================================================= */

        const endpoint =
          userMode === "register"
            ? `${API_URL}/auth/fresher/register`
            : `${API_URL}/auth/fresher/login`;

        /* =================================================
           BODY
        ================================================= */

        const body =
          userMode === "register"
            ? {
                name: userForm.name.trim(),
                email:
                  userForm.email.trim(),
                mobile:
                  userForm.mobile,
                countryCode:
                  userForm.countryCode,
                password:
                  userForm.password,
              }
            : {
                email:
                  userForm.email.trim(),
                password:
                  userForm.password,
              };

        /* =================================================
           API
        ================================================= */

        const response =
          await fetch(endpoint, {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(body),
          });

        const data =
          await response.json();

        /* =================================================
           API ERROR
        ================================================= */

        if (!response.ok) {
          setErrorMessage(
            data.message ||
              "Something went wrong."
          );

          setIsLoading(false);

          return;
        }

        /* =================================================
           SAVE TOKEN
        ================================================= */

        if (data.token) {
          localStorage.setItem(
            "fresher_token",
            data.token
          );
        }

        /* =================================================
           SAVE USER
        ================================================= */

        if (data.user) {
          localStorage.setItem(
            "user",
            JSON.stringify(data.user)
          );
        }

        /* =================================================
           WALLET INITIALIZATION
        ================================================= */

        let firstLoginReward = false;

        if (data.user) {
          const loggedInEmail =
            data.user.email ||
            userForm.email;

          const walletResult =
            initializeFresherCoins(
              loggedInEmail
            );

          firstLoginReward =
            walletResult.isFirstLogin;

          if (firstLoginReward) {
            setWalletAmount(
              walletResult.balance
            );

            setShowWalletReward(true);
          }
        }

        /* =================================================
           SUCCESS
        ================================================= */

        setSuccessMessage(
          userMode === "register"
            ? "Account created successfully!"
            : "Login successful!"
        );

        /* =================================================
           IF FIRST LOGIN

           DON'T REDIRECT.
           SHOW WALLET REWARD.
        ================================================= */

        if (firstLoginReward) {
          return;
        }

        /* =================================================
           NORMAL LOGIN REDIRECT
        ================================================= */

        setTimeout(() => {
          setIsLoading(false);

          closeModal();

          if (userMode === "login") {
            navigate(
              "/Home"
            );
          } else {
            navigate(
              "/user-dashboard"
            );
          }
        }, 1000);
      } catch (error) {
        console.error(
          "Authentication error:",
          error
        );

        setErrorMessage(
          "Unable to connect to server. Please check whether backend is running."
        );

        setIsLoading(false);
      }
    };

  /* =======================================================
     EMPLOYEE PROFILE
  ======================================================= */

  const openEmployeeProfile = () => {
    closeModal();

    navigate(
      "/employee-profile"
    );
  };

  /* =======================================================
     BACK
  ======================================================= */

  const goBackToChoice = () => {
    setAuthChoice("choice");

    setErrorMessage("");
    setSuccessMessage("");
  };

  /* =======================================================
     SWITCH LOGIN / REGISTER
  ======================================================= */

  const switchMode = (mode) => {
    setUserMode(mode);

    setErrorMessage("");
    setSuccessMessage("");

    if (mode === "login") {
      setUserForm((current) => ({
        ...current,

        name: "",
        mobile: "",
        confirmPassword: "",
      }));
    }
  };

  /* =======================================================
     ACCOUNT TYPE CHOICE
  ======================================================= */

  if (authChoice === "choice") {
    return (
      <div className="w-full bg-white">
        <div className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="max-w-3xl mx-auto">

            {/* HEADER */}

            <div className="text-center">

              <div className="flex items-center justify-center w-12 h-12 mx-auto text-white bg-indigo-600 shadow-lg rounded-2xl shadow-indigo-200">
                <Sparkles className="w-5 h-5" />
              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-600">
                MNC CONNECT
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Choose your path
              </h2>

              <p className="max-w-xl mx-auto mt-3 text-sm leading-6 text-slate-500">
                One network. Two roles.
                Freshers connect with
                industry. MNC employees
                build professional
                influence.
              </p>

            </div>

            {/* ROLE CARDS */}

            <div className="grid gap-4 mt-8 sm:grid-cols-2">

              {/* FRESHER */}

              <button
                type="button"
                onClick={() =>
                  setAuthChoice(
                    "fresher"
                  )
                }
                className="p-5 text-left transition duration-300 bg-white border group rounded-2xl border-slate-200 hover:-translate-y-1 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-xl hover:shadow-indigo-100/40"
              >

                <div className="flex items-start justify-between">

                  <div className="flex items-center justify-center text-white bg-indigo-600 shadow-lg h-11 w-11 rounded-xl shadow-indigo-200">
                    <Users className="w-5 h-5" />
                  </div>

                  <ChevronRight className="w-5 h-5 transition-transform duration-300 text-slate-300 group-hover:translate-x-1 group-hover:text-indigo-600" />

                </div>

                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                  PATH 01
                </p>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Fresher
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create your account,
                  discover MNC
                  professionals and book
                  1:1 video mentorship
                  sessions.
                </p>

                <span className="mt-4 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                  Normal Account
                </span>

              </button>

              {/* EMPLOYEE */}

              <button
                type="button"
                onClick={
                  openEmployeeProfile
                }
                className="p-5 text-left transition duration-300 bg-white border group rounded-2xl border-slate-200 hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-xl hover:shadow-emerald-100/40"
              >

                <div className="flex items-start justify-between">

                  <div className="flex items-center justify-center text-white shadow-lg h-11 w-11 rounded-xl bg-emerald-600 shadow-emerald-200">
                    <BriefcaseBusiness className="w-5 h-5" />
                  </div>

                  <ChevronRight className="w-5 h-5 transition-transform duration-300 text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-600" />

                </div>

                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  PATH 02
                </p>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  MNC Employee
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create your professional
                  profile, submit
                  employment proof and
                  enter the verification
                  flow.
                </p>

                <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Professional Profile
                </span>

              </button>

            </div>

            {/* SECURITY */}

            <div className="flex items-center justify-center gap-2 pt-5 border-t mt-7 border-slate-100">

              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />

              <span className="font-mono text-[8px] font-bold tracking-[0.2em] text-slate-400">
                SECURE ENTRY
              </span>

            </div>

          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     FRESHER AUTH SCREEN
  ======================================================= */

  return (
    <div className="relative w-full overflow-hidden bg-white">

      {/* ===================================================
          FIRST LOGIN WALLET REVEAL
      =================================================== */}

      {showWalletReward && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-slate-950/80 px-5 backdrop-blur-xl">

          {/* BACKGROUND GLOW */}

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-[130px]" />

          <div className="pointer-events-none absolute left-[15%] top-[20%] h-40 w-40 rounded-full bg-indigo-500/20 blur-[90px]" />

          <div className="pointer-events-none absolute bottom-[10%] right-[15%] h-40 w-40 rounded-full bg-cyan-400/10 blur-[90px]" />

          {/* WALLET CARD */}

          <div className="relative w-full max-w-md animate-[scale-in_.45s_ease-out] overflow-hidden rounded-[2rem] border border-white/20 bg-white p-7 shadow-[0_35px_120px_rgba(0,0,0,0.45)] sm:p-9">

            {/* TOP LIGHT */}

            <div className="absolute w-48 h-48 rounded-full -left-20 -top-20 bg-emerald-400/20 blur-3xl" />

            <div className="absolute w-40 h-40 rounded-full -right-20 top-20 bg-indigo-400/10 blur-3xl" />

            {/* CONTENT */}

            <div className="relative text-center">

              {/* WALLET ICON */}

              <div className="relative w-24 h-24 mx-auto">

                {/* PULSE RINGS */}

                <div className="absolute inset-0 animate-ping rounded-[2rem] bg-emerald-400/10" />

                <div className="absolute -inset-2 rounded-[2.2rem] border border-emerald-400/20 animate-[pulse_2s_ease-in-out_infinite]" />

                <div className="relative flex h-24 w-24 animate-[bounce_1.8s_ease-in-out_infinite] items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-[0_20px_55px_rgba(16,185,129,0.35)]">

                  <Wallet
                    className="w-10 h-10 text-white"
                    strokeWidth={2}
                  />

                  {/* SHINE */}

                  <span className="absolute inset-0 overflow-hidden rounded-[2rem]">

                    <span className="absolute -left-20 top-0 h-full w-10 rotate-12 bg-white/30 blur-md animate-[shine_2.5s_ease-in-out_infinite]" />

                  </span>

                </div>

              </div>

              {/* SMALL LABEL */}

              <p className="mt-7 text-[10px] font-black uppercase tracking-[0.32em] text-emerald-600">
                WELCOME WALLET
              </p>

              {/* TITLE */}

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Your journey starts
                <span className="block">
                  with a reward.
                </span>
              </h2>

              {/* CASH */}

              <div className="relative mt-6">

                <div className="absolute h-16 -translate-x-1/2 -translate-y-1/2 rounded-full left-1/2 top-1/2 w-52 bg-emerald-400/20 blur-3xl" />

                <div className="relative flex items-center justify-center">

                  <span className="mr-1 text-4xl font-black text-emerald-600">
                    ₹
                  </span>

                  <span className="animate-[pulse_1.4s_ease-in-out_infinite] text-7xl font-black tracking-[-0.07em] text-slate-950">
                    {walletAmount}
                  </span>

                </div>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                  WELCOME BALANCE
                </p>

              </div>

              {/* DIVIDER */}

              <div className="flex items-center justify-center gap-2 mx-auto my-6">

                <span className="w-12 h-px bg-gradient-to-r from-transparent to-slate-200" />

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />

                <span className="w-12 h-px bg-gradient-to-l from-transparent to-slate-200" />

              </div>

              {/* MESSAGE */}

              <p className="max-w-sm mx-auto text-sm leading-6 text-slate-500">
                Your fresher account has received
                its welcome wallet balance.
              </p>

              {/* ENTER */}

              <button
                type="button"
                onClick={
                  continueAfterWallet
                }
                className="flex items-center justify-center w-full gap-2 px-5 py-4 text-sm font-black text-white transition-all duration-300 shadow-xl group mt-7 rounded-2xl bg-slate-950 shadow-slate-950/20 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-2xl active:translate-y-0"
              >

                Enter MNCConnect

                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />

              </button>

              <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Welcome reward unlocked
              </p>

            </div>

          </div>

          {/* FLOATING LIGHT PARTICLES */}

          <div className="pointer-events-none absolute left-[20%] top-[25%] h-2 w-2 animate-[float_3s_ease-in-out_infinite] rounded-full bg-emerald-300 shadow-[0_0_15px_rgba(110,231,183,0.9)]" />

          <div className="pointer-events-none absolute right-[22%] top-[30%] h-1.5 w-1.5 animate-[float_4s_ease-in-out_infinite] rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(103,232,249,0.9)]" />

          <div className="pointer-events-none absolute bottom-[25%] left-[25%] h-1.5 w-1.5 animate-[float_3.5s_ease-in-out_infinite] rounded-full bg-indigo-300 shadow-[0_0_15px_rgba(165,180,252,0.9)]" />

        </div>
      )}

      {/* ===================================================
          AUTH CONTENT
      =================================================== */}

      <div className="px-5 py-7 sm:px-8 sm:py-9">

        <div className="max-w-xl mx-auto">

          {/* HEADER */}

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
                Your fresher account is
                separate from MNC employee
                profiles.
              </p>

            </div>

          </div>

          {/* ERROR */}

          {errorMessage && (
            <div className="px-4 py-3 mt-4 border border-red-200 rounded-xl bg-red-50">

              <p className="text-sm font-medium text-red-600">
                {errorMessage}
              </p>

            </div>
          )}

          {/* SUCCESS */}

          {successMessage && (
            <div className="px-4 py-3 mt-4 border border-green-200 rounded-xl bg-green-50">

              <div className="flex items-center gap-2">

                <Check className="w-4 h-4 text-green-600" />

                <p className="text-sm font-medium text-green-600">
                  {successMessage}
                </p>

              </div>

            </div>
          )}

          {/* LOGIN REGISTER SWITCH */}

          <div className="grid grid-cols-2 p-1 border mt-7 rounded-xl border-slate-200 bg-slate-50">

            <button
              type="button"
              onClick={() =>
                switchMode("login")
              }
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
                userMode === "login"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() =>
                switchMode(
                  "register"
                )
              }
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
                userMode === "register"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
            </button>

          </div>

          {/* FORM */}

          <form
            onSubmit={
              handleFresherSubmit
            }
            className="mt-6 space-y-4"
          >

            {/* NAME */}

            {userMode ===
              "register" && (
              <input
                required
                value={
                  userForm.name
                }
                onChange={(event) =>
                  updateUser(
                    "name",
                    event.target.value
                  )
                }
                placeholder="Full name"
                autoComplete="name"
                className={
                  inputBase
                }
                disabled={
                  !!successMessage
                }
              />
            )}

            {/* EMAIL */}

            <div className="relative">

              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

              <input
                required
                type="email"
                value={
                  userForm.email
                }
                onChange={(event) =>
                  updateUser(
                    "email",
                    event.target.value
                  )
                }
                placeholder="Email address"
                autoComplete="email"
                className={`${inputBase} pl-10`}
                disabled={
                  !!successMessage
                }
              />

            </div>

            {/* MOBILE */}

            {userMode ===
              "register" && (
              <div className="relative">

                <Phone className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-4 w-4 text-slate-400" />

                <div className="flex">

                  {/* COUNTRY */}

                  <div
                    ref={
                      dropdownRef
                    }
                    className="relative"
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setIsDropdownOpen(
                          !isDropdownOpen
                        )
                      }
                      className="flex items-center gap-1 px-3 py-3 text-sm transition border border-r-0 rounded-l-xl border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                      disabled={
                        !!successMessage
                      }
                    >

                      <span className="text-lg">
                        {
                          selectedCountry.flag
                        }
                      </span>

                      <span className="font-medium">
                        {
                          selectedCountry.code
                        }
                      </span>

                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isDropdownOpen
                            ? "rotate-180"
                            : ""
                        }`}
                      />

                    </button>

                    {/* DROPDOWN */}

                    {isDropdownOpen && (
                      <div className="absolute left-0 z-50 mt-1 overflow-hidden bg-white border shadow-2xl top-full w-72 rounded-xl border-slate-200">

                        <div className="p-2 border-b border-slate-100">

                          <input
                            type="text"
                            placeholder="Search country..."
                            value={
                              searchTerm
                            }
                            onChange={(e) =>
                              setSearchTerm(
                                e.target
                                  .value
                              )
                            }
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                          />

                        </div>

                        <div className="overflow-y-auto max-h-56">

                          {isLoadingCountries ? (
                            <div className="flex items-center justify-center py-8">

                              <div className="w-6 h-6 border-2 border-indigo-600 rounded-full animate-spin border-t-transparent" />

                            </div>
                          ) : filteredCountries.length ===
                            0 ? (
                            <div className="px-4 py-6 text-sm text-center text-slate-500">
                              No country
                              found
                            </div>
                          ) : (
                            filteredCountries.map(
                              (
                                country
                              ) => (
                                <button
                                  key={`${country.code}-${country.name}`}
                                  type="button"
                                  onClick={() =>
                                    handleCountrySelect(
                                      country
                                    )
                                  }
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-indigo-50 ${
                                    selectedCountry.code ===
                                    country.code
                                      ? "bg-indigo-50"
                                      : ""
                                  }`}
                                >

                                  <span className="text-xl">
                                    {
                                      country.flag
                                    }
                                  </span>

                                  <span className="flex-1 text-slate-800">
                                    {
                                      country.name
                                    }
                                  </span>

                                  <span className="text-sm text-slate-400">
                                    {
                                      country.code
                                    }
                                  </span>

                                  {selectedCountry.code ===
                                    country.code && (
                                    <Check className="w-4 h-4 text-indigo-600" />
                                  )}

                                </button>
                              )
                            )
                          )}

                        </div>

                      </div>
                    )}

                  </div>

                  {/* MOBILE INPUT */}

                  <input
                    required
                    type="tel"
                    maxLength={10}
                    value={
                      userForm.mobile
                    }
                    onChange={(event) =>
                      updateUser(
                        "mobile",
                        event.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    placeholder="Mobile number"
                    autoComplete="tel"
                    className={`${inputBase} rounded-l-none pl-4`}
                    disabled={
                      !!successMessage
                    }
                  />

                </div>

              </div>
            )}

            {/* PASSWORD */}

            <div className="relative">

              <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

              <input
                required
                type="password"
                value={
                  userForm.password
                }
                onChange={(event) =>
                  updateUser(
                    "password",
                    event.target.value
                  )
                }
                placeholder="Password"
                autoComplete={
                  userMode === "login"
                    ? "current-password"
                    : "new-password"
                }
                className={`${inputBase} pl-10`}
                disabled={
                  !!successMessage
                }
              />

            </div>

            {/* CONFIRM PASSWORD */}

            {userMode ===
              "register" && (
              <div className="relative">

                <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

                <input
                  required
                  type="password"
                  value={
                    userForm.confirmPassword
                  }
                  onChange={(event) =>
                    updateUser(
                      "confirmPassword",
                      event.target.value
                    )
                  }
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className={`${inputBase} pl-10`}
                  disabled={
                    !!successMessage
                  }
                />

              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={
                !!successMessage
              }
              className={`group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 active:translate-y-px ${
                successMessage
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >

              {userMode === "login"
                ? "Login"
                : "Create Fresher Account"}

              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />

            </button>

            {/* BACK */}

            <button
              type="button"
              onClick={
                goBackToChoice
              }
              disabled={
                !!successMessage
              }
              className="w-full py-2 text-sm font-semibold transition text-slate-500 hover:text-slate-900"
            >
              ← Choose a different
              account type
            </button>

          </form>

          {/* WALLET INFO */}

          <div className="p-4 mt-6 overflow-hidden border rounded-2xl border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50">

            <div className="flex items-center gap-3">

              <div className="relative flex items-center justify-center w-10 h-10 shadow-lg shrink-0 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 shadow-amber-200">

                <Wallet className="w-5 h-5 text-white" />

              </div>

              <div>

                <p className="text-sm font-black text-slate-900">
                  Welcome Wallet
                </p>

                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  New fresher accounts
                  receive{" "}
                  <span className="font-black text-amber-600">
                    ₹25
                  </span>{" "}
                  welcome balance on
                  their first successful
                  login.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          TAILWIND-ONLY CUSTOM ANIMATION
      =================================================== */}

      <style>
        {`
          @keyframes scale-in {
            0% {
              opacity: 0;
              transform: scale(0.88) translateY(20px);
            }

            60% {
              opacity: 1;
              transform: scale(1.03) translateY(-3px);
            }

            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes shine {
            0% {
              transform: translateX(-80px) rotate(12deg);
              opacity: 0;
            }

            20% {
              opacity: 1;
            }

            55% {
              transform: translateX(320px) rotate(12deg);
              opacity: 0;
            }

            100% {
              transform: translateX(320px) rotate(12deg);
              opacity: 0;
            }
          }

          @keyframes float {
            0%,
            100% {
              transform: translateY(0px);
              opacity: 0.5;
            }

            50% {
              transform: translateY(-18px);
              opacity: 1;
            }
          }
        `}
      </style>

    </div>
  );
}