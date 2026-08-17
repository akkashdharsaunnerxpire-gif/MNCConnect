import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
  XCircle
} from 'lucide-react';

const initialUserForm = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
};

const initialMentorProfile = {
  name: '',
  email: '',
  mobile: '',
  company: '',
  role: '',
  experience: '',
  skills: '',
  location: '',
  linkedin: '',
  bio: '',
  photo: '',
};

const initialDocs = [
  { id: 1, name: 'employment-letter.pdf', type: 'Employment Proof', status: 'Ready' },
  { id: 2, name: 'company-id.png', type: 'Professional ID', status: 'Ready' },
  { id: 3, name: 'linkedin-profile.pdf', type: 'Profile Verification', status: 'Ready' },
];

const Auth = ({ closeModal = () => {}, isModal = false }) => {
  const navigate = useNavigate();
  const [authChoice, setAuthChoice] = useState('choice');
  const [userMode, setUserMode] = useState('login');
  const [userForm, setUserForm] = useState(initialUserForm);
  const [mentorStep, setMentorStep] = useState(1);
  const [mentorProfile, setMentorProfile] = useState(initialMentorProfile);
  const [mentorDocs, setMentorDocs] = useState(initialDocs);
  const [mentorVerificationState, setMentorVerificationState] = useState('pending');
  const [mentorLoginForm, setMentorLoginForm] = useState({ email: '', password: '' });

  const handleUserInput = (field, value) => setUserForm((prev) => ({ ...prev, [field]: value }));
  const handleMentorProfileInput = (field, value) => setMentorProfile((prev) => ({ ...prev, [field]: value }));

  const handleUserSubmit = (e) => {
    e.preventDefault();
    if (isModal) closeModal();
    navigate('/user-dashboard');
  };

  const handleMentorProfileSubmit = (e) => {
    e.preventDefault();
    setMentorStep(2);
  };

  const handleMentorUploadSubmit = () => setMentorStep(3);

  const removeDoc = (id) => setMentorDocs((prev) => prev.filter((doc) => doc.id !== id));

  const handleMentorLoginSubmit = (e) => {
    e.preventDefault();
    if (isModal) closeModal();
    navigate('/mentor-dashboard');
  };

  const renderChoiceScreen = () => (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          How would you like to continue?
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setAuthChoice('normal')}
          className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <Users className="h-7 w-7" />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900">Normal User</h3>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:text-blue-600" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            I&apos;m a fresher / job seeker looking to learn, connect and discover opportunities.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setAuthChoice('mentor')}
          className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl"
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">
            <BriefcaseBusiness className="h-7 w-7" />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900">Mentor</h3>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:text-indigo-600" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            I&apos;m an experienced professional who wants to share knowledge and help others.
          </p>
        </button>
      </div>
    </div>
  );

  const renderUserScreen = () => (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Normal User</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {userMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
        </div>
        {isModal && (
          <button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <button
          type="button"
          onClick={() => setUserMode('login')}
          className={`w-1/2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            userMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setUserMode('register')}
          className={`w-1/2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            userMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Create Account
        </button>
      </div>

      <div className="space-y-5">
        <button type="button" className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md">
          <Globe className="h-5 w-5 text-red-500" />
          Continue with Google
        </button>

        <form onSubmit={handleUserSubmit} className="space-y-4">
          {userMode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                value={userForm.name}
                onChange={(e) => handleUserInput('name', e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email / Mobile Number</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={userForm.email}
                onChange={(e) => handleUserInput('email', e.target.value)}
                placeholder={userMode === 'login' ? 'name@example.com' : 'you@example.com'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                required
              />
            </div>
          </div>

          {userMode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={userForm.mobile}
                  onChange={(e) => handleUserInput('mobile', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => handleUserInput('password', e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                required
              />
            </div>
          </div>

          {userMode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(e) => handleUserInput('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <button type="button" className="font-medium text-blue-600 transition hover:text-blue-700">
              Forgot Password
            </button>
            <button
              type="button"
              onClick={() => setUserMode(userMode === 'login' ? 'register' : 'login')}
              className="font-medium text-slate-600 transition hover:text-slate-900"
            >
              {userMode === 'login' ? 'Create Account' : 'Already have an account?'}
            </button>
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:brightness-110"
          >
            {userMode === 'login' ? 'Login' : 'Create Account'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const renderMentorStepIndicator = () => (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span>Mentor onboarding</span>
        <span>Step {mentorStep} of 3</span>
      </div>
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                mentorStep >= step ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step}
            </div>
            {step < 3 && <div className={`h-px flex-1 ${mentorStep > step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>
    </div>
  );

  const renderMentorStepOne = () => (
    <form onSubmit={handleMentorProfileSubmit} className="space-y-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Step 1</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Create Profile</h2>
        </div>
        {isModal && (
          <button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
          <input value={mentorProfile.name} onChange={(e) => handleMentorProfileInput('name', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Your full name" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Professional Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={mentorProfile.email} onChange={(e) => handleMentorProfileInput('email', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="name@company.com" required />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={mentorProfile.mobile} onChange={(e) => handleMentorProfileInput('mobile', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="+91 98765 43210" required />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Current Company</label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={mentorProfile.company} onChange={(e) => handleMentorProfileInput('company', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Google / Microsoft" required />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Current Job Role</label>
          <input value={mentorProfile.role} onChange={(e) => handleMentorProfileInput('role', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Senior Product Manager" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Years of Experience</label>
          <input value={mentorProfile.experience} onChange={(e) => handleMentorProfileInput('experience', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="8" required />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">Skills</label>
          <input value={mentorProfile.skills} onChange={(e) => handleMentorProfileInput('skills', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Product Strategy, Leadership, AI, SaaS" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Current Location</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={mentorProfile.location} onChange={(e) => handleMentorProfileInput('location', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Bengaluru, India" required />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">LinkedIn Profile</label>
          <input value={mentorProfile.linkedin} onChange={(e) => handleMentorProfileInput('linkedin', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="https://linkedin.com/in/yourname" required />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">Professional Bio</label>
          <textarea value={mentorProfile.bio} onChange={(e) => handleMentorProfileInput('bio', e.target.value)} className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" placeholder="Tell students about your background, mentorship focus, and expertise." required />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">Profile Photo</label>
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Camera className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{mentorProfile.photo || 'Upload a professional headshot'}</p>
              <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
            </div>
            <input type="file" accept="image/*" className="hidden" id="mentor-photo" onChange={(e) => handleMentorProfileInput('photo', e.target.files?.[0]?.name || '')} />
            <label htmlFor="mentor-photo" className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Upload</label>
          </div>
        </div>
      </div>

      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );

  const renderMentorStepTwo = () => (
    <div className="space-y-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Step 2</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Upload Proofs</h2>
        </div>
        {isModal && (
          <button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm leading-6 text-blue-800">Your documents are used only for professional verification.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <label htmlFor="mentor-doc-upload" className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Upload professional proof documents</p>
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG up to 5MB</p>
          </div>
        </label>
        <input
          id="mentor-doc-upload"
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            const mappedDocs = files.map((file, index) => ({
              id: Date.now() + index,
              name: file.name,
              type: index === 0 ? 'Employment Proof' : index === 1 ? 'Professional ID' : 'Experience Proof',
              status: 'Uploaded',
            }));
            setMentorDocs((prev) => [...prev, ...mappedDocs]);
          }}
        />
      </div>

      <div className="space-y-3">
        {mentorDocs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
                <p className="text-xs text-slate-500">{doc.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                {doc.status}
              </span>
              <button type="button" onClick={() => removeDoc(doc.id)} className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleMentorUploadSubmit} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
        Submit for Verification
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderMentorVerification = () => (
    <div className="space-y-5 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Clock3 className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-3xl font-bold text-slate-900">Verification in progress</h2>
        <p className="mt-2 text-sm text-slate-600">Your profile has been submitted for review.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Profile submitted</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Professional information submitted</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-slate-700">Verification pending</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Status demo</p>
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected'].map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setMentorVerificationState(state)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                mentorVerificationState === state ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {mentorVerificationState === 'approved' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-base font-bold text-emerald-900">You&apos;re verified!</p>
              <p className="mt-1 text-sm text-emerald-800">Your professional profile is now ready.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuthChoice('mentor-login')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Continue to Mentor Login
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {mentorVerificationState === 'rejected' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4" />
            Rejected
          </div>
          <p className="mt-2">Please resubmit with clearer professional documentation.</p>
        </div>
      )}
    </div>
  );

  const renderMentorLogin = () => (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Verified Professional</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Mentor Login</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Verified
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-5 shadow-sm">
        <form onSubmit={handleMentorLoginSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Professional Email / Mobile Number</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={mentorLoginForm.email}
                onChange={(e) => setMentorLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={mentorLoginForm.password}
                onChange={(e) => setMentorLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400"
                required
              />
            </div>
          </div>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
            Login
            <ArrowRight className="h-4 w-4" />
          </button>

          <button type="button" className="w-full text-center text-sm font-medium text-indigo-600 transition hover:text-indigo-700">
            Forgot Password
          </button>
        </form>
      </div>
    </div>
  );

  const renderMentorScreen = () => (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 md:py-8">
      {renderMentorStepIndicator()}
      {mentorStep === 1 && renderMentorStepOne()}
      {mentorStep === 2 && renderMentorStepTwo()}
      {mentorStep === 3 && renderMentorVerification()}
    </div>
  );

  return (
    <div className={isModal ? 'w-full' : 'min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8'}>
      <div className={isModal ? 'mx-auto w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)]' : 'mx-auto w-full max-w-5xl rounded-[30px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)]'}>
        {authChoice === 'choice' && renderChoiceScreen()}
        {authChoice === 'normal' && renderUserScreen()}
        {authChoice === 'mentor' && renderMentorScreen()}
        {authChoice === 'mentor-login' && renderMentorLogin()}
      </div>
    </div>
  );
};

export default Auth;