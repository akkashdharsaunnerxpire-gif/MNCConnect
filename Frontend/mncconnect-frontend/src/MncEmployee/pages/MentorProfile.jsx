import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  Printer,
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
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * MentorProfile
 * Fetches the logged-in mentor's registered data from the API and
 * renders it in the "Health Care_" style dashboard layout: sidebar
 * with section nav (Personal Info / Skills / Documents), breadcrumb
 * header, summary card, and a tabbed content panel.
 *
 * "Edit Profile" opens an in-page modal pre-filled with every field,
 * and saving PATCHes the changes back to the API.
 */
const MentorProfile = () => {
  const [mentor, setMentor] = useState(null);
  const [mentorEmail, setMentorEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  const fetchMentorProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const email =
        localStorage.getItem("mnc_mentor_registered_email") || "vijay@gmail.com";
      setMentorEmail(email);
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
      setError(err?.response?.data?.message || "Unable to load mentor profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentorProfile();
  }, []);

  /* =======================================================================
     UPDATE / SAVE
     Adjust the URL / method here if your backend uses a different route
     (e.g. PATCH `${API_URL}/mentor/update/${mentorEmail}`).

     Sent as multipart/form-data whenever a new document file is attached
     (so text fields + files travel in one request); plain JSON otherwise.
     File field names sent to the API: offerLetter, employeeIdProof,
     additionalProof — rename these to match your backend's multer/upload
     field names if they differ.
  ======================================================================= */
  const apiUpdateMentor = async (email, formValues) => {
    const { offerLetterFile, employeeIdProofFile, additionalProofFile, languages, ...rest } =
      formValues;

    const hasFiles = offerLetterFile || employeeIdProofFile || additionalProofFile;

    let body;
    let headers = { withCredentials: true };

    if (hasFiles) {
      body = new FormData();
      Object.entries(rest).forEach(([key, value]) => {
        body.append(key, value ?? "");
      });
      (languages || []).forEach((skill) => body.append("languages[]", skill));

      if (offerLetterFile) body.append("offerLetter", offerLetterFile);
      if (employeeIdProofFile) body.append("employeeIdProof", employeeIdProofFile);
      if (additionalProofFile) body.append("additionalProof", additionalProofFile);
    } else {
      body = { ...rest, languages };
    }

    const res = await axios.put(
      `${API_URL}/mentor/${encodeURIComponent(email)}`,
      body,
      headers
    );
    return res.data;
  };

  const handleSaveProfile = async (formValues) => {
    setSaving(true);
    try {
      const data = await apiUpdateMentor(mentorEmail, formValues);

      if (data?.success === false) {
        throw new Error(data?.message || "Failed to save changes");
      }

      const {
        offerLetterFile,
        employeeIdProofFile,
        additionalProofFile,
        ...plainValues
      } = formValues;

      const updatedMentor = data?.mentor || { ...mentor, ...plainValues };
      setMentor(updatedMentor);
      setEditOpen(false);
      showToast("success", "Profile updated successfully!");
    } catch (err) {
      console.error("Mentor update error:", err);
      showToast(
        "error",
        err?.response?.data?.message || err.message || "Could not save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  // Map the raw API document into the exact fields the UI needs.
  const profile = useMemo(() => {
    if (!mentor) return null;
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
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          mentor.name || "Mentor"
        )}&background=eff6ff&color=2563eb`,
      rating: mentor.rating || 0,
      totalReviews: mentor.totalReviews || 0,
      totalSessions: mentor.totalSessions || 0,
      createdAt: mentor.createdAt,
    };
  }, [mentor]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.name,
      profile.email,
      profile.phone,
      profile.company,
      profile.designation,
      profile.experience,
      profile.skills,
      profile.bio,
    ];
    const completed = fields.filter(
      (field) => field && field !== "Not provided" && field !== "" && field !== "0"
    ).length;
    return Math.round((completed / fields.length) * 100);
  }, [profile]);

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
      <div className="flex items-center justify-center min-h-screen px-5 bg-slate-50">
        <div className="w-full max-w-md p-8 text-center bg-white shadow-xl rounded-3xl">
          <ShieldCheck size={48} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Profile unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">
            {error || "Mentor data could not be loaded."}
          </p>
          <Link
            to="/mentor/home"
            className="inline-block px-6 py-3 mt-6 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white rounded-lg shadow-lg"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
      </div>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static top-0 left-0 z-50 w-64 shrink-0 h-screen bg-white border-r border-slate-100 px-5 py-6 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-2 px-1 mb-6">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Stethoscope size={18} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold text-slate-900">
              MentorConnect<span className="text-orange-500">_</span>
            </span>
          </div>

          {/* Mini profile + completion */}
          <div className="px-1 pb-5 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-blue-100"
              />
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
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border-l-2 transition text-left ${
                    isActive
                      ? "bg-orange-50 text-orange-600 border-orange-500"
                      : "text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
            <div className="my-3 border-t border-slate-100" />
            <Link
              to="/mentor/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <Edit3 size={18} />
              <span>Settings</span>
            </Link>
          </nav>

          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Award size={16} />
              <span className="text-xs font-semibold">Premium Mentor</span>
            </div>
            <p className="text-[11px] text-blue-50">
              Verified mentors get 3x more mentee requests.
            </p>
          </div>
        </aside>

        {/* Main column */}
        <main className="flex-1 px-5 sm:px-8 py-6 max-w-6xl">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-slate-400">
              <span>Mentor</span>
              <span className="mx-2">/</span>
              <span>Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Share"
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
              >
                <Share2 size={16} />
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Edit3 size={16} />
                Edit Profile
              </button>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-16 h-16 rounded-2xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-900">{profile.name}</h1>
                    {profile.isVerified && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {profile.designation} at {profile.company}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                    <Mail size={14} />
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 md:ml-auto">
                <Field label="Location" value={profile.location} />
                <Field label="Experience" value={`${profile.experience} yrs`} />
                <Field
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          profile.accountStatus === "active" ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                      />
                      {profile.verificationStatus}
                    </span>
                  }
                />
                <Field label="Rating" value={profile.rating || "0.0"} />
                <Field label="Sessions" value={profile.totalSessions} />
                <Field label="Reviews" value={profile.totalReviews} />
              </div>
            </div>
          </div>

          {/* Tabbed section content */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {activeTab === "personal" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailItem icon={<User size={16} />} label="Full Name" value={profile.name} />
                  <DetailItem icon={<Mail size={16} />} label="Email" value={profile.email} />
                  <DetailItem icon={<Phone size={16} />} label="Phone" value={profile.phone} />
                  <DetailItem
                    icon={<Building size={16} />}
                    label="Employee ID"
                    value={profile.employeeId}
                  />
                  <DetailItem
                    icon={<MapPin size={16} />}
                    label="Office Location"
                    value={profile.officeLocation}
                  />
                  <DetailItem
                    icon={<BriefcaseBusiness size={16} />}
                    label="Department"
                    value={profile.department}
                  />
                  <DetailItem
                    icon={<Mail size={16} />}
                    label="Work Email"
                    value={profile.workEmail}
                  />
                  <DetailItem
                    icon={<ShieldCheck size={16} />}
                    label="Verification Status"
                    value={profile.verificationStatus}
                  />
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">About Me</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{profile.bio}</p>
                </div>
              </div>
            )}

            {activeTab === "skills" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Skills & Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.length > 0 ? (
                    profile.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm">No skills added yet</p>
                  )}
                </div>
                {profile.linkedin && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Social Links</h3>
                    <a
                      href={profile.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                    >
                      <FaLinkedin size={18} /> LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Uploaded Documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocumentCard title="Offer Letter" url={profile.offerLetter} />
                  <DocumentCard title="Employee ID Proof" url={profile.employeeIdProof} />
                  {profile.additionalProof && (
                    <DocumentCard title="Additional Proof" url={profile.additionalProof} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <StatCard label="Sessions" value={profile.totalSessions || 0} icon={BriefcaseBusiness} />
            <StatCard
              label="Rating"
              value={profile.rating || "0.0"}
              icon={Star}
              iconClass="text-yellow-400 fill-yellow-400"
            />
            <StatCard label="Reviews" value={profile.totalReviews || 0} icon={FileText} />
          </div>
        </main>
      </div>

      {/* Edit Profile modal */}
      {editOpen && (
        <EditMentorModal
          mentor={mentor}
          saving={saving}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveProfile}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl ring-1 ring-black/5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {toast.type === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {toast.type === "success" ? "Success" : "Error"}
              </p>
              <p className="text-xs text-slate-500">{toast.message}</p>
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

const EditMentorModal = ({ mentor, saving, onClose, onSave }) => {
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
    // Existing uploaded document URLs (kept so we can show "current file" links)
    offerLetter: mentor?.offerLetter || "",
    employeeIdProof: mentor?.employeeIdProof || "",
    additionalProof: mentor?.additionalProof || "",
    // New files picked in this session (undefined until the user chooses one)
    offerLetterFile: null,
    employeeIdProofFile: null,
    additionalProofFile: null,
  });

  const [skillInput, setSkillInput] = useState("");

  const updateFile = (key, file) => {
    setForm((prev) => ({ ...prev, [key]: file }));
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !form.languages.includes(trimmed)) {
      updateField("languages", [...form.languages, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    updateField(
      "languages",
      form.languages.filter((s) => s !== skill)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-6"
        >
          {/* Basic + contact fields */}
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

          {/* Bio */}
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

          {/* Skills */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Skills / Languages
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. React, Python, Java"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={addSkill}
                className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Add
              </button>
            </div>

            <div className="mt-3 flex min-h-[44px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 p-3">
              {form.languages.length === 0 ? (
                <p className="w-full py-1 text-center text-sm text-slate-400">
                  No skills added yet
                </p>
              ) : (
                form.languages.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <label className="mb-3 block text-xs font-medium text-slate-500">
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

          {/* Footer buttons */}
          <div className="sticky bottom-0 mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:opacity-60"
            >
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
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      {file ? (
        <p className="mt-1 truncate text-xs font-medium text-blue-600">
          Selected: {file.name}
        </p>
      ) : currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <Download size={12} /> View current file
        </a>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Not uploaded</p>
      )}

      <label
        htmlFor={inputId}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
      >
        <Plus size={13} />
        {currentUrl || file ? "Replace file" : "Upload file"}
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

const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-slate-900">{value}</p>
  </div>
);

const DetailItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
    <div className="text-slate-400">{icon}</div>
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "Not provided"}</p>
    </div>
  </div>
);

const DocumentCard = ({ title, url }) => (
  <div className="p-4 border border-slate-100 rounded-lg">
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 text-blue-600 hover:underline text-sm"
      >
        <Download size={14} /> View Document
      </a>
    ) : (
      <p className="text-sm text-slate-400 mt-2">Not uploaded</p>
    )}
  </div>
);

const StatCard = ({ label, value, icon: Icon, iconClass = "text-blue-500" }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
    <Icon size={18} className={`mx-auto mb-2 ${iconClass}`} />
    <div className="text-xl font-semibold text-slate-900">{value}</div>
    <p className="text-xs text-slate-400">{label}</p>
  </div>
);

export default MentorProfile;