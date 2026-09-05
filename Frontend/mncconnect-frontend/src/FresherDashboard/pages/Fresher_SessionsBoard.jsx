import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  Clock3,
  CheckCircle2,
  CalendarDays,
  Video,
  MessageSquare,
  IndianRupee,
  ChevronRight,
  UserRound,
  Mail,
  BriefcaseBusiness,
  Loader2,
  Wallet,
  ShieldCheck,
  Send,
  TimerReset,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const WALLET_KEY = "fresherWallet_arundharsaun11@gmail.com";
const PENDING_REQUEST_KEY = "fresher_pending_mentor_request";

const SESSION_OPTIONS = [
  {
    value: "30",
    label: "30 Min",
    minutes: 30,
    price: 200,
  },
  {
    value: "60",
    label: "1 Hr",
    minutes: 60,
    price: 400,
  },
  {
    value: "120",
    label: "2 Hr",
    minutes: 120,
    price: 800,
  },
];

const SESSION_TYPES = [
  {
    value: "any_queries",
    label: "Any Queries",
    icon: MessageSquare,
  },
  {
    value: "ideas_for_crack",
    label: "Ideas for Crack",
    icon: CheckCircle2,
  },
  {
    value: "interview_ideas",
    label: "Interview Ideas",
    icon: Video,
  },
  {
    value: "road_map",
    label: "Road Map",
    icon: CalendarDays,
  },
];

const ROLE_OPTIONS = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "DevOps Engineer",
  "Cloud Engineer",
  "UI/UX Designer",
  "Product Manager",
  "QA Engineer",
  "Other",
];

const GENDER_OPTIONS = [
  {
    value: "",
    label: "No Preference",
  },
  {
    value: "male",
    label: "Male",
  },
  {
    value: "female",
    label: "Female",
  },
];

const LANGUAGE_OPTIONS = [
  "English",
  "Tamil",
  "Hindi",
  "Malayalam",
  "Telugu",
  "Kannada",
];

function getLoggedInUser() {
  const keys = ["user", "currentUser", "userData", "authUser"];

  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);

      if (!value) {
        continue;
      }

      const parsed = JSON.parse(value);

      if (parsed) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return {};
}

