import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Users,
  BriefcaseBusiness,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

const paths = [
  {
    key: "fresher",
    to: "/login",
    step: "PATH 01",
    title: "Fresher",
    text: "Login to your account or create a new fresher account.",
    perks: [
      "Find MNC employees by role & company",
      "1:1 video sessions",
      "Interview & referral guidance",
    ],
    icon: Users,
    tone: {
      solid: "bg-indigo-600",
      text: "text-indigo-600",
      check: "text-indigo-500",
      hoverBorder: "hover:border-indigo-300 focus-visible:border-indigo-400",
      glow: "99,102,241",
    },
  },
  {
    key: "employee",
    to: "/employee-profile",
    step: "PATH 02",
    title: "MNC Employee",
    text: "Create your professional profile and submit employment proof.",
    perks: [
      "Verified mentor profile",
      "Set your own availability",
      "Earn from 1:1 sessions",
    ],
    icon: BriefcaseBusiness,
    tone: {
      solid: "bg-emerald-600",
      text: "text-emerald-600",
      check: "text-emerald-500",
      hoverBorder: "hover:border-emerald-300 focus-visible:border-emerald-400",
      glow: "16,185,129",
    },
  },
];

/* Tilt + spotlight card. Mouse only, so phones pay nothing for it. */
function PathCard({ path, index, onChoose }) {
  const ref = useRef(null);
  const raf = useRef(0);
  const Icon = path.icon;

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onMove = (event) => {
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 7).toFixed(2)}deg) translateY(-4px)`;
      el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onChoose(path.to)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`auth-card auth-in group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left outline-none ${path.tone.hoverBorder}`}
      style={{
        animationDelay: `${180 + index * 110}ms`,
        "--glow": path.tone.glow,
      }}
    >
      <span className="auth-spot" aria-hidden="true" />

      <div className="relative flex items-center justify-between">
        <div
          className={`auth-icon flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${path.tone.solid}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <ChevronRight className="auth-arrow h-5 w-5 text-slate-400" />
      </div>

      <p className={`relative mt-4 text-xs font-bold ${path.tone.text}`}>
        {path.step}
      </p>

      <h3 className="relative mt-1 text-2xl font-black text-slate-950">
        {path.title}
      </h3>

      <p className="relative mt-1.5 text-sm leading-6 text-slate-600">
        {path.text}
      </p>

      <ul className="relative mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        {path.perks.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2 text-xs font-medium text-slate-600"
          >
            <CheckCircle2
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${path.tone.check}`}
            />
            {perk}
          </li>
        ))}
      </ul>

      <span
        className={`relative mt-4 inline-flex items-center gap-1 text-xs font-bold ${path.tone.text}`}
      >
        Continue
        <ChevronRight className="auth-cta-arrow h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export default function Auth({ closeModal }) {
  const navigate = useNavigate();

  const choose = (to) => {
    if (typeof closeModal === "function") closeModal();
    navigate(to);
  };

  return (
    <div className="auth-root w-full overflow-x-hidden bg-white px-5 py-5 sm:px-8 sm:py-6">
      <style>{AUTH_CSS}</style>

      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="auth-in auth-badge relative mx-auto flex h-14 w-14 items-center justify-center">
            <span className="auth-halo" aria-hidden="true" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <p
            className="auth-in mt-3 text-xs font-bold uppercase tracking-widest text-indigo-600"
            style={{ animationDelay: "60ms" }}
          >
            MNC CONNECT
          </p>

          <h2
            className="auth-in mt-1.5 text-3xl font-black text-slate-950"
            style={{ animationDelay: "100ms" }}
          >
            Choose your path
          </h2>

          <p
            className="auth-in mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500"
            style={{ animationDelay: "140ms" }}
          >
            Freshers connect with industry. MNC employees build professional
            influence.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {paths.map((path, index) => (
            <PathCard
              key={path.key}
              path={path}
              index={index}
              onChoose={choose}
            />
          ))}
        </div>

        <div
          className="auth-in mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4"
          style={{ animationDelay: "420ms" }}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold tracking-widest text-slate-400">
            SECURE ENTRY
          </span>
        </div>
      </div>
    </div>
  );
}

/* Only transform + opacity are animated. Heavy effects are off on phones. */
const AUTH_CSS = `
/* Hide the ugly scrollbar on whatever modal wrapper holds this screen.
   The wrapper can still scroll with wheel / touch on very small screens. */
:has(> .auth-root) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
:has(> .auth-root)::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

@keyframes authIn {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to { opacity: 1; transform: none; }
}
.auth-in { opacity: 0; animation: authIn .55s cubic-bezier(.22,1,.36,1) forwards; }

@keyframes authHalo {
  0%, 100% { transform: scale(.9); opacity: .25; }
  50% { transform: scale(1.35); opacity: .55; }
}
.auth-halo {
  position: absolute; inset: 0; border-radius: 18px; background: rgba(99,102,241,.35);
  animation: authHalo 3.2s ease-in-out infinite;
}

.auth-card {
  transform-style: preserve-3d;
  transition: transform .2s ease-out, border-color .2s, box-shadow .25s;
}
.auth-card:hover, .auth-card:focus-visible {
  box-shadow: 0 24px 50px rgba(var(--glow), .18);
}
.auth-card:active { transform: scale(.985) !important; }

.auth-spot {
  position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .25s;
  background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(var(--glow), .13), transparent 60%);
}
.auth-card:hover .auth-spot { opacity: 1; }

.auth-icon { transition: transform .3s cubic-bezier(.22,1,.36,1); }
.auth-card:hover .auth-icon, .auth-card:focus-visible .auth-icon { transform: scale(1.1) rotate(-6deg); }

.auth-arrow { transition: transform .25s, color .25s; }
.auth-card:hover .auth-arrow, .auth-card:focus-visible .auth-arrow { transform: translateX(4px); color: rgb(var(--glow)); }

.auth-cta-arrow { transition: transform .25s; }
.auth-card:hover .auth-cta-arrow { transform: translateX(4px); }

@media (max-width: 768px) {
  .auth-halo { animation: none; opacity: .3; }
  .auth-spot { display: none; }
  .auth-card { transition: border-color .2s; }
  .auth-card:hover .auth-icon { transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .auth-in { opacity: 1; animation: none; }
  .auth-halo { animation: none; }
  .auth-card, .auth-icon, .auth-arrow, .auth-cta-arrow { transition: none; }
}
`;