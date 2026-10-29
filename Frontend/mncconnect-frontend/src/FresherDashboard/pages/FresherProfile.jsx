import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

/* =========================================================================
   API LAYER  (cookie based: the HttpOnly "mnc_token" cookie is sent
   automatically because every request uses credentials: "include")
   NOTHING is stored in localStorage / sessionStorage.
========================================================================= */

// must include /api (backend mounts auth at /api/auth)
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

  if (response.status === 401) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status}`);
  }

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

  if (!res.ok) {
    throw new Error("Failed to save changes");
  }

  const data = await res.json();
  return data?.user ?? data;
}

async function apiUploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  // no Content-Type here: the browser sets the multipart boundary itself
  const response = await fetch(ENDPOINTS.AVATAR, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Upload error:", errorText);
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

  if (!res.ok) {
    throw new Error("Failed to remove photo");
  }

  const data = await res.json().catch(() => ({}));
  return data?.user ?? data;
}

/* =========================================================================
   AVATAR
========================================================================= */

const PROFILE_IMAGE_KEYS = [
  "profilePic",
  "profileImage",
  "avatar",
  "photo",
  "photoUrl",
];

function getRawAvatarUrl(user) {
  for (const key of PROFILE_IMAGE_KEYS) {
    if (user?.[key]) return user[key];
  }
  return null;
}

function getGenderAvatarUrl(user) {
  const seed = encodeURIComponent(
    user?.email || user?.name || user?._id || user?.id || "fresher",
  );

  const gender = String(user?.gender || "")
    .trim()
    .toLowerCase();

  if (gender.startsWith("m")) {
    return `https://avatar.iran.liara.run/public/boy?username=${seed}`;
  }

  if (gender.startsWith("f")) {
    return `https://avatar.iran.liara.run/public/girl?username=${seed}`;
  }

  return `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundType=solid&backgroundColor=dbeafe`;
}

function resolveAvatar(user) {
  return getRawAvatarUrl(user) || getGenderAvatarUrl(user);
}

/* =========================================================================
   FIELD REGISTRY
========================================================================= */

