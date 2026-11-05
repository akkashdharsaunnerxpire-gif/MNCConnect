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
  Briefcase,
  Code,
  Heart,
  UserCircle,
  BriefcaseBusiness,
  Trash2,
  LogOut as LogOutIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { performLogout } from "../../utils/logout";
import {
  PROFILE_IMAGE_KEYS,
  REQUIRED_PERCENT,
  getRawAvatarUrl,
  getProfileStatus,
} from "../../utils/profileCompletion";

/* =========================================================================
   API LAYER (cookie based, nothing in localStorage / sessionStorage)
========================================================================= */

const API_BASE_URL =
  import.meta?.env?.VITE_API_URL || "http://localhost:5000/api";

const ENDPOINTS = {
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE: `${API_BASE_URL}/auth/update`,
  AVATAR: `${API_BASE_URL}/auth/avatar`,
};

const jsonHeaders = { "Content-Type": "application/json" };

async function apiGetCurrentUser() {
  const response = await fetch(ENDPOINTS.ME, {
    credentials: "include",
    headers: jsonHeaders,
  });
  if (response.status === 401) throw new Error("UNAUTHENTICATED");
  if (!response.ok)
    throw new Error(`Failed to load profile: ${response.status}`);
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
  // no Content-Type: the browser sets the multipart boundary itself
  const response = await fetch(ENDPOINTS.AVATAR, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    console.error("Upload error:", await response.text());
    throw new Error(`Failed to upload photo: ${response.status}`);
  }
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

// tells the Header (and anything else listening) to reload /auth/me
const notifyProfileChanged = () =>
  window.dispatchEvent(new Event("profile:updated"));

/* =========================================================================
   FIELD REGISTRY
========================================================================= */

const FIELD_DEFS = {
  name: {
    label: "Full name",
    group: "basic",
    editable: true,
    icon: User,
    required: true,
    placeholder: "Enter your full name",
  },
  gender: {
    label: "Gender",
    group: "basic",
    editable: true,
    type: "select",
    options: ["Male", "Female", "Other", "Prefer not to say"],
    icon: User,
  },
  dateOfBirth: {
    label: "Date of birth",
    group: "basic",
    editable: true,
    type: "date",
    icon: Calendar,
  },
  location: {
    label: "Location",
    group: "basic",
    editable: true,
    icon: MapPin,
    placeholder: "City, Country",
  },
  nationality: {
    label: "Nationality",
    group: "basic",
    editable: true,
    icon: Globe,
    placeholder: "Your nationality",
  },
  email: {
    label: "Email",
    group: "contact",
    editable: false,
    icon: Mail,
    required: true,
  },
  phone: {
    label: "Phone",
    group: "contact",
    editable: true,
    icon: Phone,
    required: true,
    placeholder: "+91 1234567890",
  },
  mobile: {
    label: "Mobile",
    group: "contact",
    editable: true,
    icon: Phone,
    placeholder: "+91 1234567890",
  },
  bio: {
    label: "About me",
    group: "about",
    editable: true,
    type: "textarea",
    icon: User,
    placeholder: "Tell us about yourself...",
  },
};

const HIDDEN_KEYS = new Set([
  "_id",
  "id",
  "password",
  "token",
  "__v",
  "createdAt",
  "updatedAt",
  "isVerified",
  "accountType",
  "role",
  "countryCode",
  "website",
  ...PROFILE_IMAGE_KEYS,
]);

const hasValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
};

/* =========================================================================
   SHARED STYLES (black + white system)
========================================================================= */

const INPUT =
  "w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500";

const CARD = "rounded-2xl border border-neutral-200 bg-white p-6";
const BTN_DARK =
  "flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
const HEADING = "font-serif text-lg font-semibold text-black";

const NAV_ITEMS = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
  { id: "skills", label: "Skills", icon: Code },
  { id: "interests", label: "Interests", icon: Heart },
];

/* =========================================================================
   AVATAR: uploaded photo, or the FIRST LETTER of the name (no placeholder image)
========================================================================= */

const AvatarCircle = ({
  src,
  name,
  className = "",
  fallbackClass = "bg-black text-white",
  textClass = "text-base",
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = (name || "").trim().charAt(0).toUpperCase() || "F";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || "Profile"}
        onError={() => setFailed(true)}
        className={`${className} bg-neutral-200 object-cover`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || "Profile"}
      className={`${className} flex items-center justify-center font-semibold ${fallbackClass} ${textClass}`}
    >
      {initial}
    </div>
  );
};

