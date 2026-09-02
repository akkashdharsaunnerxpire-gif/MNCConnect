import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  Search,
  Users,
  Star,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Circle,
  Clock3,
  Video,
  UserCheck,
  UserX,
  Languages,
  ChevronDown,
  TrendingUp,
  Wallet,
  Timer,
  UserRound,
  CalendarClock,
  CreditCard,
  ShieldCheck,
  Zap,
  Award,
  Globe,
  Cpu,
  Rocket,
  Palette,
  Flame,
  Crown,
  Gem,
  Heart,
  Brain,
  Target,
  Lightbulb,
  Mic,
  BookOpen,
  Code,
  PenTool,
  BarChart,
  Coffee,
  Headphones,
} from "lucide-react";


// Import company catalog from BrowseMentors
import companyCatalog from "../mncLogos/Companylogos";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const WALLET_KEY = "fresherWallet_arundharsaun11@gmail.com";

/* ============================================================
   COMPASS ICON - Custom SVG
============================================================ */
const Compass = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

/* ============================================================
   LAUREL BRANCH — decorative SVG for the medallion
============================================================ */
const Laurel = ({ flip = false, className = "" }) => (
  <svg
    viewBox="0 0 60 140"
    width="34"
    height="80"
    className={`${flip ? "-scale-x-100" : ""} ${className}`}
    fill="none"
  >
    {[...Array(7)].map((_, i) => (
      <ellipse
        key={i}
        cx={18 + (i % 2) * 4}
        cy={12 + i * 17}
        rx="10"
        ry="5"
        transform={`rotate(${-25 + i * 3} ${18 + (i % 2) * 4} ${12 + i * 17})`}
        fill="url(#goldLeaf)"
        opacity={0.9 - i * 0.05}
      />
    ))}
    <path d="M12 4 C 8 40, 8 100, 22 136" stroke="url(#goldLeaf)" strokeWidth="2" fill="none" opacity="0.8" />
    <defs>
      <linearGradient id="goldLeaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F3D98B" />
        <stop offset="50%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#9C7A22" />
      </linearGradient>
    </defs>
  </svg>
);

/* ============================================================
   SESSION PRICES
============================================================ */
const SESSION_OPTIONS = [
  { value: 30, label: "30 Minutes", price: 200, savings: "Standard" },
  { value: 60, label: "1 Hour", price: 400, savings: "Most Popular" },
  { value: 120, label: "2 Hours", price: 800, savings: "Best Value" },
];

/* ============================================================
   SESSION TYPES
============================================================ */
const SESSION_TYPES = [
  { value: "Any queries ", label: "Any Queries", icon: MessageSquare, description: "Quick questions & clarifications" },
  { value: "Ideas for Crack ", label: "Ideas for Crack ", icon: Mic, description: "Real interview simulation" },
  { value: "Interview Ideas", label: "Interview Ideas", icon: PenTool, description: "Professional resume analysis" },
  { value: "Road Map", label: "Road Map", icon: Palette, description: "Design & project evaluation" },
];

