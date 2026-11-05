import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Pencil,
  X,
  Check,
  Plus,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  User,
  Calendar,
  Globe,
  Code,
  Heart,
  UserCircle,
  BriefcaseBusiness,
  Trash2,
  Sparkles,
  ArrowRight,
  Building2,
  Award,
  Home,
  CalendarDays,
  Bell,
  Wallet,
  ChevronDown,
  Info,
  Zap,
  GraduationCapIcon,
  Briefcase
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  PROFILE_IMAGE_KEYS,
  REQUIRED_PERCENT,
  getRawAvatarUrl,
  getProfileStatus,
} from "../../utils/profileCompletion";

/* =========================================================================
   API LAYER (Unchanged)
========================================================================= */
const API_BASE_URL = import.meta?.env?.VITE_API_URL || "http://localhost:5000/api";
const ENDPOINTS = {
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE: `${API_BASE_URL}/auth/update`,
  AVATAR: `${API_BASE_URL}/auth/avatar`,
};
const jsonHeaders = { "Content-Type": "application/json" };

async function apiGetCurrentUser() {
  const response = await fetch(ENDPOINTS.ME, { credentials: "include", headers: jsonHeaders });
  if (response.status === 401) throw new Error("UNAUTHENTICATED");
  if (!response.ok) throw new Error(`Failed to load profile: ${response.status}`);
  const data = await response.json();
  return data?.user ?? data;
}

