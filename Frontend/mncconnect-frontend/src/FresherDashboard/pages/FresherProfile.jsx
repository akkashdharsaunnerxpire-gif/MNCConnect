import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Pencil, X, Check, Plus, GraduationCap, MapPin, Phone, Mail, Loader2,
  AlertTriangle, ShieldAlert, User, Calendar, Globe, Code, Heart, BriefcaseBusiness,
  Trash2, Building2, Info, Settings as SettingsIcon, Sparkles, Circle, CheckCircle2,
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

/* ============================== STYLES ============================== */
const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const BTN_PRIMARY = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60";
const BTN_OUTLINE = "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";
const CARD = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

const TABS = [
  { id: "overview", label: "Overview", icon: Info },
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
  if (src && !failed) {
    return <img src={src} alt={name || "Profile"} onError={() => setFailed(true)} className={`${className} bg-slate-100 object-cover`} />;
  }
  return (
    <div role="img" aria-label={name || "Profile"} className={`${className} flex items-center justify-center bg-blue-600 font-bold text-white ${textClass}`}>
      {initial}
    </div>
  );
};

const RequiredMark = () => <span className="ml-0.5 font-semibold text-rose-500">*</span>;

const SectionTitle = ({ icon: Icon, children, action }) => (
  <div className="mb-5 flex items-center justify-between gap-3">
    <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={18} /></span>
      {children}
    </h2>
    {action}
  </div>
);

const EmptyTab = ({ icon: Icon, text, cta, onCta }) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon size={22} /></span>
    <p className="text-sm text-slate-500">{text}</p>
    {cta && <button onClick={onCta} className={BTN_PRIMARY}><Plus size={16} /> {cta}</button>}
  </div>
);

const StatTile = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={20} /></span>
    <div className="min-w-0">
      <p className="text-xl font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  </div>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm"><Icon size={16} /></span>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-900">{value || "Not added"}</p>
    </div>
  </div>
);

const ProgressRing = ({ percent, size = 88 }) => (
  <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="9" />
      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" strokeWidth="9"
        strokeDasharray={`${(percent / 100) * 251.2} 251.2`} strokeLinecap="round" />
    </svg>
    <span className="text-lg font-bold text-slate-900">{percent}%</span>
  </div>
);