/* =========================================================================
   SIDEBAR (desktop) - never scrolls with the page
========================================================================= */

const Sidebar = ({
  user,
  avatarUrl,
  displayName,
  activeTab,
  setActiveTab,
  onLogout,
}) => (
  <aside className="hidden h-full w-72 shrink-0 flex-col bg-black lg:flex">
    <div className="flex shrink-0 items-center gap-2.5 px-6 pb-2 pt-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-black">
        F
      </div>
      <span className="font-serif text-base font-semibold tracking-wide text-white">
        FresherSpace
      </span>
    </div>

    <div className="mx-4 mt-8 shrink-0 rounded-xl border border-white/15 p-4">
      <div className="flex items-center gap-3">
        <AvatarCircle
          src={avatarUrl}
          name={displayName}
          className="h-11 w-11 rounded-full ring-2 ring-white/70"
          fallbackClass="bg-white text-black"
          textClass="text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {displayName}
          </p>
          <p className="truncate text-xs text-neutral-400">{user?.email}</p>
        </div>
      </div>
    </div>

    <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 py-2">
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <li key={id}>
              <button
                onClick={() => setActiveTab(id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>

    <div className="shrink-0 border-t border-white/15 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <button
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white"
      >
        <LogOutIcon size={18} />
        Logout
      </button>
    </div>
  </aside>
);

/* =========================================================================
   TOP BAR - always visible (sits outside the scrolling area)
========================================================================= */

const TopBar = ({
  activeTab,
  setActiveTab,
  displayName,
  avatarUrl,
  profileCompletion,
  onEdit,
}) => {
  const current = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <header className="z-30 shrink-0 border-b border-neutral-200 bg-white">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-xs text-neutral-500">
            Fresher / {current?.label}
          </p>
          <h1 className="truncate font-serif text-lg font-semibold text-black">
            {current?.label}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-black transition-all"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <span className="text-xs font-medium text-neutral-600">
              {profileCompletion}%
            </span>
          </div>

          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-100"
          >
            <Pencil size={13} />
            Edit profile
          </button>

          <AvatarCircle
            src={avatarUrl}
            name={displayName}
            className="h-9 w-9 rounded-full ring-1 ring-neutral-300"
            textClass="text-sm"
          />
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-black text-white"
                  : "border border-neutral-300 bg-white text-neutral-700"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
    </header>
  );
};

/* =========================================================================
   MODAL SHELL + SMALL FORM PIECES
========================================================================= */

const RequiredMark = () => <span className="ml-1 text-red-600">*</span>;

const ModalShell = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
    <div
      role="dialog"
      aria-modal="true"
      className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-black">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-black"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ModalInput = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-neutral-700">
      {label}
      {required && <RequiredMark />}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={INPUT}
    />
  </div>
);

const ModalTextarea = ({ name, value, onChange, placeholder }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-neutral-700">
      Description
    </label>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      rows="3"
      placeholder={placeholder}
      className={`${INPUT} resize-none`}
    />
  </div>
);

const ModalButtons = ({ onClose, submitText }) => (
  <div className="flex gap-3 pt-4">
    <button
      type="button"
      onClick={onClose}
      className="flex-1 rounded-lg border border-neutral-300 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="flex-1 rounded-lg bg-black py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
    >
      {submitText}
    </button>
  </div>
);

/* =========================================================================
   ADD EDUCATION / CAREER / TAGS MODALS
========================================================================= */

const EMPTY_EDUCATION = {
  institution: "",
  degree: "",
  field: "",
  graduationYear: "",
  cgpa: "",
  description: "",
};

const AddEducationModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState(EMPTY_EDUCATION);
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.institution || !formData.degree) {
      alert("Please fill in Institution and Degree");
      return;
    }
    onAdd({ id: Date.now().toString(), ...formData });
    setFormData(EMPTY_EDUCATION);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell title="Add education" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInput
          label="Institution / University"
          name="institution"
          value={formData.institution}
          onChange={handleChange}
          placeholder="e.g. MIT, Stanford, IIT"
          required
        />
        <ModalInput
          label="Degree"
          name="degree"
          value={formData.degree}
          onChange={handleChange}
          placeholder="e.g. B.Tech, M.Sc, MBA"
          required
        />
        <ModalInput
          label="Field / Specialization"
          name="field"
          value={formData.field}
          onChange={handleChange}
          placeholder="e.g. Computer Science, Finance"
        />
        <div className="grid grid-cols-2 gap-4">
          <ModalInput
            label="Graduation year"
            name="graduationYear"
            type="number"
            value={formData.graduationYear}
            onChange={handleChange}
            placeholder="2024"
          />
          <ModalInput
            label="CGPA / Percentage"
            name="cgpa"
            value={formData.cgpa}
            onChange={handleChange}
            placeholder="8.5 / 85%"
          />
        </div>
        <ModalTextarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Additional details about your education..."
        />
        <ModalButtons onClose={onClose} submitText="Add education" />
      </form>
    </ModalShell>
  );
};

const EMPTY_CAREER = {
  company: "",
  role: "",
  industry: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
};

const AddCareerModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState(EMPTY_CAREER);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.company || !formData.role) {
      alert("Please fill in Company and Role");
      return;
    }
    onAdd({ id: Date.now().toString(), ...formData });
    setFormData(EMPTY_CAREER);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell title="Add career experience" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInput
          label="Company"
          name="company"
          value={formData.company}
          onChange={handleChange}
          placeholder="e.g. Google, Microsoft"
          required
        />
        <ModalInput
          label="Role / Position"
          name="role"
          value={formData.role}
          onChange={handleChange}
          placeholder="e.g. Software Engineer"
          required
        />
        <ModalInput
          label="Industry"
          name="industry"
          value={formData.industry}
          onChange={handleChange}
          placeholder="e.g. Technology, Finance"
        />
        <div className="grid grid-cols-2 gap-4">
          <ModalInput
            label="Start date"
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleChange}
          />
          <ModalInput
            label="End date"
            name="endDate"
            type="date"
            value={formData.endDate}
            onChange={handleChange}
            disabled={formData.current}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="career-current"
            name="current"
            checked={formData.current}
            onChange={handleChange}
            className="h-4 w-4 rounded border-neutral-300 accent-black"
          />
          <label htmlFor="career-current" className="text-sm text-neutral-700">
            Currently working here
          </label>
        </div>
        <ModalTextarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe your role and responsibilities..."
        />
        <ModalButtons onClose={onClose} submitText="Add experience" />
      </form>
    </ModalShell>
  );
};