const FIELD_DEFS = {
  name: {
    label: "Full Name",
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
    label: "Date of Birth",
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
    label: "About Me",
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
   SIDEBAR (desktop)
========================================================================= */

const Sidebar = ({
  user,
  avatarUrl,
  displayName,
  activeTab,
  setActiveTab,
  onLogout,
}) => {
  const navItems = [
    { id: "profile", label: "Profile", icon: UserCircle },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "career", label: "Career", icon: BriefcaseBusiness },
    { id: "skills", label: "Skills", icon: Code },
    { id: "interests", label: "Interests", icon: Heart },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-[100vh] h-[100dvh] w-72 shadow-2xl shadow-black/20 lg:block">
      <div className="flex h-full min-h-0 flex-col bg-[#0B1E3F]">
        {/* Brand */}
        <div className="flex shrink-0 items-center justify-between gap-2.5 px-6 pb-2 pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-bold text-white shadow-md shadow-blue-900/40">
              F
            </div>
            <span className="font-serif text-base font-semibold tracking-wide text-white">
              Fresher<span className="text-blue-300">Space</span>
            </span>
          </div>
        </div>

        {/* User */}
        <div className="mx-4 mt-10 shrink-0 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-blue-400/40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-blue-200/70">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-blue-300/60">
            Menu
          </p>

          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white text-[#0B1E3F] shadow-md shadow-black/20"
                        : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isActive
                          ? "text-blue-700"
                          : "text-blue-300/70 group-hover:text-white"
                      }
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-white/10 bg-[#0B1E3F] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOutIcon size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

/* =========================================================================
   MOBILE TAB BAR (phones / tablets)
========================================================================= */

const MOBILE_TABS = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
  { id: "skills", label: "Skills", icon: Code },
  { id: "interests", label: "Interests", icon: Heart },
];

const MobileTabBar = ({ activeTab, setActiveTab }) => (
  <div className="mb-5 flex items-center gap-2 lg:hidden">
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
              active
                ? "bg-[#0B1E3F] text-white shadow-md"
                : "bg-white text-slate-600 ring-1 ring-blue-100"
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
);

/* =========================================================================
   ADD EDUCATION MODAL
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2A56]/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#0F2A56]">
            Add Education
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#0F2A56]"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ModalInput
            label="Institution/University"
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
            label="Field/Specialization"
            name="field"
            value={formData.field}
            onChange={handleChange}
            placeholder="e.g. Computer Science, Finance"
          />

          <div className="grid grid-cols-2 gap-4">
            <ModalInput
              label="Graduation Year"
              name="graduationYear"
              type="number"
              value={formData.graduationYear}
              onChange={handleChange}
              placeholder="2024"
            />
            <ModalInput
              label="CGPA/Percentage"
              name="cgpa"
              value={formData.cgpa}
              onChange={handleChange}
              placeholder="8.5 / 85%"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Additional details about your education..."
              className="w-full resize-none rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <ModalButtons onClose={onClose} submitText="Add Education" />
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   ADD CAREER MODAL
========================================================================= */

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
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2A56]/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#0F2A56]">
            Add Career Experience
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#0F2A56]"
          >
            <X size={20} />
          </button>
        </div>

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
            label="Role/Position"
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
              label="Start Date"
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange}
            />
            <ModalInput
              label="End Date"
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
              className="h-4 w-4 rounded border-blue-200 text-blue-700 focus:ring-blue-500"
            />
            <label htmlFor="career-current" className="text-sm text-slate-700">
              Currently working here
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Describe your role and responsibilities..."
              className="w-full resize-none rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <ModalButtons onClose={onClose} submitText="Add Experience" />
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   ADD SKILL / INTEREST MODALS
========================================================================= */

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

  const handleRemove = (item) => setItems(items.filter((s) => s !== item));

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2A56]/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#0F2A56]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#0F2A56]"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
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
                className="min-w-0 flex-1 rounded-xl border border-blue-100 px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex min-h-[60px] flex-wrap gap-2 rounded-xl border border-dashed border-blue-200 p-3">
            {items.length === 0 ? (
              <p className="w-full py-3 text-center text-sm text-slate-400">
                {emptyText}
              </p>
            ) : (
              items.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    className="hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))
            )}
          </div>

          <ModalButtons onClose={onClose} submitText={submitText} />
        </form>
      </div>
    </div>
  );
};

const AddSkillModal = ({ isOpen, onClose, onAdd, existingSkills }) => (
  <AddTagsModal
    isOpen={isOpen}
    onClose={onClose}
    onAdd={onAdd}
    existing={existingSkills}
    title="Add Skills"
    label="Add Skills"
    placeholder="e.g. React, JavaScript, Python"
    emptyText="No skills added yet"
    emptyAlert="Please add at least one skill"
    submitText="Save Skills"
  />
);