async function apiUpdateCurrentUser(payload) {
  const res = await fetch(ENDPOINTS.UPDATE, {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save changes");
  const data = await res.json();
  return data?.user ?? data;
}

async function apiUploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await fetch(ENDPOINTS.AVATAR, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) throw new Error(`Failed to upload photo: ${response.status}`);
  const data = await response.json();
  return data?.user ?? data;
}

async function apiRemoveAvatar() {
  const res = await fetch(ENDPOINTS.AVATAR, {
    method: "DELETE",
    credentials: "include",
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error("Failed to remove photo");
  const data = await res.json().catch(() => ({}));
  return data?.user ?? data;
}

const notifyProfileChanged = () => window.dispatchEvent(new Event("profile:updated"));

/* =========================================================================
   FIELD DEFS
========================================================================= */
const FIELD_DEFS = {
  name: { label: "Full name", group: "basic", editable: true, icon: User, required: true, placeholder: "Enter your full name" },
  gender: { label: "Gender", group: "basic", editable: true, type: "select", options: ["Male", "Female", "Other", "Prefer not to say"], icon: User },
  dateOfBirth: { label: "Date of birth", group: "basic", editable: true, type: "date", icon: Calendar },
  location: { label: "Location", group: "basic", editable: true, icon: MapPin, placeholder: "City, Country" },
  nationality: { label: "Nationality", group: "basic", editable: true, icon: Globe, placeholder: "Your nationality" },
  email: { label: "Email", group: "contact", editable: false, icon: Mail, required: true },
  phone: { label: "Phone", group: "contact", editable: true, icon: Phone, required: true, placeholder: "+91 1234567890" },
  bio: { label: "About me", group: "about", editable: true, type: "textarea", icon: User, placeholder: "Tell us about yourself..." },
};

const HIDDEN_KEYS = new Set(["_id", "id", "password", "token", "__v", "createdAt", "updatedAt", "isVerified", "accountType", "role", "countryCode", "website", ...PROFILE_IMAGE_KEYS]);
const hasValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
};

/* =========================================================================
   STYLES
========================================================================= */
const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const BTN_PRIMARY = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const BTN_OUTLINE = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const NAV_ITEMS = [
  { id: "profile", label: "About", icon: UserCircle },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
  { id: "skills", label: "Skills", icon: Code },
  { id: "interests", label: "Interests", icon: Heart },
];

/* =========================================================================
   AVATAR
========================================================================= */
const AvatarCircle = ({ src, name, className = "", textClass = "text-base" }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initial = (name || "").trim().charAt(0).toUpperCase() || "F";

  if (src && !failed) {
    return <img src={src} alt={name || "Profile"} onError={() => setFailed(true)} className={`${className} rounded-full bg-slate-100 object-cover`} />;
  }
  return (
    <div role="img" aria-label={name || "Profile"} className={`${className} flex items-center justify-center rounded-full bg-blue-600 font-semibold text-white ${textClass}`}>
      {initial}
    </div>
  );
};

/* =========================================================================
   MODALS & SMALL COMPONENTS
========================================================================= */
const RequiredMark = () => <span className="ml-0.5 font-semibold text-rose-500">*</span>;

const ModalShell = ({ title, onClose, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
    <motion.div initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.98 }} onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sans text-lg font-semibold text-slate-900">{title}</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const ModalInput = ({ label, name, value, onChange, placeholder, type = "text", required = false, disabled = false }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <RequiredMark />}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} required={required} className={INPUT} />
  </div>
);

const ModalTextarea = ({ name, value, onChange, placeholder }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Description</label>
    <textarea name={name} value={value} onChange={onChange} rows="3" placeholder={placeholder} className={`${INPUT} resize-none`} />
  </div>
);

const ModalButtons = ({ onClose, submitText }) => (
  <div className="flex gap-2.5 pt-4">
    <button type="button" onClick={onClose} className={`${BTN_OUTLINE} flex-1`}>Cancel</button>
    <button type="submit" className={`${BTN_PRIMARY} flex-1`}>{submitText}</button>
  </div>
);

const EMPTY_EDUCATION = { institution: "", degree: "", field: "", graduationYear: "", cgpa: "", description: "" };
const AddEducationModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState(EMPTY_EDUCATION);
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.institution || !formData.degree) { alert("Fill Institution and Degree"); return; }
    onAdd({ id: Date.now().toString(), ...formData });
    setFormData(EMPTY_EDUCATION); onClose();
  };
  if (!isOpen) return null;
  return (
    <ModalShell title="Add education" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInput label="Institution / University" name="institution" value={formData.institution} onChange={handleChange} placeholder="e.g. MIT, Stanford" required />
        <ModalInput label="Degree" name="degree" value={formData.degree} onChange={handleChange} placeholder="e.g. B.Tech, M.Sc" required />
        <ModalInput label="Field / Specialization" name="field" value={formData.field} onChange={handleChange} placeholder="e.g. Computer Science" />
        <div className="grid grid-cols-2 gap-3">
          <ModalInput label="Graduation year" name="graduationYear" type="number" value={formData.graduationYear} onChange={handleChange} placeholder="2024" />
          <ModalInput label="CGPA / Percentage" name="cgpa" value={formData.cgpa} onChange={handleChange} placeholder="8.5 / 85%" />
        </div>
        <ModalTextarea name="description" value={formData.description} onChange={handleChange} placeholder="Additional details..." />
        <ModalButtons onClose={onClose} submitText="Add education" />
      </form>
    </ModalShell>
  );
};

const EMPTY_CAREER = { company: "", role: "", industry: "", startDate: "", endDate: "", current: false, description: "" };
const AddCareerModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState(EMPTY_CAREER);
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.company || !formData.role) { alert("Fill Company and Role"); return; }
    onAdd({ id: Date.now().toString(), ...formData });
    setFormData(EMPTY_CAREER); onClose();
  };
  if (!isOpen) return null;
  return (
    <ModalShell title="Add career experience" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInput label="Company" name="company" value={formData.company} onChange={handleChange} placeholder="e.g. Google" required />
        <ModalInput label="Role / Position" name="role" value={formData.role} onChange={handleChange} placeholder="e.g. Software Engineer" required />
        <ModalInput label="Industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. Technology" />
        <div className="grid grid-cols-2 gap-3">
          <ModalInput label="Start date" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
          <ModalInput label="End date" name="endDate" type="date" value={formData.endDate} onChange={handleChange} disabled={formData.current} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="career-current" name="current" checked={formData.current} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <label htmlFor="career-current" className="text-sm text-slate-700">Currently working here</label>
        </div>
        <ModalTextarea name="description" value={formData.description} onChange={handleChange} placeholder="Describe your role..." />
        <ModalButtons onClose={onClose} submitText="Add experience" />
      </form>
    </ModalShell>
  );
};

