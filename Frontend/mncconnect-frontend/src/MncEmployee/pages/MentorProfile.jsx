import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Code2,
  Award,
  Star,
  Edit3,
  FileText,
  ShieldCheck,
  Download,
  X,
  Plus,
  Loader2,
  Check,
  AlertTriangle,
  Camera,
  Trash2,
  Zap,
  Radio,
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa";

import useLive from "../../hooks/useLive";
import useMentorSessions from "../../hooks/useMentorSessions";
import { api, EVENTS, ENDPOINTS } from "../../services/mentorApi";
import { useAuth } from "../../context/AuthContext";
import { performLogout } from "../../utils/logout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 caret-blue-600 outline-none placeholder:text-slate-400 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const fallbackAvatarFor = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Mentor")}&background=eff6ff&color=2563eb`;

const MentorProfile = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [mentor, setMentor] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("personal");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performLogout();
    } catch {
      /* ignore */
    }
    try {
      await refresh();
    } catch {
      /* ignore */
    }
    navigate("/mentor/login", { replace: true });
  };

  const { data: reviewData, connected } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
  });

  const { sessions } = useMentorSessions();

  const reviewStats = useMemo(() => {
    const list = reviewData?.reviews || [];
    if (!list.length) return null;
    const avg =
      list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length;
    return { avg: avg.toFixed(1), count: list.length };
  }, [reviewData]);

  const completedSessions = useMemo(
    () => (sessions || []).filter((s) => s.status === "Completed").length,
    [sessions],
  );

  const fetchMentorProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const me = await axios.get(`${API_URL}/auth/me`, {
        withCredentials: true,
      });
      const email = me.data?.user?.email;
      if (!email) throw new Error("Session expired. Please login again.");
      setAuthEmail(email);

      const response = await axios.get(
        `${API_URL}/mentor/${encodeURIComponent(email)}`,
        { withCredentials: true },
      );
      if (response.data?.success) {
        setMentor(response.data.mentor);
      } else {
        setError(response.data?.message || "Unable to load mentor profile.");
      }
    } catch (err) {
      console.error("Mentor profile error:", err);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to load mentor profile.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentorProfile();
  }, []);

 const apiUpdateMentor = async (email, formValues) => {
  const {
    name, mobile, officeLocation, yearsOfExperience,
    linkedinProfile, bio, skills, languages,
  } = formValues;

  const res = await axios.put(
    `${API_URL}/mentor/${encodeURIComponent(email)}`,
    { name, mobile, officeLocation, yearsOfExperience, linkedinProfile, bio, skills, languages },
    { withCredentials: true },
  );
  return res.data;
};

  const handleSaveProfile = async (formValues) => {
    setSaving(true);
    let updatedMentor = mentor;

    try {
      const data = await apiUpdateMentor(mentor.email || authEmail, formValues);
      if (data?.success === false)
        throw new Error(data?.message || "Failed to save changes");

      const {
        offerLetterFile,
        employeeIdProofFile,
        additionalProofFile,
        avatarFile,
        removeAvatar,
        ...plainValues
      } = formValues;
      updatedMentor = { ...mentor, ...plainValues, ...(data?.mentor || {}) };
      setMentor(updatedMentor);

      if (avatarFile) {
        const avatarForm = new FormData();
        avatarForm.append("avatar", avatarFile);
        const avatarResponse = await axios.post(
          `${API_URL}/auth/avatar`,
          avatarForm,
          { withCredentials: true },
        );
        if (avatarResponse.data?.success === false)
          throw new Error(
            avatarResponse.data?.message || "Profile photo upload failed.",
          );

        updatedMentor = {
          ...updatedMentor,
          profilePic:
            avatarResponse.data?.user?.profilePic ||
            avatarResponse.data?.profilePic ||
            updatedMentor.profilePic ||
            "",
        };
        setMentor(updatedMentor);
      } else if (removeAvatar) {
        const avatarResponse = await axios.delete(`${API_URL}/auth/avatar`, {
          withCredentials: true,
        });
        if (avatarResponse.data?.success === false)
          throw new Error(
            avatarResponse.data?.message || "Could not remove profile photo.",
          );
        updatedMentor = { ...updatedMentor, profilePic: "" };
        setMentor(updatedMentor);
      }

      setEditOpen(false);
      window.dispatchEvent(new Event("profile:updated"));
      showToast("success", "Profile updated successfully!");
    } catch (err) {
      console.error("Mentor update error:", err);
      if (updatedMentor && updatedMentor !== mentor) setMentor(updatedMentor);
      showToast(
        "error",
        err?.response?.data?.message || err.message || "Could not save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  const profile = useMemo(() => {
    if (!mentor) return null;
    const rating =
      reviewStats?.avg ??
      (mentor.rating ? Number(mentor.rating).toFixed(1) : "0.0");
    const totalReviews = reviewStats?.count ?? mentor.totalReviews ?? 0;
    const totalSessions = completedSessions || mentor.totalSessions || 0;

    return {
      id: mentor._id,
      name: mentor.name || "Mentor",
      email: mentor.email || authEmail || "Not provided",
      mentorCode: mentor.mentorCode || mentorCode || "Not provided",
      phone: mentor.mobile || "Not provided",
      company: mentor.currentCompany || "",
      designation: mentor.designation || "",
      department: mentor.department || "Not provided",
      employeeId: mentor.employeeId || "Not provided",
      officeLocation: mentor.officeLocation || "Not provided",
      workEmail: mentor.workEmail || "Not provided",
      experience: mentor.yearsOfExperience || "0",
      skills: Array.isArray(mentor.skills) ? mentor.skills : [],
      languages: Array.isArray(mentor.languages) ? mentor.languages : [],
      bio: mentor.bio || "No profile description available.",
      linkedin: mentor.linkedinProfile || "",
      offerLetter: mentor.offerLetter || "",
      employeeIdProof: mentor.employeeIdProof || "",
      additionalProof: mentor.additionalProof || "",
      isVerified: mentor.isVerified || false,
      verificationStatus: mentor.verificationStatus || "pending",
      accountStatus: mentor.accountStatus || "pending",
      avatar: mentor.profilePic || fallbackAvatarFor(mentor.name),
      rating,
      totalReviews,
      totalSessions,
    };
  }, [mentor, authEmail, reviewStats, completedSessions]);

  const TABS = [
    { key: "personal", label: "Personal Info", icon: User },
    { key: "skills", label: "Skills", icon: Code2 },
    { key: "documents", label: "Documents", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
          <ShieldCheck size={48} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Profile unavailable
          </h2>
          <p className="mt-2 break-words text-sm text-slate-500">
            {error || "Mentor data could not be loaded."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/mentor/home"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Home
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-red-200 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const headline = [profile.designation, profile.company]
    .filter(Boolean)
    .join(" at ");
  const approved =
    ["approved", "verified"].includes(profile.verificationStatus) ||
    profile.accountStatus === "active";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
          {/* ============ LEFT: profile card ============ */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = fallbackAvatarFor(profile.name);
                  }}
                  className="h-28 w-28 rounded-full border-4 border-blue-50 object-cover ring-1 ring-slate-200"
                />
                {profile.isVerified && (
                  <span
                    title="Verified"
                    className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white"
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-xl font-bold text-slate-900">
                {profile.name}
              </h2>
              {headline && (
                <p className="mt-1 text-sm text-slate-500">{headline}</p>
              )}

              <span
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                  approved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    approved ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {profile.verificationStatus}
              </span>
            </div>

            <ul className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-sm">
              <ContactRow icon={<Mail size={15} />} value={profile.email} />
              <ContactRow icon={<Phone size={15} />} value={profile.phone} />
              <ContactRow
                icon={<MapPin size={15} />}
                value={profile.officeLocation}
              />
              <ContactRow
                icon={<Award size={15} />}
                value={`${profile.experience} years experience`}
              />
            </ul>

            <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 py-3 text-center">
              <MiniStat label="Sessions" value={profile.totalSessions} />
              <MiniStat
                label="Rating"
                value={profile.rating}
                icon={<Star size={12} className="fill-amber-400 text-amber-400" />}
              />
              <MiniStat label="Reviews" value={profile.totalReviews} />
            </div>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Edit3 size={16} />
              Edit profile
            </button>
          </aside>

          {/* ============ RIGHT: tabs + content ============ */}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              role="tablist"
              className="flex gap-6 overflow-x-auto border-b border-slate-200 px-5 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TABS.map(({ key, label, icon: Icon }) => {
                const isActive = key === activeTab;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(key)}
                    className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 py-4 text-sm font-semibold transition ${
                      isActive
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[360px] p-5 sm:p-8">
              {activeTab === "personal" && (
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Personal information
                  </h3>
                  <dl className="mt-4 divide-y divide-slate-100">
                    <InfoRow label="Full name" value={profile.name} />
                    <InfoRow label="Email" value={profile.email} />
                    <InfoRow label="EmployeeID" value={profile.mentorCode} />
                    <InfoRow label="Phone" value={profile.phone} />
                    <InfoRow label="Employee ID" value={profile.employeeId} />
                    <InfoRow label="Department" value={profile.department} />
                    <InfoRow label="Office location" value={profile.officeLocation} />
                    <InfoRow label="Work email" value={profile.workEmail} />
                  </dl>

                  <h3 className="mt-10 text-base font-semibold text-slate-900">
                    About me
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    {profile.bio}
                  </p>
                </div>
              )}

              {activeTab === "skills" && (
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Skills
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.skills.length > 0 ? (
                      profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-700"
                        >
                          <Zap size={13} /> {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No skills added yet. Use Edit profile to add some.
                      </p>
                    )}
                  </div>

                  <h3 className="mt-10 text-base font-semibold text-slate-900">
                    Languages
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.languages.length > 0 ? (
                      profile.languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-full bg-indigo-50 px-3.5 py-1.5 text-sm font-medium text-indigo-700"
                        >
                          {lang}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No languages added yet.
                      </p>
                    )}
                  </div>

                  {profile.linkedin && (
                    <>
                      <h3 className="mt-10 text-base font-semibold text-slate-900">
                        Links
                      </h3>
                      <a
                        href={profile.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-[#0077b5] transition hover:bg-slate-50"
                      >
                        <FaLinkedin size={18} /> LinkedIn profile
                      </a>
                    </>
                  )}
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Uploaded documents
                  </h3>
                  <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    <DocumentRow title="Offer letter" url={profile.offerLetter} />
                    <DocumentRow title="Employee ID proof" url={profile.employeeIdProof} />
                    {profile.additionalProof && (
                      <DocumentRow title="Additional proof" url={profile.additionalProof} />
                    )}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {editOpen && (
        <EditMentorModal
          mentor={mentor}
          saving={saving}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveProfile}
          showToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[110]" role="status">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl ring-1 ring-black/5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {toast.type === "success" ? (
                <Check size={18} strokeWidth={3} />
              ) : (
                <AlertTriangle size={18} strokeWidth={3} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {toast.type === "success" ? "Success" : "Error"}
              </p>
              <p className="mt-0.5 break-words text-xs font-medium text-slate-500">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   EDIT MODAL (rendered in document.body so it covers the sidebar too)
========================================================================= */

const EDITABLE_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "mobile", label: "Phone", placeholder: "+91 1234567890" },
  { key: "officeLocation", label: "Office Location" },
  { key: "yearsOfExperience", label: "Years of Experience", type: "number" },
  {
    key: "linkedinProfile",
    label: "LinkedIn URL",
    placeholder: "https://linkedin.com/in/...",
  },
];

const EditMentorModal = ({ mentor, saving, onClose, onSave, showToast }) => {
  const [form, setForm] = useState({
    name: mentor?.name || "",
    mobile: mentor?.mobile || "",
    currentCompany: mentor?.currentCompany || "",
    designation: mentor?.designation || "",
    department: mentor?.department || "",
    employeeId: mentor?.employeeId || "",
    officeLocation: mentor?.officeLocation || "",
    workEmail: mentor?.workEmail || "",
    yearsOfExperience: mentor?.yearsOfExperience || "",
    linkedinProfile: mentor?.linkedinProfile || "",
    bio: mentor?.bio || "",
    skills: Array.isArray(mentor?.skills) ? mentor.skills : [],
    languages: Array.isArray(mentor?.languages) ? mentor.languages : [],
    offerLetter: mentor?.offerLetter || "",
    employeeIdProof: mentor?.employeeIdProof || "",
    additionalProof: mentor?.additionalProof || "",
    offerLetterFile: null,
    employeeIdProofFile: null,
    additionalProofFile: null,
    avatarFile: null,
    removeAvatar: false,
  });

  const avatarInputRef = useRef(null);

  const fallbackAvatar = fallbackAvatarFor(mentor?.name);
  const [avatarPreview, setAvatarPreview] = useState(
    mentor?.profilePic || fallbackAvatar,
  );

  useEffect(() => {
    if (!form.avatarFile) return undefined;
    const objectUrl = URL.createObjectURL(form.avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [form.avatarFile]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // lock page scroll while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      showToast?.("error", "Choose a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.("error", "Profile photo must be 5MB or smaller.");
      event.target.value = "";
      return;
    }
    setForm((prev) => ({ ...prev, avatarFile: file, removeAvatar: false }));
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarFile: null, removeAvatar: true }));
    setAvatarPreview(fallbackAvatar);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const updateFile = (key, file) =>
    setForm((prev) => ({ ...prev, [key]: file }));
  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white text-slate-800 shadow-2xl [color-scheme:light] sm:max-h-[90dvh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Edit3 size={18} className="text-blue-600" /> Edit Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* PROFILE PHOTO */}
            <section className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-20 w-20 shrink-0">
                  <img
                    src={avatarPreview}
                    alt="Mentor profile"
                    onError={() => setAvatarPreview(fallbackAvatar)}
                    className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={saving}
                    aria-label="Change photo"
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Camera size={15} />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    Profile photo
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Upload a new photo to replace your current profile picture.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
                    >
                      <Camera size={14} />{" "}
                      {form.avatarFile ||
                      (mentor?.profilePic && !form.removeAvatar)
                        ? "Change photo"
                        : "Upload photo"}
                    </button>
                    {(mentor?.profilePic || form.avatarFile) &&
                      !form.removeAvatar && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold text-red-600 transition hover:text-red-700 disabled:opacity-60"
                        >
                          <Trash2 size={14} /> Remove photo
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EDITABLE_FIELDS.map(
                ({ key, label, type, placeholder, required }) => (
                  <div
                    key={key}
                    className={key === "name" ? "sm:col-span-2" : ""}
                  >
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      {label}
                      {required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    <input
                      type={type || "text"}
                      value={form[key]}
                      required={required}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                      className={INPUT_CLASS}
                    />
                  </div>
                ),
              )}
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                About me
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                rows={4}
                placeholder="Tell mentees about yourself..."
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            <div className="mt-5">
              <TagInput
                label="Skills"
                placeholder="e.g. React, Python, Java"
                items={form.skills}
                onChange={(list) => updateField("skills", list)}
              />
            </div>

            <div className="mt-5">
              <TagInput
                label="Languages"
                placeholder="e.g. English, Tamil, Hindi"
                items={form.languages}
                onChange={(list) => updateField("languages", list)}
              />
            </div>

            <div className="mt-7 border-t border-slate-100 pt-6">
              <label className="mb-3 block text-xs font-bold text-slate-700">
                Documents
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DocumentUploadField
                  label="Offer Letter"
                  currentUrl={form.offerLetter}
                  file={form.offerLetterFile}
                  onChange={(file) => updateFile("offerLetterFile", file)}
                />
                <DocumentUploadField
                  label="Employee ID Proof"
                  currentUrl={form.employeeIdProof}
                  file={form.employeeIdProofFile}
                  onChange={(file) => updateFile("employeeIdProofFile", file)}
                />
                <DocumentUploadField
                  label="Additional Proof"
                  currentUrl={form.additionalProof}
                  file={form.additionalProofFile}
                  onChange={(file) => updateFile("additionalProofFile", file)}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

/* =========================================================================
   SMALL PARTS
========================================================================= */

const ContactRow = ({ icon, value }) => (
  <li className="flex items-center gap-3 text-slate-600">
    <span className="shrink-0 text-slate-400">{icon}</span>
    <span className="min-w-0 break-words">{value}</span>
  </li>
);

const MiniStat = ({ label, value, icon }) => (
  <div className="px-2">
    <p className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900">
      {icon}
      {value}
    </p>
    <p className="text-[11px] text-slate-500">{label}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="grid gap-1 py-3.5 sm:grid-cols-[180px_1fr] sm:gap-4">
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="break-words text-sm font-medium text-slate-900">
      {value || "Not provided"}
    </dd>
  </div>
);

const DocumentRow = ({ title, url }) => (
  <li className="flex items-center justify-between gap-4 px-4 py-3.5">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <FileText size={16} />
      </span>
      <span className="truncate text-sm font-medium text-slate-800">{title}</span>
    </div>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
      >
        <Download size={14} /> View
      </a>
    ) : (
      <span className="shrink-0 text-sm text-slate-400">Not uploaded</span>
    )}
  </li>
);

const TagInput = ({ label, placeholder, items, onChange }) => {
  const [value, setValue] = useState("");

  const add = () => {
    const parts = value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const next = [...items];
    parts.forEach((p) => {
      if (!next.some((n) => n.toLowerCase() === p.toLowerCase())) next.push(p);
    });
    onChange(next);
    setValue("");
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-700">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={add}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="mt-3 flex min-h-[50px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
        {items.length === 0 ? (
          <p className="w-full py-1 text-center text-sm font-medium text-slate-400">
            Nothing added yet
          </p>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="flex max-w-full items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== item))}
                aria-label={`Remove ${item}`}
                className="shrink-0 text-blue-500 transition hover:text-red-500"
              >
                <X size={13} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
};

const DocumentUploadField = ({ label, currentUrl, file, onChange }) => {
  const inputId = `doc-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      {file ? (
        <p className="mt-1 truncate text-xs font-semibold text-blue-600">
          Selected: {file.name}
        </p>
      ) : currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <Download size={12} /> View current file
        </a>
      ) : (
        <p className="mt-1 text-xs font-medium text-slate-400">Not uploaded</p>
      )}
      <label
        htmlFor={inputId}
        className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-2 text-xs font-bold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
      >
        <Plus size={13} /> {currentUrl || file ? "Replace file" : "Upload file"}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  );
};

export default MentorProfile;