import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Pencil, X, Check, Plus, GraduationCap, MapPin, Phone, Mail, Loader2,
  AlertTriangle, ShieldAlert, User, Calendar, Globe, Code, Heart, BriefcaseBusiness,
  Trash2, Building2, Info, Settings as SettingsIcon, Sparkles, Circle, CheckCircle2, Search, SlidersHorizontal
} from "lucide-react";
import {
  PROFILE_IMAGE_KEYS, REQUIRED_PERCENT, getRawAvatarUrl, getProfileStatus,
} from "../../utils/profileCompletion";

/* ============================== API ============================== */
const API_BASE_URL = import.meta?.env?.VITE_API_URL || "http://localhost:5000/api";
const ENDPOINTS = {
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE: `${API_BASE_URL}/auth/update`,
  AVATAR: `${API_BASE_URL}/auth/avatar`,
};
const jsonHeaders = { "Content-Type": "application/json" };

async function apiGetCurrentUser() {
  const r = await fetch(ENDPOINTS.ME, { credentials: "include", headers: jsonHeaders });
  if (r.status === 401) throw new Error("UNAUTHENTICATED");
  if (!r.ok) throw new Error(`Failed to load profile: ${r.status}`);
  const d = await r.json();
  return d?.user ?? d;
}
async function apiUpdateCurrentUser(payload) {
  const r = await fetch(ENDPOINTS.UPDATE, {
    method: "PATCH", credentials: "include", headers: jsonHeaders, body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to save changes");
  const d = await r.json();
  return d?.user ?? d;
}
async function apiUploadAvatar(file) {
  const fd = new FormData();
  fd.append("avatar", file);
  const r = await fetch(ENDPOINTS.AVATAR, { method: "POST", credentials: "include", body: fd });
  if (!r.ok) throw new Error(`Failed to upload photo: ${r.status}`);
  const d = await r.json();
  return d?.user ?? d;
}
async function apiRemoveAvatar() {
  const r = await fetch(ENDPOINTS.AVATAR, { method: "DELETE", credentials: "include", headers: jsonHeaders });
  if (!r.ok) throw new Error("Failed to remove photo");
  const d = await r.json().catch(() => ({}));
  return d?.user ?? d;
}
const notifyProfileChanged = () => window.dispatchEvent(new Event("profile:updated"));

/* ============================== FIELDS ============================== */
const FIELD_DEFS = {
  name: { label: "Full name", group: "basic", required: true },
  gender: { label: "Gender", group: "basic", type: "select", options: ["Male", "Female", "Other", "Prefer not to say"] },
  dateOfBirth: { label: "Date of birth", group: "basic", type: "date" },
  location: { label: "Location", group: "basic", placeholder: "City, Country" },
  nationality: { label: "Nationality", group: "basic", placeholder: "Your nationality" },
  email: { label: "Email", group: "contact", editable: false, required: true },
  phone: { label: "Phone", group: "contact", required: true, placeholder: "+91 1234567890" },
  bio: { label: "About me", group: "about", type: "textarea", placeholder: "Tell us about yourself..." },
};

/* ============================== LIGHT MODE STYLES ============================== */
const CARD = "bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";
const INPUT = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/20 transition hover:brightness-105 disabled:opacity-60";
const BTN_OUTLINE = "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900";
const PILL_BTN = "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition shadow-sm hover:brightness-110";

const TABS = [
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
  { id: "skills", label: "Skills", icon: Code },
  { id: "interests", label: "Interests", icon: Heart },
];

/* ============================== SMALL PARTS ============================== */
const AvatarImage = ({ src, name, className = "", textClass = "text-4xl" }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initial = (name || "").trim().charAt(0).toUpperCase() || "F";
  return src && !failed
    ? <img src={src} alt={name || "Profile"} onError={() => setFailed(true)} className={`${className} object-cover`} />
    : <div role="img" aria-label={name || "Profile"} className={`${className} flex items-center justify-center bg-gradient-to-br from-pink-400 to-orange-400 font-bold text-white ${textClass}`}>{initial}</div>;
};

const RequiredMark = () => <span className="ml-0.5 font-semibold text-pink-500">*</span>;

/* ============================== MODALS ============================== */
const ModalShell = ({ title, onClose, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-end justify-center overscroll-contain bg-gray-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className="max-h-[92dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900"><X size={18} /></button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const ModalInput = ({ label, name, value, onChange, placeholder, type = "text", required = false, disabled = false }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-gray-700">{label}{required && <RequiredMark />}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} required={required} className={INPUT} />
  </div>
);

/* ============================== EDIT PROFILE MODAL ============================== */
const EditProfileModal = ({ user, saving, onClose, onSave, onAvatarUpload, onAvatarRemove, avatarUrl, hasRealAvatar }) => {
  const [form, setForm] = useState({ ...user, phone: user.phone || user.mobile || "" });
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fields = useMemo(() => Object.keys(FIELD_DEFS).map((key) => ({ key, def: FIELD_DEFS[key] })), []);
  const group = (g) => fields.filter((f) => f.def.group === g);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    try { await onAvatarUpload(file); } finally { setUploading(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {};
    fields.filter((f) => f.def.editable !== false).forEach(({ key }) => {
      const v = form[key];
      payload[key] = typeof v === "string" ? v.trim() : v ?? "";
    });
    onSave(payload);
  };

  const renderField = ({ key, def }) => (
    <div key={key}>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">{def.label}{def.required && <RequiredMark />}</label>
      {def.type === "select" ? (
        <select value={form[key] || ""} onChange={(e) => update(key, e.target.value)} className={INPUT}>
          <option value="">Select</option>
          {def.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : def.type === "textarea" ? (
        <textarea value={form[key] || ""} rows={4} placeholder={def.placeholder} onChange={(e) => update(key, e.target.value)} className={`${INPUT} resize-none`} />
      ) : (
        <input type={def.type || "text"} value={form[key] || ""} placeholder={def.placeholder} disabled={def.editable === false}
          onChange={(e) => update(key, e.target.value)} className={INPUT} />
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center overscroll-contain bg-gray-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Edit profile</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900"><X size={17} /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-gray-50 p-5 sm:flex-row border border-gray-100">
              <div className="relative">
                <AvatarImage src={preview || avatarUrl} name={user?.name} className="h-20 w-20 rounded-2xl" textClass="text-2xl" />
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70"><Loader2 size={22} className="animate-spin text-pink-500" /></div>}
                <label htmlFor="edit-image" className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-lg">
                  <Camera size={13} />
                  <input id="edit-image" type="file" accept="image/*" onChange={pick} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-sm font-semibold text-gray-900">Profile photo <RequiredMark /></h3>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG or WEBP. Max 5MB.</p>
                {hasRealAvatar && <button type="button" onClick={onAvatarRemove} className="mt-2 text-xs font-semibold text-pink-600 hover:text-pink-700">Remove photo</button>}
              </div>
            </div>
            {[["basic", "Basic information", "sm:grid-cols-2"], ["contact", "Contact", "sm:grid-cols-2"], ["about", "About you", ""]].map(([g, title, cols]) => (
              <div key={g}>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h4>
                <div className={`grid gap-4 ${cols}`}>{group(g).map(renderField)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 border-t border-gray-100 px-6 py-4 sm:justify-end">
            <button type="button" onClick={onClose} className={BTN_OUTLINE}>Cancel</button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save changes
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ============================== DETAILS MODAL (VIEW & UPDATE) ============================== */
const DetailsModal = ({ title, icon: Icon, onClose, user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState("list"); // 'list' or 'form'
  
  // State for adding new items
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", field: "", graduationYear: "", cgpa: "", description: "" });
  const [careerForm, setCareerForm] = useState({ company: "", role: "", industry: "", startDate: "", endDate: "", current: false, description: "" });
  const [tagInput, setTagInput] = useState("");

  const handleAddEducation = (e) => {
    e.preventDefault();
    if (!eduForm.institution || !eduForm.degree) return;
    onUpdate({ education: [...user.education, { id: Date.now().toString(), ...eduForm }] }, "Education added.");
    setEduForm({ institution: "", degree: "", field: "", graduationYear: "", cgpa: "", description: "" });
    setActiveTab("list");
  };

  const handleAddCareer = (e) => {
    e.preventDefault();
    if (!careerForm.company || !careerForm.role) return;
    onUpdate({ career: [...user.career, { id: Date.now().toString(), ...careerForm }] }, "Experience added.");
    setCareerForm({ company: "", role: "", industry: "", startDate: "", endDate: "", current: false, description: "" });
    setActiveTab("list");
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const val = tagInput.trim();
    if (!val) return;
    const field = title.toLowerCase(); // 'skills' or 'interests'
    if (!user[field].includes(val)) {
      onUpdate({ [field]: [...user[field], val] }, `${title} added.`);
    }
    setTagInput("");
  };

  const handleDelete = (type, id) => {
    onUpdate({ [type]: user[type].filter((x) => x.id !== id) }, "Item removed.");
  };

  return (
    <ModalShell title={`Manage ${title}`} onClose={onClose}>
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-2">
        <button onClick={() => setActiveTab("list")} className={`text-sm font-semibold px-4 py-2 rounded-full transition ${activeTab === "list" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>View Details</button>
        <button onClick={() => setActiveTab("form")} className={`text-sm font-semibold px-4 py-2 rounded-full transition ${activeTab === "form" ? "bg-pink-50 text-pink-600" : "text-gray-500 hover:text-gray-900"}`}>+ Add New</button>
      </div>

      {activeTab === "list" && (
        <div className="space-y-4">
          {title === "Education" && (
            user.education.length ? user.education.map(e => (
              <div key={e.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 relative group">
                <h4 className="font-bold text-gray-900">{e.institution}</h4>
                <p className="text-sm text-gray-600">{e.degree} {e.field && `· ${e.field}`}</p>
                <div className="flex gap-2 mt-2">
                  {e.graduationYear && <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">{e.graduationYear}</span>}
                  {e.cgpa && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">{e.cgpa}</span>}
                </div>
                <button onClick={() => handleDelete('education', e.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
              </div>
            )) : <p className="text-sm text-gray-400 text-center py-4 italic">No education details added yet.</p>
          )}

          {title === "Career" && (
            user.career.length ? user.career.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 relative group">
                <h4 className="font-bold text-gray-900">{c.role}</h4>
                <p className="text-sm text-gray-600">{c.company} {c.industry && `· ${c.industry}`}</p>
                <p className="text-xs text-gray-400 mt-1">{c.startDate} - {c.current ? "Present" : c.endDate}</p>
                <button onClick={() => handleDelete('career', c.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
              </div>
            )) : <p className="text-sm text-gray-400 text-center py-4 italic">No experience added yet.</p>
          )}

          {(title === "Skills" || title === "Interests") && (
            <div className="flex flex-wrap gap-2">
              {user[title.toLowerCase()].length ? user[title.toLowerCase()].map(item => (
                <span key={item} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
                  {item}
                  <button onClick={() => {
                    const field = title.toLowerCase();
                    onUpdate({ [field]: user[field].filter(x => x !== item) }, `${title} removed.`);
                  }} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                </span>
              )) : <p className="text-sm text-gray-400 text-center w-full py-4 italic">None added yet.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === "form" && (
        <div>
          {title === "Education" && (
            <form onSubmit={handleAddEducation} className="space-y-4">
              <ModalInput label="Institution" value={eduForm.institution} onChange={e => setEduForm({...eduForm, institution: e.target.value})} required />
              <ModalInput label="Degree" value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <ModalInput label="Year" value={eduForm.graduationYear} onChange={e => setEduForm({...eduForm, graduationYear: e.target.value})} />
                <ModalInput label="CGPA" value={eduForm.cgpa} onChange={e => setEduForm({...eduForm, cgpa: e.target.value})} />
              </div>
              <button type="submit" className={`${BTN_PRIMARY} w-full mt-4`}>Save Education</button>
            </form>
          )}

          {title === "Career" && (
            <form onSubmit={handleAddCareer} className="space-y-4">
              <ModalInput label="Company" value={careerForm.company} onChange={e => setCareerForm({...careerForm, company: e.target.value})} required />
              <ModalInput label="Role" value={careerForm.role} onChange={e => setCareerForm({...careerForm, role: e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <ModalInput label="Start Date" type="date" value={careerForm.startDate} onChange={e => setCareerForm({...careerForm, startDate: e.target.value})} />
                <ModalInput label="End Date" type="date" value={careerForm.endDate} onChange={e => setCareerForm({...careerForm, endDate: e.target.value})} disabled={careerForm.current} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={careerForm.current} onChange={e => setCareerForm({...careerForm, current: e.target.checked})} className="h-4 w-4 rounded text-pink-500" />
                Currently working here
              </label>
              <button type="submit" className={`${BTN_PRIMARY} w-full mt-4`}>Save Experience</button>
            </form>
          )}

          {(title === "Skills" || title === "Interests") && (
            <form onSubmit={handleAddTag} className="space-y-4">
              <ModalInput label={`Add new ${title.slice(0,-1)}`} value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder={`e.g. ${title === 'Skills' ? 'React' : 'AI/ML'}`} />
              <button type="submit" className={`${BTN_PRIMARY} w-full mt-4`}>Add {title.slice(0,-1)}</button>
            </form>
          )}
        </div>
      )}
    </ModalShell>
  );
};

/* ============================== MAIN ============================== */
const FresherProfile = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    const modalOpen = editOpen || Boolean(detailsOpen);
    if (!modalOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [editOpen, detailsOpen]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const loadUser = useCallback(async () => {
    setStatus("loading");
    try {
      const d = await apiGetCurrentUser();
      setUser({ ...d, phone: d.phone || d.mobile || "", education: d.education || [], career: d.career || [], skills: d.skills || [], interests: d.interests || [] });
      setStatus("ready");
    } catch (err) {
      setStatus(err.message === "UNAUTHENTICATED" ? "unauthenticated" : "error");
    }
  }, []);
  useEffect(() => { loadUser(); }, [loadUser]);

  const persist = async (patch, msg) => {
    const previous = user;
    setUser({ ...user, ...patch });
    try {
      const updated = await apiUpdateCurrentUser(patch);
      setUser((p) => ({ ...p, ...updated }));
      notifyProfileChanged();
      showToast("success", msg);
    } catch (err) {
      setUser(previous);
      showToast("error", err.message || "Could not save.");
    }
  };

 const handleAvatarUpload = async (file) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showToast("error", "Select a valid image.");
  if (file.size > 5 * 1024 * 1024) return showToast("error", "Max 5MB.");

  setUploading(true);
  try {
    const updated = await apiUploadAvatar(file);
    if (!updated || !getRawAvatarUrl(updated)) throw new Error("Avatar URL missing from server response.");
    setUser((prev) => ({ ...prev, ...updated }));
    setPreviewImage(null);
    notifyProfileChanged();
    showToast("success", "Photo updated.");
  } catch (err) {
    console.error("Avatar upload error:", err);
    showToast("error", err.message || "Upload failed.");
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

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const updated = await apiUpdateCurrentUser(payload);
      setUser({ ...user, ...payload, ...updated });
      setEditOpen(false); notifyProfileChanged(); showToast("success", "Changes saved.");
    } catch (err) { showToast("error", err.message || "Save failed."); }
    finally { setSaving(false); }
  };

  if (status === "unauthenticated") return <StateShell icon={<ShieldAlert size={22} />} title="Sign in required" message="Your session expired." action={<Link to="/login" className={BTN_PRIMARY}>Login</Link>} />;
  if (status === "error") return <StateShell icon={<AlertTriangle size={22} />} title="Couldn't load profile" message="Please check your connection." action={<button onClick={loadUser} className={BTN_PRIMARY}>Retry</button>} />;
  if (status === "loading" || !user) return <Skeleton />;

  const name = (user.name || "").trim() || "Fresher";
  const avatarUrl = previewImage || getRawAvatarUrl(user);

  return (
    // Changed to h-screen and overflow-hidden to stop main page scroll
    <div className="h-screen bg-[#f4f7f9] text-slate-800 flex flex-col overflow-hidden">
      
      {/* Container takes full height, max-w-7xl, overflow hidden, NO padding top/bottom */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
        
        {/* LEFT COLUMN: Profile Image Card - Centered vertically, no scroll */}
        <div className="hidden lg:flex lg:col-span-1 h-full items-center justify-center">
          <div className={`${CARD} overflow-hidden w-full max-h-[85vh]`}>
            <div className="relative w-full h-full aspect-[4/5] bg-gray-100">
              <AvatarImage src={avatarUrl} name={name} className="h-full w-full object-cover grayscale-[10%]" textClass="text-6xl" />
              <label htmlFor="avatar-upload" className="absolute bottom-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-md text-gray-700 hover:bg-white transition">
                <Camera size={18} />
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm"><Loader2 size={24} className="animate-spin text-pink-500" /></div>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Name, Info, and List - THIS is the only part that scrolls */}
        {/* Added py-6 and pb-24 here to allow scrolling to the very bottom */}
        <div className="col-span-1 lg:col-span-2 h-full overflow-y-auto py-6 pb-24 pr-2 space-y-6 custom-scrollbar">
          
          {/* Mobile Image (Shows only on mobile) */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className={`${CARD} overflow-hidden w-full max-w-sm`}>
              <div className="relative w-full aspect-square bg-gray-100">
                <AvatarImage src={avatarUrl} name={name} className="h-full w-full object-cover grayscale-[10%]" textClass="text-6xl" />
                <label htmlFor="avatar-upload-mobile" className="absolute bottom-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-md text-gray-700 hover:bg-white transition">
                  <Camera size={18} />
                  <input id="avatar-upload-mobile" type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>

          {/* Profile Header Card */}
          <div className={`${CARD} p-8`}>
            <div className="flex justify-between items-start mb-6">
               <div>
                  <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
                  <p className="text-gray-500 mt-1">{user.bio || "Fresher · add your bio"}</p>
               </div>
               <button onClick={() => setEditOpen(true)} className={`${BTN_PRIMARY} px-4 py-2 text-xs`}>Edit Profile</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="bg-gray-100 p-2 rounded-lg"><Mail size={16} /></div>
                  {user.email}
               </div>
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="bg-gray-100 p-2 rounded-lg"><Phone size={16} /></div>
                  {user.phone || "Not added"}
               </div>
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="bg-gray-100 p-2 rounded-lg"><MapPin size={16} /></div>
                  {user.location || "Not added"}
               </div>
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="bg-gray-100 p-2 rounded-lg"><User size={16} /></div>
                  {user.gender || "Not added"}
               </div>
            </div>
          </div>

          {/* Categories / List Card */}
          <div className={`${CARD} p-8`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">My Profile Details</h2>
            </div>

            <div className="space-y-4">
              {TABS.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400">
                       <t.icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">{t.label}</h3>
                      <p className="text-xs text-gray-500">
                         {t.id === 'education' && `${user.education.length} entries`}
                         {t.id === 'career' && `${user.career.length} entries`}
                         {t.id === 'skills' && `${user.skills.length} skills`}
                         {t.id === 'interests' && `${user.interests.length} interests`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setDetailsOpen(t.label)} className={`${PILL_BTN} bg-gradient-to-r from-pink-500 to-rose-500`}>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <AnimatePresence>
        {detailsOpen && (
          <DetailsModal 
            title={detailsOpen} 
            onClose={() => setDetailsOpen(null)} 
            user={user} 
            onUpdate={persist} 
          />
        )}
        {editOpen && (
          <EditProfileModal user={user} saving={saving} onClose={() => setEditOpen(false)} onSave={handleSave}
            onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove} avatarUrl={avatarUrl} hasRealAvatar={Boolean(getRawAvatarUrl(user))} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-6 right-6 z-[110]">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-xl border border-gray-100">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${toast.type === "error" ? "bg-red-100 text-red-500" : "bg-green-100 text-green-500"}`}>
                {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} strokeWidth={3} />}
              </span>
              <p className="text-sm font-medium text-gray-800">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StateShell = ({ icon, title, message, action }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#f4f7f9] px-5">
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl border border-gray-100">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 text-white">{icon}</div>
      <h1 className="mt-5 text-lg font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  </div>
);

const Skeleton = () => (
  <div className="h-screen bg-[#f4f7f9] p-6 flex justify-center overflow-hidden">
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
       <div className="hidden lg:block h-[500px] animate-pulse rounded-3xl bg-white shadow-sm" />
       <div className="lg:col-span-2 space-y-6 overflow-hidden">
         <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
         <div className="h-96 animate-pulse rounded-3xl bg-white shadow-sm" />
       </div>
    </div>
  </div>
);

export default FresherProfile;