function createRequestGroupId() {
  return `REQ-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function getUserName(user) {
  return (
    user?.fullName ||
    user?.name ||
    user?.username ||
    user?.displayName ||
    "Fresher"
  );
}

function getUserEmail(user) {
  return user?.email || "";
}

function getUserImage(user) {
  return user?.image || user?.profileImage || user?.avatar || user?.photo || "";
}

function normalizeImage(image) {
  if (!image) {
    return "";
  }

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:")
  ) {
    return image;
  }

  if (image.startsWith("/")) {
    return image;
  }

  return `/${image}`;
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
      <ShieldCheck size={11} />
      Verified
    </span>
  );
}

function RazorpayCoin({ success }) {
  return (
    <div className="relative mx-auto flex h-32 w-32 items-center justify-center [perspective:700px]">
      <div
        className={`absolute h-24 w-24 rounded-full border-4 border-yellow-300 bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 shadow-[0_12px_35px_rgba(234,179,8,0.45)] ${
          success ? "coin-success" : "coin-flip"
        }`}
      >
        <div className="absolute inset-2 flex items-center justify-center rounded-full border border-yellow-100/70">
          <IndianRupee
            size={38}
            className="text-white drop-shadow-md"
            strokeWidth={2.5}
          />
        </div>

        <div className="absolute left-4 top-3 h-3 w-8 rotate-[-35deg] rounded-full bg-white/30 blur-[1px]" />
      </div>

      <div className="absolute h-32 w-32 rounded-full border border-yellow-300/30 coin-ring" />
    </div>
  );
}

function PaymentOverlay({ paymentState, amount, onSuccess }) {
  if (!paymentState) {
    return null;
  }

  const success = paymentState === "success";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="px-7 pb-8 pt-10 text-center">
          <RazorpayCoin success={success} />

          {!success ? (
            <>
              <h3 className="mt-5 text-xl font-bold text-slate-900">
                Processing Payment
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Please wait while we verify your payment.
              </p>

              <div className="mx-auto mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                <Loader2 size={18} className="animate-spin" />
                Verifying ₹{amount}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={17} />
                Payment Successful
              </div>

              <h3 className="mt-5 text-2xl font-extrabold text-slate-900">
                ₹{amount} Paid Successfully
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Your payment has been completed successfully.
              </p>

              <button
                type="button"
                onClick={onSuccess}
                className="mt-7 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                OK
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      <option value="">Select Language</option>

      {LANGUAGE_OPTIONS.map((language) => (
        <option key={language} value={language}>
          {language}
        </option>
      ))}
    </select>
  );
}

function SessionRequirements({ requirements, setRequirements }) {
  const update = (field, value) => {
    setRequirements((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="mt-8">
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Role
          </label>

          <select
            value={requirements.role}
            onChange={(e) => update("role", e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select Role</option>

            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {requirements.role === "Other" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Enter Your Role
            </label>

            <input
              type="text"
              value={requirements.otherRole}
              onChange={(e) => update("otherRole", e.target.value)}
              placeholder="Enter role"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Gender Preference
          </label>

          <select
            value={requirements.gender}
            onChange={(e) => update("gender", e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {GENDER_OPTIONS.map((gender) => (
              <option key={gender.value} value={gender.value}>
                {gender.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Preferred Language
          </label>

          <LanguageSelect
            value={requirements.language}
            onChange={(value) => update("language", value)}
          />
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-slate-700">
            Duration
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SESSION_OPTIONS.map((option) => {
              const selected = requirements.duration === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("duration", option.value)}
                  className={`rounded-xl border px-4 py-4 text-center transition ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  }`}
                >
                  <Clock3 size={20} className="mx-auto mb-2" />

                  <div className="text-sm font-bold">{option.label}</div>

                  <div className="mt-1 text-xs">₹{option.price}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestStatusModal({ status, request, refundAmount, onOk }) {
  if (!status) {
    return null;
  }

  const accepted = status === "accepted";

  const refunded = status === "refunded";

  const waiting = status === "waiting";

  const employee = request?.employee || {};

  const employeeName =
    employee.name || employee.fullName || employee.full_name || "Employee";

  const employeeImage =
    employee.image ||
    employee.profileImage ||
    employee.avatar ||
    employee.photo ||
    "";

  const employeeEmail = employee.email || employee.employeeEmail || "";

  const employeeDesignation =
    employee.designation || employee.role || employee.jobTitle || "";

  const finalRefundAmount =
    Number(
      refundAmount ||
        request?.refundAmount ||
        request?.amount ||
        request?.sessionDetails?.amount ||
        0,
    ) || 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        {waiting && (
          <div className="px-7 py-10 text-center">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />

              <div className="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />

              <Send size={30} className="text-blue-600" />
            </div>

            <h2 className="mt-6 text-2xl font-bold text-slate-900">
              Session Request Sent
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Your payment was successful and your session request has been sent
              to an eligible online employee.
            </p>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-700">
                <Loader2 size={17} className="animate-spin" />
                Waiting for employee acceptance...
              </div>

              <p className="mt-2 text-xs text-blue-600">
                Please keep this page open while we wait for an employee to
                accept your request.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
              <TimerReset size={14} />
              If no employee accepts before your selected session duration ends,
              your payment will be refunded.
            </div>
          </div>
        )}

        {accepted && (
          <div className="px-7 py-8">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={34} className="text-emerald-600" />
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900">
                Session Confirmed
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                An employee has accepted your session request.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-4">
                {employeeImage ? (
                  <img
                    src={normalizeImage(employeeImage)}
                    alt={employeeName}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <UserRound size={28} className="text-slate-500" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {employeeName}
                    </h3>

                    <VerifiedBadge />
                  </div>

                  {employeeEmail && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <Mail size={14} />

                      <span className="break-all">{employeeEmail}</span>
                    </div>
                  )}

                  {employeeDesignation && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <BriefcaseBusiness size={14} />

                      {employeeDesignation}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
              Your mentor session is confirmed.
            </div>

            <button
              type="button"
              onClick={onOk}
              className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              OK
            </button>
          </div>
        )}

        {refunded && (
          <div className="px-7 py-9 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
              <IndianRupee size={34} className="text-amber-600" />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-slate-900">
              Amount Refunded
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              No employee accepted your session request within the selected
              session duration. Your payment has been refunded.
            </p>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wider text-amber-700">
                Refund Amount
              </div>

              <div className="mt-1 text-3xl font-extrabold text-amber-800">
                ₹{finalRefundAmount}
              </div>

              <div className="mt-2 text-xs font-medium text-amber-700">
                Refund Status: Completed
              </div>
            </div>

            <button
              type="button"
              onClick={onOk}
              className="mt-6 w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionBoard() {
  const navigate = useNavigate();
  const { company } = useParams();

  const decodedCompanyName = useMemo(() => {
    try {
      return decodeURIComponent(company || "");
    } catch {
      return company || "";
    }
  }, [company]);

  const [companyDetails, setCompanyDetails] = useState(null);

  const [loadingCompany, setLoadingCompany] = useState(true);

  const [requirements, setRequirements] = useState({
    sessionType: SESSION_TYPES[0].value,
    role: "",
    otherRole: "",
    gender: "",
    language: "",
    duration: "30",
  });

  const [walletBalance, setWalletBalance] = useState(0);

  const [paymentState, setPaymentState] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("");

  const [requestStatus, setRequestStatus] = useState(null);

  const [requestData, setRequestData] = useState(null);

  const [refundAmount, setRefundAmount] = useState(0);

  const requestGroupIdRef = useRef(null);

  const pollRef = useRef(null);

  const refundHandledRef = useRef(false);

  const loggedInUser = useMemo(() => getLoggedInUser(), []);

  const requesterName = getUserName(loggedInUser);

  const requesterEmail = getUserEmail(loggedInUser);

  const requesterImage = getUserImage(loggedInUser);

  const selectedType = useMemo(() => {
    return (
      SESSION_TYPES.find((item) => item.value === requirements.sessionType) ||
      SESSION_TYPES[0]
    );
  }, [requirements.sessionType]);

  const selectedDuration = useMemo(() => {
    return (
      SESSION_OPTIONS.find((item) => item.value === requirements.duration) ||
      SESSION_OPTIONS[0]
    );
  }, [requirements.duration]);

  const sessionPrice = selectedDuration.price;

  const isFormValid = useMemo(() => {
    if (!requirements.sessionType) {
      return false;
    }

    if (!requirements.role) {
      return false;
    }

    if (requirements.role === "Other" && !requirements.otherRole.trim()) {
      return false;
    }

    if (!requirements.language) {
      return false;
    }

    if (!requirements.duration) {
      return false;
    }

    return true;
  }, [requirements]);

  const fetchCompany = useCallback(async () => {
    try {
      setLoadingCompany(true);

      const response = await fetch(`${API_URL}/mentor/companies`);

      if (!response.ok) {
        throw new Error("Unable to fetch companies");
      }

      const data = await response.json();

      const companies = Array.isArray(data)
        ? data
        : data.companies || data.data || [];

      const foundCompany = companies.find((item) => {
        const itemName = item.companyName || item.name || item.slug || "";

        return (
          String(itemName).toLowerCase() ===
          String(decodedCompanyName).toLowerCase()
        );
      });

      setCompanyDetails(foundCompany || null);
    } catch (error) {
      console.error("Company fetch error:", error);

      setCompanyDetails(null);
    } finally {
      setLoadingCompany(false);
    }
  }, [decodedCompanyName]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    try {
      const savedWallet = localStorage.getItem(WALLET_KEY);

      if (savedWallet !== null) {
        setWalletBalance(Number(savedWallet) || 0);
      }
    } catch {
      setWalletBalance(0);
    }
  }, []);

  const saveWallet = useCallback((amount) => {
    const safeAmount = Math.max(0, Number(amount) || 0);

    setWalletBalance(safeAmount);

    try {
      localStorage.setItem(WALLET_KEY, String(safeAmount));
    } catch {
      return;
    }
  }, []);

  const validateForm = () => {
    if (!requirements.sessionType) {
      return false;
    }

    if (!requirements.role) {
      return false;
    }

    if (requirements.role === "Other" && !requirements.otherRole.trim()) {
      return false;
    }

    if (!requirements.language) {
      return false;
    }

    if (!requirements.duration) {
      return false;
    }

    return true;
  };

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);

      pollRef.current = null;
    }
  }, []);

  const storePendingRequest = useCallback(() => {
    try {
      localStorage.setItem(
        PENDING_REQUEST_KEY,
        JSON.stringify({
          requestGroupId: requestGroupIdRef.current,

          companyName: decodedCompanyName,

          amount: sessionPrice,

          paymentMethod,

          duration: Number(requirements.duration),

          createdAt: Date.now(),

          expiresAt: Date.now() + Number(requirements.duration) * 60 * 1000,
        }),
      );
    } catch {
      return;
    }
  }, [decodedCompanyName, paymentMethod, requirements.duration, sessionPrice]);

  const clearPendingRequest = useCallback(() => {
    try {
      localStorage.removeItem(PENDING_REQUEST_KEY);
    } catch {
      return;
    }
  }, []);

  const refundWalletIfNeeded = useCallback(
    (amount) => {
      if (paymentMethod !== "wallet" || refundHandledRef.current) {
        return;
      }

      refundHandledRef.current = true;

      const refund = Number(amount) || sessionPrice;

      setWalletBalance((currentBalance) => {
        const newBalance = currentBalance + refund;

        try {
          localStorage.setItem(WALLET_KEY, String(newBalance));
        } catch {
          return newBalance;
        }

        return newBalance;
      });
    },
    [paymentMethod, sessionPrice],
  );

  const checkRequestStatus = useCallback(async () => {
    const requestGroupId = requestGroupIdRef.current;

    if (!requestGroupId) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/mentor/session-requests/${encodeURIComponent(
          requestGroupId,
        )}`,
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (!data?.success && !data?.request && !data?.data) {
        return;
      }

      const request = data.request || data.data;

      if (!request) {
        return;
      }

      setRequestData(request);

      const status = String(request.status || "pending").toLowerCase();

      if (status === "accepted" || status === "confirmed") {
        clearPolling();
        clearPendingRequest();

        setRequestStatus("accepted");

        return;
      }

      if (
        status === "refunded" ||
        status === "expired" ||
        status === "cancelled"
      ) {
        clearPolling();

        const amount =
          Number(
            request.refundAmount ??
              request.amount ??
              request.sessionDetails?.amount ??
              sessionPrice,
          ) || sessionPrice;

        setRefundAmount(amount);

        refundWalletIfNeeded(amount);

        clearPendingRequest();

        setRequestStatus("refunded");

        return;
      }

      setRequestStatus("waiting");
    } catch (error) {
      console.error("Request status error:", error);
    }
  }, [clearPendingRequest, clearPolling, refundWalletIfNeeded, sessionPrice]);

  const startRequestPolling = useCallback(() => {
    clearPolling();

    checkRequestStatus();

    pollRef.current = setInterval(() => {
      checkRequestStatus();
    }, 3000);
  }, [checkRequestStatus, clearPolling]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const sendSessionRequest = async () => {
    const requestGroupId = requestGroupIdRef.current;

    if (!requestGroupId) {
      throw new Error("Request ID missing");
    }

    const durationMinutes = Number(requirements.duration);

    const expiresAt = new Date(
      Date.now() + durationMinutes * 60 * 1000,
    ).toISOString();

    const payload = {
      requestGroupId,

      companyName: decodedCompanyName,

      companyLogo: companyDetails?.logo || companyDetails?.companyLogo || null,

      companyImage: companyDetails?.companyImage || null,

      requester: {
        fullName: requesterName,

        email: requesterEmail,

        image: requesterImage,
      },

      sessionDetails: {
        sessionType: selectedType?.label || requirements.sessionType,

        sessionTypeValue: requirements.sessionType,

        role: requirements.role,

        otherRole:
          requirements.role === "Other" ? requirements.otherRole.trim() : "",

        gender: requirements.gender,

        language: requirements.language,

        duration: durationMinutes,

        amount: Number(sessionPrice),
      },

      paymentMethod,

      status: "pending",

      expiresAt,
    };

    console.log("Sending session request:", payload);

    const response = await fetch(`${API_URL}/mentor/session-requests`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      throw new Error(text || `Request failed with status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`,
      );
    }

    if (data?.success === false) {
      throw new Error(data?.message || "Unable to send session request");
    }

    console.log("Session request created:", data);

    return data;
  };

  const finishPaymentSuccess = async () => {
    try {
      setPaymentState(null);

      await sendSessionRequest();

      if (paymentMethod === "wallet") {
        saveWallet(walletBalance - sessionPrice);
      }

      refundHandledRef.current = false;

      storePendingRequest();

      setRequestData(null);

      setRefundAmount(0);

      setRequestStatus("waiting");

      startRequestPolling();
    } catch (error) {
      console.error("Session request failed:", error);

      setPaymentState(null);

      setRequestStatus(null);

      console.error("Backend endpoint:", `${API_URL}/mentor/session-requests`);
    }
  };

  const startPayment = async () => {
    if (!validateForm()) return;

    try {
      requestGroupIdRef.current = createRequestGroupId();

      setPaymentMethod("razorpay");
      setPaymentState("processing");

      // 1. Create Razorpay order
      const orderResponse = await fetch(`${API_URL}/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: sessionPrice,
        }),
      });

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.message || "Unable to create payment order");
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,

        amount: order.amount,
        currency: order.currency,

        name: "MNCConnect",
        description: "Mentoring Session",

        order_id: order.id,

        handler: async function (response) {
          try {
            // 3. Verify payment
            const verifyResponse = await fetch(
             `${API_URL}/payments/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,

                  razorpay_payment_id: response.razorpay_payment_id,

                  razorpay_signature: response.razorpay_signature,
                }),
              },
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.message || "Payment verification failed",
              );
            }

            // 4. Payment verified → create session request
            await finishPaymentSuccess();
          } catch (error) {
            console.error("Payment verification error:", error);

            setPaymentState(null);
          }
        },

        prefill: {
          name: requesterName,
          email: requesterEmail,
        },

        theme: {
          color: "#2563eb",
        },

        modal: {
          ondismiss: function () {
            setPaymentState(null);
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.open();
    } catch (error) {
      console.error("Razorpay error:", error);

      setPaymentState(null);
    }
  };
  const handlePay = () => {
    startPayment();
  };

  const handleUseWallet = () => {
    startPayment("wallet");
  };

  const handlePaymentSuccessContinue = () => {
    finishPaymentSuccess();
  };

  const handleRequestOk = () => {
    clearPolling();

    clearPendingRequest();

    setRequestStatus(null);

    setRequestData(null);

    setRefundAmount(0);

    setPaymentMethod("");

    requestGroupIdRef.current = null;
  };

  const companyLogo =
    companyDetails?.logo ||
    companyDetails?.companyLogo ||
    companyDetails?.image ||
    "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-7 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-900">
            Home
          </Link>

          <ChevronRight size={16} />

          <span>{decodedCompanyName}</span>

          <ChevronRight size={16} />

          <span className="font-semibold text-slate-900">Session</span>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Select Session Type
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Choose the type of guidance you need from an eligible
                    employee.
                  </p>
                </div>

                {loadingCompany ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={15} className="animate-spin" />
                    Loading company...
                  </div>
                ) : companyLogo ? (
                  <img
                    src={normalizeImage(companyLogo)}
                    alt={decodedCompanyName}
                    className="h-12 w-12 rounded-xl border border-slate-200 object-contain"
                  />
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SESSION_TYPES.map((type) => {
                  const Icon = type.icon;

                  const selected = requirements.sessionType === type.value;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setRequirements((prev) => ({
                          ...prev,
                          sessionType: type.value,
                        }))
                      }
                      className={`relative min-h-[105px] rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={
                          selected ? "text-blue-600" : "text-slate-500"
                        }
                      />

                      {selected && (
                        <CheckCircle2
                          size={18}
                          className="absolute right-4 top-4 text-blue-600"
                        />
                      )}

                      <div className="mt-5 text-sm font-bold text-slate-800">
                        {type.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <SessionRequirements
                requirements={requirements}
                setRequirements={setRequirements}
              />
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck size={20} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    How the session request works
                  </h3>

                  <div className="mt-3 space-y-3 text-sm text-slate-500">
                    <div className="flex gap-3">
                      <span className="font-bold text-slate-900">1.</span>

                      <span>
                        Complete your session preferences and make the payment.
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <span className="font-bold text-slate-900">2.</span>

                      <span>
                        Your request will be sent to an eligible employee who is
                        online at that moment.
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <span className="font-bold text-slate-900">3.</span>

                      <span>
                        If the employee accepts, your session will be confirmed.
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <span className="font-bold text-slate-900">4.</span>

                      <span>
                        If nobody accepts before your selected duration ends,
                        the payment will be refunded.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="self-stretch">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Session Summary
                </h2>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">Session</span>

                    <span className="text-right text-sm font-semibold text-slate-900">
                      {selectedType.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">Role</span>

                    <span className="max-w-[170px] text-right text-sm font-semibold text-slate-900">
                      {requirements.role || "Not selected"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">Language</span>

                    <span className="text-right text-sm font-semibold text-slate-900">
                      {requirements.language || "Not selected"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">Duration</span>

                    <span className="text-sm font-semibold text-slate-900">
                      {selectedDuration.label}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Session Price
                      </span>

                      <span className="text-2xl font-extrabold text-slate-950">
                        ₹{sessionPrice}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={!isFormValid}
                    className={`w-full rounded-xl py-3.5 text-sm font-bold transition ${
                      isFormValid
                        ? "bg-slate-950 text-white hover:bg-slate-800"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    }`}
                  >
                    Pay ₹{sessionPrice} & Send Request
                  </button>

                  <button
                    type="button"
                    onClick={handleUseWallet}
                    disabled={!isFormValid || walletBalance < sessionPrice}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-bold transition ${
                      isFormValid && walletBalance >= sessionPrice
                        ? "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                        : "cursor-not-allowed border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    <Wallet size={17} />
                    Use Wallet ₹{sessionPrice}
                  </button>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />

                    <p className="text-xs leading-5 text-slate-500">
                      After successful payment, your request will be sent to an
                      eligible employee who is online at that moment. If nobody
                      accepts within the selected session duration, your payment
                      will be refunded.
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-slate-400">
                  Secure session request
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <PaymentOverlay
        paymentState={paymentState}
        amount={sessionPrice}
        onSuccess={handlePaymentSuccessContinue}
      />

      <RequestStatusModal
        status={requestStatus}
        request={requestData}
        refundAmount={refundAmount}
        onOk={handleRequestOk}
      />

      <style>{`
        @keyframes coinFlip {
          0% {
            transform: rotateY(0deg) translateY(0);
          }

          25% {
            transform: rotateY(180deg) translateY(-12px);
          }

          50% {
            transform: rotateY(360deg) translateY(0);
          }

          75% {
            transform: rotateY(540deg) translateY(-8px);
          }

          100% {
            transform: rotateY(720deg) translateY(0);
          }
        }

        @keyframes coinSuccess {
          0% {
            transform: scale(0.7) rotateY(0deg);
            opacity: 0.5;
          }

          50% {
            transform: scale(1.12) rotateY(360deg);
            opacity: 1;
          }

          100% {
            transform: scale(1) rotateY(720deg);
            opacity: 1;
          }
        }

        @keyframes ringPulse {
          0% {
            transform: scale(0.75);
            opacity: 0;
          }

          50% {
            transform: scale(1);
            opacity: 1;
          }

          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }

        .coin-flip {
          animation: coinFlip 1.1s linear infinite;
          transform-style: preserve-3d;
        }

        .coin-success {
          animation: coinSuccess 1s ease-out forwards;
          transform-style: preserve-3d;
        }

        .coin-ring {
          animation: ringPulse 1.4s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
