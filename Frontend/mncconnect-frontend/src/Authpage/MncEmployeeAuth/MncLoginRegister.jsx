import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
  LogIn,
  UserPlus,
  Home,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

// Auth endpoints / storage keys. Keep these in one place if your backend paths differ.
const MENTOR_LOGIN_URL = `${API_URL}/auth/mentor/login`;
const MENTOR_FORGOT_PASSWORD_URL = `${API_URL}/auth/mentor/forgot-password`;
const MENTOR_DASHBOARD_PATH = "/mentor/home";
const MENTOR_REGISTERED_KEY = "mnc_mentor_registration_complete";
const MENTOR_VERIFICATION_KEY = "mnc_mentor_verification_status";
const MENTOR_EMAIL_KEY = "mnc_mentor_registered_email";

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const initialProfile = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  company: "",
  designation: "",
  department: "",
  experience: "",
  gender: "",
  location: "",
  linkedin: "",
  skills: "",
  bio: "",
  offerLetter: "",
  employeeIdProof: "",
  companyId: "",
  additionalProof: "",
  confirmationAccepted: false,
};

const emptyFiles = {
  offerLetter: null,
  employeeIdProof: null,
  additionalProof: null,
};

const INPUT_CLASS =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition-all duration-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-50 hover:border-slate-300";

const PRIMARY_ACTION =
  "border-transparent bg-[linear-gradient(135deg,#111827_0%,#1d4ed8_42%,#06b6d4_100%)] text-white shadow-[0_10px_28px_rgba(37,99,235,.18)] hover:shadow-[0_14px_34px_rgba(37,99,235,.24)] active:scale-[0.99] transition-[box-shadow,transform] duration-200";

const SECONDARY_ACTION =
  "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-300";

const STEP_ITEMS = [
  { number: 1, title: "Create profile", icon: UserRound },
  { number: 2, title: "Submit proof", icon: FileCheck2 },
  { number: 3, title: "Verification", icon: ShieldCheck },
];

const REQUIRED_STEP_1_FIELDS = [
  ["name", "Full name is required."],
  ["email", "Professional email is required."],
  ["mobile", "Mobile number is required."],
  ["password", "Password is required."],
  ["company", "Current MNC / Company is required."],
  ["designation", "Designation is required."],
  ["department", "Department / Team is required."],
  ["gender", "Gender is required."], // ADD
  ["experience", "Years of experience is required."],
  ["location", "Current location is required."],
  ["skills", "Skills / Expertise is required."],
  ["bio", "Professional bio is required."],
];

// ============================================================================
// TOAST / POPUP NOTIFICATION SYSTEM
// ============================================================================