const AddTagsModal = ({ isOpen, onClose, onAdd, existing, title, label, placeholder, emptyText, emptyAlert, submitText }) => {
  const [input, setInput] = useState("");
  const [items, setItems] = useState([]);
  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed) && !existing.includes(trimmed)) { setItems([...items, trimmed]); setInput(""); }
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) { alert(emptyAlert); return; }
    onAdd(items); setItems([]); setInput(""); onClose();
  };
  if (!isOpen) return null;
  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }} placeholder={placeholder} className={`${INPUT} min-w-0 flex-1`} />
            <button type="button" onClick={handleAdd} className={BTN_PRIMARY}>Add</button>
          </div>
        </div>
        <div className="flex min-h-[60px] flex-wrap content-start gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
          {items.length === 0 ? (
            <p className="w-full py-2 text-center text-sm text-slate-400">{emptyText}</p>
          ) : (
            items.map((item) => (
              <span key={item} className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {item}
                <button type="button" onClick={() => setItems(items.filter((s) => s !== item))} className="rounded-full p-0.5 text-blue-500 hover:bg-blue-200 hover:text-blue-900"><X size={12} /></button>
              </span>
            ))
          )}
        </div>
        <ModalButtons onClose={onClose} submitText={submitText} />
      </form>
    </ModalShell>
  );
};

const AddSkillModal = ({ existingSkills, ...props }) => <AddTagsModal {...props} existing={existingSkills} title="Add skills" label="Skill" placeholder="e.g. React" emptyText="No skills added" emptyAlert="Add at least one skill" submitText="Save skills" />;
const AddInterestModal = ({ existingInterests, ...props }) => <AddTagsModal {...props} existing={existingInterests} title="Add interests" label="Interest" placeholder="e.g. AI/ML" emptyText="No interests added" emptyAlert="Add at least one interest" submitText="Save interests" />;