const AddTagsModal = ({
  isOpen,
  onClose,
  onAdd,
  existing,
  title,
  label,
  placeholder,
  emptyText,
  emptyAlert,
  submitText,
}) => {
  const [input, setInput] = useState("");
  const [items, setItems] = useState([]);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed) && !existing.includes(trimmed)) {
      setItems([...items, trimmed]);
      setInput("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) {
      alert(emptyAlert);
      return;
    }
    onAdd(items);
    setItems([]);
    setInput("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            {label}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={placeholder}
              className={`${INPUT} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex min-h-[60px] flex-wrap gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
          {items.length === 0 ? (
            <p className="w-full py-3 text-center text-sm text-neutral-400">
              {emptyText}
            </p>
          ) : (
            items.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => setItems(items.filter((s) => s !== item))}
                  className="text-neutral-300 hover:text-white"
                >
                  <X size={14} />
                </button>
              </span>
            ))
          )}
        </div>

        <ModalButtons onClose={onClose} submitText={submitText} />
      </form>
    </ModalShell>
  );
};

const AddSkillModal = ({ existingSkills, ...props }) => (
  <AddTagsModal
    {...props}
    existing={existingSkills}
    title="Add skills"
    label="Skill"
    placeholder="e.g. React, JavaScript, Python"
    emptyText="No skills added yet"
    emptyAlert="Please add at least one skill"
    submitText="Save skills"
  />
);

const AddInterestModal = ({ existingInterests, ...props }) => (
  <AddTagsModal
    {...props}
    existing={existingInterests}
    title="Add career interests"
    label="Interest"
    placeholder="e.g. AI/ML, Full Stack, Data Science"
    emptyText="No interests added yet"
    emptyAlert="Please add at least one interest"
    submitText="Save interests"
  />
);

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

  // jump back to the top of the content when switching tabs
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  /* LOGOUT: server clears cookie, socket closes, AuthContext refreshes */
  const handleLogout = async () => {
    await performLogout();
    try {
      await refresh();
    } catch {
      /* ignore */
    }
    navigate("/", { replace: true });
  };

  /* LOAD USER (always from the server) */
  const loadUser = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await apiGetCurrentUser();
      setUser({
        ...data,
        education: data.education || [],
        career: data.career || [],
        skills: data.skills || [],
        interests: data.interests || [],
      });
      setStatus("ready");
    } catch (err) {
      console.error("Error loading user:", err);
      setStatus(
        err.message === "UNAUTHENTICATED" ? "unauthenticated" : "error",
      );
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // optimistic update -> save to backend -> roll back if it fails
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
      showToast("error", err.message || "Could not save. Please try again.");
    }
  };

  /* AVATAR */
  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    try {
      const updated = await apiUploadAvatar(file);
      if (updated) {
        const url =
          updated.avatar ||
          updated.profilePic ||
          updated.profileImage ||
          updated.photo ||
          updated.photoUrl;
        setUser((prev) => ({ ...prev, ...updated }));
        if (url) setPreviewImage(null);
        notifyProfileChanged();
        showToast("success", "Profile photo updated.");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      showToast(
        "error",
        err.message || "Could not upload photo. Please try again.",
      );
      setPreviewImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    try {
      const updated = await apiRemoveAvatar();
      const mergedUser = { ...user, ...updated };
      PROFILE_IMAGE_KEYS.forEach((key) => delete mergedUser[key]);
      setUser(mergedUser);
      setPreviewImage(null);
      notifyProfileChanged();
      showToast("success", "Profile photo removed.");
    } catch (err) {
      showToast("error", err.message || "Could not remove photo.");
    }
  };

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("error", "Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("error", "Image size should be less than 5MB.");
      return;
    }
    handleAvatarUpload(file);
  };

  /* CRUD (saved on the server) */
  const handleAddEducation = (education) =>
    persist(
      { education: [...(user.education || []), education] },
      "Education added.",
    );
  const handleDeleteEducation = (id) =>
    persist(
      { education: (user.education || []).filter((e) => e.id !== id) },
      "Education removed.",
      "info",
    );

  const handleAddCareer = (career) =>
    persist({ career: [...(user.career || []), career] }, "Experience added.");
  const handleDeleteCareer = (id) =>
    persist(
      { career: (user.career || []).filter((c) => c.id !== id) },
      "Experience removed.",
      "info",
    );

  const handleAddSkills = (newSkills) =>
    persist(
      { skills: [...(user.skills || []), ...newSkills] },
      "Skills added.",
    );
  const handleDeleteSkill = (skill) =>
    persist(
      { skills: (user.skills || []).filter((s) => s !== skill) },
      "Skill removed.",
      "info",
    );

  const handleAddInterests = (newInterests) =>
    persist(
      { interests: [...(user.interests || []), ...newInterests] },
      "Interests added.",
    );
  const handleDeleteInterest = (interest) =>
    persist(
      { interests: (user.interests || []).filter((i) => i !== interest) },
      "Interest removed.",
      "info",
    );

  /* SAVE PROFILE */
  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const updated = await apiUpdateCurrentUser(payload);
      setUser({ ...user, ...payload, ...updated });
      setEditOpen(false);
      notifyProfileChanged();
      showToast("success", "Changes saved.");
    } catch (err) {
      showToast("error", err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  /* DERIVED DATA */
  const presentFields = useMemo(() => {
    if (!user) return [];
    return Object.entries(user)
      .filter(
        ([key, value]) =>
          !HIDDEN_KEYS.has(key) && hasValue(value) && FIELD_DEFS[key],
      )
      .map(([key, value]) => ({ key, value, def: FIELD_DEFS[key] }));
  }, [user]);

  const fieldByKey = (key) => presentFields.find((field) => field.key === key);

  // SAME rule as Header + SessionBoard (utils/profileCompletion.js)
  const profile = useMemo(
    () =>
      getProfileStatus(user, {
        hasPhoto: Boolean(getRawAvatarUrl(user)) || Boolean(previewImage),
      }),
    [user, previewImage],
  );
  const profileCompletion = profile.percent;

  const displayName = (user?.name || "").trim() || "Fresher";
  const avatarUrl = previewImage || getRawAvatarUrl(user); // null => first letter is shown

  /* STATES */
  if (status === "unauthenticated") {
    return (
      <EmptyStateShell
        icon={<ShieldAlert size={22} />}
        title="Please sign in"
        message="Your session has expired. Log in to view your profile."
        action={
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Go to login
          </Link>
        }
      />
    );
  }

  if (status === "error") {
    return (
      <EmptyStateShell
        icon={<AlertTriangle size={22} />}
        title="We couldn't load your profile"
        message="Check that your backend server is running, then try again."
        action={
          <button
            onClick={loadUser}
            className="mt-6 rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (status === "loading" || !user) return <ProfileSkeleton />;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-neutral-100">
      <Sidebar
        user={user}
        avatarUrl={avatarUrl}
        displayName={displayName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          displayName={displayName}
          avatarUrl={avatarUrl}
          profileCompletion={profileCompletion}
          onEdit={() => setEditOpen(true)}
        />

        {/* Only this area scrolls */}
        <main
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8"
        >
          <div className="mx-auto max-w-4xl">
            {/* Profile card */}
            <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="relative h-24 bg-black">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_100%]" />
              </div>

              <div className="flex items-end gap-5 px-6 pb-6">
                <div className="group relative -mt-12 shrink-0">
                  <AvatarCircle
                    src={avatarUrl}
                    name={displayName}
                    className="h-24 w-24 rounded-full border-4 border-white"
                    textClass="text-4xl"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <Camera size={22} />
                    <span className="mt-1 text-xs">Upload</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70">
                      <Loader2 size={28} className="animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 pt-4">
                  <h2 className="truncate font-serif text-2xl font-semibold text-black">
                    {displayName}
                  </h2>
                  <p className="truncate text-sm text-neutral-500">
                    {user?.email}
                  </p>
                  <span className="mt-2 inline-block rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700">
                    {profileCompletion}% complete
                  </span>
                </div>
              </div>
            </div>

            {/* Not complete yet -> tell the user exactly what is missing */}
            {!profile.ok && (
              <div className="mb-6">
                <CompletionBanner
                  profile={profile}
                  onEdit={() => setEditOpen(true)}
                />
              </div>
            )}

            <div className="space-y-6">
              {activeTab === "profile" && (
                <ProfileContent
                  user={user}
                  fieldByKey={fieldByKey}
                  onEdit={() => setEditOpen(true)}
                />
              )}
              {activeTab === "education" && (
                <EducationContent
                  education={user.education || []}
                  onAdd={() => setShowEducationModal(true)}
                  onDelete={handleDeleteEducation}
                />
              )}
              {activeTab === "career" && (
                <CareerContent
                  career={user.career || []}
                  onAdd={() => setShowCareerModal(true)}
                  onDelete={handleDeleteCareer}
                />
              )}
              {activeTab === "skills" && (
                <SkillsContent
                  skills={user.skills || []}
                  onAdd={() => setShowSkillModal(true)}
                  onDelete={handleDeleteSkill}
                />
              )}
              {activeTab === "interests" && (
                <InterestsContent
                  interests={user.interests || []}
                  onAdd={() => setShowInterestModal(true)}
                  onDelete={handleDeleteInterest}
                />
              )}
            </div>

            {/* Mobile logout */}
            <button
              onClick={handleLogout}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-100 lg:hidden"
            >
              <LogOutIcon size={18} />
              Logout
            </button>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AddEducationModal
        isOpen={showEducationModal}
        onClose={() => setShowEducationModal(false)}
        onAdd={handleAddEducation}
      />
      <AddCareerModal
        isOpen={showCareerModal}
        onClose={() => setShowCareerModal(false)}
        onAdd={handleAddCareer}
      />
      <AddSkillModal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        onAdd={handleAddSkills}
        existingSkills={user.skills || []}
      />
      <AddInterestModal
        isOpen={showInterestModal}
        onClose={() => setShowInterestModal(false)}
        onAdd={handleAddInterests}
        existingInterests={user.interests || []}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[110] max-w-[calc(100vw-3rem)]"
          >
            <div className="flex items-center gap-3 rounded-xl bg-black px-5 py-4 text-white shadow-2xl">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  toast.type === "error" ? "bg-red-500" : "bg-white text-black"
                }`}
              >
                {toast.type === "error" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Check size={14} />
                )}
              </div>
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile */}
      <AnimatePresence>
        {editOpen && (
          <EditProfileModal
            user={user}
            saving={saving}
            onClose={() => setEditOpen(false)}
            onSave={handleSave}
            onAvatarUpload={handleAvatarUpload}
            onAvatarRemove={handleAvatarRemove}
            avatarUrl={avatarUrl}
            hasRealAvatar={Boolean(getRawAvatarUrl(user))}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* =========================================================================
   COMPLETION BANNER
========================================================================= */

const CompletionBanner = ({ profile, onEdit }) => (
  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
    <div className="flex items-start gap-3">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-amber-900">
          Fill your profile details to book meetings
        </h3>
        <p className="mt-1 text-sm text-amber-800">
          You need a profile photo and at least {REQUIRED_PERCENT}% of your
          details filled. You are at {profile.percent}% now.
        </p>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200">
          <div
            className="h-full rounded-full bg-amber-600 transition-all"
            style={{ width: `${profile.percent}%` }}
          />
        </div>

        {profile.missing.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.missing.map((m) => (
              <span
                key={m.key}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900"
              >
                {m.label}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-amber-800">
          Photo: tap your picture and upload. Education, Skills and Interests:
          use the tabs on the left. Career experience is optional.
        </p>

        <button onClick={onEdit} className={`${BTN_DARK} mt-4`}>
          <Pencil size={14} />
          Fill details now
        </button>
      </div>
    </div>
  </div>
);

/* =========================================================================
   TAB CONTENT
========================================================================= */

const ProfileContent = ({ user, fieldByKey, onEdit }) => (
  <>
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={HEADING}>About</h2>
        <button
          onClick={onEdit}
          className="text-sm font-medium text-black underline-offset-4 hover:underline"
        >
          Edit
        </button>
      </div>
      {user?.bio ? (
        <p className="leading-7 text-neutral-700">{user.bio}</p>
      ) : (
        <p className="text-neutral-400">
          Add a short introduction so mentors know your goals.
        </p>
      )}
    </div>

    <div className={CARD}>
      <h2 className={`mb-4 ${HEADING}`}>Contact information</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem
          icon={Phone}
          label="Phone"
          value={user?.phone || user?.mobile}
        />
        <InfoItem icon={Mail} label="Email" value={user?.email} />
        {fieldByKey("linkedin") && (
          <InfoItem icon={Globe} label="LinkedIn" value={user?.linkedin} />
        )}
        {fieldByKey("github") && (
          <InfoItem icon={Globe} label="GitHub" value={user?.github} />
        )}
        {fieldByKey("location") && (
          <InfoItem icon={MapPin} label="Location" value={user?.location} />
        )}
        {fieldByKey("nationality") && (
          <InfoItem
            icon={Globe}
            label="Nationality"
            value={user?.nationality}
          />
        )}
      </div>
    </div>
  </>
);

const SectionCard = ({ title, addLabel, onAdd, children }) => (
  <div className={CARD}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={HEADING}>{title}</h2>
      <button onClick={onAdd} className={BTN_DARK}>
        <Plus size={16} />
        {addLabel}
      </button>
    </div>
    {children}
  </div>
);

const EntryCard = ({ children, onDelete, label }) => (
  <div className="rounded-xl border border-neutral-200 p-4 transition hover:border-black">
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        onClick={onDelete}
        aria-label={label}
        className="p-2 text-neutral-400 transition-colors hover:text-red-600"
      >
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

const EducationContent = ({ education, onAdd, onDelete }) => (
  <SectionCard title="Education" addLabel="Add education" onAdd={onAdd}>
    {education.length > 0 ? (
      <div className="space-y-4">
        {education.map((edu, index) => (
          <EntryCard
            key={edu.id || index}
            onDelete={() => onDelete(edu.id)}
            label="Delete education"
          >
            <h3 className="font-semibold text-black">{edu.institution}</h3>
            <p className="text-sm text-neutral-700">{edu.degree}</p>
            {edu.field && (
              <p className="text-sm text-neutral-500">{edu.field}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
              {edu.graduationYear && <span>{edu.graduationYear}</span>}
              {edu.cgpa && <span>{edu.cgpa}</span>}
            </div>
            {edu.description && (
              <p className="mt-2 text-sm text-neutral-600">{edu.description}</p>
            )}
          </EntryCard>
        ))}
      </div>
    ) : (
      <EmptyTab
        icon={<GraduationCap size={44} />}
        text="No education added yet"
        subtext='Select "Add education" to start.'
      />
    )}
  </SectionCard>
);

const CareerContent = ({ career, onAdd, onDelete }) => (
  <SectionCard
    title="Career experience"
    addLabel="Add experience"
    onAdd={onAdd}
  >
    {career.length > 0 ? (
      <div className="space-y-4">
        {career.map((exp, index) => (
          <EntryCard
            key={exp.id || index}
            onDelete={() => onDelete(exp.id)}
            label="Delete experience"
          >
            <h3 className="font-semibold text-black">{exp.company}</h3>
            <p className="text-sm text-neutral-700">{exp.role}</p>
            {exp.industry && (
              <p className="text-sm text-neutral-500">{exp.industry}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
              {exp.startDate && <span>From: {exp.startDate}</span>}
              {exp.current ? (
                <span className="font-semibold text-black">● Present</span>
              ) : (
                exp.endDate && <span>To: {exp.endDate}</span>
              )}
            </div>
            {exp.description && (
              <p className="mt-2 text-sm text-neutral-600">{exp.description}</p>
            )}
          </EntryCard>
        ))}
      </div>
    ) : (
      <EmptyTab
        icon={<Briefcase size={44} />}
        text="No career experience added yet"
        subtext='Select "Add experience" to start.'
      />
    )}
  </SectionCard>
);

const TagList = ({ items, onDelete }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <span
        key={item}
        className="group flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black transition hover:border-black"
      >
        {item}
        <button
          onClick={() => onDelete(item)}
          aria-label={`Remove ${item}`}
          className="opacity-100 transition-opacity hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
        >
          <X size={14} />
        </button>
      </span>
    ))}
  </div>
);

const SkillsContent = ({ skills, onAdd, onDelete }) => (
  <SectionCard title="Skills" addLabel="Add skills" onAdd={onAdd}>
    {skills.length > 0 ? (
      <TagList items={skills} onDelete={onDelete} />
    ) : (
      <EmptyTab
        icon={<Code size={44} />}
        text="No skills added yet"
        subtext='Select "Add skills" to start.'
      />
    )}
  </SectionCard>
);

const InterestsContent = ({ interests, onAdd, onDelete }) => (
  <SectionCard title="Career interests" addLabel="Add interests" onAdd={onAdd}>
    {interests.length > 0 ? (
      <TagList items={interests} onDelete={onDelete} />
    ) : (
      <EmptyTab
        icon={<Heart size={44} />}
        text="No interests added yet"
        subtext='Select "Add interests" to start.'
      />
    )}
  </SectionCard>
);

/* =========================================================================
   EDIT PROFILE MODAL
========================================================================= */

const EditProfileModal = ({
  user,
  saving,
  onClose,
  onSave,
  onAvatarUpload,
  onAvatarRemove,
  avatarUrl,
  hasRealAvatar,
}) => {
  const [form, setForm] = useState({ ...user });
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ALL editable fields are listed (even if the user has never saved them before),
  // so gender / location / nationality / about can be filled for the first time
  const editableFields = useMemo(
    () =>
      Object.keys(FIELD_DEFS)
        .filter((key) => FIELD_DEFS[key].editable !== false)
        .map((key) => ({ key, def: FIELD_DEFS[key] })),
    [],
  );

  const groupedEditable = (group) =>
    editableFields.filter((f) => f.def.group === group);
  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    try {
      await onAvatarUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // send only the fields this form edits (not the whole user object)
    const payload = {};
    editableFields.forEach(({ key }) => {
      const v = form[key];
      payload[key] = typeof v === "string" ? v.trim() : (v ?? "");
    });
    onSave(payload);
  };

  const missingFields = useMemo(
    () =>
      Object.keys(FIELD_DEFS).filter(
        (k) => FIELD_DEFS[k].required && !hasValue(form[k]),
      ),
    [form],
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90dvh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-black">
              Edit profile
            </h2>
            {missingFields.length > 0 && (
              <p className="mt-0.5 text-xs text-neutral-500">
                {missingFields.length} required field
                {missingFields.length > 1 ? "s" : ""} missing
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(90dvh-80px)] overflow-y-auto px-6 py-6"
        >
          {/* Photo */}
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <AvatarCircle
                src={previewImage || avatarUrl}
                name={user?.name}
                className="h-20 w-20 rounded-full border-2 border-white shadow-sm"
                textClass="text-3xl"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}
              <label
                htmlFor="edit-profile-image"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black text-white shadow transition hover:bg-neutral-800"
              >
                <Camera size={14} />
                <input
                  id="edit-profile-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-black">
                Profile photo
                <RequiredMark />
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                {hasRealAvatar
                  ? "Upload a new photo to replace this one."
                  : "Your first letter is shown until you upload a photo. A photo is needed to book meetings."}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                JPG, PNG or GIF, up to 5MB
              </p>
              {hasRealAvatar && (
                <button
                  type="button"
                  onClick={onAvatarRemove}
                  className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {groupedEditable("basic").length > 0 && (
            <FormBlock title="Basic information">
              {groupedEditable("basic").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(v) => updateField(key, v)}
                  isRequired={def.required}
                />
              ))}
            </FormBlock>
          )}

          {groupedEditable("contact").length > 0 && (
            <FormBlock title="Contact information">
              {groupedEditable("contact").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(v) => updateField(key, v)}
                  isRequired={def.required}
                />
              ))}
            </FormBlock>
          )}

          {groupedEditable("about").length > 0 && (
            <FormBlock title="About you" full>
              {groupedEditable("about").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(v) => updateField(key, v)}
                  fullWidth
                />
              ))}
            </FormBlock>
          )}

          <div className="sticky bottom-0 mt-8 flex flex-col-reverse gap-3 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FormBlock = ({ title, children, full }) => (
  <div className="mt-7">
    <h4 className="mb-3 text-sm font-semibold text-black">{title}</h4>
    <div className={full ? "mt-3" : "grid gap-4 sm:grid-cols-2"}>
      {children}
    </div>
  </div>
);

const EditField = ({
  def,
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  isRequired = false,
}) => {
  const labelEl = (
    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
      {def.label}
      {isRequired && <RequiredMark />}
      {disabled && <span className="text-neutral-400">(not editable)</span>}
    </label>
  );

  if (def.type === "textarea") {
    return (
      <div className={fullWidth ? "col-span-2" : ""}>
        {labelEl}
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}…`}
          className={`${INPUT} resize-none`}
        />
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div>
        {labelEl}
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          <option value="" disabled>
            Select {def.label.toLowerCase()}
          </option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <input
        type={
          def.type === "date"
            ? "date"
            : def.type === "number"
              ? "number"
              : "text"
        }
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}`}
        className={INPUT}
      />
    </div>
  );
};