function Toast({ message, type = "success", onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === "success" ? "bg-emerald-500" : "bg-red-500";
  const borderColor =
    type === "success" ? "border-emerald-200" : "border-red-200";
  const iconBg = type === "success" ? "bg-emerald-100" : "bg-red-100";
  const iconColor = type === "success" ? "text-emerald-600" : "text-red-600";

  return (
    <div className="fixed top-4 right-4 z-[100000] max-w-sm w-full animate-slideInRight">
      <div
        className={`rounded-xl border ${borderColor} bg-white shadow-[0_20px_60px_rgba(0,0,0,.12)] overflow-hidden`}
      >
        <div className={`h-1 w-full ${bgColor}`} />
        <div className="flex items-start gap-3 p-4">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}
          >
            {type === "success" ? (
              <CheckCircle2 className={`h-4 w-4 ${iconColor}`} />
            ) : (
              <X className={`h-4 w-4 ${iconColor}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900">
              {type === "success" ? "Success" : "Error"}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-5">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast container to manage multiple toasts
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration || 4000}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MncEmployeeProfile() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLoader, setShowLoader] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [step, setStep] = useState(1);

  const [profile, setProfile] = useState(initialProfile);
  const [files, setFiles] = useState(emptyFiles);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [errors, setErrors] = useState({});
  const [cropState, setCropState] = useState({
    cropX: 0.18,
    cropY: 0.14,
    cropW: 0.64,
    cropH: 0.7,
  });
  const [toasts, setToasts] = useState([]);

  const objectUrlsRef = useRef(new Set());

  const currentPath = location.pathname;
  const isRegisterRoute =
    currentPath === "/mentor/register" || currentPath === "/mentor";
  const isLoginRoute = currentPath === "/mentor/login";
  const isForgotPasswordRoute = currentPath === "/mentor/forgot-password";

  // ==========================================================================
  // TOAST FUNCTIONS
  // ==========================================================================

  const showToast = (message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    const registered =
      window.localStorage.getItem(MENTOR_REGISTERED_KEY) === "true";
    setIsRegistered(registered);

    // Show toast if registration success flag is present
    if (location.state?.registrationSuccess) {
      showToast(
        "🎉 Registration successful! Your account is pending verification.",
        "success",
        5000,
      );
      // Clear the state to prevent showing again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (registered && isRegisterRoute) {
      navigate("/mentor/login", { replace: true });
      return;
    }

    if (!isRegisterRoute) {
      setShowLoader(false);
      return;
    }

    const timer = window.setTimeout(() => setShowLoader(false), 2650);
    return () => window.clearTimeout(timer);
  }, [isRegisterRoute, navigate, location.state]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;

    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      html.style.overscrollBehavior = "";
      window.scrollTo(0, scrollY);
    };
  }, [preview]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const update = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const setObjectUrl = (file) => {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  };

  const handleFile = (field, file) => {
    if (!file) return;

    const currentFile = files[field];
    if (currentFile?.__url) {
      URL.revokeObjectURL(currentFile.__url);
      objectUrlsRef.current.delete(currentFile.__url);
    }

    const prepared = Object.assign(file, { __url: setObjectUrl(file) });
    setFiles((prev) => ({ ...prev, [field]: prepared }));
    update(field, file.name);
  };

  const openPreview = (field) => {
    const file = files[field];
    if (!file?.__url) return;

    setCropState({ cropX: 0.18, cropY: 0.14, cropW: 0.64, cropH: 0.7 });
    setPreview({
      field,
      file,
      name: file.name,
      url: file.__url,
      isImage: file.type.startsWith("image/"),
      isPdf: file.type === "application/pdf",
    });
  };

  const closePreview = () => setPreview(null);
  const resetCrop = () =>
    setCropState({ cropX: 0.18, cropY: 0.14, cropW: 0.64, cropH: 0.7 });

  const saveCrop = async () => {
    if (!preview?.file || !preview.isImage) return;

    try {
      const image = new Image();
      image.src = preview.url;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const stageWidth = 1200;
      const stageHeight = 750;
      const fitScale = Math.min(
        stageWidth / image.naturalWidth,
        stageHeight / image.naturalHeight,
      );
      const renderedWidth = image.naturalWidth * fitScale;
      const renderedHeight = image.naturalHeight * fitScale;
      const imageLeft = (stageWidth - renderedWidth) / 2;
      const imageTop = (stageHeight - renderedHeight) / 2;

      const cropX = cropState.cropX * stageWidth;
      const cropY = cropState.cropY * stageHeight;
      const cropW = cropState.cropW * stageWidth;
      const cropH = cropState.cropH * stageHeight;

      const sourceX = Math.max(0, (cropX - imageLeft) / fitScale);
      const sourceY = Math.max(0, (cropY - imageTop) / fitScale);
      const sourceRight = Math.min(
        image.naturalWidth,
        (cropX + cropW - imageLeft) / fitScale,
      );
      const sourceBottom = Math.min(
        image.naturalHeight,
        (cropY + cropH - imageTop) / fitScale,
      );
      const sourceWidth = Math.max(1, sourceRight - sourceX);
      const sourceHeight = Math.max(1, sourceBottom - sourceY);

      const outputWidth = 1400;
      const outputHeight = Math.max(
        1,
        Math.round(outputWidth * (sourceHeight / sourceWidth)),
      );

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            value ? resolve(value) : reject(new Error("Crop failed"));
          },
          "image/jpeg",
          0.96,
        );
      });

      const croppedFile = new File(
        [blob],
        `${preview.name.replace(/\.[^/.]+$/, "")}-cropped.jpg`,
        { type: "image/jpeg" },
      );

      const currentFile = files[preview.field];
      if (currentFile?.__url) {
        URL.revokeObjectURL(currentFile.__url);
        objectUrlsRef.current.delete(currentFile.__url);
      }

      const prepared = Object.assign(croppedFile, {
        __url: setObjectUrl(croppedFile),
      });
      setFiles((prev) => ({ ...prev, [preview.field]: prepared }));
      update(preview.field, prepared.name);
      closePreview();
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  const validateStep = (currentStep) => {
    const nextErrors = {};

    if (currentStep === 1) {
      REQUIRED_STEP_1_FIELDS.forEach(([field, message]) => {
        if (!String(profile[field] || "").trim()) {
          nextErrors[field] = message;
        }
      });

      if (profile.password && profile.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters.";
      }
      if (
        profile.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())
      ) {
        nextErrors.email = "Enter a valid professional email.";
      }
    }

    if (currentStep === 2) {
      if (!files.offerLetter) {
        nextErrors.offerLetter =
          "Company offer letter / employment proof is required.";
      }
      if (!files.employeeIdProof) {
        nextErrors.employeeIdProof =
          "Employee ID / company ID proof is required.";
      }
      if (!String(profile.companyId || "").trim()) {
        nextErrors.companyId = "Company Employee ID is required.";
      }
    }

    if (currentStep === 3 && !profile.confirmationAccepted) {
      nextErrors.confirmation =
        "Please confirm that the information and documents are genuine.";
    }

    setErrors(nextErrors);
    setValidationAttempted(true);

    if (Object.keys(nextErrors).length === 0) return true;

    setTimeout(() => {
      document.querySelector("[data-validation-error]")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);

    return false;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setValidationAttempted(false);
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    setValidationAttempted(false);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitForVerification = async (event) => {
    event.preventDefault();
    if (!validateStep(3) || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();

      Object.entries(profile).forEach(([key, value]) => {
        if (key === "confirmationAccepted") {
          formData.append(key, value ? "true" : "false");
        } else if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value);
        }
      });

      if (files.offerLetter) formData.append("offerLetter", files.offerLetter);
      if (files.employeeIdProof)
        formData.append("employeeIdProof", files.employeeIdProof);
      if (files.additionalProof)
        formData.append("additionalProof", files.additionalProof);

      const response = await fetch(`${API_URL}/auth/mentor/register`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMessage =
          data.message || "Registration failed. Please try again.";
        if (response.status === 409) {
          errorMessage =
            data.message ||
            "An account already exists with this email, mobile, or employee ID.";
        } else if (response.status === 400) {
          errorMessage =
            data.message || "Please check all fields and try again.";
        } else if (response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        }
        showToast(errorMessage, "error", 5000);
        return;
      }

      window.localStorage.setItem(MENTOR_REGISTERED_KEY, "true");
      window.localStorage.setItem(MENTOR_EMAIL_KEY, profile.email.trim());

      const backendVerificationStatus = String(
        data?.verificationStatus ||
          data?.verification?.status ||
          data?.status ||
          "pending",
      ).toLowerCase();
      const verificationStatus = [
        "verified",
        "approved",
        "success",
        "active",
      ].includes(backendVerificationStatus)
        ? "verified"
        : "pending";

      window.localStorage.setItem(MENTOR_VERIFICATION_KEY, verificationStatus);
      setIsRegistered(true);

      // Navigate to login with success state to show toast
      navigate("/mentor/login", {
        replace: true,
        state: {
          registered: true,
          email: profile.email.trim(),
          verificationStatus,
          registrationSuccess: true,
        },
      });
    } catch (error) {
      console.error("Submission error:", error);
      const message =
        error.message === "Failed to fetch"
          ? "Cannot connect to server. Please check if the backend is running."
          : error.message || "Unable to submit registration. Please try again.";
      showToast(message, "error", 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const stepTitle = useMemo(() => {
    const titles = [
      "",
      "Create Profile",
      "Submit Professional Proof",
      "Verify & Submit",
    ];
    return titles[step] || "";
  }, [step]);

  // ==========================================================================
  // RENDER - AUTH ROUTES (Login & Forgot Password)
  // ==========================================================================

  if (isLoginRoute || isForgotPasswordRoute) {
    return (
      <div className="min-h-screen w-full overflow-x-clip bg-gradient-to-br from-[#f7f9fc] via-[#f0f4f8] to-[#e8edf4] text-slate-950">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <Header navigate={navigate} />
        <div className="relative">
          <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl items-start px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="w-full">
              <MobileAuthNav
                isRegistered={isRegistered}
                isLoginRoute={isLoginRoute}
                isRegisterRoute={isRegisterRoute}
              />
              <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,820px)] lg:items-start lg:justify-center lg:gap-10">
                <AuthSidebar
                  isRegistered={isRegistered}
                  isLoginRoute={isLoginRoute}
                  isRegisterRoute={isRegisterRoute}
                />
                <div className="min-w-0 w-full">
                  {isLoginRoute ? (
                    <MentorLogin showToast={showToast} />
                  ) : (
                    <MentorForgotPassword showToast={showToast} />
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
        <AuthMotionStyles />
      </div>
    );
  }

  // ==========================================================================
  // RENDER - MAIN REGISTRATION
  // ==========================================================================

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-gradient-to-br from-[#f7f9fc] via-[#f0f4f8] to-[#e8edf4] text-slate-950">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {preview && (
        <DocumentPreview
          preview={preview}
          cropState={cropState}
          setCropState={setCropState}
          onClose={closePreview}
          onReset={resetCrop}
          onSaveCrop={saveCrop}
        />
      )}

      <Header navigate={navigate} />
      <div className="relative overflow-visible">
        <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl items-start px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="w-full">
            <MobileAuthNav
              isRegistered={isRegistered}
              isRegisterRoute={isRegisterRoute}
            />
            <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,820px)] lg:items-start lg:justify-center lg:gap-10">
              <AuthSidebar
                isRegistered={isRegistered}
                isRegisterRoute={isRegisterRoute}
              />

              <form onSubmit={submitForVerification} className="min-w-0 w-full">
                <div className="w-full rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,.07)] sm:rounded-[30px]">
                  <div>
                    <FormHeader step={step} stepTitle={stepTitle} />
                  </div>

                  <div className="px-4 py-5 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
                    {step === 1 && (
                      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,.12)]">
                        <div className="flex items-start gap-3 p-4 sm:p-5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                            <LockKeyhole className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                              Important before you start
                            </p>
                            <p className="mt-1.5 text-sm font-semibold leading-5 text-white">
                              Enter your professional information carefully.
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-300">
                              After final submission, your profile details are
                              locked until verification is completed.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="min-w-0">
                      {step === 1 && (
                        <StepOne
                          profile={profile}
                          update={update}
                          errors={errors}
                          validationAttempted={validationAttempted}
                        />
                      )}

                      {step === 2 && (
                        <StepTwo
                          profile={profile}
                          update={update}
                          files={files}
                          handleFile={handleFile}
                          openPreview={openPreview}
                          errors={errors}
                          validationAttempted={validationAttempted}
                        />
                      )}

                      {step === 3 && (
                        <StepThree
                          profile={profile}
                          files={files}
                          update={update}
                          errors={errors}
                          validationAttempted={validationAttempted}
                        />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 bg-white/95 px-4 pb-4 sm:px-7 lg:px-8">
                    <ActionBar
                      step={step}
                      goBack={goBack}
                      goNext={goNext}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {showLoader && isRegisterRoute && <McLoader />}

      <style>{`
        html {
          scrollbar-gutter: stable both-edges;
        }
        body {
          overflow-y: scroll;
          overflow-x: clip;
        }
        #root {
          min-width: 0;
          width: 100%;
          overflow: visible;
        }

        @media (min-width: 1024px) {
          .mentor-auth-sticky {
            position: -webkit-sticky !important;
            position: sticky !important;
            top: 96px !important;
            align-self: start !important;
            height: fit-content !important;
            overflow: visible !important;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.32s cubic-bezier(.22,1,.36,1) forwards;
        }
        .animate-slideIn {
          animation: slideIn 0.28s cubic-bezier(.22,1,.36,1) forwards;
        }
        .animate-slideInRight {
          animation: slideInRight 0.35s cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes completeToast {
          from { opacity: 0; transform: translateY(-8px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes completeLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-completeToast { animation: completeToast .42s cubic-bezier(.22,1,.36,1) both; }
        .animate-completeLine { animation: completeLine 1.6s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// ----- HEADER -----
function Header({ navigate }) {
  return (
    <header className="border-b border-slate-200/80 bg-white/95 px-4 py-4 sm:px-8 sticky top-0 z-50 transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl transition-all duration-300 hover:scale-105"
        >
          <span className="text-slate-900">MNC</span>
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            CONNECT
          </span>
          <Home className="h-5 w-5 text-slate-400 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:text-blue-600" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-all duration-300 hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Go to Home</span>
        </button>
      </div>
    </header>
  );
}

// ----- MOBILE AUTH NAV -----
function MobileAuthNav({
  isRegistered = false,
  isLoginRoute = false,
  isRegisterRoute = false,
}) {
  const navigate = useNavigate();
  const isVerified =
    (window.localStorage.getItem(MENTOR_VERIFICATION_KEY) || "pending") ===
    "verified";
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm lg:hidden">
      <button
        type="button"
        disabled={isRegistered}
        onClick={() => !isRegistered && navigate("/mentor/register")}
        className={`relative flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold ${isRegisterRoute ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"} ${isRegistered ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${isVerified ? "bg-blue-600 text-white" : isRegistered ? "bg-amber-400 text-slate-950" : isRegisterRoute ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-500"}`}
        >
          1
          {isLoginRoute && !isRegistered && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-800 text-white">
              <LockKeyhole className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
        <span className="truncate">Register</span>
        {isRegistered &&
          (isVerified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
          ))}
      </button>
      <button
        type="button"
        onClick={() => navigate("/mentor/login")}
        className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold ${isLoginRoute ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
      >
        <span
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${isLoginRoute ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-500"}`}
        >
          2
          {isRegisterRoute && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-800 text-white">
              <LockKeyhole className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
        <span className="truncate">Mentor Login</span>
      </button>
    </div>
  );
}

// ----- AUTH SIDEBAR / TWO-BUTTON NAV -----
function AuthSidebar({
  isRegistered = false,
  isLoginRoute = false,
  isRegisterRoute = false,
}) {
  const navigate = useNavigate();
  const verificationStatus =
    window.localStorage.getItem(MENTOR_VERIFICATION_KEY) || "pending";
  const isVerified = verificationStatus === "verified";

  const itemClass = (active) =>
    `group relative flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left ${
      active
        ? "border border-amber-300/70 bg-white shadow-[0_12px_30px_rgba(15,23,42,.08)]"
        : "border border-transparent hover:border-slate-200 hover:bg-white/70"
    }`;

  return (
    <aside
      className="mentor-auth-sticky hidden w-full self-start lg:block lg:h-fit lg:self-start"
      style={{ position: "sticky", top: "96px", alignSelf: "flex-start" }}
    >
      <div>
        <p className="mb-5 pl-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
          Mentor access
        </p>

        <div className="relative pl-0">
          <div className="absolute left-[27px] top-8 h-[118px] w-px bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" />

          {/* BUTTON 1 — REGISTER */}
          {isRegistered ? (
            <button
              type="button"
              disabled
              title={
                isVerified
                  ? "Verification completed"
                  : "Registration locked until verification is completed"
              }
              className={`${itemClass(isRegisterRoute)} cursor-not-allowed opacity-95`}
            >
              <span
                className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${isVerified ? "border-blue-500 bg-blue-600 text-white shadow-[0_6px_18px_rgba(37,99,235,.22)]" : "border-amber-500 bg-amber-400 text-slate-950 shadow-[0_6px_18px_rgba(251,191,36,.22)]"}`}
              >
                1
                <span
                  className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm ${isVerified ? "bg-blue-600 text-white" : "bg-slate-800 text-white"}`}
                >
                  {isVerified ? (
                    <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <LockKeyhole className="h-3 w-3" strokeWidth={2.5} />
                  )}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950">
                  Register
                </span>
                <span
                  className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${isVerified ? "text-blue-600" : "text-slate-400"}`}
                >
                  {isVerified ? "Verification completed" : "Profile locked"}
                </span>
              </span>
              {isRegisterRoute && (
                <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-amber-400" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/mentor/register")}
              className={itemClass(isRegisterRoute)}
            >
              <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500 bg-amber-400 text-xs font-bold text-slate-950 shadow-[0_6px_18px_rgba(251,191,36,.22)]">
                1
                {isLoginRoute && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white">
                    <LockKeyhole className="h-3 w-3" />
                  </span>
                )}
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-950">
                  Register
                </span>
                <span
                  className={`mt-0.5 block text-[10px] font-semibold ${isLoginRoute ? "text-slate-400" : "text-slate-400"}`}
                >
                  {isLoginRoute
                    ? "Locked while signed-in flow is active"
                    : "Create mentor profile"}
                </span>
              </span>
              {isRegisterRoute && (
                <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-amber-400" />
              )}
            </button>
          )}

          {/* BUTTON 2 — MENTOR LOGIN */}
          <button
            type="button"
            disabled={!isRegistered}
            onClick={() => {
              if (isRegistered) {
                navigate("/mentor/login");
              }
            }}
            className={`${itemClass(isLoginRoute)} mt-4 ${
              !isRegistered ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <span
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                isLoginRoute
                  ? "border-amber-500 bg-amber-400 text-slate-950 shadow-[0_6px_18px_rgba(251,191,36,.22)]"
                  : isRegistered
                    ? "border-slate-200 bg-white text-slate-400"
                    : "border-slate-200 bg-slate-100 text-slate-300"
              }`}
            >
              2
              {!isRegistered && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white">
                  <LockKeyhole className="h-3 w-3" />
                </span>
              )}
              {isRegisterRoute && isRegistered && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white">
                  <LockKeyhole className="h-3 w-3" />
                </span>
              )}
            </span>

            <span>
              <span
                className={`block text-sm font-bold ${
                  isLoginRoute
                    ? "text-slate-950"
                    : isRegistered
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                Mentor Login
              </span>

              <span
                className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${
                  isLoginRoute
                    ? "text-amber-600"
                    : isRegistered
                      ? "text-slate-400"
                      : "text-slate-300"
                }`}
              >
                {!isRegistered && <LockKeyhole className="h-3 w-3" />}

                {isRegistered ? "Secure access" : "Register first"}
              </span>
            </span>

            {isLoginRoute && (
              <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-amber-400" />
            )}
          </button>
        </div>

        <div
          className={`mt-7 rounded-2xl border p-4 ${
            isVerified
              ? "border-blue-100 bg-blue-50/70"
              : isRegistered
                ? "border-amber-100 bg-amber-50/70"
                : "border-slate-200 bg-slate-50/70"
          }`}
        >
          {isVerified ? (
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          ) : (
            <LockKeyhole className="h-4 w-4 text-amber-600" />
          )}

          <p className="mt-2 text-xs font-bold text-slate-900">
            {isVerified
              ? "Verification completed"
              : isRegistered
                ? "Registration submitted and locked"
                : "Registration required"}
          </p>

          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            {isVerified
              ? "Your mentor account is verified. You can now login securely."
              : isRegistered
                ? "Your registration details are locked. You cannot register again. Please wait for admin verification. Once your account is approved, you can login securely."
                : "Please complete your mentor registration first. Once submitted, your registration details cannot be changed or submitted again."}
          </p>
        </div>
      </div>
    </aside>
  );
}

// ----- MENTOR LOGIN -----
function MentorLogin({ showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(
    () =>
      location.state?.email ||
      window.localStorage.getItem(MENTOR_EMAIL_KEY) ||
      "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    if (!location.state?.registered) return "";
    if (location.state?.registrationSuccess) {
      return "🎉 Registration successful! Your account is pending verification.";
    }
    return location.state?.verificationStatus === "verified"
      ? "Verification approved. You can login now."
      : "Registration completed. Your account is locked until verification is approved.";
  });

  useEffect(() => {
    if (location.state?.registered) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(MENTOR_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Invalid email or password.");
      }

      const verificationStatus = String(
        data?.verificationStatus || data?.mentor?.verificationStatus || "",
      ).toLowerCase();

      if (verificationStatus !== "approved") {
        throw new Error(
          data?.message || "Your account is waiting for admin verification.",
        );
      }
      const token = data.token || data.accessToken;
      if (token) window.localStorage.setItem("mnc_mentor_token", token);
      window.localStorage.setItem(MENTOR_EMAIL_KEY, email.trim());

      const backendVerificationStatus = String(
        data?.verificationStatus ||
          data?.verification?.status ||
          data?.mentor?.verificationStatus ||
          "",
      ).toLowerCase();
      if (
        ["verified", "approved", "success", "active"].includes(
          backendVerificationStatus,
        )
      ) {
        window.localStorage.setItem(MENTOR_VERIFICATION_KEY, "verified");
      }

      // Show login success toast
      showToast("✅ Login successful! Welcome back, Mentor.", "success", 4000);
      window.localStorage.setItem(MENTOR_EMAIL_KEY, email.trim());

      const mentorId =
        data?.mentor?.id || data?.mentor?._id || data?.id || data?._id;

      if (!mentorId) {
        throw new Error("Mentor ID was not returned by the server.");
      }

      window.localStorage.setItem("mentorId", String(mentorId));

      showToast("✅ Login successful! Welcome back, Mentor.", "success", 4000);

      navigate(MENTOR_DASHBOARD_PATH, { replace: true });
    } catch (loginError) {
      setError(
        loginError?.message === "Failed to fetch"
          ? "Cannot connect to the server. Please check the backend."
          : loginError?.message || "Login failed. Please try again.",
      );
      showToast(
        loginError?.message || "Login failed. Please try again.",
        "error",
        4000,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,.07)]">
      <div className="border-b border-slate-100/80 bg-gradient-to-r from-white via-slate-50/50 to-white px-6 py-7 sm:px-8">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
            MNC Mentor
          </p>
          <span className="rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
            SECURE LOGIN
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Welcome back
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Login with the professional email and password from your mentor
          registration.
        </p>
      </div>

      <form onSubmit={submit} className="px-6 py-7 sm:px-8">
        {notice && (
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(16,185,129,.10)] animate-completeToast">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,.22)]">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">
                  Completed
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {notice}
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-emerald-100">
              <span className="block h-full w-full origin-left bg-emerald-500 animate-completeLine" />
            </div>
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <Field label="Professional Email" required>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className={`${INPUT_CLASS} pr-12`}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 text-gray-400 transition-colors duration-200 hover:text-purple-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate("/mentor/forgot-password")}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${PRIMARY_ACTION}`}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Login as Mentor
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
          Your mentor verification status is managed by MNC Connect.
        </p>
      </form>
    </section>
  );
}

// ----- FORGOT PASSWORD -----
function MentorForgotPassword({ showToast }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(
    () => window.localStorage.getItem(MENTOR_EMAIL_KEY) || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your registered professional email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(MENTOR_FORGOT_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Unable to send reset instructions.");
      setMessage(
        data.message ||
          "Password reset instructions have been sent if the account exists.",
      );
      showToast("✅ Password reset link sent to your email.", "success", 4000);
    } catch (forgotError) {
      const errMsg =
        forgotError?.message === "Failed to fetch"
          ? "Cannot connect to the server."
          : forgotError?.message || "Unable to process the request.";
      setError(errMsg);
      showToast(errMsg, "error", 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,.07)]">
      <div className="border-b border-slate-100/80 bg-gradient-to-r from-white via-slate-50/50 to-white px-6 py-7 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
          MNC Mentor
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Reset password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Enter your registered professional email to request a password reset.
        </p>
      </div>
      <form onSubmit={submit} className="px-6 py-7 sm:px-8">
        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {error}
          </div>
        )}
        <Field label="Professional Email" required>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className={INPUT_CLASS}
          />
        </Field>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${PRIMARY_ACTION}`}
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/mentor/login")}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold ${SECONDARY_ACTION}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Mentor Login
        </button>
      </form>
    </section>
  );
}

// ----- AUTH MOTION -----
function AuthMotionStyles() {
  return (
    <style>{`
      @media (prefers-reduced-motion: reduce) {
        .animate-fadeIn, .animate-slideIn, .animate-slideInRight { animation: none !important; }
      }
    `}</style>
  );
}

// ----- FORM HEADER -----
function FormHeader({ step, stepTitle }) {
  const descriptions = {
    1: "Tell us about yourself and your current professional role.",
    2: "Upload employment proof for admin verification only. Your documents remain private.",
    3: "Review your details and confirm everything before submission.",
  };

  const stepEmojis = {
    1: "👤",
    2: "📄",
    3: "✅",
  };

  return (
    <div className="border-b border-slate-100/80 bg-gradient-to-b from-white to-slate-50/60 px-4 py-5 sm:px-7 sm:py-7 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
          MNC Employee
        </p>
        <span className="rounded-full border border-amber-200/60 bg-amber-50/80 px-2.5 py-1 text-[9px] font-bold text-amber-700 backdrop-blur-sm">
          STEP {step} / 3
        </span>
        <span className="text-sm ml-1">{stepEmojis[step]}</span>
      </div>

      <h1 className="mt-3 text-[28px] font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
        {stepTitle}
      </h1>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        {descriptions[step] || ""}
      </p>

      <div className="mt-3 inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-slate-500 backdrop-blur-sm">
        <span className="mr-1 text-red-500">*</span>
        Required field
      </div>
    </div>
  );
}

// ----- MC LOADER -----
function McLoader() {
  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden">
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
            className="font-black leading-none tracking-[-0.12em] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent"
            style={{
              fontSize: "clamp(30px, 10vw, 120px)",
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
  );
}

// ----- STEP ONE -----
function StepOne({
  profile,
  update,
  errors = {},
  validationAttempted = false,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="animate-fadeIn">
      <InfoBanner icon={UserRound} className="mb-7">
        Use your real professional information. This information will be
        reviewed before your mentor account is approved.
      </InfoBanner>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-5">
        <Field label="Legal / Full Name" required={validationAttempted}>
          <input
            value={profile.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Arun Kumar"
            className={`${INPUT_CLASS} ${errors.name && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <Hint>Your name used for professional verification.</Hint>
          <ErrorText
            error={errors.name}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Professional Email" required={validationAttempted}>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="arun@company.com"
            className={`${INPUT_CLASS} ${errors.email && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.email}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Mobile Number" required={validationAttempted}>
          <input
            value={profile.mobile}
            onChange={(e) => update("mobile", e.target.value)}
            placeholder="+91 98765 43210"
            className={`${INPUT_CLASS} ${errors.mobile && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <Hint>Approval notification will be sent here.</Hint>
          <ErrorText
            error={errors.mobile}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Password" required={validationAttempted}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={profile.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Min 8 characters"
              className={`${INPUT_CLASS} pr-12 ${
                errors.password && validationAttempted
                  ? "border-red-300 bg-red-50/50"
                  : ""
              }`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-purple-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={19} strokeWidth={2} />
              ) : (
                <Eye size={19} strokeWidth={2} />
              )}
            </button>
          </div>

          <Hint>Must be at least 8 characters long.</Hint>

          <ErrorText
            error={errors.password}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Current MNC / Company" required={validationAttempted}>
          <input
            value={profile.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="Google / Amazon / TCS"
            className={`${INPUT_CLASS} ${errors.company && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.company}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Designation" required={validationAttempted}>
          <input
            value={profile.designation}
            onChange={(e) => update("designation", e.target.value)}
            placeholder="Senior Software Engineer"
            className={`${INPUT_CLASS} ${errors.designation && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.designation}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Department / Team" required={validationAttempted}>
          <input
            value={profile.department}
            onChange={(e) => update("department", e.target.value)}
            placeholder="Engineering / Product / HR"
            className={`${INPUT_CLASS} ${errors.department && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.department}
            validationAttempted={validationAttempted}
          />
        </Field>
        <Field label="Gender" required={validationAttempted}>
          <select
            value={profile.gender}
            onChange={(e) => update("gender", e.target.value)}
            className={`${INPUT_CLASS} ${
              errors.gender && validationAttempted
                ? "border-red-300 bg-red-50/50"
                : ""
            }`}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          <ErrorText
            error={errors.gender}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Years of Experience" required={validationAttempted}>
          <input
            type="number"
            min="0"
            value={profile.experience}
            onChange={(e) => update("experience", e.target.value)}
            placeholder="5"
            className={`${INPUT_CLASS} ${errors.experience && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.experience}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="Current Location" required={validationAttempted}>
          <input
            value={profile.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Bengaluru, India"
            className={`${INPUT_CLASS} ${errors.location && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.location}
            validationAttempted={validationAttempted}
          />
        </Field>

        <Field label="LinkedIn Profile">
          <input
            type="url"
            value={profile.linkedin}
            onChange={(e) => update("linkedin", e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Skills / Expertise" required={validationAttempted}>
          <input
            value={profile.skills}
            onChange={(e) => update("skills", e.target.value)}
            placeholder="React, Java, DSA, Cloud..."
            className={`${INPUT_CLASS} ${errors.skills && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors.skills}
            validationAttempted={validationAttempted}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Professional Bio" required={validationAttempted}>
          <textarea
            value={profile.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Tell freshers about your career, expertise and what you can help them with..."
            className={`${INPUT_CLASS} min-h-32 resize-y ${errors?.bio && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
          />
          <ErrorText
            error={errors?.bio}
            validationAttempted={validationAttempted}
          />
        </Field>
      </div>
    </div>
  );
}

// ----- STEP TWO -----
function StepTwo({
  profile,
  update,
  files,
  handleFile,
  openPreview,
  errors = {},
  validationAttempted = false,
}) {
  return (
    <div className="animate-fadeIn">
      <InfoBanner icon={LockKeyhole} className="mb-7" variant="warning">
        <p className="font-bold text-slate-900">
          Just use for admin verification only
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Your uploaded documents will not be displayed on your public mentor
          profile. They are used only to verify your current employment.
        </p>
      </InfoBanner>

      <div className="mt-7 space-y-5">
        <DocumentUpload
          required={validationAttempted}
          label="Company Offer Letter / Employment Proof"
          description="Upload your company offer letter or current employment document."
          value={profile.offerLetter}
          onChange={(file) => handleFile("offerLetter", file)}
          onView={() => openPreview("offerLetter")}
          error={errors.offerLetter}
          validationAttempted={validationAttempted}
        />

        <DocumentUpload
          required={validationAttempted}
          label="Employee ID / Company ID Proof"
          description="Upload a valid company employee ID or another official employee proof."
          value={profile.employeeIdProof}
          onChange={(file) => handleFile("employeeIdProof", file)}
          onView={() => openPreview("employeeIdProof")}
          error={errors.employeeIdProof}
          validationAttempted={validationAttempted}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company Employee ID" required={validationAttempted}>
            <input
              value={profile.companyId}
              onChange={(e) => update("companyId", e.target.value)}
              placeholder="EMP-10293"
              className={`${INPUT_CLASS} ${errors.companyId && validationAttempted ? "border-red-300 bg-red-50/50" : ""}`}
            />
            <ErrorText
              error={errors.companyId}
              validationAttempted={validationAttempted}
            />
          </Field>

          <DocumentUpload
            label="Additional Proof"
            description="Optional document that helps verification."
            value={profile.additionalProof}
            onChange={(file) => handleFile("additionalProof", file)}
            onView={() => openPreview("additionalProof")}
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-slate-100/40 p-4 backdrop-blur-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <p className="text-xs leading-5 text-slate-600">
            Upload clear, readable documents. Admin will use these files only to
            verify your employment information.
          </p>
        </div>
      </div>
    </div>
  );
}

// ----- STEP THREE -----
function StepThree({
  profile,
  files,
  update,
  errors = {},
  validationAttempted = false,
}) {
  return (
    <div className="animate-fadeIn">
      <InfoBanner icon={FileCheck2} className="mb-7" variant="warning">
        <p className="font-bold text-slate-900">Final verification</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Review your information and verification documents before submitting
          your mentor profile.
        </p>
      </InfoBanner>

      <ReviewSection
        title="Personal & Professional Details"
        icon={UserRound}
        rows={[
          ["Full Name", profile.name],
          ["Professional Email", profile.email],
          ["Mobile", profile.mobile],
          ["Company", profile.company],
          ["Designation", profile.designation],
          ["Department", profile.department],
          [
            "Experience",
            profile.experience ? `${profile.experience} years` : "",
          ],
          ["Location", profile.location],
          ["LinkedIn", profile.linkedin || "Not provided"],
          ["Skills", profile.skills],
        ]}
      />

      <ReviewSection
        title="Verification Documents"
        icon={FileText}
        rows={[
          [
            "Offer / Employment Proof",
            files.offerLetter?.name || "Not provided",
          ],
          ["Employee ID Proof", files.employeeIdProof?.name || "Not provided"],
          ["Company Employee ID", profile.companyId],
          ["Additional Proof", files.additionalProof?.name || "Not provided"],
        ]}
      />

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Professional Bio
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {profile.bio || "No bio added"}
        </p>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-white/40 p-4 backdrop-blur-sm transition-all duration-300 hover:border-amber-200 hover:shadow-md">
        <input
          type="checkbox"
          checked={Boolean(profile.confirmationAccepted)}
          onChange={(event) =>
            update("confirmationAccepted", event.target.checked)
          }
          className="mt-1 h-4 w-4 accent-amber-500 shrink-0 transition-all duration-200"
        />
        <span className="text-xs leading-5 text-slate-600">
          <span className="mr-1 text-red-500">*</span>I confirm that the
          information and documents provided are genuine and accurate. I
          understand that my mentor profile will remain pending until MNC
          Connect admin verification is completed.
        </span>
      </label>
      <ErrorText
        error={errors.confirmation}
        validationAttempted={validationAttempted}
      />
    </div>
  );
}

// ----- ACTION BAR -----
function ActionBar({ step, goBack, goNext, isSubmitting = false }) {
  const isLast = step === 3;

  const handlePrimary = () => {
    if (isLast) return;
    goNext();
  };

  return (
    <div className="pt-4">
      <div className="rounded-2xl border border-amber-200/60 bg-white/90 p-3 shadow-[0_-8px_25px_rgba(15,23,42,.05)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className={`flex-1 rounded-xl border px-5 py-3.5 text-sm font-bold transition-all duration-300 disabled:opacity-50 ${SECONDARY_ACTION}`}
            >
              <ArrowLeft className="mr-2 inline h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              Back
            </button>
          )}

          <button
            type={isLast ? "submit" : "button"}
            onClick={handlePrimary}
            disabled={isSubmitting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-bold disabled:opacity-70 transition-all duration-300 ${PRIMARY_ACTION}`}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                {isLast ? "Submit for Verification" : "Continue"}
                {isLast ? (
                  <ShieldCheck className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                ) : (
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                )}
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
          {isLast
            ? "Your documents are shared only for admin verification."
            : "Required fields appear only after you press Continue."}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// ----- INFO BANNER -----
function InfoBanner({
  icon: Icon,
  children,
  className = "",
  variant = "default",
}) {
  const variantStyles = {
    default:
      "border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-amber-100/40 text-amber-600",
    warning:
      "border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-amber-100/40 text-amber-600",
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-md ${variantStyles[variant]} ${className}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-xs leading-5 text-slate-600">{children}</div>
    </div>
  );
}

// ----- FIELD -----
function Field({ label, required = false, children }) {
  return (
    <div className="transition-all duration-200">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ----- HINT -----
function Hint({ children }) {
  return <p className="mt-1.5 text-[11px] text-slate-400">{children}</p>;
}

// ----- ERROR TEXT -----
function ErrorText({ error, validationAttempted }) {
  if (!validationAttempted || !error) return null;
  return (
    <p
      data-validation-error
      className="mt-1.5 text-xs font-medium text-red-600 animate-fadeIn"
    >
      {error}
    </p>
  );
}

// ----- REVIEW SECTION -----
function ReviewSection({ title, icon: Icon, rows }) {
  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/80 to-white/40 px-4 py-3">
        <Icon className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>

      <div className="divide-y divide-slate-100/80 bg-white/80">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 transition-all duration-200 hover:bg-slate-50/50 sm:grid-cols-[190px_1fr]"
          >
            <span className="text-xs font-medium text-slate-400">{label}</span>
            <span className="break-words text-sm font-semibold text-slate-700">
              {value || "Not provided"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ----- DOCUMENT UPLOAD -----
function DocumentUpload({
  label,
  description,
  value,
  onChange,
  onView,
  required = false,
  validationAttempted = false,
  error = "",
}) {
  const inputRef = useRef(null);

  const pickFile = () => inputRef.current?.click();

  const handleCardClick = (event) => {
    if (event.target.closest("button")) return;
    pickFile();
  };

  const hasValue = Boolean(value);
  const hasError = error && validationAttempted;

  return (
    <div className="transition-all duration-300">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pickFile();
          }
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 outline-none transition-all duration-300 ${
          hasValue
            ? "border-emerald-300 bg-emerald-50/50 shadow-[0_4px_15px_rgba(16,185,129,.1)]"
            : hasError
              ? "border-red-300 bg-red-50/30"
              : "border-slate-200 bg-white hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
              hasValue
                ? "bg-emerald-100 text-emerald-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {hasValue ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {value || "Choose document"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              PDF, PNG or JPG • up to 10MB
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {hasValue && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onView();
                }}
                className="rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 transition-all duration-300 hover:bg-blue-50 hover:shadow-md"
              >
                View
              </button>
            )}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                pickFile();
              }}
              className="rounded-xl border border-amber-500 bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition-all duration-300 hover:bg-amber-500 hover:shadow-md hover:scale-105 active:scale-95"
            >
              {hasValue ? "Change" : "Browse"}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(event) => {
                onChange(event.target.files?.[0] || null);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <ErrorText error={error} validationAttempted={validationAttempted} />
    </div>
  );
}

// ----- DOCUMENT PREVIEW -----
function DocumentPreview({
  preview,
  cropState,
  setCropState,
  onClose,
  onReset,
  onSaveCrop,
}) {
  const previewName = preview?.name || "Document";
  const stageRef = useRef(null);

  const [cropDragging, setCropDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    rect: null,
    stageWidth: 1,
    stageHeight: 1,
  });

  const MIN_W = 0.04;
  const MIN_H = 0.04;
  const MIN_MARGIN = 0.01;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const clampRect = (rect) => {
    let { cropX, cropY, cropW, cropH } = rect;
    cropW = clamp(cropW, MIN_W, 1);
    cropH = clamp(cropH, MIN_H, 1);
    cropX = clamp(cropX, MIN_MARGIN, 1 - cropW - MIN_MARGIN);
    cropY = clamp(cropY, MIN_MARGIN, 1 - cropH - MIN_MARGIN);
    return { cropX, cropY, cropW, cropH };
  };

  const getStageSize = () => {
    const rect = stageRef.current?.getBoundingClientRect();
    return {
      width: Math.max(1, rect?.width || 1),
      height: Math.max(1, rect?.height || 1),
    };
  };

  const beginDrag = (event, mode = "move") => {
    if (!preview?.isImage) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const stage = getStageSize();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...cropState },
      stageWidth: stage.width,
      stageHeight: stage.height,
    };

    setDragMode(mode);
    setCropDragging(true);
  };

  const moveCrop = (event) => {
    if (!cropDragging || !dragMode || !dragRef.current.rect) return;

    const dx =
      (event.clientX - dragRef.current.startX) / dragRef.current.stageWidth;
    const dy =
      (event.clientY - dragRef.current.startY) / dragRef.current.stageHeight;
    const base = dragRef.current.rect;
    let next = { ...base };

    if (dragMode === "move") {
      next.cropX = base.cropX + dx;
      next.cropY = base.cropY + dy;
    } else {
      const left = base.cropX;
      const top = base.cropY;
      const right = base.cropX + base.cropW;
      const bottom = base.cropY + base.cropH;

      if (dragMode.includes("e")) next.cropW = right + dx - left;
      if (dragMode.includes("s")) next.cropH = bottom + dy - top;
      if (dragMode.includes("w")) {
        next.cropX = left + dx;
        next.cropW = right - next.cropX;
      }
      if (dragMode.includes("n")) {
        next.cropY = top + dy;
        next.cropH = bottom - next.cropY;
      }

      if (next.cropW < MIN_W) {
        next.cropW = MIN_W;
        if (dragMode.includes("w")) next.cropX = right - MIN_W;
      }
      if (next.cropH < MIN_H) {
        next.cropH = MIN_H;
        if (dragMode.includes("n")) next.cropY = bottom - MIN_H;
      }
    }

    setCropState((prev) => ({ ...prev, ...clampRect(next) }));
  };

  const endDrag = () => {
    setCropDragging(false);
    setDragMode(null);
  };

  const selectionStyle = {
    left: `${cropState.cropX * 100}%`,
    top: `${cropState.cropY * 100}%`,
    width: `${cropState.cropW * 100}%`,
    height: `${cropState.cropH * 100}%`,
  };

  return (
    <div
      className="fixed inset-0 z-[100000] bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#171717] text-white sm:h-[94vh] sm:max-w-5xl sm:rounded-2xl sm:shadow-[0_35px_120px_rgba(0,0,0,.42)] animate-fadeIn"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#222] px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {previewName}
            </p>
            <p className="mt-0.5 text-[10px] text-white/40">Crop</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/75 transition-all duration-300 hover:bg-white/10 hover:text-white hover:scale-110"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#111]">
          {preview?.isImage ? (
            <div className="flex min-h-full flex-col">
              <div className="flex min-h-[55vh] flex-1 items-center justify-center px-3 py-4 sm:min-h-0 sm:px-5 sm:py-6">
                <div
                  ref={stageRef}
                  className="relative w-full max-w-4xl overflow-hidden bg-[#0a0a0a] rounded-lg"
                  style={{ aspectRatio: "16 / 10" }}
                  onPointerMove={moveCrop}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onPointerLeave={endDrag}
                >
                  <img
                    src={preview.url}
                    alt={previewName}
                    draggable="false"
                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/42" />

                  <div
                    className={`absolute border-2 ${cropDragging ? "border-white" : "border-white/95"} cursor-move transition-shadow duration-200`}
                    style={{
                      ...selectionStyle,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,.50)",
                    }}
                    onPointerDown={(event) => beginDrag(event, "move")}
                  >
                    <span className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-white/25" />
                    <span className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-white/25" />
                    <span className="pointer-events-none absolute left-0 top-1/3 h-px w-full bg-white/25" />
                    <span className="pointer-events-none absolute left-0 top-2/3 h-px w-full bg-white/25" />

                    <span className="pointer-events-none absolute left-[-3px] top-[-3px] h-6 w-6 border-l-2 border-t-2 border-white" />
                    <span className="pointer-events-none absolute right-[-3px] top-[-3px] h-6 w-6 border-r-2 border-t-2 border-white" />
                    <span className="pointer-events-none absolute bottom-[-3px] left-[-3px] h-6 w-6 border-b-2 border-l-2 border-white" />
                    <span className="pointer-events-none absolute bottom-[-3px] right-[-3px] h-6 w-6 border-b-2 border-r-2 border-white" />

                    <span
                      onPointerDown={(event) => beginDrag(event, "n")}
                      className="absolute left-1/2 top-[-5px] h-3 w-16 -translate-x-1/2 cursor-ns-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "s")}
                      className="absolute bottom-[-5px] left-1/2 h-3 w-16 -translate-x-1/2 cursor-ns-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "w")}
                      className="absolute left-[-5px] top-1/2 h-16 w-3 -translate-y-1/2 cursor-ew-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "e")}
                      className="absolute right-[-5px] top-1/2 h-16 w-3 -translate-y-1/2 cursor-ew-resize"
                    />

                    <span
                      onPointerDown={(event) => beginDrag(event, "nw")}
                      className="absolute left-[-8px] top-[-8px] h-5 w-5 cursor-nwse-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "ne")}
                      className="absolute right-[-8px] top-[-8px] h-5 w-5 cursor-nesw-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "sw")}
                      className="absolute bottom-[-8px] left-[-8px] h-5 w-5 cursor-nesw-resize"
                    />
                    <span
                      onPointerDown={(event) => beginDrag(event, "se")}
                      className="absolute bottom-[-8px] right-[-8px] h-5 w-5 cursor-nwse-resize"
                    />

                    <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2.5 py-1 text-[9px] font-mono text-white sm:text-[10px] backdrop-blur-sm">
                      {Math.round(cropState.cropW * 1200)} ×{" "}
                      {Math.round(cropState.cropH * 750)}
                    </span>
                  </div>

                  <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-3 py-1.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
                    Drag edges / corners
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#222] px-3 py-3 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[10px] text-white/35">
                    Free crop • any size • no zoom
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                    <button
                      type="button"
                      onClick={onReset}
                      className="rounded-lg border border-white/10 bg-[#2c2c2c] px-3 py-2.5 text-xs font-semibold text-white/80 transition-all duration-300 hover:bg-[#3c3c3c] hover:scale-105 active:scale-95"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={onSaveCrop}
                      className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_25px_rgba(59,130,246,.25)] transition-all duration-300 hover:shadow-[0_12px_35px_rgba(59,130,246,.35)] hover:scale-105 active:scale-95"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-xs font-semibold text-white/65 transition-all duration-300 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : preview?.isPdf ? (
            <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
              <iframe
                title={previewName}
                src={preview.url}
                className="h-[78dvh] w-full rounded-xl bg-white"
              />
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center p-10 text-center">
              <div>
                <p className="text-sm font-semibold text-white">
                  Preview unavailable
                </p>
                <p className="mt-2 text-xs leading-5 text-white/40">
                  This document can still be submitted for verification.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