const AddInterestModal = ({ isOpen, onClose, onAdd, existingInterests }) => (
  <AddTagsModal
    isOpen={isOpen}
    onClose={onClose}
    onAdd={onAdd}
    existing={existingInterests}
    title="Add Career Interests"
    label="Add Interests"
    placeholder="e.g. AI/ML, Full Stack, Data Science"
    emptyText="No interests added yet"
    emptyAlert="Please add at least one interest"
    submitText="Save Interests"
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

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  /* =======================================================================
     LOGOUT
     1. server clears the HttpOnly cookie (JS cannot do this itself)
     2. realtime socket is closed -> user goes OFFLINE on the server
     3. AuthContext is refreshed (it becomes "logged out")
  ======================================================================= */

  const handleLogout = async () => {
    await performLogout();
    try {
      await refresh();
    } catch {
      /* ignore */
    }
    navigate("/", { replace: true });
  };

  /* =======================================================================
     LOAD USER (always from the server, nothing cached in the browser)
  ======================================================================= */

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
      setStatus(err.message === "UNAUTHENTICATED" ? "unauthenticated" : "error");
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
      showToast(type, successMsg);
    } catch (err) {
      setUser(previous);
      showToast("error", err.message || "Could not save. Please try again.");
    }
  };

  /* =======================================================================
     AVATAR UPLOAD
  ======================================================================= */

  const handleAvatarUpload = async (file) => {
    if (!file) return;

    setUploading(true);

    // instant preview
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
        if (url) setPreviewImage(null); // real url is available now

        showToast("success", "Profile photo updated successfully!");
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
      PROFILE_IMAGE_KEYS.forEach((key) => {
        delete mergedUser[key];
      });

      setUser(mergedUser);
      setPreviewImage(null);

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

  /* =======================================================================
     CRUD (saved on the server)
  ======================================================================= */

  const handleAddEducation = (education) =>
    persist(
      { education: [...(user.education || []), education] },
      "Education added successfully!",
    );

  const handleDeleteEducation = (id) =>
    persist(
      { education: (user.education || []).filter((edu) => edu.id !== id) },
      "Education removed",
      "info",
    );

  const handleAddCareer = (career) =>
    persist(
      { career: [...(user.career || []), career] },
      "Career experience added successfully!",
    );

  const handleDeleteCareer = (id) =>
    persist(
      { career: (user.career || []).filter((c) => c.id !== id) },
      "Career experience removed",
      "info",
    );

  const handleAddSkills = (newSkills) =>
    persist(
      { skills: [...(user.skills || []), ...newSkills] },
      "Skills added successfully!",
    );

  const handleDeleteSkill = (skill) =>
    persist(
      { skills: (user.skills || []).filter((s) => s !== skill) },
      "Skill removed",
      "info",
    );

  const handleAddInterests = (newInterests) =>
    persist(
      { interests: [...(user.interests || []), ...newInterests] },
      "Interests added successfully!",
    );

  const handleDeleteInterest = (interest) =>
    persist(
      { interests: (user.interests || []).filter((i) => i !== interest) },
      "Interest removed",
      "info",
    );

  /* =======================================================================
     SAVE PROFILE
  ======================================================================= */

  const handleSave = async (payload) => {
    setSaving(true);

    try {
      const updated = await apiUpdateCurrentUser(payload);
      setUser({ ...user, ...updated });
      setEditOpen(false);

      showToast("success", "Your changes have been saved!");
    } catch (err) {
      showToast("error", err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================================
     DERIVED DATA
  ======================================================================= */

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

  const checklist = useMemo(() => {
    if (!user) return [];

    return [
      {
        label: "Profile photo",
        done: Boolean(getRawAvatarUrl(user)) || Boolean(previewImage),
      },
      { label: "About you", done: hasValue(user.bio) },
      { label: "Education added", done: (user.education || []).length > 0 },
      { label: "Skills added", done: (user.skills || []).length > 0 },
      {
        label: "Contact number",
        done: hasValue(user.phone) || hasValue(user.mobile),
      },
      { label: "Career experience", done: (user.career || []).length > 0 },
      { label: "Interests added", done: (user.interests || []).length > 0 },
    ];
  }, [user, previewImage]);

  const profileCompletion = useMemo(() => {
    if (checklist.length === 0) return 0;
    return Math.round(
      (checklist.filter((c) => c.done).length / checklist.length) * 100,
    );
  }, [checklist]);

  const displayName = (user?.name || "").trim() || "Fresher";

  const avatarUrl = previewImage || (user ? resolveAvatar(user) : null);

  /* =======================================================================
     STATES
  ======================================================================= */

  if (status === "unauthenticated") {
    return (
      <EmptyStateShell
        icon={<ShieldAlert size={22} />}
        title="Please sign in"
        message="Your session has expired. Log in to view your profile."
        action={
          <Link
            to="/login"
            className="mt-6 inline-block rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
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
        message="Make sure your backend server is running."
        action={
          <button
            onClick={loadUser}
            className="mt-6 rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (status === "loading" || !user) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F8FC]">
      {/* Premium background: heavy blurs only on desktop (lag on phones) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,42,86,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,42,86,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_-10%,black_40%,transparent_100%)]" />
        <div className="absolute -top-40 left-1/3 hidden h-[36rem] w-[36rem] rounded-full bg-blue-300/25 blur-[120px] md:block" />
        <div className="absolute -right-32 top-1/4 hidden h-[28rem] w-[28rem] rounded-full bg-blue-500/15 blur-[110px] md:block" />
        <div className="absolute bottom-[-10rem] left-[-6rem] hidden h-[26rem] w-[26rem] rounded-full bg-indigo-200/40 blur-[100px] md:block" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          user={user}
          avatarUrl={avatarUrl}
          displayName={displayName}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
        />

        <div className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8 lg:pl-72">
          <div className="mx-auto max-w-4xl">
            <MobileTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Profile Header */}
            <div className="mb-8 overflow-hidden rounded-2xl bg-white/90 shadow-xl shadow-blue-900/5 ring-1 ring-blue-100/70 md:backdrop-blur-sm">
              <div className="relative h-24 overflow-hidden bg-gradient-to-r from-[#0B1E3F] via-[#0F2A56] to-blue-700">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_100%]" />
              </div>

              <div className="flex flex-col gap-6 p-6 pt-0 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-6">
                  {/* Avatar */}
                  <div className="group relative -mt-12 shrink-0">
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
                    />

                    <div className="absolute inset-0 flex rounded-full bg-[#0F2A56]/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <label
                        htmlFor="avatar-upload"
                        className="flex flex-1 cursor-pointer flex-col items-center justify-center text-white"
                      >
                        <Camera size={24} />
                        <span className="mt-1 text-xs">Upload</span>
                      </label>
                    </div>

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
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0F2A56]/70">
                        <Loader2 size={30} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  {/* User details */}
                  <div className="min-w-0 pb-1">
                    <h1 className="truncate font-serif text-2xl font-semibold text-[#0F2A56]">
                      {displayName}
                    </h1>
                    <p className="truncate text-sm text-slate-500">
                      {user?.email}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-100">
                        {profileCompletion}% Complete
                      </span>

                      <button
                        onClick={() => setEditOpen(true)}
                        className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-100 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil size={12} className="mr-1 inline" />
                        Edit Profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
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
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 lg:hidden"
            >
              <LogOutIcon size={18} />
              Logout
            </button>
          </div>
        </div>
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
            <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl ring-1 ring-blue-100">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  toast.type === "success"
                    ? "bg-emerald-50 text-emerald-600"
                    : toast.type === "info"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-red-50 text-red-600"
                }`}
              >
                {toast.type === "success" ? (
                  <Check size={15} />
                ) : (
                  <AlertTriangle size={15} />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-[#0F2A56]">
                  {toast.type === "success"
                    ? "Success"
                    : toast.type === "info"
                      ? "Info"
                      : "Error"}
                </p>
                <p className="text-xs text-slate-500">{toast.message}</p>
              </div>
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
   PROFILE CONTENT
========================================================================= */

const ProfileContent = ({ user, fieldByKey, onEdit }) => (
  <div className="space-y-6">
    {/* About */}
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
          About
        </h2>
        <button
          onClick={onEdit}
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          Edit
        </button>
      </div>

      {user?.bio ? (
        <p className="leading-7 text-slate-600">{user.bio}</p>
      ) : (
        <p className="text-slate-400">
          Add a short introduction so mentors know your goals
        </p>
      )}
    </div>

    {/* Contact */}
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
      <h2 className="mb-4 font-serif text-lg font-semibold text-[#0F2A56]">
        Contact Information
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem icon={Phone} label="Phone" value={user?.phone || user?.mobile} />
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
          <InfoItem icon={Globe} label="Nationality" value={user?.nationality} />
        )}
      </div>
    </div>
  </div>
);

/* =========================================================================
   EDUCATION
========================================================================= */

const EducationContent = ({ education, onAdd, onDelete }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
        Education
      </h2>
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <Plus size={16} />
        Add Education
      </button>
    </div>

    {education.length > 0 ? (
      <div className="space-y-4">
        {education.map((edu, index) => (
          <div
            key={edu.id || index}
            className="rounded-xl border border-blue-100/70 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[#0F2A56]">
                  {edu.institution}
                </h3>
                <p className="text-sm text-slate-600">{edu.degree}</p>

                {edu.field && (
                  <p className="text-sm text-slate-500">{edu.field}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {edu.graduationYear && <span>{edu.graduationYear}</span>}
                  {edu.cgpa && <span>{edu.cgpa}</span>}
                </div>

                {edu.description && (
                  <p className="mt-2 text-sm text-slate-600">
                    {edu.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => onDelete(edu.id)}
                aria-label="Delete education"
                className="p-2 text-slate-400 transition-colors hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyTab
        icon={<GraduationCap size={48} />}
        text="No education added yet"
        subtext='Click "Add Education" to get started!'
      />
    )}
  </div>
);

/* =========================================================================
   CAREER
========================================================================= */

const CareerContent = ({ career, onAdd, onDelete }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
        Career Experience
      </h2>
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <Plus size={16} />
        Add Experience
      </button>
    </div>

    {career.length > 0 ? (
      <div className="space-y-4">
        {career.map((exp, index) => (
          <div
            key={exp.id || index}
            className="rounded-xl border border-blue-100/70 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[#0F2A56]">{exp.company}</h3>
                <p className="text-sm text-slate-600">{exp.role}</p>

                {exp.industry && (
                  <p className="text-sm text-slate-500">{exp.industry}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {exp.startDate && <span>From: {exp.startDate}</span>}

                  {exp.current ? (
                    <span className="font-medium text-emerald-600">
                      ● Present
                    </span>
                  ) : (
                    exp.endDate && <span>To: {exp.endDate}</span>
                  )}
                </div>

                {exp.description && (
                  <p className="mt-2 text-sm text-slate-600">
                    {exp.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => onDelete(exp.id)}
                aria-label="Delete experience"
                className="p-2 text-slate-400 transition-colors hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyTab
        icon={<Briefcase size={48} />}
        text="No career experience added yet"
        subtext='Click "Add Experience" to get started!'
      />
    )}
  </div>
);

/* =========================================================================
   SKILLS / INTERESTS (delete "x" always visible on touch screens)
========================================================================= */

const TagList = ({ items, onDelete }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <span
        key={item}
        className="group flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 ring-1 ring-blue-100 transition hover:shadow-md"
      >
        {item}
        <button
          onClick={() => onDelete(item)}
          aria-label={`Remove ${item}`}
          className="opacity-100 transition-opacity hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      </span>
    ))}
  </div>
);

const SkillsContent = ({ skills, onAdd, onDelete }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
        Skills
      </h2>
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <Plus size={16} />
        Add Skills
      </button>
    </div>

    {skills.length > 0 ? (
      <TagList items={skills} onDelete={onDelete} />
    ) : (
      <EmptyTab
        icon={<Code size={48} />}
        text="No skills added yet"
        subtext='Click "Add Skills" to get started!'
      />
    )}
  </div>
);

const InterestsContent = ({ interests, onAdd, onDelete }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
        Career Interests
      </h2>
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <Plus size={16} />
        Add Interests
      </button>
    </div>

    {interests.length > 0 ? (
      <TagList items={interests} onDelete={onDelete} />
    ) : (
      <EmptyTab
        icon={<Heart size={48} />}
        text="No interests added yet"
        subtext='Click "Add Interests" to get started!'
      />
    )}
  </div>
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

  const fileInputRef = useRef(null);

  const editableFields = useMemo(() => {
    return Object.keys(user)
      .filter((key) => FIELD_DEFS[key] && FIELD_DEFS[key].editable !== false)
      .map((key) => ({ key, def: FIELD_DEFS[key] }));
  }, [user]);

  const groupedEditable = (group) =>
    editableFields.filter((field) => field.def.group === group);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
    onSave(form);
  };

  const missingFields = useMemo(() => {
    const required = Object.keys(FIELD_DEFS).filter(
      (key) => FIELD_DEFS[key].required,
    );
    return required.filter((key) => !hasValue(form[key]));
  }, [form]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0F2A56]/50 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90dvh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-blue-100">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-blue-100/70 bg-white px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#0F2A56]">
              Edit Profile
            </h2>

            {missingFields.length > 0 && (
              <p className="mt-0.5 text-xs text-blue-700">
                {missingFields.length} field
                {missingFields.length > 1 ? "s" : ""} missing
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-50"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(90dvh-80px)] overflow-y-auto px-6 py-6"
        >
          {/* Photo */}
          <div className="flex flex-col gap-4 rounded-xl bg-blue-50/60 p-5 ring-1 ring-blue-100/70 sm:flex-row sm:items-center">
            <div className="group relative shrink-0">
              <img
                src={previewImage || avatarUrl}
                alt="Profile"
                className="h-20 w-20 rounded-full border-2 border-white object-cover shadow-sm"
              />

              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0F2A56]/70">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}

              <label
                htmlFor="edit-profile-image"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-700 text-white shadow transition hover:bg-blue-800 hover:shadow-lg"
              >
                <Camera size={14} />
                <input
                  ref={fileInputRef}
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
              <h3 className="text-sm font-semibold text-[#0F2A56]">
                Profile Photo
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {hasRealAvatar
                  ? "Upload a new photo to replace this one."
                  : "A placeholder avatar is shown until you upload one."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Supported: JPG, PNG, GIF (Max 5MB)
              </p>

              {hasRealAvatar && (
                <button
                  type="button"
                  onClick={onAvatarRemove}
                  className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {/* Basic */}
          {groupedEditable("basic").length > 0 && (
            <FormBlock title="Basic Information">
              {groupedEditable("basic").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                  isRequired={def.required}
                />
              ))}
            </FormBlock>
          )}

          {/* Contact */}
          {groupedEditable("contact").length > 0 && (
            <FormBlock title="Contact Information">
              {groupedEditable("contact").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                  disabled={def.editable === false}
                  isRequired={def.required}
                />
              ))}
            </FormBlock>
          )}

          {/* Social */}
          {groupedEditable("social").length > 0 && (
            <FormBlock title="Social Media">
              {groupedEditable("social").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                />
              ))}
            </FormBlock>
          )}

          {/* About */}
          {groupedEditable("about").length > 0 && (
            <FormBlock title="About You" full>
              {groupedEditable("about").map(({ key, def }) => (
                <EditField
                  key={key}
                  def={def}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                  fullWidth
                />
              ))}
            </FormBlock>
          )}

          {/* Buttons */}
          <div className="sticky bottom-0 mt-8 flex flex-col-reverse gap-3 border-t border-blue-100/70 bg-white pb-[env(safe-area-inset-bottom)] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-blue-100 px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-blue-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-full bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800 hover:shadow-xl disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   FORM BLOCK
========================================================================= */

const FormBlock = ({ title, children, full }) => (
  <div className="mt-7">
    <h4 className="mb-3 text-sm font-semibold text-[#0F2A56]">{title}</h4>
    <div className={full ? "mt-3" : "grid gap-4 sm:grid-cols-2"}>{children}</div>
  </div>
);

/* =========================================================================
   EDIT FIELD
========================================================================= */

const fieldInputClass =
  "w-full rounded-xl border border-blue-100 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-50/40";

const RequiredMark = () => <span className="ml-1 text-red-500">*</span>;

const EditField = ({
  def,
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  isRequired = false,
}) => {
  if (def.type === "textarea") {
    return (
      <div className={fullWidth ? "col-span-2" : ""}>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          {def.label}
          {isRequired && <RequiredMark />}
        </label>
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}…`}
          className={`${fieldInputClass} resize-none`}
        />
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          {def.label}
          {isRequired && <RequiredMark />}
        </label>
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldInputClass} bg-white`}
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

  if (def.type === "date" || def.type === "number") {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          {def.label}
          {isRequired && <RequiredMark />}
        </label>
        <input
          type={def.type === "date" ? "date" : "number"}
          value={value || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder || def.label}
          className={fieldInputClass}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {def.label}
        {isRequired && <RequiredMark />}
        {disabled && <span className="text-slate-400">(not editable)</span>}
      </label>
      <input
        type="text"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}`}
        className={fieldInputClass}
      />
    </div>
  );
};