/* =========================================================================
   SMALL COMPONENTS
========================================================================= */

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl bg-neutral-100 p-4">
    <Icon size={16} className="mt-0.5 shrink-0 text-black" />
    <div className="min-w-0">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="truncate text-sm font-medium text-black">{value || "—"}</p>
    </div>
  </div>
);

const EmptyTab = ({ icon, text, subtext }) => (
  <div className="py-8 text-center">
    <div className="mb-3 flex justify-center text-neutral-300">{icon}</div>
    <p className="text-neutral-500">{text}</p>
    <p className="mt-1 text-sm text-neutral-400">{subtext}</p>
  </div>
);

const EmptyStateShell = ({ icon, title, message, action }) => (
  <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-5">
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
        {icon}
      </div>
      <h1 className="mt-5 font-serif text-xl font-semibold text-black">
        {title}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">{message}</p>
      {action || (
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Go home
        </Link>
      )}
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="flex h-[100dvh] overflow-hidden bg-neutral-100">
    <div className="hidden h-full w-72 shrink-0 animate-pulse bg-black lg:block">
      <div className="border-b border-white/10 p-6">
        <div className="h-14 w-14 rounded-full bg-white/10" />
        <div className="mt-2 h-4 w-24 rounded bg-white/10" />
        <div className="mt-1 h-3 w-32 rounded bg-white/10" />
      </div>
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/5" />
        ))}
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="h-16 border-b border-neutral-200 bg-white" />
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  </div>
);

export default FresherProfile;
