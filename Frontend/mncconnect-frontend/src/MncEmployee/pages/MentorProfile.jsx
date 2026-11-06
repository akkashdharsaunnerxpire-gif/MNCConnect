import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User,
  Mail,
  Phone,
  MapPin,
  BriefcaseBusiness,
  Code2,
  Award,
  Star,
  Edit3,
  Share2,
  FileText,
  Building,
  ShieldCheck,
  Menu,
  Stethoscope,
  Download,
  X,
  Plus,
  Loader2,
  Check,
  AlertTriangle,
  LogOut,
  Camera,
  Trash2,
  ChevronRight,
  Sparkles,
  Zap,
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

const MentorProfile = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [mentor, setMentor] = useState(null);
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
    await performLogout();
    try {
      await refresh();
    } catch {}
    navigate("/mentor/login", { replace: true });
  };

  const { data: reviewData } = useLive({
    fetcher: () => api(ENDPOINTS.reviews),
    events: [EVENTS.reviewNew, EVENTS.reviewUpdated],
  });

  const { sessions } = useMentorSessions();

  const reviewStats = useMemo(() => {
    const list = reviewData?.reviews || [];
    if (!list.length) return null;
    const avg = list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length;
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
      const me = await axios.get(`${API_URL}/auth/me`, { withCredentials: true });
      const email = me.data?.user?.email;
      if (!email) throw new Error("Session expired. Please login again.");

      const response = await axios.get(`${API_URL}/mentor/${encodeURIComponent(email)}`, { withCredentials: true });
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
    const { offerLetterFile, employeeIdProofFile, additionalProofFile, avatarFile, removeAvatar, languages, ...rest } = formValues;
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
      const data = await apiUpdateMentor(mentor.email, formValues);
      if (data?.success === false) throw new Error(data?.message || "Failed to save changes");

      const { offerLetterFile, employeeIdProofFile, additionalProofFile, avatarFile, removeAvatar, ...plainValues } = formValues;
      updatedMentor = data?.mentor || { ...mentor, ...plainValues };
      setMentor(updatedMentor);

      if (avatarFile) {
        const avatarForm = new FormData();
        avatarForm.append("avatar", avatarFile);
        const avatarResponse = await axios.post(`${API_URL}/auth/avatar`, avatarForm, { withCredentials: true });
        if (avatarResponse.data?.success === false) throw new Error(avatarResponse.data?.message || "Profile photo upload failed.");

        updatedMentor = {
          ...updatedMentor,
          profilePic: avatarResponse.data?.user?.profilePic || avatarResponse.data?.profilePic || updatedMentor.profilePic || "",
        };
        setMentor(updatedMentor);
      } else if (removeAvatar) {
        const avatarResponse = await axios.delete(`${API_URL}/auth/avatar`, { withCredentials: true });
        if (avatarResponse.data?.success === false) throw new Error(avatarResponse.data?.message || "Could not remove profile photo.");
        updatedMentor = { ...updatedMentor, profilePic: "" };
        setMentor(updatedMentor);
      }
      
      setEditOpen(false);
      window.dispatchEvent(new Event("profile:updated"));
      showToast("success", "Profile updated successfully!");
    } catch (err) {
      console.error("Mentor update error:", err);
      if (updatedMentor && updatedMentor !== mentor) setMentor(updatedMentor);
      showToast("error", err?.response?.data?.message || err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const profile = useMemo(() => {
    if (!mentor) return null;
    const rating = reviewStats?.avg ?? (mentor.rating ? Number(mentor.rating).toFixed(1) : "0.0");
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
      avatar: mentor.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || "Mentor")}&background=eff6ff&color=2563eb`,
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
      <div className="flex items-center justify-center min-h-screen px-4 bg-slate-50">
        <div className="w-full max-w-md p-8 text-center bg-white shadow-xl rounded-3xl">
          <ShieldCheck size={48} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Profile unavailable</h2>
          <p className="mt-2 text-sm text-slate-500 break-words">{error || "Mentor data could not be loaded."}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/mentor/home" className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">Back to Home</Link>
            <button onClick={handleLogout} disabled={loggingOut} className="px-6 py-3 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-60">
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      {/* Top Navbar is handled by your external Layout component (Home, Requests, etc.) */}
      
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Profile</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Manage your personal information and preferences.</p>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Share" className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition shadow-sm">
              <Share2 size={18} />
            </button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition">
              <Edit3 size={16} />
              Edit Profile
            </button>
          </div>
        </div>

        {/* HERO PROFILE CARD */}
        <div className="relative bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 w-full absolute top-0 left-0" />
          <div className="px-6 sm:px-8 pb-8 pt-16 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="relative shrink-0 -mt-16 sm:-mt-20">
                <img src={profile.avatar} alt={profile.name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-white shadow-lg bg-white" />
                {profile.isVerified && (
                  <div className="absolute -bottom-3 -right-3 bg-white p-1.5 rounded-full shadow-md">
                    <div className="bg-blue-600 text-white p-1 rounded-full"><Check size={14} strokeWidth={3} /></div>
                  </div>
                )}
              </div>
              
              <div className="min-w-0 flex-1 md:mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">{profile.name}</h2>
                  {profile.isVerified && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full border border-blue-100">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-500 mt-1">{profile.designation} at {profile.company}</p>
                <div className="flex flex-wrap gap-4 mt-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Mail size={14} className="text-blue-500" /> {profile.email}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <MapPin size={14} className="text-blue-500" /> {profile.location}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 md:ml-auto w-full md:w-auto">
                <div className="flex-1 md:flex-none text-center bg-slate-50 rounded-xl px-5 py-3 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Experience</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{profile.experience} yrs</p>
                </div>
                <div className="flex-1 md:flex-none text-center bg-slate-50 rounded-xl px-5 py-3 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</p>
                  <p className={`text-base font-bold mt-0.5 capitalize ${profile.accountStatus === "active" ? "text-emerald-600" : "text-amber-500"}`}>{profile.verificationStatus}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PILL TABS (Exact style from screenshot) */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white p-1.5 rounded-full shadow-sm border border-slate-200/80">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeTab;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                    isActive 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 min-h-[400px] mb-6">
          {activeTab === "personal" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><User size={18} /></div>
                <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem icon={<User size={16} />} label="Full Name" value={profile.name} />
                <DetailItem icon={<Mail size={16} />} label="Email" value={profile.email} />
                <DetailItem icon={<Phone size={16} />} label="Phone" value={profile.phone} />
                <DetailItem icon={<Building size={16} />} label="Employee ID" value={profile.employeeId} />
                <DetailItem icon={<MapPin size={16} />} label="Office Location" value={profile.officeLocation} />
                <DetailItem icon={<BriefcaseBusiness size={16} />} label="Department" value={profile.department} />
                <DetailItem icon={<Mail size={16} />} label="Work Email" value={profile.workEmail} />
                <DetailItem icon={<ShieldCheck size={16} />} label="Verification Status" value={profile.verificationStatus} />
              </div>
              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileText size={18} /></div>
                  <h3 className="text-base font-bold text-slate-900">About Me</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">{profile.bio}</p>
              </div>
            </div>
          )}

          {activeTab === "skills" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Code2 size={18} /></div>
                <h2 className="text-lg font-bold text-slate-900">Skills & Expertise</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {profile.skills.length > 0 ? profile.skills.map((skill, index) => (
                  <span key={index} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-100 transition hover:bg-blue-100">
                    <Zap size={14} className="text-blue-500" /> {skill}
                  </span>
                )) : <p className="text-slate-400 text-sm italic">No skills added yet</p>}
              </div>
              {profile.linkedin && (
                <div className="mt-10 pt-8 border-t border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Social Links</h3>
                  <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 rounded-xl text-sm font-bold transition">
                    <FaLinkedin size={18} /> LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><FileText size={18} /></div>
                <h2 className="text-lg font-bold text-slate-900">Uploaded Documents</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DocumentCard title="Offer Letter" url={profile.offerLetter} />
                <DocumentCard title="Employee ID Proof" url={profile.employeeIdProof} />
                {profile.additionalProof && <DocumentCard title="Additional Proof" url={profile.additionalProof} />}
              </div>
            </div>
          )}
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Sessions" value={profile.totalSessions} icon={BriefcaseBusiness} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
          <StatCard label="Rating" value={profile.rating} icon={Star} color="text-amber-500" bg="bg-amber-50" border="border-amber-100" iconClass="fill-amber-500" />
          <StatCard label="Reviews" value={profile.totalReviews} icon={FileText} color="text-indigo-600" bg="bg-indigo-50" border="border-indigo-100" />
        </div>

        {/* BOTTOM LOGOUT BUTTON (Only for mobile / quick access) */}
        <div className="mt-12 flex justify-center sm:hidden">
          <button onClick={handleLogout} disabled={loggingOut} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition disabled:opacity-60">
            {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>

      </main>

      {/* EDIT MODAL */}
      {editOpen && (
        <EditMentorModal
          mentor={mentor}
          saving={saving}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveProfile}
          showToast={showToast}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl ring-1 ring-black/5 max-w-sm">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
              {toast.type === "success" ? <Check size={18} strokeWidth={3} /> : <AlertTriangle size={18} strokeWidth={3} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{toast.type === "success" ? "Success" : "Error"}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5 break-words">{toast.message}</p>
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

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor?.name || "Mentor")}&background=eff6ff&color=2563eb`;
  const [avatarPreview, setAvatarPreview] = useState(mentor?.profilePic || fallbackAvatar);

  useEffect(() => {
    if (!form.avatarFile) return undefined;
    const objectUrl = URL.createObjectURL(form.avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [form.avatarFile]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) { showToast?.("error", "Choose a JPG, PNG or WEBP image."); event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { showToast?.("error", "Profile photo must be 5MB or smaller."); event.target.value = ""; return; }
    setForm((prev) => ({ ...prev, avatarFile: file, removeAvatar: false }));
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarFile: null, removeAvatar: true }));
    setAvatarPreview(fallbackAvatar);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const updateFile = (key, file) => setForm((prev) => ({ ...prev, [key]: file }));
  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !form.languages.includes(trimmed)) updateField("languages", [...form.languages, trimmed]);
    setSkillInput("");
  };

  const removeSkill = (skill) => updateField("languages", form.languages.filter((s) => s !== skill));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[95dvh] sm:max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white text-slate-800 shadow-2xl [color-scheme:light] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit3 size={18} className="text-blue-600" /> Edit Profile
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* PROFILE PHOTO */}
            <section className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-20 w-20 shrink-0">
                  <img src={avatarPreview} alt="Mentor profile" onError={() => setAvatarPreview(fallbackAvatar)} className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md" />
                  <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={saving} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md hover:bg-blue-700 transition disabled:opacity-60">
                    <Camera size={15} />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} className="hidden" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Profile Photo</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Upload a new photo to replace your current profile picture.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 transition disabled:opacity-60 shadow-sm">
                      <Camera size={14} /> {form.avatarFile || (mentor?.profilePic && !form.removeAvatar) ? "Change photo" : "Upload photo"}
                    </button>
                    {(mentor?.profilePic || form.avatarFile) && !form.removeAvatar && (
                      <button type="button" onClick={handleRemoveAvatar} disabled={saving} className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold text-red-600 hover:text-red-700 transition disabled:opacity-60">
                        <Trash2 size={14} /> Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EDITABLE_FIELDS.map(({ key, label, type, placeholder, required }) => (
                <div key={key} className={key === "name" ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</label>
                  <input type={type || "text"} value={form[key]} required={required} onChange={(e) => updateField(key, e.target.value)} placeholder={placeholder || `Enter ${label.toLowerCase()}`} className={INPUT_CLASS} />
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-bold text-slate-700">About Me</label>
              <textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} rows={4} placeholder="Tell mentees about yourself..." className={`${INPUT_CLASS} resize-none`} />
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Skills / Languages</label>
              <div className="flex gap-2">
                <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} placeholder="e.g. React, Python, Java" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button type="button" onClick={addSkill} className="flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm">
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="mt-3 flex min-h-[50px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
                {form.languages.length === 0 ? (
                  <p className="w-full py-1 text-center text-sm font-medium text-slate-400">No skills added yet</p>
                ) : (
                  form.languages.map((skill) => (
                    <span key={skill} className="flex max-w-full items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
                      <span className="min-w-0 break-words">{skill}</span>
                      <button type="button" onClick={() => removeSkill(skill)} className="shrink-0 text-blue-500 hover:text-red-500 transition"><X size={13} /></button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-7 pt-6 border-t border-slate-100">
              <label className="mb-3 block text-xs font-bold text-slate-700">Documents</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DocumentUploadField label="Offer Letter" currentUrl={form.offerLetter} file={form.offerLetterFile} onChange={(file) => updateFile("offerLetterFile", file)} />
                <DocumentUploadField label="Employee ID Proof" currentUrl={form.employeeIdProof} file={form.employeeIdProofFile} onChange={(file) => updateFile("employeeIdProofFile", file)} />
                <DocumentUploadField label="Additional Proof" currentUrl={form.additionalProof} file={form.additionalProofFile} onChange={(file) => updateFile("additionalProofFile", file)} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {saving ? "Saving…" : "Save Changes"}
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
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      {file ? <p className="mt-1 truncate text-xs font-semibold text-blue-600">Selected: {file.name}</p> : currentUrl ? (
        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"><Download size={12} /> View current file</a>
      ) : <p className="mt-1 text-xs font-medium text-slate-400">Not uploaded</p>}
      <label htmlFor={inputId} className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-2 text-xs font-bold text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition">
        <Plus size={13} /> {currentUrl || file ? "Replace file" : "Upload file"}
      </label>
      <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onChange(e.target.files?.[0] || null)} className="hidden" />
    </div>
  );
};

const DetailItem = ({ icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 transition hover:bg-slate-100/50">
    <div className="shrink-0 text-blue-500 bg-blue-100/50 p-2 rounded-lg">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-900 break-words">{value || "Not provided"}</p>
    </div>
  </div>
);

const DocumentCard = ({ title, url }) => (
  <div className="min-w-0 p-4 border border-slate-200 rounded-xl bg-white shadow-sm transition hover:shadow-md">
    <div className="flex items-center gap-2 mb-2">
      <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><FileText size={14} /></div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
    </div>
    {url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-xs mt-1 transition">
        <Download size={14} /> View Document
      </a>
    ) : <p className="text-xs font-medium text-slate-400 mt-1">Not uploaded</p>}
  </div>
);

const StatCard = ({ label, value, icon: Icon, color, bg, border, iconClass = "" }) => (
  <div className="min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center transition hover:shadow-md">
    <div className={`w-12 h-12 mx-auto mb-3 rounded-full ${bg} ${border} border flex items-center justify-center`}>
      <Icon size={22} className={`${color} ${iconClass}`} />
    </div>
    <div className="text-2xl font-bold text-slate-900 truncate">{value}</div>
    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{label}</p>
  </div>
);

export default MentorProfile;