/* ============================================================
   VERIFIED BADGE
============================================================ */
const VerifiedBadge = ({ size = 18 }) => (
  <span title="Verified professional" aria-label="Verified professional" className="inline-flex items-center justify-center flex-shrink-0">
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M12 2.5L14.3 4.1L17.1 4L18.2 6.6L20.5 8.1L19.9 10.8L21 13.3L19.1 15.3L18.9 18.1L16.3 19.1L14.4 21.2L11.8 20.4L9.2 21.2L7.3 19.1L4.7 18.1L4.5 15.3L2.6 13.3L3.7 10.8L3.1 8.1L5.4 6.6L6.5 4L9.3 4.1L12 2.5Z"
        fill="#D4AF37"
      />
      <path d="M8.3 12.2L10.7 14.6L15.8 9.4" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/* ============================================================
   GOLD CORNER FRAME — thin elegant corner accents
============================================================ */
const GoldCorners = ({ opacity = "border-[#D4AF37]/30" }) => (
  <>
    <span className={`absolute top-0 left-0 w-6 h-6 border-t border-l ${opacity}`} />
    <span className={`absolute top-0 right-0 w-6 h-6 border-t border-r ${opacity}`} />
    <span className={`absolute bottom-0 left-0 w-6 h-6 border-b border-l ${opacity}`} />
    <span className={`absolute bottom-0 right-0 w-6 h-6 border-b border-r ${opacity}`} />
  </>
);

/* ============================================================
   PAYMENT OVERLAY
============================================================ */
const PaymentOverlay = ({ isOpen, onClose, amount, type }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("processing");

  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      setStatus("processing");
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus("success");
            setTimeout(() => onClose(), 1500);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-md mx-4 overflow-hidden border border-[#D4AF37]/30 bg-[#0a0a0a]">
        <GoldCorners opacity="border-[#D4AF37]/60" />
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        <div className="p-8 text-center">
          <div
            className={`relative w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center border transition-all duration-500 ${
              status === "success" ? "border-emerald-400 bg-emerald-500/10" : "border-[#D4AF37] bg-[#D4AF37]/10"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 size={34} className="text-emerald-400" />
            ) : (
              <Wallet size={30} className="text-[#D4AF37]" />
            )}
          </div>

          <h3 className={`font-serif text-2xl font-bold tracking-wide ${status === "success" ? "text-emerald-400" : "text-[#E8C766]"}`}>
            {status === "success" ? "Payment Confirmed" : "Processing Payment"}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {status === "success" ? "Your session has been secured" : `Processing ₹${amount} · ${type}`}
          </p>

          <div className="mt-6 space-y-2">
            <div className="w-full h-[3px] overflow-hidden bg-white/5">
              <div
                className={`h-full transition-all duration-300 ${status === "success" ? "bg-emerald-400" : "bg-gradient-to-r from-[#9C7A22] via-[#D4AF37] to-[#F3D98B]"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-medium text-[#D4AF37]">{status === "success" ? "Verified" : `${progress}%`}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-5 text-xs text-gray-600">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Secured & encrypted transaction</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   AVATAR
============================================================ */
const EmployeeAvatar = ({ employee, size = "md" }) => {
  const [imageError, setImageError] = useState(false);
  const name = getEmployeeName(employee);
  const image = getEmployeeImage(employee);

  const sizeClasses = { sm: "w-10 h-10", md: "w-16 h-16", lg: "w-16 h-16" };
  const fallbackAvatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
  const isOnline = getEmployeeStatus(employee) === "online";

  return (
    <div className="relative flex-shrink-0">
      <div className={`overflow-hidden bg-[#111] rounded-full border-2 ${isOnline ? "border-[#D4AF37]/70" : "border-white/10"} transition-all duration-300 ${sizeClasses[size]}`}>
        {image && !imageError ? (
          <img src={image} alt={name} className="object-cover w-full h-full" onError={() => setImageError(true)} />
        ) : (
          <img src={fallbackAvatar} alt={`${name} avatar`} className="object-cover w-full h-full" />
        )}
      </div>
      <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0a] ${isOnline ? "bg-emerald-400" : "bg-gray-600"}`} />
    </div>
  );
};

/* ============================================================
   LANGUAGE SELECT
============================================================ */
const LanguageSelect = ({ selectedLanguage, onChange }) => {
  const languages = [
    "English", "Tamil", "Hindi", "Malayalam", "Telugu",
    "Kannada", "Bengali", "Marathi", "Gujarati", "Punjabi",
    "Spanish", "Mandarin", "Arabic", "French", "German",
  ];

  return (
    <div className="relative group">
      <Languages size={14} className="absolute text-[#D4AF37] transition-colors left-3 top-3.5" />
      <select
        value={selectedLanguage}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-8 text-sm transition-all bg-white border border-blue-200 outline-none appearance-none cursor-pointer h-11 text-blue-950 rounded-xl pl-9 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-blue-400"
      >
        <option value="" className="bg-white text-blue-950">Any language</option>
        {languages.map((language) => (
          <option key={language} value={language} className="bg-white text-blue-950">
            {language}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute text-gray-500 transition-colors pointer-events-none right-3 top-3.5" />
    </div>
  );
};

/* ============================================================
   SESSION REQUIREMENTS
============================================================ */
const SessionRequirements = ({ requirements, setRequirements, wallet, onPay, onWallet, isPaying }) => {
  const selectedSession = SESSION_OPTIONS.find((item) => item.value === Number(requirements.duration));
  const price = selectedSession?.price || 200;

  const update = (field, value) => setRequirements((prev) => ({ ...prev, [field]: value }));

  return (
    <section className="relative px-5 pt-3 pb-8 sm:px-8 lg:px-10">
      <div className="relative max-w-[1450px] mx-auto">
        <div className="relative border border-blue-200 bg-white/95 backdrop-blur-xl">
          <GoldCorners />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

          <div className="flex flex-col justify-between gap-4 px-6 py-5 border-b border-blue-100 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 text-black bg-gradient-to-br from-[#F3D98B] to-[#D4AF37] rounded-full">
                <MessageSquare size={18} />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold tracking-wide text-[#E8C766]">Session Requirements</h2>
                <p className="text-xs text-gray-500">Configure your ideal professional match</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7 lg:p-8">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Session Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {SESSION_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = requirements.sessionType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => update("sessionType", type.value)}
                        className={`p-2 text-left transition-all border ${
                          isSelected
                            ? "border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/20 to-transparent text-[#E8C766]"
                            : "border-blue-100 bg-blue-50 hover:border-[#D4AF37]/30 text-gray-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} />
                          <span className="text-[10px] font-semibold">{type.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Professional Role</label>
                <select
                  value={requirements.role}
                  onChange={(e) => update("role", e.target.value)}
                  className="w-full px-3 text-sm transition-all bg-white border border-blue-200 outline-none text-blue-950 rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-blue-400"
                >
                  <option>Software Engineer</option>
                  <option>Frontend Developer</option>
                  <option>Backend Developer</option>
                  <option>Full Stack Developer</option>
                  <option>Data Scientist</option>
                  <option>DevOps Engineer</option>
                  <option>UI/UX Designer</option>
                  <option>Product Manager</option>
                  <option>AI/ML Engineer</option>
                  <option>Other</option>
                </select>
              </div>

              {requirements.role === "Other" && (
                <div>
                  <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Specify Role</label>
                  <input
                    value={requirements.otherRole}
                    onChange={(e) => update("otherRole", e.target.value)}
                    placeholder="Enter required role"
                    className="w-full px-3 text-sm transition-all bg-white border border-blue-200 outline-none text-blue-950 rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-blue-300"
                  />
                </div>
              )}

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Experience</label>
                <select
                  value={requirements.experience}
                  onChange={(e) => update("experience", e.target.value)}
                  className="w-full px-3 text-sm transition-all bg-white border border-blue-200 outline-none text-blue-950 rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-blue-400"
                >
                  <option value="0">Any Experience</option>
                  <option value="1">1+ Years</option>
                  <option value="2">2+ Years</option>
                  <option value="3">3+ Years</option>
                  <option value="5">5+ Years</option>
                  <option value="8">8+ Years</option>
                  <option value="10">10+ Years</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Professional</label>
                <select
                  value={requirements.gender}
                  onChange={(e) => update("gender", e.target.value)}
                  className="w-full px-3 text-sm transition-all bg-white border border-blue-200 outline-none text-blue-950 rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-blue-400"
                >
                  <option value="any">Male or Female</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Language</label>
                <LanguageSelect selectedLanguage={requirements.language} onChange={(value) => update("language", value)} />
              </div>

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Duration</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SESSION_OPTIONS.map((session) => {
                    const isSelected = Number(requirements.duration) === session.value;
                    return (
                      <button
                        key={session.value}
                        onClick={() => update("duration", session.value)}
                        className={`py-2.5 text-[10px] font-bold uppercase border transition-all ${
                          isSelected
                            ? "bg-gradient-to-r from-[#9C7A22] via-[#D4AF37] to-[#F3D98B] text-black border-transparent"
                            : "border-white/10 text-gray-400 hover:border-[#D4AF37]/40"
                        }`}
                      >
                        {session.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block mb-2 text-xs font-bold tracking-wide text-blue-700 uppercase">Session Price</label>
                <div className="flex items-center gap-2 px-3 bg-gradient-to-r from-[#9C7A22] via-[#D4AF37] to-[#F3D98B] h-11">
                  <CreditCard size={16} className="text-black" />
                  <span className="text-lg font-black text-black">₹{price}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-5 p-10 mt-20 border border-white/10 bg-blue-50 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-400">Secure Session Payment</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Instant refunds if the professional doesn't accept your request.
                </p>
              </div>

              <div className="flex flex-col w-full gap-3 sm:flex-row lg:w-auto">
                <button
                  onClick={onPay}
                  disabled={isPaying}
                  className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-black transition-all bg-gradient-to-r from-[#9C7A22] via-[#D4AF37] to-[#F3D98B] hover:brightness-110 ${
                    isPaying ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isPaying ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Pay ₹{price}
                    </>
                  )}
                </button>
                <button
                  onClick={onWallet}
                  disabled={wallet < price || isPaying}
                  className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all border ${
                    wallet >= price && !isPaying
                      ? "text-[#E8C766] border-[#D4AF37]/40 hover:bg-[#D4AF37]/10"
                      : "text-gray-600 border-white/10 cursor-not-allowed"
                  }`}
                >
                  <Wallet size={16} />
                  {wallet >= price ? `Use Wallet (${wallet})` : `Need ${price} Coins`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};



const normalizeCompanyName = (name = "") => String(name).toLowerCase().trim().replace(/[\s._-]+/g, "");

const getEmployeeName = (employee) =>
  employee?.name || employee?.fullName || employee?.employeeName || employee?.displayName || "Expert";

const getEmployeeRole = (employee) =>
  employee?.designation || employee?.role || employee?.jobRole || employee?.position || "Professional";

const getEmployeeDepartment = (employee) => employee?.department || employee?.team || employee?.division || "Technology";

const getEmployeeImage = (employee) =>
  employee?.profilePic || employee?.profileImage || employee?.profilePicture ||
  employee?.image || employee?.photo || employee?.avatar || employee?.imageUrl || null;

const getEmployeeId = (employee, index = 0) =>
  employee?._id || employee?.id || employee?.employeeId || employee?.email || `expert-${index}`;

const getSessionCount = (employee) => {
  const values = [
    employee?.sessionCount, employee?.sessionsAttended,
    employee?.sessionsCompleted, employee?.completedSessions,
    employee?.totalSessions, employee?.sessions,
  ];
  return Math.max(0, ...values.filter((v) => Number.isFinite(Number(v))).map(Number));
};


const getEmployeeStatus = (employee) => {
  const status = String(employee?.status || employee?.availabilityStatus || "").toLowerCase();
  return employee?.isOnline === true || employee?.online === true || status === "online" ? "online" : "offline";
};

const getSessionStatus = (employee) => {
  const status = String(
    employee?.sessionStatus || employee?.currentSessionStatus || employee?.availability || employee?.meetingStatus || ""
  ).toLowerCase();
  return employee?.isAttending === true || employee?.attending === true ||
    employee?.isInSession === true || employee?.inSession === true ||
    ["attending", "in_session", "insession", "busy"].includes(status)
    ? "attending"
    : "available";
};

const getEmployeeLanguages = (employee) => {
  const languages = employee?.languages || employee?.language || employee?.preferredLanguages || employee?.spokenLanguages || [];
  if (Array.isArray(languages)) return languages.map(String);
  if (typeof languages === "string") return languages.split(",").map((s) => s.trim()).filter(Boolean);
  return ["English"];
};

const getEmployeeExperience = (employee) =>
  Number(employee?.yearsOfExperience ?? employee?.experience ?? employee?.experienceYears ?? employee?.totalExperience ?? 0);

const getEmployeeGender = (employee) =>
  String(employee?.gender || employee?.sex || employee?.profileGender || "").trim().toLowerCase();

const getEmployeeTiming = (employee) =>
  employee?.availableTimings || employee?.availabilityTime || employee?.timings || employee?.workingHours || employee?.availableHours || "";

/* ============================================================
   FIND COMPANY FROM CATALOG
============================================================ */
const findCompanyDetails = (companyName) => {
  const normalizedName = String(companyName).toLowerCase().trim().replace(/\s+/g, "").replace(/[._-]/g, "");
  return companyCatalog.find(
    (company) => String(company.name).toLowerCase().trim().replace(/\s+/g, "").replace(/[._-]/g, "") === normalizedName
  );
};

/* ============================================================
   MAIN COMPONENT - SessionBoard
============================================================ */
const SessionBoard = () => {
  const { companyName } = useParams();
  const navigate = useNavigate();
  const decodedCompanyName = decodeURIComponent(companyName || "");

  const [employees, setEmployees] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [isPaying, setIsPaying] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const [requirements, setRequirements] = useState({
    role: "Software Engineer",
    otherRole: "",
    experience: "0",
    gender: "any",
    language: "",
    timing: "",
    duration: 30,
    sessionType: "queries",
  });

  useEffect(() => {
    const savedWallet = localStorage.getItem(WALLET_KEY);
    if (savedWallet === null) {
      localStorage.setItem(WALLET_KEY, "25");
      setWallet(25);
    } else {
      setWallet(Number(savedWallet) || 0);
    }
  }, []);

  const updateWallet = useCallback((amount) => {
    const safeAmount = Math.max(0, Number(amount) || 0);
    localStorage.setItem(WALLET_KEY, String(safeAmount));
    setWallet(safeAmount);
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_URL}/mentors/companies`);
      const data = await response.json();

      if (!response.ok) throw new Error(data?.message || "Failed to load employees");

      const companies = Array.isArray(data) ? data : data?.companies || [];
      const matchedCompany = companies.find(
        (item) => normalizeCompanyName(item.companyName) === normalizeCompanyName(decodedCompanyName)
      );

      if (matchedCompany) {
        setCompany(matchedCompany);
        setEmployees(Array.isArray(matchedCompany.mentors) ? matchedCompany.mentors : []);
        return;
      }

      const matchedEmployees = companies.filter((employee) => {
        const employeeCompany = employee.companyName || employee.currentCompany || employee.company;
        return normalizeCompanyName(employeeCompany) === normalizeCompanyName(decodedCompanyName);
      });

      setEmployees(matchedEmployees);
      setCompany({ companyName: decodedCompanyName, mentorCount: matchedEmployees.length });
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load employees");
    } finally {
      setLoading(false);
    }
  }, [decodedCompanyName]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    const keyword = requirements.role === "Other" ? requirements.otherRole.toLowerCase().trim() : requirements.role.toLowerCase().trim();
    const requiredExperience = Number(requirements.experience) || 0;

    return employees.filter((employee) => {
      const experience = getEmployeeExperience(employee);
      const employeeGender = getEmployeeGender(employee);
      const languages = getEmployeeLanguages(employee).map((x) => x.toLowerCase());

      if (experience < requiredExperience) return false;
      if (requirements.gender !== "any" && employeeGender !== requirements.gender) return false;

      if (keyword) {
        const employeeRole = getEmployeeRole(employee).toLowerCase();
        if (!employeeRole.includes(keyword)) return false;
      }

      if (requirements.language && !languages.includes(requirements.language.toLowerCase())) return false;

      if (requirements.timing) {
        const employeeTiming = getEmployeeTiming(employee).toLowerCase().replace(/\s+/g, "");
        if (employeeTiming && !employeeTiming.includes(requirements.timing)) return false;
      }

      return true;
    });
  }, [employees, requirements]);

  const onlineEmployees = useMemo(
    () => employees.filter((employee) => getEmployeeStatus(employee) === "online").length,
    [employees]
  );

  const attendingEmployees = useMemo(
    () => employees.filter((employee) => getSessionStatus(employee) === "attending").length,
    [employees]
  );

  const selectedSession = SESSION_OPTIONS.find((item) => item.value === Number(requirements.duration));
  const sessionPrice = selectedSession?.price || 200;
  const selectedType = SESSION_TYPES.find((item) => item.value === requirements.sessionType);

  const companyDetails = findCompanyDetails(decodedCompanyName);

  const handlePay = () => {
    setIsPaying(true);
    setPaymentAmount(sessionPrice);
    setShowPayment(true);
    setTimeout(() => setIsPaying(false), 3000);
  };

  const handlePaymentClose = () => {
    setShowPayment(false);
    setPaymentAmount(0);
  };

  const handleUseWallet = () => {
    if (wallet < sessionPrice) return;
    setIsPaying(true);
    setPaymentAmount(sessionPrice);
    setShowPayment(true);
    setTimeout(() => {
      updateWallet(wallet - sessionPrice);
      setIsPaying(false);
    }, 3000);
  };

  const handleRequest = (employee, index) => {
    const id = getEmployeeId(employee, index);
    if (getEmployeeStatus(employee) !== "online") return;
    if (getSessionStatus(employee) === "attending") return;

    if (activeRequestId === id) {
      setActiveRequestId(null);
      return;
    }
    if (activeRequestId !== null) return;

    if (requirements.role === "Other" && !requirements.otherRole.trim()) {
      alert("Please specify the role.");
      return;
    }

    setActiveRequestId(id);
    console.log("SESSION REQUEST", {
      employeeId: id,
      companyName: decodedCompanyName,
      role: requirements.role,
      otherRole: requirements.otherRole,
      sessionType: requirements.sessionType,
      duration: requirements.duration,
      amount: sessionPrice,
      gender: requirements.gender,
      experience: requirements.experience,
      language: requirements.language,
      timing: requirements.timing,
    });
    alert(`Request sent to ${getEmployeeName(employee)}.`);
  };

  /* LOADING STATE */
  if (loading) {
    return (
      <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#050505] text-white">
        <div className="relative text-center">
          <div className="relative flex items-center justify-center w-20 h-20 mx-auto rounded-full">
            <div className="absolute inset-0 border rounded-full border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
            <Sparkles size={22} className="text-[#D4AF37]" />
          </div>
          <p className="mt-6 font-serif text-sm tracking-widest text-[#D4AF37]/80">
            Loading {decodedCompanyName} professionals...
          </p>
        </div>
      </div>
    );
  }

  /* ERROR STATE */
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-5 bg-[#050505] text-white">
        <div className="relative w-full max-w-md p-8 text-center border border-rose-500/30 bg-[#0b0b0b]">
          <GoldCorners opacity="border-rose-400/50" />
          <div className="flex items-center justify-center w-16 h-16 mx-auto border border-rose-500/30 bg-rose-500/10">
            <XCircle className="text-rose-400" size={28} />
          </div>
          <h2 className="mt-5 font-serif text-2xl font-bold text-rose-400">Unable to load employees</h2>
          <p className="mt-3 text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchEmployees}
            className="flex items-center justify-center gap-2 px-6 py-3 mx-auto mt-6 text-sm font-bold text-black transition-all bg-gradient-to-r from-[#9C7A22] via-[#D4AF37] to-[#F3D98B] hover:brightness-110"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  /* MAIN RENDER */
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-slate-900">

      <PaymentOverlay isOpen={showPayment} onClose={handlePaymentClose} amount={paymentAmount} type={selectedType?.label || "Session"} />

      <div className="relative z-10">
        
        <section className="px-5 pt-10 sm:px-8 lg:px-10">
          <div className="max-w-[1450px] mx-auto">
            <Link
              to="/browse-mentors"
              className="inline-flex items-center gap-2 mb-10 text-sm tracking-wide text-gray-500 transition-colors hover:text-[#D4AF37] group"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              Back to Companies
            </Link>

            <div
              className="relative overflow-hidden border border-[#D4AF37]/40 bg-cover bg-center bg-no-repeat shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
              style={companyDetails?.companyImage ? { backgroundImage: `url(${companyDetails.companyImage})` } : undefined}
            >
              {/* Company image + dark cinematic overlay */}
              <div className="absolute inset-0 bg-slate-950/70" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,0.22),transparent_42%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/65 to-black/85" />

              <GoldCorners opacity="border-[#D4AF37]/60" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

              <div className="relative z-10 flex flex-col items-center px-8 py-16 text-center sm:px-14">
                {/* ================= LUXURY MEDALLION ================= */}
                <div className="relative flex items-center justify-center mb-9">
                  <Laurel className="absolute hidden mr-1 -translate-y-1/2 right-full top-1/2 sm:block" />
                  <Laurel flip className="absolute hidden ml-1 -translate-y-1/2 left-full top-1/2 sm:block" />

                  <div className="absolute rounded-full -inset-6 border border-dashed border-[#D4AF37]/25 animate-[spin_22s_linear_infinite]" />
                  <div className="absolute rounded-full -inset-8 bg-[#D4AF37]/15 blur-2xl" />

                 <div className="relative flex items-center justify-center border-2 rounded-full w-44 h-44 sm:w-52 sm:h-52 border-[#D4AF37] bg-white shadow-[0_0_60px_rgba(212,175,55,0.45),0_0_100px_rgba(212,175,55,0.18)]">

  <div className="absolute rounded-full inset-2 border border-[#D4AF37]/40" />
  <div className="absolute rounded-full inset-4 border border-[#D4AF37]/20" />

  <div className="absolute inset-0 overflow-hidden rounded-full">
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent animate-[shimmer_3.5s_ease-in-out_infinite]" />
  </div>

  {companyDetails?.logo ? (
    <img
      src={companyDetails.logo}
      alt={`${decodedCompanyName} logo`}
      className="relative z-10 object-contain w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white drop-shadow-[0_4px_20px_rgba(212,175,55,0.35)]"
    />
  ) : (
    <span className="relative z-10 font-serif text-5xl font-bold text-[#D4AF37]">
      {decodedCompanyName.charAt(0).toUpperCase()}
    </span>
  )}
</div>

                  <div className="absolute z-20 flex items-center gap-1 px-3 py-1 -translate-x-1/2 border rounded-full shadow-lg -bottom-3 left-1/2 border-[#D4AF37]/60 bg-gradient-to-r from-[#0a0a0a] to-[#151105] whitespace-nowrap">
                    <Crown size={12} className="text-[#D4AF37]" />
                    <span className="text-[10px] font-bold tracking-widest text-[#E8C766] uppercase">Premium Partner</span>
                  </div>
                </div>

                <h1 className="font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {decodedCompanyName}
                </h1>

                <div className="flex items-center gap-2 mt-4">
                  <div className="w-8 h-px bg-[#D4AF37]/40" />
                  <VerifiedBadge size={16} />
                  <span className="text-xs tracking-widest text-blue-700 uppercase">Verified</span>
                  <div className="w-8 h-px bg-[#D4AF37]/40" />
                </div>

                <p className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400 md:text-base">
                  <Rocket size={16} className="text-[#D4AF37]" />
                  Learn from the best minds at <span className="font-semibold text-white">{decodedCompanyName}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <SessionRequirements
          requirements={requirements}
          setRequirements={setRequirements}
          wallet={wallet}
          onPay={handlePay}
          onWallet={handleUseWallet}
          isPaying={isPaying}
        />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        * { scrollbar-width: thin; scrollbar-color: #D4AF37 #0a0a0a; }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: #ffffff; }
        *::-webkit-scrollbar-thumb { background: #D4AF37; }
        html, body, #root { background: #ffffff; }
      `}</style>
    </div>
  );
};

export default SessionBoard;