/* ============================== MODALS ============================== */
const ModalShell = ({ title, onClose, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-end justify-center overscroll-contain bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
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

const ModalButtons = ({ onClose, submitText }) => (
  <div className="flex gap-2.5 pt-4">
    <button type="button" onClick={onClose} className={`${BTN_OUTLINE} flex-1`}>Cancel</button>
    <button type="submit" className={`${BTN_PRIMARY} flex-1`}>{submitText}</button>
  </div>
);

const EMPTY_EDU = { institution: "", degree: "", field: "", graduationYear: "", cgpa: "", description: "" };
const AddEducationModal = ({ onClose, onAdd }) => {
  const [f, setF] = useState(EMPTY_EDU);
  const change = (e) => setF({ ...f, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!f.institution.trim() || !f.degree.trim()) return;
    onAdd({ id: Date.now().toString(), ...f });
    onClose();
  };
  return (
    <ModalShell title="Add education" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalInput label="Institution / University" name="institution" value={f.institution} onChange={change} placeholder="e.g. MIT" required />
        <ModalInput label="Degree" name="degree" value={f.degree} onChange={change} placeholder="e.g. B.Tech" required />
        <ModalInput label="Field / Specialization" name="field" value={f.field} onChange={change} placeholder="e.g. Computer Science" />
        <div className="grid grid-cols-2 gap-3">
          <ModalInput label="Graduation year" name="graduationYear" type="number" value={f.graduationYear} onChange={change} placeholder="2025" />
          <ModalInput label="CGPA / Percentage" name="cgpa" value={f.cgpa} onChange={change} placeholder="8.5 / 85%" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Description</label>
          <textarea name="description" value={f.description} onChange={change} rows={3} placeholder="Additional details..." className={`${INPUT} resize-none`} />
        </div>
        <ModalButtons onClose={onClose} submitText="Add education" />
      </form>
    </ModalShell>
  );
};

const EMPTY_CAREER = { company: "", role: "", industry: "", startDate: "", endDate: "", current: false, description: "" };
const AddCareerModal = ({ onClose, onAdd }) => {
  const [f, setF] = useState(EMPTY_CAREER);
  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setF({ ...f, [name]: type === "checkbox" ? checked : value });
  };
  const submit = (e) => {
    e.preventDefault();
    if (!f.company.trim() || !f.role.trim()) return;
    onAdd({ id: Date.now().toString(), ...f });
    onClose();
  };
  return (
    <ModalShell title="Add experience" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalInput label="Company" name="company" value={f.company} onChange={change} placeholder="e.g. Google" required />
        <ModalInput label="Role" name="role" value={f.role} onChange={change} placeholder="e.g. Software Engineer" required />
        <ModalInput label="Industry" name="industry" value={f.industry} onChange={change} placeholder="e.g. Technology" />
        <div className="grid grid-cols-2 gap-3">
          <ModalInput label="Start date" name="startDate" type="date" value={f.startDate} onChange={change} />
          <ModalInput label="End date" name="endDate" type="date" value={f.endDate} onChange={change} disabled={f.current} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="current" checked={f.current} onChange={change} className="h-4 w-4 rounded border-slate-300" />
          Currently working here
        </label>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Description</label>
          <textarea name="description" value={f.description} onChange={change} rows={3} placeholder="Describe your role..." className={`${INPUT} resize-none`} />
        </div>
        <ModalButtons onClose={onClose} submitText="Add experience" />
      </form>
    </ModalShell>
  );
};

const AddTagsModal = ({ onClose, onAdd, existing, title, label, placeholder, submitText }) => {
  const [input, setInput] = useState("");
  const [items, setItems] = useState([]);
  const add = () => {
    const t = input.trim();
    if (t && !items.includes(t) && !existing.includes(t)) { setItems([...items, t]); setInput(""); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (!items.length) return;
    onAdd(items);
    onClose();
  };
  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={`${INPUT} min-w-0 flex-1`} />
            <button type="button" onClick={add} className={BTN_PRIMARY}>Add</button>
          </div>
        </div>
        <div className="flex min-h-[60px] flex-wrap content-start gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
          {items.length === 0 ? <p className="w-full py-2 text-center text-sm text-slate-400">Nothing added yet</p> : items.map((i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
              {i}
              <button type="button" onClick={() => setItems(items.filter((s) => s !== i))}><X size={12} /></button>
            </span>
          ))}
        </div>
        <ModalButtons onClose={onClose} submitText={submitText} />
      </form>
    </ModalShell>
  );
};

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
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{def.label}{def.required && <RequiredMark />}</label>
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
      className="fixed inset-0 z-[90] flex items-center justify-center overscroll-contain bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit profile</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:flex-row">
              <div className="relative">
                <AvatarImage src={preview || avatarUrl} name={user?.name} className="h-20 w-20 rounded-2xl" textClass="text-2xl" />
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60"><Loader2 size={22} className="animate-spin text-blue-600" /></div>}
                <label htmlFor="edit-image" className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                  <Camera size={13} />
                  <input id="edit-image" type="file" accept="image/*" onChange={pick} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-sm font-semibold text-slate-900">Profile photo <RequiredMark /></h3>
                <p className="mt-1 text-xs text-slate-500">JPG, PNG or WEBP. Max 5MB.</p>
                {hasRealAvatar && <button type="button" onClick={onAvatarRemove} className="mt-2 text-xs font-semibold text-red-600">Remove photo</button>}
              </div>
            </div>
            {[["basic", "Basic information", "sm:grid-cols-2"], ["contact", "Contact", "sm:grid-cols-2"], ["about", "About you", ""]].map(([g, title, cols]) => (
              <div key={g}>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h4>
                <div className={`grid gap-4 ${cols}`}>{group(g).map(renderField)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:justify-end">
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

/* ============================== TAB CONTENT ============================== */
const Timeline = ({ children }) => <div className="relative space-y-4 pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">{children}</div>;

const TimelineItem = ({ icon: Icon, title, subtitle, meta, onDelete, children }) => (
  <div className="group relative rounded-xl border border-slate-100 bg-white p-4 transition hover:bg-slate-50">
    <span className="absolute -left-[25px] top-5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white" />
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm font-medium text-slate-600">{subtitle}</p>}
        {meta}
        {children}
      </div>
      <button onClick={onDelete} aria-label="Delete" className="rounded-lg p-1.5 text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={16} /></button>
    </div>
  </div>
);

const Chip = ({ children, tone = "slate" }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{children}</span>
);

const TagCloud = ({ items, onDelete }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((i) => (
      <span key={i} className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
        {i}
        <button onClick={() => onDelete(i)} aria-label={`Remove ${i}`} className="text-blue-400 hover:text-red-500"><X size={14} /></button>
      </span>
    ))}
  </div>
);

/* ============================== MAIN ============================== */
const FresherProfile = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null); // education | career | skills | interests
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const toastTimer = useRef(null);

  // Lock the page behind any profile modal and restore its scroll position on close.
  useEffect(() => {
    const modalOpen = editOpen || Boolean(modal);
    if (!modalOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousOverflow = body.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [editOpen, modal]);

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
    if (!file.type.startsWith("image/")) return showToast("error", "Select an image.");
    if (file.size > 5 * 1024 * 1024) return showToast("error", "Max 5MB.");
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
    try {
      const updated = await apiUploadAvatar(file);
      if (updated) {
        setUser((p) => ({ ...p, ...updated }));
        setPreviewImage(null);
        notifyProfileChanged();
        showToast("success", "Photo updated.");
      }
    } catch (err) {
      showToast("error", err.message || "Upload failed.");
      setPreviewImage(null);
    } finally { setUploading(false); }
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

  const profile = useMemo(
    () => getProfileStatus(user, { hasPhoto: Boolean(getRawAvatarUrl(user)) || Boolean(previewImage) }),
    [user, previewImage],
  );

  if (status === "unauthenticated") return <StateShell icon={<ShieldAlert size={22} />} title="Sign in required" message="Your session expired." action={<Link to="/login" className={BTN_PRIMARY}>Login</Link>} />;
  if (status === "error") return <StateShell icon={<AlertTriangle size={22} />} title="Couldn't load profile" message="Please check your connection." action={<button onClick={loadUser} className={BTN_PRIMARY}>Retry</button>} />;
  if (status === "loading" || !user) return <Skeleton />;

  const name = (user.name || "").trim() || "Fresher";
  const avatarUrl = previewImage || getRawAvatarUrl(user);
  const latestEdu = user.education[user.education.length - 1];
  const headline = latestEdu ? `${latestEdu.degree}${latestEdu.field ? ` in ${latestEdu.field}` : ""} · ${latestEdu.institution}` : "Fresher · add your education";
  const missing = Array.isArray(profile?.missing) ? profile.missing : [];

  return (
    <div className="min-h-screen bg-[#f4f7f9] pb-20">
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        {/* HERO */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 sm:h-36" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 md:flex-row md:items-end">
              <div className="relative mx-auto shrink-0 md:mx-0">
                <div className="rounded-3xl border-4 border-white bg-white shadow-lg">
                  <AvatarImage src={avatarUrl} name={name} className="h-28 w-28 rounded-2xl sm:h-32 sm:w-32" textClass="text-5xl" />
                </div>
                <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md hover:bg-blue-700">
                  <Camera size={15} />
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/50 backdrop-blur-sm"><Loader2 size={24} className="animate-spin text-blue-600" /></div>}
              </div>

              <div className="min-w-0 flex-1 text-center md:mb-1 md:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{name}</h1>
                  {profile.ok && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 size={12} /> Booking ready
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-600">{headline}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 md:justify-start">
                  {user.location && <span className="flex items-center gap-1.5"><MapPin size={13} className="text-blue-500" />{user.location}</span>}
                  {user.email && <span className="flex items-center gap-1.5"><Mail size={13} className="text-blue-500" />{user.email}</span>}
                </div>
              </div>

              <div className="flex justify-center gap-2 md:mb-1">
                <button onClick={() => setEditOpen(true)} className={BTN_PRIMARY}><Pencil size={15} /> Edit profile</button>
                <Link to="/Home/settings" className={BTN_OUTLINE} aria-label="Settings"><SettingsIcon size={15} /> Settings</Link>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={GraduationCap} label="Education" value={user.education.length} />
          <StatTile icon={BriefcaseBusiness} label="Experience" value={user.career.length} />
          <StatTile icon={Code} label="Skills" value={user.skills.length} />
          <StatTile icon={Heart} label="Interests" value={user.interests.length} />
        </div>

        {/* TABS */}
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {tab === "overview" && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <div className={CARD}>
                    <SectionTitle icon={User} action={<button onClick={() => setEditOpen(true)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" aria-label="Edit about"><Pencil size={15} /></button>}>About me</SectionTitle>
                    {user.bio ? <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{user.bio}</p>
                      : <p className="text-sm italic text-slate-400">Add a short introduction so mentors know your goals.</p>}
                  </div>
                  <div className={CARD}>
                    <SectionTitle icon={Phone}>Contact & details</SectionTitle>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoRow icon={Mail} label="Email" value={user.email} />
                      <InfoRow icon={Phone} label="Phone" value={user.phone} />
                      <InfoRow icon={MapPin} label="Location" value={user.location} />
                      <InfoRow icon={Globe} label="Nationality" value={user.nationality} />
                      <InfoRow icon={User} label="Gender" value={user.gender} />
                      <InfoRow icon={Calendar} label="Date of birth" value={user.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : ""} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={CARD}>
                    <SectionTitle icon={Sparkles}>Profile strength</SectionTitle>
                    <div className="flex items-center gap-4">
                      <ProgressRing percent={profile.percent} />
                      <p className="text-xs leading-relaxed text-slate-500">
                        {profile.ok ? "Your profile is ready to book sessions." : `Reach ${REQUIRED_PERCENT}% and add a photo to book sessions.`}
                      </p>
                    </div>
                    {missing.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {missing.map((m) => (
                          <li key={m.key} className="flex items-center gap-2 text-xs text-slate-600"><Circle size={10} className="text-amber-500" />{m.label}</li>
                        ))}
                      </ul>
                    )}
                    {missing.length > 0 && <button onClick={() => setEditOpen(true)} className={`${BTN_PRIMARY} mt-4 w-full`}>Complete profile</button>}
                  </div>
                  <div className={CARD}>
                    <SectionTitle icon={Code}>Top skills</SectionTitle>
                    {user.skills.length ? (
                      <div className="flex flex-wrap gap-2">{user.skills.slice(0, 8).map((s) => <Chip key={s}>{s}</Chip>)}</div>
                    ) : <p className="text-sm italic text-slate-400">No skills yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === "education" && (
              <div className={CARD}>
                <SectionTitle icon={GraduationCap} action={<button onClick={() => setModal("education")} className={BTN_PRIMARY}><Plus size={16} /> Add</button>}>Education</SectionTitle>
                {user.education.length ? (
                  <Timeline>
                    {user.education.map((e, i) => (
                      <TimelineItem key={e.id || i} icon={GraduationCap} title={e.institution} subtitle={`${e.degree}${e.field ? ` · ${e.field}` : ""}`}
                        onDelete={() => persist({ education: user.education.filter((x) => x.id !== e.id) }, "Education removed.")}
                        meta={<div className="mt-2 flex flex-wrap gap-2">{e.graduationYear && <Chip>{e.graduationYear}</Chip>}{e.cgpa && <Chip tone="green">{e.cgpa}</Chip>}</div>}>
                        {e.description && <p className="mt-2 text-xs text-slate-500">{e.description}</p>}
                      </TimelineItem>
                    ))}
                  </Timeline>
                ) : <EmptyTab icon={GraduationCap} text="No education added yet." cta="Add education" onCta={() => setModal("education")} />}
              </div>
            )}

            {tab === "career" && (
              <div className={CARD}>
                <SectionTitle icon={BriefcaseBusiness} action={<button onClick={() => setModal("career")} className={BTN_PRIMARY}><Plus size={16} /> Add</button>}>Experience</SectionTitle>
                {user.career.length ? (
                  <Timeline>
                    {user.career.map((c, i) => (
                      <TimelineItem key={c.id || i} icon={Building2} title={c.role} subtitle={`${c.company}${c.industry ? ` · ${c.industry}` : ""}`}
                        onDelete={() => persist({ career: user.career.filter((x) => x.id !== c.id) }, "Experience removed.")}
                        meta={<div className="mt-2 flex flex-wrap gap-2">{c.startDate && <Chip>{c.startDate}</Chip>}{c.current ? <Chip tone="green">Present</Chip> : c.endDate && <Chip>{c.endDate}</Chip>}</div>}>
                        {c.description && <p className="mt-2 text-xs text-slate-500">{c.description}</p>}
                      </TimelineItem>
                    ))}
                  </Timeline>
                ) : <EmptyTab icon={BriefcaseBusiness} text="No experience added yet." cta="Add experience" onCta={() => setModal("career")} />}
              </div>
            )}

            {tab === "skills" && (
              <div className={CARD}>
                <SectionTitle icon={Code} action={<button onClick={() => setModal("skills")} className={BTN_PRIMARY}><Plus size={16} /> Add</button>}>Skills</SectionTitle>
                {user.skills.length ? <TagCloud items={user.skills} onDelete={(s) => persist({ skills: user.skills.filter((x) => x !== s) }, "Skill removed.")} />
                  : <EmptyTab icon={Code} text="No skills added yet." cta="Add skills" onCta={() => setModal("skills")} />}
              </div>
            )}

            {tab === "interests" && (
              <div className={CARD}>
                <SectionTitle icon={Heart} action={<button onClick={() => setModal("interests")} className={BTN_PRIMARY}><Plus size={16} /> Add</button>}>Interests</SectionTitle>
                {user.interests.length ? <TagCloud items={user.interests} onDelete={(s) => persist({ interests: user.interests.filter((x) => x !== s) }, "Interest removed.")} />
                  : <EmptyTab icon={Heart} text="No interests added yet." cta="Add interests" onCta={() => setModal("interests")} />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {modal === "education" && <AddEducationModal onClose={() => setModal(null)} onAdd={(e) => persist({ education: [...user.education, e] }, "Education added.")} />}
        {modal === "career" && <AddCareerModal onClose={() => setModal(null)} onAdd={(c) => persist({ career: [...user.career, c] }, "Experience added.")} />}
        {modal === "skills" && <AddTagsModal onClose={() => setModal(null)} existing={user.skills} title="Add skills" label="Skill" placeholder="e.g. React" submitText="Save skills" onAdd={(s) => persist({ skills: [...user.skills, ...s] }, "Skills added.")} />}
        {modal === "interests" && <AddTagsModal onClose={() => setModal(null)} existing={user.interests} title="Add interests" label="Interest" placeholder="e.g. AI/ML" submitText="Save interests" onAdd={(s) => persist({ interests: [...user.interests, ...s] }, "Interests added.")} />}
        {editOpen && (
          <EditProfileModal user={user} saving={saving} onClose={() => setEditOpen(false)} onSave={handleSave}
            onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove} avatarUrl={avatarUrl} hasRealAvatar={Boolean(getRawAvatarUrl(user))} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-6 right-6 z-[110]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
                {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} strokeWidth={3} />}
              </span>
              <p className="text-sm font-medium text-slate-800">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StateShell = ({ icon, title, message, action }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
    <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">{icon}</div>
      <h1 className="mt-5 text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  </div>
);

const Skeleton = () => (
  <div className="min-h-screen bg-[#f4f7f9] p-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-64 animate-pulse rounded-3xl bg-white" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>
      <div className="h-14 animate-pulse rounded-2xl bg-white" />
      <div className="h-64 animate-pulse rounded-2xl bg-white" />
    </div>
  </div>
);

export default FresherProfile;