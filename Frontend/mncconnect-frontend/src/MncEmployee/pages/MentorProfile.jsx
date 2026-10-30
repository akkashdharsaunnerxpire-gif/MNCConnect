import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User, Mail, Phone, MapPin, BriefcaseBusiness, Code2, Award, Star, Edit3,
  Share2, FileText, Building, ShieldCheck, Menu, Stethoscope, Download, X,
  Plus, Loader2, Check, AlertTriangle, LogOut, Camera, Trash2
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa";

import useLive from "../../hooks/useLive";
import useMentorSessions from "../../hooks/useMentorSessions";
import { api, EVENTS, ENDPOINTS } from "../../services/mentorApi";
import { useAuth } from "../../context/AuthContext";
import { performLogout } from "../../utils/logout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MentorProfile = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  /* ---------- LOGOUT (mentor) ----------
     1. server clears the HttpOnly cookie
     2. socket is closed (mentor goes offline)
     3. AuthContext refreshed -> logged out
     4. redirect to mentor login                                    */
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await performLogout();
    try {
      await refresh();
    } catch {
      /* ignore */
    }
    navigate("/mentor/login", { replace: true });
  };

  /* ---------- SAME data sources as Home page ---------- */

  // Reviews (rating + review count) - live
  const { data: reviewData } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
  });

  // Sessions - live
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
    [sessions]
  );

  /* ---------- mentor profile ---------- */

  const fetchMentorProfile = async () => {
    try {
      setLoading(true);
      setError("");

      // identity comes from the cookie session, not localStorage
      const me = await axios.get(`${API_URL}/auth/me`, { withCredentials: true });
      const email = me.data?.user?.email;
      if (!email) throw new Error("Session expired. Please login again.");

      const response = await axios.get(
        `${API_URL}/mentor/${encodeURIComponent(email)}`,
        { withCredentials: true }
      );
      if (response.data?.success) {
        setMentor(response.data.mentor);
      } else {
        setError(response.data?.message || "Unable to load mentor profile.");
      }
    } catch (err) {
      console.error("Mentor profile error:", err);
      setError(err?.response?.data?.message || err.message || "Unable to load mentor profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentorProfile();
  }, []);

  const apiUpdateMentor = async (email, formValues) => {
    const {
      offerLetterFile,
      employeeIdProofFile,
      additionalProofFile,
      avatarFile,
      removeAvatar,
      languages,
      ...rest
    } = formValues;
    const hasFiles = offerLetterFile || employeeIdProofFile || additionalProofFile;

    let body;
    const config = { withCredentials: true };

    if (hasFiles) {
      body = new FormData();
      Object.entries(rest).forEach(([key, value]) => body.append(key, value ?? ""));
      (languages || []).forEach((skill) => body.append("languages[]", skill));
      if (offerLetterFile) body.append("offerLetter", offerLetterFile);
      if (employeeIdProofFile) body.append("employeeIdProof", employeeIdProofFile);
      if (additionalProofFile) body.append("additionalProof", additionalProofFile);
    } else {
      body = { ...rest, languages };
    }

    const res = await axios.put(`${API_URL}/mentor/${encodeURIComponent(email)}`, body, config);
    return res.data;
  };

  const handleSaveProfile = async (formValues) => {
    setSaving(true);

    let updatedMentor = mentor;

    try {
      // First save the normal mentor details and any verification documents.
      const data = await apiUpdateMentor(mentor.email, formValues);
      if (data?.success === false) {
        throw new Error(data?.message || "Failed to save changes");
      }

      const {
        offerLetterFile,
        employeeIdProofFile,
        additionalProofFile,
        avatarFile,
        removeAvatar,
        ...plainValues
      } = formValues;

      updatedMentor = data?.mentor || { ...mentor, ...plainValues };
      setMentor(updatedMentor);

      // Upload the selected profile photo through the authenticated avatar API.
      if (avatarFile) {
        const avatarForm = new FormData();
        avatarForm.append("avatar", avatarFile);

        const avatarResponse = await axios.post(
          `${API_URL}/auth/avatar`,
          avatarForm,
          {
            withCredentials: true,
            // Let Axios/browser set the multipart boundary automatically.
          }
        );

        if (avatarResponse.data?.success === false) {
          throw new Error(
            avatarResponse.data?.message || "Profile photo upload failed."
          );
        }

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

        if (avatarResponse.data?.success === false) {
          throw new Error(
            avatarResponse.data?.message || "Could not remove profile photo."
          );
        }

        updatedMentor = {
          ...updatedMentor,
          profilePic: "",
        };

        setMentor(updatedMentor);
      }

      setEditOpen(false);
      showToast("success", "Profile updated successfully!");
    } catch (err) {
      console.error("Mentor update error:", err);

      // If the profile fields were saved but the photo request failed,
      // keep the saved profile data visible and leave the modal open.
      if (updatedMentor && updatedMentor !== mentor) {
        setMentor(updatedMentor);
      }

      showToast(
        "error",
        err?.response?.data?.message ||
          err.message ||
          "Could not save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const profile = useMemo(() => {
    if (!mentor) return null;

    // Live values win; fall back to values saved on the mentor document
    const rating =
      reviewStats?.avg ??
      (mentor.rating ? Number(mentor.rating).toFixed(1) : "0.0");
    const totalReviews = reviewStats?.count ?? mentor.totalReviews ?? 0;
    const totalSessions = completedSessions || mentor.totalSessions || 0;

    return {
      id: mentor._id,
      name: mentor.name || "Mentor",
      email: mentor.email || "Not provided",
      phone: mentor.mobile || "Not provided",
      company: mentor.currentCompany || "Not provided",
      designation: mentor.designation || "Not provided",
      department: mentor.department || "Not provided",
      employeeId: mentor.employeeId || "Not provided",
      officeLocation: mentor.officeLocation || "Not provided",
      location: mentor.officeLocation || "Not provided",
      workEmail: mentor.workEmail || "Not provided",
      experience: mentor.yearsOfExperience || "0",
      skills: Array.isArray(mentor.languages) ? mentor.languages : [],
      bio: mentor.bio || "No profile description available.",
      linkedin: mentor.linkedinProfile || "",
      offerLetter: mentor.offerLetter || "",
      employeeIdProof: mentor.employeeIdProof || "",
      additionalProof: mentor.additionalProof || "",
      isVerified: mentor.isVerified || false,
      verificationStatus: mentor.verificationStatus || "pending",
      accountStatus: mentor.accountStatus || "pending",
      avatar:
        mentor.profilePic ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || "Mentor")}&background=eff6ff&color=2563eb`,
      rating,
      totalReviews,
      totalSessions,
      createdAt: mentor.createdAt,
    };
  }, [mentor, reviewStats, completedSessions]);

  const NAV_ITEMS = [
    { key: "personal", label: "Personal Info", icon: User },
    { key: "skills", label: "Skills", icon: Code2 },
    { key: "documents", label: "Documents", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-slate-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 sm:px-5 bg-slate-50">
        <div className="w-full max-w-md p-6 sm:p-8 text-center bg-white shadow-xl rounded-3xl">
          <ShieldCheck size={48} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-lg sm:text-xl font-bold text-slate-900">Profile unavailable</h2>
          <p className="mt-2 text-sm text-slate-500 break-words">{error || "Mentor data could not be loaded."}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/mentor/home" className="inline-block px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">Back to Home</Link>
            <button onClick={handleLogout} disabled={loggingOut} className="inline-block px-6 py-3 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-60">
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-white rounded-lg shadow-lg" aria-label="Toggle menu">
          <Menu size={22} />
        </button>
      </div>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/30 lg:hidden" />}

      <div className="flex">
        {/* SIDEBAR: drawer on mobile, sticky column on desktop */}
        <aside className={`fixed lg:sticky top-0 left-0 z-50 w-64 max-w-[85vw] shrink-0 h-[100dvh] overflow-y-auto bg-white border-r border-slate-100 px-5 py-6 flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center gap-2 px-1 mb-6">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-orange-500 flex items-center justify-center">
              <Stethoscope size={18} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold text-slate-900">MentorConnect<span className="text-orange-500">_</span></span>
          </div>

          <div className="px-1 pb-5 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img src={profile.avatar} alt={profile.name} className="w-11 h-11 shrink-0 rounded-full object-cover border-2 border-blue-100" />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">{profile.name}</p>
                <p className="text-xs text-slate-400 truncate">{profile.designation}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeTab;
              return (
                <button key={key} onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border-l-2 transition text-left ${isActive ? "bg-orange-50 text-orange-600 border-orange-500" : "text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700"}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
            <div className="my-3 border-t border-slate-100" />
            <Link to="/mentor/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <Edit3 size={18} className="shrink-0" />
              <span>Settings</span>
            </Link>

            {/* MENTOR LOGOUT */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-60 text-left"
            >
              {loggingOut ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <LogOut size={18} className="shrink-0" />}
              <span>{loggingOut ? "Logging out…" : "Logout"}</span>
            </button>
          </nav>

          <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Award size={16} />
              <span className="text-xs font-semibold">Premium Mentor</span>
            </div>
            <p className="text-[11px] text-blue-50">Verified mentors get 3x more mentee requests.</p>
          </div>
        </aside>

        {/* MAIN: pt-16 on mobile so the hamburger never overlaps content */}
        <main className="flex-1 min-w-0 w-full max-w-6xl px-3 sm:px-6 lg:px-8 pt-16 pb-8 lg:pt-6">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="min-w-0 truncate text-sm text-slate-400">
              <span>Mentor</span>
              <span className="mx-2">/</span>
              <span>Profile</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button aria-label="Share" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"><Share2 size={16} /></button>
              <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Edit3 size={16} /> <span className="hidden min-[380px]:inline">Edit Profile</span><span className="min-[380px]:hidden">Edit</span>
              </button>
            </div>
          </div>

          {/* PROFILE HEADER CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-5 sm:gap-6">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <img src={profile.avatar} alt={profile.name} className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{profile.name}</h1>
                    {profile.isVerified && <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full">Verified</span>}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 break-words">{profile.designation} at {profile.company}</p>
                  <p className="flex items-start gap-1.5 text-sm text-slate-400 mt-1 min-w-0">
                    <Mail size={14} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 break-all">{profile.email}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-4 md:ml-auto">
                <Field label="Location" value={profile.location} />
                <Field label="Experience" value={`${profile.experience} yrs`} />
                <Field label="Status" value={
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.accountStatus === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    {profile.verificationStatus}
                  </span>
                } />
                <Field label="Rating" value={profile.rating} />
                <Field label="Sessions" value={profile.totalSessions} />
                <Field label="Reviews" value={profile.totalReviews} />
              </div>
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
            {activeTab === "personal" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <DetailItem icon={<User size={16} />} label="Full Name" value={profile.name} />
                  <DetailItem icon={<Mail size={16} />} label="Email" value={profile.email} />
                  <DetailItem icon={<Phone size={16} />} label="Phone" value={profile.phone} />
                  <DetailItem icon={<Building size={16} />} label="Employee ID" value={profile.employeeId} />
                  <DetailItem icon={<MapPin size={16} />} label="Office Location" value={profile.officeLocation} />
                  <DetailItem icon={<BriefcaseBusiness size={16} />} label="Department" value={profile.department} />
                  <DetailItem icon={<Mail size={16} />} label="Work Email" value={profile.workEmail} />
                  <DetailItem icon={<ShieldCheck size={16} />} label="Verification Status" value={profile.verificationStatus} />
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">About Me</h3>
                  <p className="text-sm text-slate-600 leading-relaxed break-words">{profile.bio}</p>
                </div>
              </div>
            )}

            {activeTab === "skills" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Skills & Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.length > 0 ? (
                    profile.skills.map((skill, index) => (
                      <span key={index} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium break-words">{skill}</span>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm">No skills added yet</p>
                  )}
                </div>
                {profile.linkedin && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Social Links</h3>
                    <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
                      <FaLinkedin size={18} /> LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Uploaded Documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <DocumentCard title="Offer Letter" url={profile.offerLetter} />
                  <DocumentCard title="Employee ID Proof" url={profile.employeeIdProof} />
                  {profile.additionalProof && <DocumentCard title="Additional Proof" url={profile.additionalProof} />}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <StatCard label="Sessions" value={profile.totalSessions} icon={BriefcaseBusiness} />
            <StatCard label="Rating" value={profile.rating} icon={Star} iconClass="text-yellow-400 fill-yellow-400" />
            <StatCard label="Reviews" value={profile.totalReviews} icon={FileText} />
          </div>
        </main>
      </div>

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
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[100]">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-2xl ring-1 ring-black/5 sm:max-w-sm">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              {toast.type === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{toast.type === "success" ? "Success" : "Error"}</p>
              <p className="text-xs text-slate-500 break-words">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   EDIT MODAL
========================================================================= */

const EDITABLE_FIELDS = [
  { key: "name", label: "Full Name", icon: User, required: true },
  { key: "mobile", label: "Phone", icon: Phone, placeholder: "+91 1234567890" },
  { key: "currentCompany", label: "Company", icon: Building },
  { key: "designation", label: "Designation", icon: BriefcaseBusiness },
  { key: "department", label: "Department", icon: BriefcaseBusiness },
  { key: "employeeId", label: "Employee ID", icon: Building },
  { key: "officeLocation", label: "Office Location", icon: MapPin },
  { key: "workEmail", label: "Work Email", icon: Mail },
  { key: "yearsOfExperience", label: "Years of Experience", icon: Award, type: "number" },
  { key: "linkedinProfile", label: "LinkedIn URL", icon: User, placeholder: "https://linkedin.com/in/..." },
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

  const [skillInput, setSkillInput] = useState("");
  const avatarInputRef = useRef(null);

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    mentor?.name || "Mentor"
  )}&background=eff6ff&color=2563eb`;

  const [avatarPreview, setAvatarPreview] = useState(
    mentor?.profilePic || fallbackAvatar
  );

  useEffect(() => {
    if (!form.avatarFile) return undefined;

    const objectUrl = URL.createObjectURL(form.avatarFile);
    setAvatarPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [form.avatarFile]);

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

    setForm((prev) => ({
      ...prev,
      avatarFile: file,
      removeAvatar: false,
    }));
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({
      ...prev,
      avatarFile: null,
      removeAvatar: true,
    }));
    setAvatarPreview(fallbackAvatar);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const updateFile = (key, file) => setForm((prev) => ({ ...prev, [key]: file }));
  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !form.languages.includes(trimmed)) {
      updateField("languages", [...form.languages, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    updateField("languages", form.languages.filter((s) => s !== skill));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
      {/* flex-col: header + footer stay put, only the form body scrolls */}
      <div className="relative flex max-h-[95dvh] sm:max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">Edit Profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {/* PROFILE PHOTO */}
            <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-20 w-20 shrink-0">
                  <img
                    src={avatarPreview}
                    alt="Mentor profile"
                    onError={() => setAvatarPreview(fallbackAvatar)}
                    className="h-20 w-20 rounded-full border-2 border-white object-cover shadow-sm"
                  />

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={saving}
                    aria-label="Choose profile photo"
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
                  <p className="text-sm font-semibold text-slate-800">
                    Profile Photo
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Upload a new photo to replace your current profile picture.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Supported: JPG, PNG, WEBP (Maximum 5MB)
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
                    >
                      <Camera size={14} />
                      {form.avatarFile || (mentor?.profilePic && !form.removeAvatar)
                        ? "Change photo"
                        : "Upload photo"}
                    </button>

                    {(mentor?.profilePic || form.avatarFile) && !form.removeAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        Remove photo
                      </button>
                    )}

                    {form.avatarFile && (
                      <span className="max-w-full truncate text-[11px] text-slate-500">
                        Selected: {form.avatarFile.name}
                      </span>
                    )}

                    {form.removeAvatar && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Photo will be removed when you save.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EDITABLE_FIELDS.map(({ key, label, type, placeholder, required }) => (
                <div key={key} className={key === "name" ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  <input
                    type={type || "text"}
                    value={form[key]}
                    required={required}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">About Me</label>
              <textarea
                value={form.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                rows={4}
                placeholder="Tell mentees about yourself..."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Skills / Languages</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  placeholder="e.g. React, Python, Java"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={addSkill} className="flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3 sm:px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="mt-3 flex min-h-[44px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 p-3">
                {form.languages.length === 0 ? (
                  <p className="w-full py-1 text-center text-sm text-slate-400">No skills added yet</p>
                ) : (
                  form.languages.map((skill) => (
                    <span key={skill} className="flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                      <span className="min-w-0 break-words">{skill}</span>
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} className="shrink-0 hover:text-red-500"><X size={13} /></button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <label className="mb-3 block text-xs font-medium text-slate-500">Documents</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DocumentUploadField label="Offer Letter" currentUrl={form.offerLetter} file={form.offerLetterFile} onChange={(file) => updateFile("offerLetterFile", file)} />
                <DocumentUploadField label="Employee ID Proof" currentUrl={form.employeeIdProof} file={form.employeeIdProofFile} onChange={(file) => updateFile("employeeIdProofFile", file)} />
                <DocumentUploadField label="Additional Proof" currentUrl={form.additionalProof} file={form.additionalProofFile} onChange={(file) => updateFile("additionalProofFile", file)} />
              </div>
            </div>
          </div>

          {/* footer always visible */}
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DocumentUploadField = ({ label, currentUrl, file, onChange }) => {
  const inputId = `doc-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {file ? (
        <p className="mt-1 truncate text-xs font-medium text-blue-600">Selected: {file.name}</p>
      ) : currentUrl ? (
        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
          <Download size={12} /> View current file
        </a>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Not uploaded</p>
      )}
      <label htmlFor={inputId} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
        <Plus size={13} /> {currentUrl || file ? "Replace file" : "Upload file"}
      </label>
      <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onChange(e.target.files?.[0] || null)} className="hidden" />
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
  </div>
);

const DetailItem = ({ icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 p-3 bg-slate-50 rounded-lg">
    <div className="shrink-0 text-slate-400">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-900 break-words">{value || "Not provided"}</p>
    </div>
  </div>
);

const DocumentCard = ({ title, url }) => (
  <div className="min-w-0 p-4 border border-slate-100 rounded-lg">
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 text-blue-600 hover:underline text-sm">
        <Download size={14} /> View Document
      </a>
    ) : (
      <p className="text-sm text-slate-400 mt-2">Not uploaded</p>
    )}
  </div>
);

const StatCard = ({ label, value, icon: Icon, iconClass = "text-blue-500" }) => (
  <div className="min-w-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 text-center">
    <Icon size={18} className={`mx-auto mb-1.5 sm:mb-2 ${iconClass}`} />
    <div className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{value}</div>
    <p className="text-[11px] sm:text-xs text-slate-400">{label}</p>
  </div>
);

export default MentorProfile;