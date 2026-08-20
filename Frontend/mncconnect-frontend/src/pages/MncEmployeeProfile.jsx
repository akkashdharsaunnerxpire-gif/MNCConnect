import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
const API_URL = import.meta.env.VITE_API_URL; // Change this to your backend URL

const initialProfile = {
  name: "",
  email: "",
  mobile: "",
  company: "",
  designation: "",
  department: "",
  experience: "",
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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-50";

const PRIMARY_ACTION =
  "border-transparent bg-[linear-gradient(135deg,#111827_0%,#1d4ed8_42%,#06b6d4_100%)] text-white shadow-[0_14px_40px_rgba(37,99,235,.24)]";

export default function MncEmployeeProfile() {
  const navigate = useNavigate();

  const [showLoader, setShowLoader] = useState(true);
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(initialProfile);
  const [files, setFiles] = useState(emptyFiles);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [errors, setErrors] = useState({});
  const [cropState, setCropState] = useState({
    cropX: 0.18,
    cropY: 0.14,
    cropW: 0.64,
    cropH: 0.70,
  });

  const objectUrlsRef = useRef(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowLoader(false);
    }, 2650);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const update = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const setObjectUrl = (file) => {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  };

  const replaceFileUrl = (oldFile, nextFile) => {
    if (oldFile?.__url) {
      URL.revokeObjectURL(oldFile.__url);
      objectUrlsRef.current.delete(oldFile.__url);
    }

    const nextUrl = setObjectUrl(nextFile);

    return Object.assign(nextFile, {
      __url: nextUrl,
    });
  };

  const handleFile = (field, file) => {
    if (!file) return;

    const currentFile = files[field];
    const prepared = Object.assign(file, {
      __url: setObjectUrl(file),
    });

    if (currentFile?.__url) {
      URL.revokeObjectURL(currentFile.__url);
      objectUrlsRef.current.delete(currentFile.__url);
    }

    setFiles((current) => ({
      ...current,
      [field]: prepared,
    }));

    update(field, file.name);
  };

  const openPreview = (field) => {
    const file = files[field];

    if (!file?.__url) return;

    setCropState({
      cropX: 0.18,
      cropY: 0.14,
      cropW: 0.64,
      cropH: 0.70,
    });

    setPreview({
      field,
      file,
      name: file.name,
      url: file.__url,
      isImage: file.type.startsWith("image/"),
      isPdf: file.type === "application/pdf",
    });
  };

  const closePreview = () => {
    setPreview(null);
  };

  const resetCrop = () => {
    setCropState({
      cropX: 0.18,
      cropY: 0.14,
      cropW: 0.64,
      cropH: 0.70,
    });
  };

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

      if (!context) {
        throw new Error("Canvas context unavailable");
      }

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
            if (value) resolve(value);
            else reject(new Error("Crop failed"));
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

      const prepared = replaceFileUrl(files[preview.field], croppedFile);

      setFiles((current) => ({
        ...current,
        [preview.field]: prepared,
      }));

      update(preview.field, prepared.name);
      closePreview();
    } catch (error) {
      console.error("Responsive crop failed:", error);
    }
  };

  const validateStep = (currentStep) => {
    const nextErrors = {};

    if (currentStep === 1) {
      const requiredFields = [
        ["name", "Full name is required."],
        ["email", "Professional email is required."],
        ["mobile", "Mobile number is required."],
        ["company", "Current MNC / Company is required."],
        ["designation", "Designation is required."],
        ["department", "Department / Team is required."],
        ["experience", "Years of experience is required."],
        ["location", "Current location is required."],
        ["skills", "Skills / Expertise is required."],
        ["bio", "Professional bio is required."],
      ];

      requiredFields.forEach(([field, message]) => {
        if (!String(profile[field] || "").trim()) {
          nextErrors[field] = message;
        }
      });

      if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
        nextErrors.email = "Enter a valid professional email.";
      }
    }

    if (currentStep === 2) {
      if (!files.offerLetter) {
        nextErrors.offerLetter = "Company offer letter / employment proof is required.";
      }
      if (!files.employeeIdProof) {
        nextErrors.employeeIdProof = "Employee ID / company ID proof is required.";
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

    if (Object.keys(nextErrors).length === 0) {
      return true;
    }

    window.setTimeout(() => {
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
    setStep((current) => Math.min(current + 1, 3));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const goBack = () => {
    setStep((current) => Math.max(current - 1, 1));
    setValidationAttempted(false);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const submitForVerification = async (event) => {
  event.preventDefault();
  
  if (!validateStep(3)) return;
  
  if (isSubmitting) return;
  
  setIsSubmitting(true);
  
  try {
    const formData = new FormData();
    
    Object.entries(profile).forEach(([key, value]) => {
      if (key === 'confirmationAccepted') {
        formData.append(key, value ? 'true' : 'false');
      } else if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });
    
    if (files.offerLetter) {
      formData.append('offerLetter', files.offerLetter);
    }
    
    if (files.employeeIdProof) {
      formData.append('employeeIdProof', files.employeeIdProof);
    }
    
    if (files.additionalProof) {
      formData.append('additionalProof', files.additionalProof);
    }
    
    console.log('Submitting mentor registration:');
    for (let pair of formData.entries()) {
      if (pair[1] instanceof File) {
        console.log(`${pair[0]}: File(${pair[1].name}, ${pair[1].size} bytes)`);
      } else {
        console.log(`${pair[0]}: ${pair[1]}`);
      }
    }
    
    // FIX: Use hardcoded URL or import.meta.env
    
    const response = await fetch(`${API_URL}/auth/mentor/register`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      let errorMessage = data.message || 'Registration failed. Please try again.';
      
      if (response.status === 409) {
        errorMessage = data.message || 'An account already exists with this email, mobile, or employee ID.';
      } else if (response.status === 400) {
        errorMessage = data.message || 'Please check all fields and try again.';
      } else if (response.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      alert(errorMessage);
      setIsSubmitting(false);
      return;
    }
    
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "auto" });
    
    console.log('Registration successful:', data);
    
  } catch (error) {
    console.error('Submission error:', error);
    
    if (error.message === 'Failed to fetch') {
      alert('Cannot connect to server. Please check if the backend is running on http://localhost:5000');
    } else {
      alert(error.message || 'Unable to submit registration. Please try again.');
    }
  } finally {
    setIsSubmitting(false);
  }
};

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

  const stepTitle = useMemo(() => {
    if (step === 1) return "Create Profile";
    if (step === 2) return "Submit Professional Proof";
    return "Verify & Submit";
  }, [step]);

  if (showLoader) {
    return <McLoader />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
        <Header navigate={navigate} />

        <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[220px_1fr]">
          <StepSidebar step={3} />

          <section className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white/90 p-7 shadow-[0_25px_80px_rgba(15,23,42,.08)] backdrop-blur-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-amber-700">
              Verification submitted
            </p>

            <h1 className="mt-3 text-center text-3xl font-black tracking-tight text-slate-950">
              Your profile is under review
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-slate-600">
              Your professional details and verification documents have been
              submitted for MNC Connect admin review.
            </p>

            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                <div>
                  <p className="font-bold text-slate-900">What happens next?</p>

                  <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-600">
                    <li>• Admin checks your employment information.</li>
                    <li>• Your mentor profile stays private during review.</li>
                    <li>• Approval is sent to your registered phone.</li>
                    <li>• After approval, you can login and use MNC Connect.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-amber-600" />

              <p className="text-xs leading-5 text-slate-500">
                <span className="font-bold text-slate-700">
                  Documents are for admin verification only.
                </span>{" "}
                They are not shown publicly on your mentor profile.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/")}
              className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold ${PRIMARY_ACTION}`}
            >
              Back to MNC Connect
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
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

      <main className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[230px_minmax(0,700px)] lg:justify-center lg:gap-16">
        <StepSidebar step={step} />

        <form onSubmit={submitForVerification} className="w-full">
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-[0_25px_80px_rgba(15,23,42,.08)] backdrop-blur-sm">
            <div className="border-b border-slate-100 px-6 py-7 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
                  MNC Employee
                </p>

                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                  STEP {step} / 3
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {stepTitle}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                {step === 1 &&
                  "Tell us about yourself and your current professional role."}
                {step === 2 &&
                  "Upload employment proof for admin verification only. Your documents remain private."}
                {step === 3 &&
                  "Review your details and confirm everything before submission."}
              </p>

              <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500">
                <span className="mr-1 text-red-500">*</span>
                Required field
              </div>
            </div>

            <div className="px-6 py-7 sm:px-8">
              {step === 1 && (
                <StepOne
                  profile={profile}
                  update={update}
                  inputClass={inputClass}
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

              <ActionBar
                step={step}
                goBack={goBack}
                goNext={goNext}
                validateStep={validateStep}
                isSubmitting={isSubmitting}
              />
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}

function McLoader() {
  const previewProfile = {
    name: "",
    email: "",
    mobile: "",
    company: "",
    designation: "",
    department: "",
    experience: "",
    location: "",
    linkedin: "",
    skills: "",
    bio: "",
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc]">
      <div className="pointer-events-none min-h-screen select-none">
        <Header navigate={() => {}} />

        <main className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[230px_minmax(0,700px)] lg:justify-center lg:gap-16">
          <StepSidebar step={1} />

          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,.08)]">
            <div className="border-b border-slate-100 px-6 py-7 sm:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
                MNC Employee
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Create Profile
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Tell us about yourself and your current professional role.
              </p>
            </div>

            <div className="px-6 py-7 sm:px-8">
              <StepOne
                profile={previewProfile}
                update={() => {}}
                inputClass={inputClass}
              />
            </div>
          </section>
        </main>
      </div>

      <div className="fixed inset-0 z-[99999] overflow-hidden">
        <div
          className="absolute inset-0 bg-white"
          style={{
            animation:
              "mncCurtain 2.65s cubic-bezier(.77,0,.18,1) forwards",
          }}
        />

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation:
              "mncFadeLayer 2.65s cubic-bezier(.77,0,.18,1) forwards",
          }}
        >
          <div
            className="relative"
            style={{
              animation:
                "mncZoomFull 2.65s cubic-bezier(.77,0,.18,1) forwards",
            }}
          >
            <div
              className="font-black leading-none tracking-[-0.12em] text-blue-600"
              style={{
                fontSize: "clamp(30px, 10vw, 120px)",
                textShadow: "0 14px 50px rgba(37,99,235,.18)",
              }}
            >
              MNC
            </div>

            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent"
              style={{
                animation: "mncSheen 1.1s ease-out .3s forwards",
                transform: "translateX(-120%)",
              }}
            />
          </div>
        </div>

        <div
          className="absolute left-1/2 top-[62%] flex -translate-x-1/2 items-center gap-2"
          style={{
            animation: "mncDots 1.9s ease-out forwards",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        </div>

        <div
          className="absolute left-1/2 top-[67%] -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.35em] text-slate-400"
          style={{
            animation: "mncCaption 1.3s ease-out forwards",
          }}
        >
        </div>
      </div>

      <style>{`
        @keyframes mncZoomFull {
          0% {
            transform: scale(.72);
            opacity: 0;
            filter: blur(7px);
          }

          16% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }

          48% {
            transform: scale(1.04);
            opacity: 1;
          }

          100% {
            transform: scale(18);
            opacity: 0;
          }
        }

        @keyframes mncCurtain {
          0%,
          54% {
            opacity: 1;
          }

          74% {
            opacity: .98;
          }

          100% {
            opacity: 0;
          }
        }

        @keyframes mncFadeLayer {
          0% {
            opacity: 1;
          }

          72% {
            opacity: 1;
          }

          100% {
            opacity: 0;
          }
        }

        @keyframes mncSheen {
          0% {
            opacity: 0;
            transform: translateX(-120%);
          }

          25% {
            opacity: .85;
          }

          100% {
            opacity: 0;
            transform: translateX(120%);
          }
        }

        @keyframes mncDots {
          0% {
            opacity: 0;
            transform: translate(-50%, 8px);
          }

          18% {
            opacity: 1;
            transform: translate(-50%, 0);
          }

          70% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(-50%, -5px);
          }
        }

        @keyframes mncCaption {
          0% {
            opacity: 0;
            transform: translate(-50%, 8px);
          }

          20% {
            opacity: 1;
            transform: translate(-50%, 0);
          }

          70% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(-50%, -4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

function Header({ navigate }) {
  return (
    <header className="border-b border-slate-200 bg-white/95 px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-2xl font-black tracking-tight"
        >
          MNC<span className="text-blue-600">CONNECT</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to Home
        </button>
      </div>
    </header>
  );
}

function StepSidebar({ step }) {
  const items = [
    { number: 1, title: "Create profile", icon: UserRound },
    { number: 2, title: "Submit proof", icon: FileCheck2 },
    { number: 3, title: "Verification", icon: ShieldCheck },
  ];

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-8">
        <p className="mb-7 text-sm font-medium text-slate-500">
          Employee onboarding
        </p>

        <div className="relative">
          <div className="absolute left-[15px] top-8 h-[145px] w-px bg-slate-200" />

          <div className="space-y-8">
            {items.map((item) => {
              const Icon = item.icon;
              const active = step >= item.number;

              return (
                <div
                  key={item.number}
                  className="relative flex items-center gap-4"
                >
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      active
                        ? "border-amber-500 bg-amber-400 text-slate-950"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {item.number}
                  </div>

                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        active ? "text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {item.title}
                    </p>

                    <Icon
                      className={`mt-1 h-3.5 w-3.5 ${
                        active ? "text-amber-600" : "text-slate-300"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <LockKeyhole className="h-4 w-4 text-amber-600" />

          <p className="mt-2 text-xs font-semibold leading-5 text-slate-900">
            Your proof documents are private.
          </p>

          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            They are used only for admin verification.
          </p>
        </div>
      </div>
    </aside>
  );
}

function StepOne({ profile, update, inputClass, errors = {}, validationAttempted = false }) {
  return (
    <div>
      <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

        <p className="text-xs leading-5 text-slate-600">
          Use your real professional information. This information will be
          reviewed before your mentor account is approved.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Legal / Full Name" showRequired={validationAttempted}>
          <input
            value={profile.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Arun Kumar"
            className={inputClass}
          />
          <Hint>Your name used for professional verification.</Hint>
          {validationAttempted && errors.name && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.name}
            </p>
          )}
        </Field>

        <Field label="Professional Email" showRequired={validationAttempted}>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="arun@company.com"
            className={inputClass}
          />
          {validationAttempted && errors.email && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.email}
            </p>
          )}
        </Field>

        <Field label="Mobile Number" showRequired={validationAttempted}>
          <input
            value={profile.mobile}
            onChange={(e) => update("mobile", e.target.value)}
            placeholder="+91 98765 43210"
            className={inputClass}
          />
          <Hint>Approval notification will be sent here.</Hint>
          {validationAttempted && errors.mobile && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.mobile}
            </p>
          )}
        </Field>

        <Field label="Password" showRequired={validationAttempted}>
          <input
            type="password"
            value={profile.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Min 8 characters"
            className={inputClass}
          />
          <Hint>Must be at least 8 characters long.</Hint>
          {validationAttempted && errors.password && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.password}
            </p>
          )}
        </Field>

        <Field label="Current MNC / Company" showRequired={validationAttempted}>
          <input
            value={profile.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="Google / Amazon / TCS"
            className={inputClass}
          />
          {validationAttempted && errors.company && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.company}
            </p>
          )}
        </Field>

        <Field label="Designation" showRequired={validationAttempted}>
          <input
            value={profile.designation}
            onChange={(e) => update("designation", e.target.value)}
            placeholder="Senior Software Engineer"
            className={inputClass}
          />
          {validationAttempted && errors.designation && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.designation}
            </p>
          )}
        </Field>

        <Field label="Department / Team" showRequired={validationAttempted}>
          <input
            value={profile.department}
            onChange={(e) => update("department", e.target.value)}
            placeholder="Engineering / Product / HR"
            className={inputClass}
          />
          {validationAttempted && errors.department && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.department}
            </p>
          )}
        </Field>

        <Field label="Years of Experience" showRequired={validationAttempted}>
          <input
            type="number"
            min="0"
            value={profile.experience}
            onChange={(e) => update("experience", e.target.value)}
            placeholder="5"
            className={inputClass}
          />
          {validationAttempted && errors.experience && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.experience}
            </p>
          )}
        </Field>

        <Field label="Current Location" icon={MapPin} required>
          <input
            value={profile.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Bengaluru, India"
            className={inputClass}
          />
          {validationAttempted && errors.location && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.location}
            </p>
          )}
        </Field>

        <Field label="LinkedIn Profile">
          <input
            type="url"
            value={profile.linkedin}
            onChange={(e) => update("linkedin", e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
            className={inputClass}
          />
        </Field>

        <Field label="Skills / Expertise" showRequired={validationAttempted}>
          <input
            value={profile.skills}
            onChange={(e) => update("skills", e.target.value)}
            placeholder="React, Java, DSA, Cloud..."
            className={inputClass}
          />
          {validationAttempted && errors.skills && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors.skills}
            </p>
          )}
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Professional Bio" showRequired={validationAttempted}>
          <textarea
            value={profile.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Tell freshers about your career, expertise and what you can help them with..."
            className={`${inputClass} min-h-32 resize-y ${errors?.bio && validationAttempted ? "border-red-300" : ""}`}
          />
          {validationAttempted && errors?.bio && (
            <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
              {errors?.bio}
            </p>
          )}
        </Field>
      </div>
    </div>
  );
}

function StepTwo({
  profile,
  update,
  handleFile,
  openPreview,
  errors = {},
  validationAttempted = false,
}) {
  return (
    <div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <p className="font-bold text-slate-900">
              Just use for admin verification only
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Your uploaded documents will not be displayed on your public
              mentor profile. They are used only to verify your current
              employment.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-5">
        <DocumentUpload
          showRequired={validationAttempted}
          label="Company Offer Letter / Employment Proof"
          description="Upload your company offer letter or current employment document."
          value={profile.offerLetter}
          onChange={(file) => handleFile("offerLetter", file)}
          onView={() => openPreview("offerLetter")}
          error={errors.offerLetter}
        />
        {validationAttempted && errors.offerLetter && (
          <p data-validation-error className="-mt-3 text-xs font-medium text-red-600">
            {errors.offerLetter}
          </p>
        )}

        <DocumentUpload
          showRequired={validationAttempted}
          label="Employee ID / Company ID Proof"
          description="Upload a valid company employee ID or another official employee proof."
          value={profile.employeeIdProof}
          onChange={(file) => handleFile("employeeIdProof", file)}
          onView={() => openPreview("employeeIdProof")}
          error={errors.employeeIdProof}
        />
        {validationAttempted && errors.employeeIdProof && (
          <p data-validation-error className="-mt-3 text-xs font-medium text-red-600">
            {errors.employeeIdProof}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company Employee ID" showRequired={validationAttempted}>
            <input
              value={profile.companyId}
              onChange={(e) => update("companyId", e.target.value)}
              placeholder="EMP-10293"
              className={inputClass}
            />
            {validationAttempted && errors.companyId && (
              <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
                {errors.companyId}
              </p>
            )}
          </Field>

          <DocumentUpload
            label="Additional Proof"
            description="Optional document that helps verification."
            value={profile.additionalProof}
            onChange={(file) => handleFile("additionalProof", file)}
            onView={() => openPreview("additionalProof")}
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

          <p className="text-xs leading-5 text-slate-600">
            Upload clear, readable documents. Admin will use these files only
            to verify your employment information.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepThree({ profile, files, update, errors = {}, validationAttempted = false }) {
  return (
    <div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <p className="font-bold text-slate-900">Final verification</p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Review your information and verification documents before
              submitting your mentor profile.
            </p>
          </div>
        </div>
      </div>

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
          ["Experience", profile.experience ? `${profile.experience} years` : ""],
          ["Location", profile.location],
          ["LinkedIn", profile.linkedin || "Not provided"],
          ["Skills", profile.skills],
        ]}
      />

      <ReviewSection
        title="Verification Documents"
        icon={FileText}
        rows={[
          ["Offer / Employment Proof", files.offerLetter?.name || "Not provided"],
          [
            "Employee ID Proof",
            files.employeeIdProof?.name || "Not provided",
          ],
          ["Company Employee ID", profile.companyId],
          [
            "Additional Proof",
            files.additionalProof?.name || "Not provided",
          ],
        ]}
      />

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Professional Bio
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {profile.bio || "No bio added"}
        </p>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={Boolean(profile.confirmationAccepted)}
          onChange={(event) =>
            update("confirmationAccepted", event.target.checked)
          }
          className="mt-1 h-4 w-4 accent-amber-500"
        />

        <span className="text-xs leading-5 text-slate-600">
          <span className="mr-1 text-red-500">*</span>
          I confirm that the information and documents provided are genuine
          and accurate. I understand that my mentor profile will remain
          pending until MNC Connect admin verification is completed.
        </span>
        {validationAttempted && errors.confirmation && (
          <p data-validation-error className="mt-2 text-xs font-medium text-red-600">
            {errors.confirmation}
          </p>
        )}
      </label>
    </div>
  );
}

function ReviewSection({ title, icon: Icon, rows }) {
  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <Icon className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>

      <div className="divide-y divide-slate-100 bg-white">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[190px_1fr]"
          >
            <span className="text-xs font-medium text-slate-400">
              {label}
            </span>

            <span className="break-words text-sm font-semibold text-slate-700">
              {value || "Not provided"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentUpload({
  label,
  description,
  value,
  onChange,
  onView,
  required = false,
  showRequired = false,
  error = "",
}) {
  const inputRef = useRef(null);

  const pickFile = () => {
    inputRef.current?.click();
  };

  const handleCardClick = (event) => {
    if (event.target.closest("button")) return;
    pickFile();
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {showRequired && <span className="ml-1 text-red-500">*</span>}
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
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 outline-none ${
          value
            ? "border-emerald-300 bg-emerald-50/50"
            : error && showRequired
              ? "border-red-300 bg-red-50/30"
              : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              value
                ? "bg-emerald-100 text-emerald-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {value ? (
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
            {value && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onView();
                }}
                className="rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700"
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
              className="rounded-xl border border-amber-500 bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950"
            >
              {value ? "Change" : "Browse"}
            </button>

            <input
              ref={inputRef}
              required={false}
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
      {showRequired && error && (
        <p data-validation-error className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

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

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

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
      (event.clientX - dragRef.current.startX) /
      dragRef.current.stageWidth;

    const dy =
      (event.clientY - dragRef.current.startY) /
      dragRef.current.stageHeight;

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

      if (dragMode.includes("e")) {
        next.cropW = right + dx - left;
      }

      if (dragMode.includes("s")) {
        next.cropH = bottom + dy - top;
      }

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
        if (dragMode.includes("w")) {
          next.cropX = right - MIN_W;
        }
      }

      if (next.cropH < MIN_H) {
        next.cropH = MIN_H;
        if (dragMode.includes("n")) {
          next.cropY = bottom - MIN_H;
        }
      }
    }

    setCropState((current) => ({
      ...current,
      ...clampRect(next),
    }));
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

  const sizeLabel = (stageWidth = 1200, stageHeight = 750) => {
    const w = Math.round(cropState.cropW * stageWidth);
    const h = Math.round(cropState.cropH * stageHeight);
    return `${w} × ${h}`;
  };

  return (
    <div
      className="fixed inset-0 z-[100000] bg-black/70"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#171717] text-white sm:h-[94vh] sm:max-w-5xl sm:rounded-2xl sm:shadow-[0_35px_120px_rgba(0,0,0,.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#222] px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {previewName}
            </p>
            <p className="mt-0.5 text-[10px] text-white/40">
              Crop
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/75"
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
                  className="relative w-full max-w-4xl overflow-hidden bg-[#0a0a0a]"
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
                    className={`absolute border ${
                      cropDragging ? "border-white" : "border-white/95"
                    } ${
                      dragMode === "move"
                        ? "cursor-grabbing"
                        : "cursor-move"
                    }`}
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
                    <span className="pointer-events-none absolute left-[-2px] top-[-2px] h-5 w-5 border-l-2 border-t-2 border-white" />
                    <span className="pointer-events-none absolute right-[-2px] top-[-2px] h-5 w-5 border-r-2 border-t-2 border-white" />
                    <span className="pointer-events-none absolute bottom-[-2px] left-[-2px] h-5 w-5 border-b-2 border-l-2 border-white" />
                    <span className="pointer-events-none absolute bottom-[-2px] right-[-2px] h-5 w-5 border-b-2 border-r-2 border-white" />

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

                    <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2.5 py-1 text-[9px] font-mono text-white sm:text-[10px]">
                      {sizeLabel()}
                    </span>
                  </div>

                  <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-3 py-1.5 text-[9px] font-medium text-white/80">
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
                      className="rounded-lg border border-white/10 bg-[#2c2c2c] px-3 py-2.5 text-xs font-semibold text-white/80"
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      onClick={onSaveCrop}
                      className="rounded-lg bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_25px_rgba(59,130,246,.18)]"
                    >
                      Done
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-xs font-semibold text-white/65"
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

function ActionBar({ step, goBack, goNext, validateStep, isSubmitting = false }) {
  const isLast = step === 3;

  const handlePrimary = () => {
    if (isLast) {
      validateStep(3);
      return;
    }

    goNext();
  };

  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-white/60 bg-white/80 pt-4 backdrop-blur-md">
      <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-3 shadow-[0_-8px_25px_rgba(15,23,42,.05)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              Back
            </button>
          )}

          <button
            type={isLast ? "submit" : "button"}
            onClick={handlePrimary}
            disabled={isSubmitting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-bold disabled:opacity-70 ${PRIMARY_ACTION}`}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Submitting...
              </>
            ) : (
              <>
                {isLast ? "Submit for Verification" : "Continue"}
                {isLast ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
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

function Field({
  label,
  icon: Icon,
  required = false,
  showRequired = false,
  children,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {Icon && (
          <Icon className="mr-1 inline-block h-4 w-4 text-slate-400" />
        )}

        {label}

        {(required || showRequired) && (
          <span className="ml-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function Hint({ children }) {
  return <p className="mt-1.5 text-[11px] text-slate-400">{children}</p>;
}