/* =========================================================================
   SMALL COMPONENTS
========================================================================= */

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
    <label className="mb-1 block text-sm font-medium text-slate-700">
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
      className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-blue-50/40"
    />
  </div>
);

const ModalButtons = ({ onClose, submitText }) => (
  <div className="flex gap-3 pt-4">
    <button
      type="button"
      onClick={onClose}
      className="flex-1 rounded-xl border border-blue-100 py-3 text-sm font-semibold text-slate-600 transition hover:bg-blue-50"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-lg"
    >
      {submitText}
    </button>
  </div>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl bg-[#F5F8FC] p-4">
    <Icon size={16} className="mt-0.5 shrink-0 text-blue-700" />
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="truncate text-sm font-medium text-[#0F2A56]">
        {value || "—"}
      </p>
    </div>
  </div>
);

const EmptyTab = ({ icon, text, subtext }) => (
  <div className="py-8 text-center">
    <div className="mb-3 flex justify-center text-blue-200">{icon}</div>
    <p className="text-slate-400">{text}</p>
    <p className="mt-1 text-sm text-slate-400">{subtext}</p>
  </div>
);

/* =========================================================================
   EMPTY STATE
========================================================================= */

const EmptyStateShell = ({ icon, title, message, action }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F8FC] px-5">
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      <div className="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-300/25 blur-[120px]" />
      <div className="absolute bottom-[-8rem] right-[-6rem] h-[22rem] w-[22rem] rounded-full bg-indigo-200/40 blur-[100px]" />
    </div>

    <div className="relative w-full max-w-sm rounded-2xl bg-white/90 p-8 text-center shadow-xl shadow-blue-900/5 ring-1 ring-blue-100/70">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F2A56] to-blue-700 text-white shadow-lg shadow-blue-900/20">
        {icon}
      </div>

      <h1 className="mt-5 font-serif text-xl font-semibold text-[#0F2A56]">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>

      {action || (
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Go home
        </Link>
      )}
    </div>
  </div>
);

/* =========================================================================
   SKELETON
========================================================================= */

const ProfileSkeleton = () => (
  <div className="flex min-h-screen bg-[#F5F8FC]">
    <div className="fixed left-0 top-0 hidden h-screen w-72 animate-pulse bg-[#0B1E3F] lg:block">
      <div className="border-b border-white/10 p-6">
        <div className="h-14 w-14 rounded-full bg-white/10" />
        <div className="mt-2 h-4 w-24 rounded bg-white/10" />
        <div className="mt-1 h-3 w-32 rounded bg-white/10" />
      </div>

      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>

    <div className="min-w-0 flex-1 p-4 lg:p-8 lg:pl-72">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-blue-100/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-blue-100/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-blue-100/50" />
      </div>
    </div>
  </div>
);

export default FresherProfile;