/* =========================================================================
   MAIN COMPONENT
========================================================================= */
const FresherProfile = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);

  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const mainRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [activeTab]);

  const loadUser = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await apiGetCurrentUser();
      setUser({ ...data, phone: data.phone || data.mobile || "", education: data.education || [], career: data.career || [], skills: data.skills || [], interests: data.interests || [] });
      setStatus("ready");
    } catch (err) {
      setStatus(err.message === "UNAUTHENTICATED" ? "unauthenticated" : "error");
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const persist = async (patch, successMsg, type = "success") => {
    const previous = user;
    setUser({ ...user, ...patch });
    try {
      const updated = await apiUpdateCurrentUser(patch);
      setUser((prev) => ({ ...prev, ...updated }));
      notifyProfileChanged();
      showToast(type, successMsg);
    } catch (err) {
      setUser(previous);
      showToast("error", err.message || "Could not save.");
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
    try {
      const updated = await apiUploadAvatar(file);
      if (updated) {
        const url = updated.avatar || updated.profilePic || updated.profileImage || updated.photo || updated.photoUrl;
        setUser((prev) => ({ ...prev, ...updated }));
        if (url) setPreviewImage(null);
        notifyProfileChanged();
        showToast("success", "Photo updated.");
      }
    } catch (err) {
      showToast("error", err.message || "Upload failed.");
      setPreviewImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    try {
      const updated = await apiRemoveAvatar();
      const merged = { ...user, ...updated };
      PROFILE_IMAGE_KEYS.forEach((k) => delete merged[k]);
      setUser(merged); setPreviewImage(null); notifyProfileChanged(); showToast("success", "Photo removed.");
    } catch (err) { showToast("error", err.message || "Remove failed."); }
  };

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("error", "Select an image."); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("error", "Max 5MB."); return; }
    handleAvatarUpload(file);
  };

  const handleAddEducation = (edu) => persist({ education: [...(user.education || []), edu] }, "Education added.");
  const handleDeleteEducation = (id) => persist({ education: (user.education || []).filter((e) => e.id !== id) }, "Education removed.", "info");
  const handleAddCareer = (career) => persist({ career: [...(user.career || []), career] }, "Experience added.");
  const handleDeleteCareer = (id) => persist({ career: (user.career || []).filter((c) => c.id !== id) }, "Experience removed.", "info");
  const handleAddSkills = (skills) => persist({ skills: [...(user.skills || []), ...skills] }, "Skills added.");
  const handleDeleteSkill = (skill) => persist({ skills: (user.skills || []).filter((s) => s !== skill) }, "Skill removed.", "info");
  const handleAddInterests = (interests) => persist({ interests: [...(user.interests || []), ...interests] }, "Interests added.");
  const handleDeleteInterest = (interest) => persist({ interests: (user.interests || []).filter((i) => i !== interest) }, "Interest removed.", "info");

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const updated = await apiUpdateCurrentUser(payload);
      setUser({ ...user, ...payload, ...updated });
      setEditOpen(false); notifyProfileChanged(); showToast("success", "Changes saved.");
    } catch (err) {
      showToast("error", err.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const presentFields = useMemo(() => {
    if (!user) return [];
    return Object.entries(user).filter(([key, value]) => !HIDDEN_KEYS.has(key) && hasValue(value) && FIELD_DEFS[key]).map(([key, value]) => ({ key, value, def: FIELD_DEFS[key] }));
  }, [user]);

  const fieldByKey = (key) => presentFields.find((field) => field.key === key);
  const profile = useMemo(() => getProfileStatus(user, { hasPhoto: Boolean(getRawAvatarUrl(user)) || Boolean(previewImage) }), [user, previewImage]);
  const displayName = (user?.name || "").trim() || "Fresher";
  const avatarUrl = previewImage || getRawAvatarUrl(user);

  if (status === "unauthenticated") return <EmptyStateShell icon={<ShieldAlert size={22} />} title="Sign in required" message="Session expired." action={<Link to="/login" className={BTN_PRIMARY}>Login</Link>} />;
  if (status === "error") return <EmptyStateShell icon={<AlertTriangle size={22} />} title="Couldn't load" message="Check backend." action={<button onClick={loadUser} className={BTN_PRIMARY}>Retry</button>} />;
  if (status === "loading" || !user) return <ProfileSkeleton />;

  return (
    <div className="min-h-screen bg-[#f4f7f9] pb-20">
      {/* Main content centered with max width 5xl */}
      <main ref={mainRef} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        
        {/* ====== HERO PROFILE CARD ====== */}
        <section className="relative mb-8 flex flex-col md:flex-row items-center justify-between overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
            <svg className="absolute right-0 bottom-0 h-[150%] w-[70%] text-blue-50 opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,100 C30,100 40,40 100,40 L100,100 Z" fill="currentColor" />
            </svg>
            <div className="absolute right-[20%] top-0 h-[150%] w-[50%] bg-gradient-to-b from-blue-50/50 to-transparent -skew-x-12 transform origin-top-right" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full md:w-auto">
            <div className="relative shrink-0">
              <div className="rounded-full border-[6px] border-white bg-white shadow-lg outline outline-1 outline-blue-100">
                <AvatarCircle src={avatarUrl} name={displayName} className="h-32 w-32 sm:h-36 sm:w-36" textClass="text-5xl" />
              </div>
              <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition">
                <Camera size={16} />
                <input ref={fileInputRef} id="avatar-upload" type="file" accept="image/*" onChange={handleImagePick} className="hidden" disabled={uploading} />
              </label>
              {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-sm"><Loader2 size={24} className="animate-spin text-blue-600" /></div>}
            </div>

            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{displayName}</h1>
                {profile.ok && <Check size={20} className="text-blue-500 bg-blue-100 rounded-full p-1" />}
              </div>
              <p className="mt-1 text-sm sm:text-base font-medium text-slate-600">{user?.bio?.split('.')[0] || "Computer Science Engineering Graduate"}</p>
              
              <div className="mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-500">
                <MapPin size={14} className="text-blue-500" />
                <span>{user?.location || "Kanyakumari, Tamil Nadu"}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {user?.skills?.slice(0, 4).map((skill, idx) => (
                  <span key={idx} className={`rounded-full px-3 py-1 text-xs font-semibold ${idx === 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {skill}
                  </span>
                ))}
                {(!user?.skills || user.skills.length === 0) && (
                  <>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Full Stack Developer</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">React</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 md:mt-0 flex flex-col items-center gap-4 bg-white/40 backdrop-blur-sm md:bg-transparent rounded-2xl p-4 md:p-0">
            <div className="flex items-center gap-6">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" strokeWidth="8" strokeDasharray={`${(profile.percent / 100) * 251.2} 251.2`} strokeLinecap="round" />
                </svg>
                <span className="text-xl font-bold text-slate-900">{profile.percent}%</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-700">Profile Complete</p>
              </div>
            </div>

            <button onClick={() => setEditOpen(true)} className={`${BTN_OUTLINE} w-full md:w-auto mt-2`}>
              <Pencil size={15} />
              Edit Profile
            </button>
          </div>
        </section>

        {/* ====== TABS ====== */}
        <nav className="mb-8 flex justify-center overflow-x-auto rounded-full bg-white p-2 shadow-sm border border-slate-100 max-w-4xl mx-auto hide-scrollbar">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 shrink-0 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
                  active ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* ====== CONTENT GRID (Center Aligned) ====== */}
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {activeTab === "profile" && <ProfileContent user={user} fieldByKey={fieldByKey} onEdit={() => setEditOpen(true)} />}
              {activeTab === "education" && <EducationContent education={user.education || []} onAdd={() => setShowEducationModal(true)} onDelete={handleDeleteEducation} />}
              {activeTab === "career" && <CareerContent career={user.career || []} onAdd={() => setShowCareerModal(true)} onDelete={handleDeleteCareer} />}
              {activeTab === "skills" && <SkillsContent skills={user.skills || []} onAdd={() => setShowSkillModal(true)} onDelete={handleDeleteSkill} />}
              {activeTab === "interests" && <InterestsContent interests={user.interests || []} onAdd={() => setShowInterestModal(true)} onDelete={handleDeleteInterest} />}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* MODALS */}
      <AddEducationModal isOpen={showEducationModal} onClose={() => setShowEducationModal(false)} onAdd={handleAddEducation} />
      <AddCareerModal isOpen={showCareerModal} onClose={() => setShowCareerModal(false)} onAdd={handleAddCareer} />
      <AddSkillModal isOpen={showSkillModal} onClose={() => setShowSkillModal(false)} onAdd={handleAddSkills} existingSkills={user.skills || []} />
      <AddInterestModal isOpen={showInterestModal} onClose={() => setShowInterestModal(false)} onAdd={handleAddInterests} existingInterests={user.interests || []} />

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="fixed bottom-6 right-6 z-[110]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
                {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} strokeWidth={3} />}
              </div>
              <p className="text-sm font-medium text-slate-800">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT PROFILE MODAL */}
      <AnimatePresence>
        {editOpen && (
          <EditProfileModal user={user} saving={saving} onClose={() => setEditOpen(false)} onSave={handleSave} onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove} avatarUrl={avatarUrl} hasRealAvatar={Boolean(getRawAvatarUrl(user))} />
        )}
      </AnimatePresence>
    </div>
  );
};

/* =========================================================================
   TAB CONTENT COMPONENTS
========================================================================= */
const ProfileContent = ({ user, fieldByKey, onEdit }) => (
  <>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Info size={20} className="text-blue-600" />
          About Me
        </h2>
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100">
          <Pencil size={14} />
        </button>
      </div>
      {user?.bio ? (
        <p className="text-sm leading-relaxed text-slate-600">{user.bio}</p>
      ) : (
        <p className="text-sm italic text-slate-400">Add a short introduction so mentors know your goals.</p>
      )}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mt-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Phone size={20} className="text-blue-600" />
          Contact Information
        </h2>
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100">
          <Pencil size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
        <ContactItem icon={Mail} label="Email" value={user?.email} />
        <ContactItem icon={Phone} label="Phone" value={user?.phone || user?.mobile} />
        <ContactItem icon={MapPin} label="Location" value={user?.location} />
        <ContactItem icon={Globe} label="Nationality" value={user?.nationality} />
      </div>
    </div>
  </>
);

const EducationContent = ({ education, onAdd, onDelete }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <GraduationCap size={20} className="text-blue-600" />
        Education
      </h2>
      <button onClick={onAdd} className={BTN_PRIMARY}><Plus size={16} /> Add</button>
    </div>
    {education.length > 0 ? (
      <div className="space-y-4">
        {education.map((edu, i) => (
          <div key={edu.id || i} className="relative rounded-xl border border-slate-100 p-4 hover:bg-slate-50 transition group">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <GraduationCap size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{edu.institution}</h3>
                <p className="text-sm font-medium text-slate-600">{edu.degree}</p>
                {edu.field && <p className="text-xs text-slate-500">{edu.field}</p>}
                <div className="mt-2 flex gap-2 text-xs text-slate-500">
                  {edu.graduationYear && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{edu.graduationYear}</span>}
                  {edu.cgpa && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{edu.cgpa}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => onDelete(edu.id)} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 transition"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    ) : <EmptyTab text="No education added yet." />}
  </div>
);

const CareerContent = ({ career, onAdd, onDelete }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <BriefcaseBusiness size={20} className="text-blue-600" />
        Career
      </h2>
      <button onClick={onAdd} className={BTN_PRIMARY}><Plus size={16} /> Add</button>
    </div>
    {career.length > 0 ? (
      <div className="space-y-4">
        {career.map((exp, i) => (
          <div key={exp.id || i} className="relative rounded-xl border border-slate-100 p-4 hover:bg-slate-50 transition group">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Building2 size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{exp.company}</h3>
                <p className="text-sm font-medium text-slate-600">{exp.role}</p>
                <div className="mt-2 flex gap-2 text-xs text-slate-500">
                  {exp.startDate && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{exp.startDate}</span>}
                  {exp.current ? <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Present</span> : exp.endDate && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{exp.endDate}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => onDelete(exp.id)} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 transition"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    ) : <EmptyTab text="No career experience yet." />}
  </div>
);

const SkillsContent = ({ skills, onAdd, onDelete }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Code size={20} className="text-blue-600" />
        Skills
      </h2>
      <button onClick={onAdd} className={BTN_PRIMARY}><Plus size={16} /> Add</button>
    </div>
    {skills.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {skills.map(item => (
          <span key={item} className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {item}
            <button onClick={() => onDelete(item)} className="text-blue-400 hover:text-red-500"><X size={14} /></button>
          </span>
        ))}
      </div>
    ) : <EmptyTab text="No skills added yet." />}
  </div>
);

const InterestsContent = ({ interests, onAdd, onDelete }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Heart size={20} className="text-blue-600" />
        Interests
      </h2>
      <button onClick={onAdd} className={BTN_PRIMARY}><Plus size={16} /> Add</button>
    </div>
    {interests.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {interests.map(item => (
          <span key={item} className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {item}
            <button onClick={() => onDelete(item)} className="text-blue-400 hover:text-red-500"><X size={14} /></button>
          </span>
        ))}
      </div>
    ) : <EmptyTab text="No interests added yet." />}
  </div>
);

/* =========================================================================
   MODAL: EDIT PROFILE
========================================================================= */
const EditProfileModal = ({ user, saving, onClose, onSave, onAvatarUpload, onAvatarRemove, avatarUrl, hasRealAvatar }) => {
  const [form, setForm] = useState({ ...user, phone: user.phone || user.mobile || "" });
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const editableFields = useMemo(() => Object.keys(FIELD_DEFS).filter((key) => FIELD_DEFS[key].editable !== false).map((key) => ({ key, def: FIELD_DEFS[key] })), []);
  const groupedEditable = (group) => editableFields.filter((f) => f.def.group === group);
  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
    try { await onAvatarUpload(file); } finally { setUploading(false); }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {};
    editableFields.forEach(({ key }) => { const v = form[key]; payload[key] = typeof v === "string" ? v.trim() : (v ?? ""); });
    onSave(payload);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} onClick={(e) => e.stopPropagation()} className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit profile</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center mb-6">
              <div className="relative mx-auto sm:mx-0">
                <AvatarCircle src={previewImage || avatarUrl} name={user?.name} className="h-20 w-20" textClass="text-2xl" />
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60"><Loader2 size={22} className="animate-spin text-blue-600" /></div>}
                <label htmlFor="edit-image" className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700">
                  <Camera size={13} /><input id="edit-image" type="file" accept="image/*" onChange={handleImagePick} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-sm font-semibold text-slate-900">Profile photo <RequiredMark /></h3>
                <p className="mt-1 text-xs text-slate-500">Upload a new photo to replace this one.</p>
                {hasRealAvatar && <button type="button" onClick={onAvatarRemove} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700">Remove photo</button>}
              </div>
            </div>

            <div className="space-y-6">
              {groupedEditable("basic").length > 0 && (
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Basic information</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {groupedEditable("basic").map(({ key, def }) => (
                      <div key={key}><label className="mb-1.5 block text-xs font-semibold text-slate-700">{def.label} {def.required && <RequiredMark />}</label><input type={def.type || "text"} value={form[key] || ""} onChange={(e) => updateField(key, e.target.value)} className={INPUT} /></div>
                    ))}
                  </div>
                </div>
              )}
              {groupedEditable("contact").length > 0 && (
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Contact information</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {groupedEditable("contact").map(({ key, def }) => (
                      <div key={key}><label className="mb-1.5 block text-xs font-semibold text-slate-700">{def.label} {def.required && <RequiredMark />}</label><input type={def.type || "text"} value={form[key] || ""} disabled={def.editable === false} onChange={(e) => updateField(key, e.target.value)} className={INPUT} /></div>
                    ))}
                  </div>
                </div>
              )}
              {groupedEditable("about").length > 0 && (
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">About you</h4>
                  <div className="grid gap-4">
                    {groupedEditable("about").map(({ key, def }) => (
                      <div key={key}><label className="mb-1.5 block text-xs font-semibold text-slate-700">{def.label}</label><textarea value={form[key] || ""} onChange={(e) => updateField(key, e.target.value)} rows={4} className={`${INPUT} resize-none`} /></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:justify-end">
            <button type="button" onClick={onClose} className={BTN_OUTLINE}>Cancel</button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save changes</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* =========================================================================
   SMALL UTILS
========================================================================= */
const ContactItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
      <Icon size={18} />
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  </div>
);

const QuickInfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <Icon size={16} />
    </div>
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const EmptyTab = ({ text }) => (
  <div className="py-10 text-center text-sm text-slate-400">{text}</div>
);

const EmptyStateShell = ({ icon, title, message, action }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg border border-slate-100">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">{icon}</div>
      <h1 className="mt-5 text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-[#f4f7f9] p-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
      <div className="h-16 animate-pulse rounded-full bg-white max-w-4xl mx-auto" />
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  </div>
);

export default FresherProfile;