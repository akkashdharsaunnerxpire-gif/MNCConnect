import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  DollarSign,
  GraduationCap,
  Headphones,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserRound,
  Users,
  Video,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import Auth from "./Auth";

const mentors = [
  {
    name: "Ananya",
    role: "SDE II",
    company: "Zoho",
    rating: "4.9",
    sessions: "184",
    earned: "",
    expertise: "Backend • Java • System Design",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=85",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    name: "Arun",
    role: "SDE II",
    company: "Zoho",
    rating: "4.9",
    sessions: "184",
    earned: "",
    expertise: "Backend • Java • System Design",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=85",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    name: "Rahul",
    role: "Tech Lead",
    company: "TCS",
    rating: "4.9",
    sessions: "231",
    earned: "",
    expertise: "Interview Prep • Projects • Career",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=85",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    name: "Meera",
    role: "Software Engineer",
    company: "Amazon",
    rating: "5.0",
    sessions: "127",
    earned: "",
    expertise: "DSA • Mock Interviews • Resume",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=85",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Arjun",
    role: "Senior Engineer",
    company: "Google",
    rating: "4.9",
    sessions: "302",
    earned: "",
    expertise: "Frontend • React • Hiring Insights",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=85",
    gradient: "from-blue-500 to-indigo-500",
  },
];

const companies = ["ZOHO", "TCS", "WIPRO", "INFOSYS", "META", "AMAZON"];

const DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const features = [
  {
    icon: Video,
    number: "01",
    label: "REAL MNC CONNECTION",
    title: "1:1 Video With Working Professionals",
    text: "Connect directly with professionals who are currently working in the industry. Choose a MNC Employee based on your target company, role, skills and experience.",
    accent: "indigo",
  },
  {
    icon: Target,
    number: "02",
    label: "ROLE-SPECIFIC GUIDANCE",
    title: "Prepare For The Role You Want",
    text: "Learn how the role actually works, what interviewers expect, how to prepare, which projects matter and how to present yourself with confidence.",
    accent: "violet",
  },
  {
    icon: Rocket,
    number: "03",
    label: "OPPORTUNITIES",
    title: "Internships, Jobs & Referral Guidance",
    text: "Ask questions, stay connected and discover relevant internships, job openings and potential referral opportunities shared by  MNC Employee.",
    accent: "emerald",
  },
];

export default function Landing() {
  const [persona, setPersona] = useState("fresher");
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mentorIndex, setMentorIndex] = useState(0);
  const [mentorPaused, setMentorPaused] = useState(false);
  const mentorStartX = useRef(0);
  const mentorDragging = useRef(false);

  /*
   * AUTH MODAL SCROLL LOCK
   * ----------------------
   * When the login / signup popup opens:
   * - Lock the body so the landing page cannot scroll.
   * - Preserve the exact background scroll position.
   * - Restore it when the popup closes.
   * - Also compensate for the scrollbar width to avoid layout jumping.
   */
  useEffect(() => {
    if (!showAuthModal) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.paddingRight = previousBodyPaddingRight;

      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: "auto",
      });
    };
  }, [showAuthModal]);


  const [stats, setStats] = useState({
    sessions: 0,
    paid: 0,
    success: 0,
  });

  const heroRef = useRef(null);

  /* Dynamic HUD counters */
  useEffect(() => {
    const target = {
      sessions: 5000,
      paid: 50,
      success: 94,
    };

    const start = performance.now();
    const duration = 1800;
    let frame;

    const animate = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setStats({
        sessions: Math.floor(target.sessions * eased),
        paid: Math.floor(target.paid * eased),
        success: Math.floor(target.success * eased),
      });

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  /* Hero 3D parallax */
  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!heroRef.current) return;

      const rect = heroRef.current.getBoundingClientRect();

      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      heroRef.current.style.transform = `
        perspective(1400px)
        rotateX(${y * -5}deg)
        rotateY(${x * 7}deg)
        translateZ(0)
      `;
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const tiltCard = (event) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const rotateX = ((y / rect.height) - 0.5) * -9;
    const rotateY = ((x / rect.width) - 0.5) * 9;

    card.style.transform = `
      perspective(1100px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.025)
      translateZ(18px)
    `;
  };

  const resetTilt = (event) => {
    event.currentTarget.style.transform = `
      perspective(1100px)
      rotateX(0deg)
      rotateY(0deg)
      scale(1)
      translateZ(0)
    `;
  };

  const fresherMode = persona === "fresher";

  const nextMentor = () => setMentorIndex((value) => (value + 1) % mentors.length);
  const prevMentor = () => setMentorIndex((value) => (value - 1 + mentors.length) % mentors.length);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMentorIndex((value) => (value + 1) % mentors.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  const handleMentorPointerDown = (event) => {
    mentorDragging.current = true;
    mentorStartX.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleMentorPointerUp = (event) => {
    if (!mentorDragging.current) return;
    const distance = event.clientX - mentorStartX.current;
    if (Math.abs(distance) > 55) {
      distance < 0 ? nextMentor() : prevMentor();
    }
    mentorDragging.current = false;
  };

  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-900">
      <style>{`
        @keyframes authBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes authModalIn {
          from {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes floatBlock {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotateX(0deg);
          }
          25% {
            transform: translate3d(7px, -12px, 18px) rotateX(1deg);
          }
          50% {
            transform: translate3d(-5px, -22px, 30px) rotateX(-1deg);
          }
          75% {
            transform: translate3d(-9px, -8px, 14px) rotateX(1deg);
          }
        }

        @keyframes marqueeSlide {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow:
              0 20px 70px rgba(99, 102, 241, .08),
              0 0 0 rgba(99, 102, 241, 0);
          }
          50% {
            box-shadow:
              0 25px 90px rgba(99, 102, 241, .18),
              0 0 45px rgba(99, 102, 241, .12);
          }
        }

        @keyframes gridScan {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          15% {
            opacity: .35;
          }
          80% {
            opacity: .2;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        @keyframes particleUp {
          0% {
            transform: translateY(110vh) scale(.4);
            opacity: 0;
          }
          15% {
            opacity: .45;
          }
          80% {
            opacity: .2;
          }
          100% {
            transform: translateY(-20vh) scale(1);
            opacity: 0;
          }
        }

        @keyframes ringRotate {
          from {
            transform: translate(-50%, -50%) rotateX(68deg) rotateZ(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotateX(68deg) rotateZ(360deg);
          }
        }

        @keyframes ringRotateReverse {
          from {
            transform: translate(-50%, -50%) rotateY(66deg) rotateZ(360deg);
          }
          to {
            transform: translate(-50%, -50%) rotateY(66deg) rotateZ(0deg);
          }
        }

        @keyframes scanLine {
          0% {
            transform: translateX(-130%);
          }
          100% {
            transform: translateX(130%);
          }
        }

        @keyframes livePulse {
          0%, 100% {
            transform: scale(.92);
            opacity: .4;
          }
          50% {
            transform: scale(1.1);
            opacity: .85;
          }
        }

        @keyframes orbitDot {
          from {
            transform: rotate(0deg) translateX(175px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(175px) rotate(-360deg);
          }
        }

        .perspective {
          perspective: 1400px;
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        .float-block {
          animation: floatBlock 7s ease-in-out infinite;
        }

        .pulse-glow {
          animation: pulseGlow 4s ease-in-out infinite;
        }

        .marquee-track {
          animation: marqueeSlide 28s linear infinite;
        }

        .grid-scan {
          animation: gridScan 8s linear infinite;
        }

        .particle {
          animation: particleUp 12s linear infinite;
        }

        .ring-a {
          animation: ringRotate 20s linear infinite;
        }

        .ring-b {
          animation: ringRotateReverse 16s linear infinite;
        }

        .scan-line {
          animation: scanLine 3s ease-in-out infinite;
        }

        .live-pulse {
          animation: livePulse 3s ease-in-out infinite;
        }

        .orbit-dot {
          animation: orbitDot 8s linear infinite;
        }

        .cyber-grid {
          background-image:
            linear-gradient(rgba(226,232,240,.75) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226,232,240,.75) 1px, transparent 1px);
          background-size: 52px 52px;
        }

        .fine-grid {
          background-image:
            linear-gradient(rgba(226,232,240,.45) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226,232,240,.45) 1px, transparent 1px);
          background-size: 26px 26px;
        }

        .glass {
          background: rgba(255,255,255,.68);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        @keyframes premiumAurora {
          0%, 100% { transform: translate3d(-8%, -4%, 0) scale(1); opacity: .45; }
          50% { transform: translate3d(8%, 5%, 0) scale(1.12); opacity: .7; }
        }

        @keyframes premiumCardGlow {
          0%, 100% { opacity: .25; transform: translateX(-20%); }
          50% { opacity: .8; transform: translateX(220%); }
        }

        @keyframes premiumNoise {
          0%, 100% { transform: translate(0,0); }
          25% { transform: translate(1%, -1%); }
          50% { transform: translate(-1%, 1%); }
          75% { transform: translate(1%, 1%); }
        }

        .premium-feature-section {
          background:
            radial-gradient(circle at 15% 20%, rgba(99,102,241,.18), transparent 30%),
            radial-gradient(circle at 85% 75%, rgba(16,185,129,.12), transparent 32%),
            linear-gradient(135deg, #050816 0%, #0a1022 48%, #050b17 100%);
          color: #f8fafc;
        }

        .premium-feature-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(148,163,184,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.055) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
        }

        .premium-feature-section::after {
          content: "";
          position: absolute;
          width: 42rem;
          height: 42rem;
          left: -12rem;
          top: 10rem;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(99,102,241,.24), transparent 68%);
          filter: blur(18px);
          animation: premiumAurora 9s ease-in-out infinite;
          pointer-events: none;
        }

        .premium-feature-section .text-slate-900 {
          color: #f8fafc !important;
        }

        .premium-feature-section .text-slate-700 {
          color: rgba(226,232,240,.72) !important;
        }

        .premium-feature-section .text-slate-600 {
          color: rgba(226,232,240,.58) !important;
        }

        .feature-card-premium {
          isolation: isolate;
          background:
            linear-gradient(145deg, rgba(20,30,58,.94), rgba(8,15,31,.94));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.08),
            0 30px 80px rgba(0,0,0,.28),
            0 0 0 1px rgba(99,102,241,.03);
        }

        .feature-card-premium::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(120deg, rgba(129,140,248,.55), transparent 32%, transparent 65%, rgba(45,212,191,.4));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: .6;
        }

        .feature-card-premium::after {
          content: "";
          position: absolute;
          left: -40%;
          bottom: 0;
          width: 35%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #67e8f9, transparent);
          box-shadow: 0 0 22px rgba(34,211,238,.8);
          animation: premiumCardGlow 4.5s ease-in-out infinite;
          pointer-events: none;
        }

        .feature-card-premium:hover {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.12),
            0 40px 100px rgba(0,0,0,.42),
            0 0 45px rgba(99,102,241,.12);
        }

        .feature-card-premium .feature-icon-premium {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.12),
            0 0 28px rgba(99,102,241,.12);
        }

        .premium-feature-section .scan-line {
          background: linear-gradient(90deg, transparent, #67e8f9, #818cf8, transparent);
          box-shadow: 0 0 20px rgba(34,211,238,.7);
        }

        .premium-feature-section .fine-grid {
          opacity: .18 !important;
        }

        .mentor-carousel-stage {
          perspective: 1500px;
          transform-style: preserve-3d;
        }

        .mentor-carousel-stage > div[style] {
          transform-style: preserve-3d;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        @media (max-width: 900px) {
          .mentor-carousel-stage {
            height: 560px;
          }
        }

        @media (max-width: 640px) {
          .mentor-carousel-stage {
            height: 525px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .premium-feature-section::after,
          .feature-card-premium::after,
          .float-block,
          .marquee-track,
          .scan-line,
          .grid-scan,
          .particle,
          .ring-a,
          .ring-b,
          .orbit-dot,
          .live-pulse {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-white" />

      <div className="pointer-events-none fixed inset-0 z-0 cyber-grid opacity-55" />

      <div className="pointer-events-none fixed left-[-10%] top-[10%] z-0 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px]" />

      <div className="pointer-events-none fixed right-[-10%] top-[25%] z-0 h-[600px] w-[600px] rounded-full bg-emerald-400/10 blur-[150px]" />

      <div className="pointer-events-none fixed bottom-[-15%] left-[35%] z-0 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[140px]" />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="grid-scan absolute left-0 right-0 h-48 bg-gradient-to-b from-transparent via-indigo-400/10 to-transparent" />

        {[...Array(15)].map((_, i) => (
          <span
            key={i}
            className="particle absolute h-1 w-1 rounded-full bg-indigo-400/30"
            style={{
              left: `${(i * 17) % 100}%`,
              animationDelay: `${(i * 1.7) % 10}s`,
            }}
          />
        ))}
      </div>

      {/* NAVBAR */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-sm">
              <div className="absolute inset-1 rounded-lg border border-indigo-200/60" />
              <span className="relative font-black text-indigo-600">M</span>
            </div>

            <div>
              <div className="text-sm font-black tracking-[.26em]">
                MNC <span className="text-indigo-600">CONNECTS</span>
              </div>
              <div className="font-mono text-[7px] tracking-[.28em] text-slate-600">
                CONNECCTING FRESHER TO EMPLOYEE
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {[
              ["Mnc Connect", "section-0"],
              ["How It Works", "section-3"],
              ["For Freshers", "section-2"],
              ["For Professionals", "section-4"],
            ].map(([item, id]) => (
              <a
                key={item}
                href={`#${id}`}
                className="text-sm font-medium text-slate-700 transition hover:text-indigo-600"
              >
                {item}
              </a>
            )
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600" onClick={() => setShowAuthModal(true)}>
              Log in
            </button>

            <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-600" onClick={() => setShowAuthModal(true)}>
              Get Started
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-xl border border-slate-200 p-2.5 md:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-6 py-6 md:hidden">
            <div className="flex flex-col gap-5 text-sm font-semibold text-slate-600">
              <a href="#section-0">MNC connect</a>
              <a href="#section-3">How It Works</a>
              <a href="#section-2">For Freshers</a>
              <a href="#section-4">For Professionals</a>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-5 pb-24 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto grid min-h-[780px] max-w-[1500px] gap-10 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative z-20">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono text-[8px] font-bold tracking-[.25em] text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="live-pulse absolute inset-0 rounded-full bg-emerald-500" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              1:1 VIDEO MENTORSHIP // LIVE
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[.88] tracking-[-.065em] text-slate-900 sm:text-6xl md:text-7xl xl:text-[5.9rem]">
              CONNECT WITH
              <span className="block bg-gradient-to-r from-slate-900 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                MNC EMPLOYEES
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
              For Freshers: Find working MNC professionals who match your target role, connect with them 1:1 on video, learn how to crack interviews, ask career questions and discover internships, jobs and referral opportunities.<br />
              For MNC Employees: Share your real industry experience, guide the next generation and 
              <span className="font-bold text-emerald-600"> Earn up</span>{" "} 
               to in your spare time.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowAuthModal(true)}
                className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(79,70,229,.25)] transition hover:-translate-y-1 hover:shadow-[0_25px_55px_rgba(79,70,229,.32)]"
              >
                <GraduationCap size={18} />
                Find a Employee
                <span className="rounded-md bg-white/15 px-2 py-1 text-[8px]">
                  FRESHERS
                </span>
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </button>

              <button
                onClick={() => setShowAuthModal(true)}
                className="group flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-white px-7 py-4 text-sm font-bold text-slate-700 shadow-[0_12px_35px_rgba(15,23,42,.07)] transition hover:-translate-y-1 hover:border-emerald-300 hover:text-emerald-600"
              >
                <CircleDollarSign size={18} />
                Become a Paid Employee
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </button>
            </div>

            {/* HUD */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white/75 shadow-[0_20px_60px_rgba(15,23,42,.06)] backdrop-blur-xl">
              <div className="grid grid-cols-3">
                <HudStat
                  value={stats.sessions.toLocaleString()}
                  suffix="+"
                  label="ACTIVE SESSIONS"
                  icon={<Video size={13} />}
                />
                <HudStat
                  value={`₹${stats.paid}`}
                  suffix="L+"
                  label="PAID TO EMPLOYEE"
                  icon={<WalletCards size={13} />}
                />
                <HudStat
                  value={stats.success}
                  suffix="%"
                  label="EMPLOYEE MATCHING"
                  icon={<Target size={13} />}
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 font-mono text-[7px] tracking-[.22em] text-slate-600">
                <span>NETWORK STATUS: OPERATIONAL</span>
                <span className="flex items-center gap-2 text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* HERO VIDEO / 3D */}
          <div className="perspective relative flex min-h-[650px] justify-center">
            <div
              ref={heroRef}
              className="preserve-3d relative h-[560px] w-full max-w-[650px] transition-transform duration-200 ease-out"
            >
              {/* Ambient halo */}
              <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[90px]" />

              {/* Rings */}
              <div className="ring-a absolute left-1/2 top-1/2 h-[470px] w-[470px] rounded-full border border-indigo-300/40" />

              <div className="ring-b absolute left-1/2 top-1/2 h-[520px] w-[280px] rounded-[50%] border border-violet-300/40" />

              <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200/70" />

              {/* Main video window */}
              <div className="pulse-glow glass float-block absolute left-1/2 top-1/2 w-[min(92%,560px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/90 shadow-[0_35px_100px_rgba(15,23,42,.16)]">
                {/* Video header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Video size={15} />
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        LIVE MOCK INTERVIEW
                      </div>
                      <div className="font-mono text-[7px] tracking-[.16em] text-slate-600">
                        SECURE VIDEO ROOM // #MX-28491
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[7px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    LIVE
                  </div>
                </div>

                {/* Video */}
                <div className="relative grid aspect-[16/9] grid-cols-2 gap-2 bg-slate-900 p-2">
                  <VideoPerson
                    image={mentors[0].image}
                    videoSrc={DEMO_VIDEO_URL}
                    name="Ananya"
                    role="Mentor • Zoho SDE II"
                    mentor
                  />

                  <VideoPerson
                    image="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=900&q=85"
                    name="You"
                    role="Candidate • Final Year"
                  />

                  {/* Connection center */}
                  <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-xl">
                    <Zap size={15} />
                  </div>

                  {/* Audio bars */}
                  <div className="absolute bottom-3 left-3 flex items-end gap-0.5">
                    {[3, 6, 10, 5, 8].map((height, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-emerald-400"
                        style={{ height }}
                      />
                    ))}
                  </div>

                  <div className="absolute bottom-3 right-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[7px] text-white backdrop-blur">
                    00:42:18
                  </div>
                </div>

                {/* Video controls */}
                <div className="flex items-center justify-between bg-white px-5 py-4">
                  <div className="flex gap-2">
                    {["MUTE", "CAM", "CHAT"].map((label) => (
                      <span
                        key={label}
                        className="rounded-md bg-slate-50 px-2 py-1 font-mono text-[7px] text-slate-600"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setVideoOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[9px] font-bold text-white transition hover:bg-indigo-700"
                  >
                    <Play size={11} fill="currentColor" />
                    ENTER SESSION
                  </button>
                </div>
              </div>

              {/* Floating profile cards */}
              <MentorFloatCard
                mentor={mentors[1]}
                className="-left-2 top-10"
                delay="0s"
              />

              <MentorFloatCard
                mentor={mentors[2]}
                className="-right-3 bottom-20"
                delay="1.2s"
              />

              {/* Earnings badge */}
              <div className="float-block absolute -bottom-2 left-[16%] rounded-2xl border border-emerald-200 bg-white/85 px-4 py-3 shadow-[0_15px_45px_rgba(16,185,129,.12)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign size={17} />
                  </div>

                  <div>
                    <div className="font-mono text-[7px] tracking-[.15em] text-slate-600">
                      MENTOR EARNINGS
                    </div>
                    <div className="mt-0.5 text-sm font-black text-emerald-600">
                      ₹2,500 / HR
                    </div>
                  </div>
                </div>
              </div>

              {/* Orbit dot */}
              <div className="absolute left-1/2 top-1/2">
                <div className="orbit-dot h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,.8)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company marquee */}
      <section className="relative z-10 overflow-hidden border-y border-slate-200 bg-slate-50/70 py-8">
        <div className="mb-5 text-center font-mono text-[8px] font-bold tracking-[.3em] text-slate-600">
          LEARN FROM PEOPLE WHO WORK HERE
        </div>

        <div className="overflow-hidden">
          <div className="marquee-track flex w-max items-center">
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company}-${index}`}
                className="mx-10 flex items-center gap-3 text-xl font-black tracking-[-.04em] text-slate-500 sm:mx-14 sm:text-2xl"
              >
                <span className="h-2 w-2 rounded-full bg-indigo-300" />
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONA SWITCHER */}
      <section id="section-2" className="relative z-10 px-5 py-28 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-[8px] tracking-[.25em] text-slate-600 shadow-sm">
              <Users size={12} className="text-indigo-500" />
              CHOOSE YOUR PATH
            </div>

            <h2 className="text-5xl font-black tracking-[-.06em] text-slate-900 sm:text-6xl">
              ONE PLATFORM.
              <span className="block bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                TWO POWERFUL ROLES.
              </span>
            </h2>

            <p className="mt-6 text-base leading-7 text-slate-700">
              Freshers get direct access to working professionals. MNC employees turn their
              experience into meaningful mentorship and paid sessions.
            </p>
          </div>

          {/* Toggle */}
          <div className="mx-auto mt-10 flex w-fit rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-sm">
            <button
              onClick={() => setPersona("fresher")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${fresherMode
                ? "bg-white text-indigo-600 shadow-md"
                : "text-slate-600"
                }`}
            >
              <GraduationCap size={17} />
              I am a Fresher
            </button>

            <button
              onClick={() => setPersona("mentor")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${!fresherMode
                ? "bg-white text-emerald-600 shadow-md"
                : "text-slate-600"
                }`}
            >
              <Award size={17} />
              I am an MNC Employee
            </button>
          </div>

          {/* Dynamic persona panel */}
          <div className="perspective mt-14">
            <div
              className={`preserve-3d overflow-hidden rounded-[32px] border p-8 shadow-[0_30px_100px_rgba(15,23,42,.08)] transition-all duration-500 md:p-12 ${fresherMode
                ? "border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60"
                : "border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60"
                }`}
            >
              <div className="grid items-center gap-12 lg:grid-cols-[1fr_.8fr]">
                <div>
                  <div
                    className={`font-mono text-[8px] font-bold tracking-[.3em] ${fresherMode ? "text-indigo-500" : "text-emerald-600"
                      }`}
                  >
                    {fresherMode
                      ? "FRESHER CAREER ENGINE"
                      : "MENTOR EARNING ENGINE"}
                  </div>

                  <h3 className="mt-5 text-4xl font-black tracking-[-.05em] text-slate-900 sm:text-5xl">
                    {fresherMode
                      ? "Go from target role to real MNC guidance."
                      : "Turn your MNC experience into mentorship."}
                  </h3>

                  <p className="mt-6 max-w-xl text-base leading-7 text-slate-700">
                    {fresherMode
                      ? "Choose professionals who match your target role and company. Connect on video, ask questions, learn interview strategies, get feedback and stay connected for future opportunities."
                      : "Register as a working professional, choose your availability and share your experience through focused 1:1 sessions — while earning from your expertise."}
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {(fresherMode
                      ? [
                        "Role & company matched mentors",
                        "Interview & mock interview guidance",
                        "Internship & job opportunity insights",
                        "Referral & career guidance",
                        "Ask questions & stay connected",
                      ]
                      : [
                        "Register as a working MNC professional",
                        "Choose your availability",
                        "Share real industry experience",
                        "Mentor freshers in your expertise",
                        "Earn from 1:1 sessions",
                      ]
                    ).map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-xl border border-white bg-white/75 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"
                      >
                        <CheckCircle2
                          size={15}
                          className={
                            fresherMode
                              ? "text-indigo-500"
                              : "text-emerald-500"
                          }
                        />
                        {item}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowAuthModal(true)}
                    className={`mt-9 inline-flex items-center gap-3 rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-1 ${fresherMode
                      ? "bg-indigo-600 shadow-indigo-200"
                      : "bg-emerald-600 shadow-emerald-200"
                      }`}
                  >
                    {fresherMode ? "Explore MNC Working Employees" : "Start Earning"}
                  </button>
                </div>

                <div className="relative flex min-h-[330px] items-center justify-center">
                  <div
                    className={`absolute h-64 w-64 rounded-full blur-[70px] ${fresherMode ? "bg-indigo-300/30" : "bg-emerald-300/30"
                      }`}
                  />

                  <div className="float-block relative w-full max-w-sm rounded-3xl border border-white bg-white/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,.1)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] tracking-[.2em] text-slate-600">
                        {fresherMode ? "CAREER TELEMETRY" : "EARNING TELEMETRY"}
                      </span>

                      <span
                        className={`h-2 w-2 rounded-full ${fresherMode ? "bg-indigo-500" : "bg-emerald-500"
                          }`}
                      />
                    </div>

                    <div className="mt-7 flex items-end gap-3">
                      <div
                        className={`text-5xl font-black ${fresherMode
                          ? "text-indigo-600"
                          : "text-emerald-600"
                          }`}
                      >
                        {fresherMode ? "1:1" : "₹3K"}
                      </div>

                      <div className="pb-2 font-mono text-[8px] tracking-[.15em] text-slate-600">
                        {fresherMode
                          ? "VIDEO MENTORSHIP"
                          : "MAX / SESSION HOUR"}
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      <TelemetryBar
                        label={
                          fresherMode ? "Role match" : "Profile strength"
                        }
                        value={fresherMode ? "92%" : "96%"}
                        width={fresherMode ? "92%" : "96%"}
                        emerald={!fresherMode}
                      />

                      <TelemetryBar
                        label={
                          fresherMode ? "Interview guidance" : "Availability"
                        }
                        value={fresherMode ? "90%" : "72%"}
                        width={fresherMode ? "90%" : "72%"}
                        emerald={!fresherMode}
                      />

                      <TelemetryBar
                        label={
                          fresherMode ? "Opportunity access" : "Session demand"
                        }
                        value={fresherMode ? "84%" : "89%"}
                        width={fresherMode ? "84%" : "89%"}
                        emerald={!fresherMode}
                      />
                    </div>

                    <div className="mt-7 rounded-xl bg-slate-50 px-4 py-3 font-mono text-[8px] tracking-[.12em] text-slate-600">
                      STATUS:{" "}
                      <span
                        className={
                          fresherMode ? "text-indigo-600" : "text-emerald-600"
                        }
                      >
                        {fresherMode
                          ? "READY FOR INTERVIEW"
                          : "ACCEPTING SESSIONS"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="section-1"
        className="premium-feature-section relative z-10 overflow-hidden border-y border-slate-800 px-5 py-28 sm:px-8 lg:px-12"
      >
        <div className="absolute inset-0 fine-grid opacity-50" />

        <div className="relative mx-auto max-w-[1450px]">
          <SectionHeading
            eyebrow="THE PLATFORM"
            number="01"
            title="BUILT FOR"
            gradient="REAL CONNECTION."
            description="Not another course library. A live career network where freshers can connect with working MNC professionals for role-specific guidance, interview preparation and opportunity insights."
          />

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  onMouseMove={tiltCard}
                  onMouseLeave={resetTilt}
                  className={`feature-card-premium preserve-3d group relative min-h-[410px] overflow-hidden rounded-[28px] border p-8 backdrop-blur-xl transition-transform duration-200 ${feature.accent === "emerald"
                    ? "border-emerald-400/25"
                    : feature.accent === "violet"
                      ? "border-violet-400/20"
                      : "border-indigo-400/20"
                    }`}
                >
                  <div
                    className={`absolute -right-20 -top-20 h-48 w-48 rounded-full blur-[70px] ${feature.accent === "emerald"
                      ? "bg-emerald-400/10"
                      : feature.accent === "violet"
                        ? "bg-violet-400/10"
                        : "bg-indigo-400/10"
                      }`}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div
                        className={`feature-icon-premium flex h-14 w-14 items-center justify-center rounded-2xl ${feature.accent === "emerald"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : feature.accent === "violet"
                            ? "bg-violet-400/10 text-violet-300"
                            : "bg-indigo-400/10 text-indigo-300"
                          }`}
                      >
                        <Icon size={24} />
                      </div>

                      <span className="text-5xl font-black tracking-[-.08em] text-white/10">
                        {feature.number}
                      </span>
                    </div>

                    <div className="mt-20 font-mono text-[14px] font-bold tracking-[.25em] text-white/55">
                      {feature.label}
                    </div>

                    <h3 className="mt-3 text-2xl font-black tracking-[-.04em] text-white">
                      {feature.title}
                    </h3>

                    <p className="mt-4 text-sm leading-6 text-white/65">
                      {feature.text}
                    </p>

                    <div className="mt-7 flex items-center gap-2 text-xs font-bold text-cyan-300">
                      Learn more
                      <ArrowRight
                        size={14}
                        className="transition group-hover:translate-x-1"
                      />
                    </div>
                  </div>

                  <div className="scan-line absolute bottom-0 left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* MENTOR SPOTLIGHT — 3D AUTO CAROUSEL */}
      <section
        id="section-0"
        className="relative z-10 overflow-hidden px-5 py-28 sm:px-8 lg:px-12"
        onMouseEnter={() => setMentorPaused(true)}
        onMouseLeave={() => setMentorPaused(false)}
      >
        <div className="mx-auto max-w-[1500px]">
          <SectionHeading
            eyebrow="MENTOR NETWORK"
            number="02"
            title="CONNECT WITH"
            gradient="MNC EMPLOYEES WHO WORK THERE."
            description="Meet verified working professionals from leading mnc companies. Pick Employees based on your target company, role and expertise, then connect with them directly through 1:1 video sessions."
          />

          <div
            className="mentor-carousel-stage relative mx-auto mt-14 h-[610px] max-w-[1400px] touch-pan-y select-none"
            onPointerDown={handleMentorPointerDown}
            onPointerUp={handleMentorPointerUp}
            onPointerCancel={() => { mentorDragging.current = false; }}
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[850px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-indigo-200/60 [transform:translate(-50%,-50%)_rotateX(67deg)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[330px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-violet-200/50 [transform:translate(-50%,-50%)_rotateX(67deg)]" />
            <div className="pointer-events-none absolute left-1/2 top-[72%] h-28 w-[70%] -translate-x-1/2 rounded-[50%] bg-indigo-500/10 blur-3xl" />

            {mentors.map((mentor, index) => {
              let offset = index - mentorIndex;
              if (offset > mentors.length / 2) offset -= mentors.length;
              if (offset < -mentors.length / 2) offset += mentors.length;

              const abs = Math.abs(offset);
              const x = offset * 305;
              const z = abs === 0 ? 100 : abs === 1 ? -45 : -190;
              const rotateY = offset === 0 ? 0 : offset > 0 ? -34 : 34;
              const scale = abs === 0 ? 1 : abs === 1 ? 0.82 : 0.64;
              const opacity = abs === 0 ? 1 : abs === 1 ? 0.78 : 0.2;

              return (
                <div
                  key={mentor.name}
                  onClick={() => setMentorIndex(index)}
                  className={`absolute left-1/2 top-1/2 h-[400px] w-[300px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_35px_100px_rgba(15,23,42,.20)] transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${abs > 2 ? "pointer-events-none" : "cursor-pointer"}`}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                    opacity,
                    zIndex: 30 - abs,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="relative h-[270px] overflow-hidden bg-slate-100">
                    <img
                      src={mentor.image}
                      alt={`${mentor.name} - ${mentor.role} at ${mentor.company}`}
                      draggable="false"
                      className="h-full w-full object-cover transition duration-700"
                    />
                    <div className={`absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t ${mentor.gradient} opacity-30`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                    <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 font-mono text-[7px] font-bold tracking-[.16em] text-slate-700 backdrop-blur-xl">
                      ✓ VERIFIED MENTOR
                    </div>

                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="text-2xl font-black tracking-tight text-white drop-shadow-lg">{mentor.name}</div>
                      <div className="mt-1 text-xs font-semibold text-white/85">{mentor.role} • {mentor.company}</div>
                      <div className="mt-1 text-[9px] text-white/70">{mentor.expertise}</div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                        <Star size={13} fill="currentColor" />
                        {mentor.rating}
                      </span>
                      <span className="font-mono text-[8px] font-bold text-slate-500">
                        {mentor.sessions} SESSIONS
                      </span>
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <div className="font-mono text-[7px] tracking-[.18em] text-slate-500">SESSION RATE</div>
                        <div className="mt-1 text-2xl font-black text-emerald-600">{mentor.earned}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setMentorIndex(index); }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
                        aria-label={`View ${mentor.name}`}
                      >
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="-mt-3 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              {mentors.map((mentor, index) => (
                <button
                  key={mentor.name}
                  type="button"
                  onClick={() => setMentorIndex(index)}
                  aria-label={`Show ${mentor.name}`}
                  className={`h-2 rounded-full transition-all duration-500 ${mentorIndex === index ? "w-9 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="section-3"
        className="relative z-10 border-y border-slate-200 bg-slate-50/70 px-5 py-28 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-[1400px]">
          <SectionHeading
            eyebrow="HOW IT WORKS"
            number="03"
            title="FROM TARGET ROLE"
            gradient="TO REAL OPPORTUNITIES."
            description="Find the right working professional, learn directly from their experience, prepare for your target role and stay connected to opportunities that can move your career forward."
          />

          <div className="mt-16 grid gap-0 md:grid-cols-5">
            {[
              {
                n: "01",
                icon: Search,
                title: "FIND",
                text: "Select your target role and discover working professionals who match your company, skills and career goals.",
              },
              {
                n: "02",
                icon: CalendarDays,
                title: "BOOK",
                text: "Choose a convenient slot and book a focused 1:1 video session with your selected MNC Employee.",
              },
              {
                n: "03",
                icon: Video,
                title: "CONNECT",
                text: "Meet your MNC Employee on video. Ask doubts, understand the role and learn how the industry really works.",
              },
              {
                n: "04",
                icon: Target,
                title: "PREPARE",
                text: "Get interview strategies, mock interview feedback, project guidance and practical next steps.",
              },
              {
                n: "05",
                icon: Rocket,
                title: "DISCOVER",
                text: "Stay connected for relevant internships, job openings, updates and potential referral opportunities.",
              },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.n}
                  className="group relative border-l border-slate-200 p-8 first:border-l-0"
                >
                  <div className="absolute left-0 top-0 h-0.5 w-0 bg-indigo-500 transition-all duration-500 group-hover:w-full" />

                  <div className="flex items-center justify-between">
                    <span className="text-5xl font-black text-slate-200 transition group-hover:text-indigo-100">
                      {item.n}
                    </span>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                      <Icon size={19} />
                    </div>
                  </div>

                  <h3 className="mt-14 font-mono text-sm font-bold tracking-[.3em] text-slate-900">
                    {item.title}
                  </h3>

                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    {item.text}
                  </p>

                  {index < 3 && (
                    <ChevronRight
                      size={16}
                      className="absolute right-[-8px] top-1/2 hidden -translate-y-1/2 text-indigo-300 md:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROFESSIONALS ANCHOR */}
      <div id="section-4" className="relative z-10 h-0 scroll-mt-24" aria-hidden="true" />

      {/* FINAL CTA */}
      <section className="relative z-10 overflow-hidden px-5 py-32 sm:px-8 lg:px-12">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[130px]" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 font-mono text-[8px] font-bold tracking-[.3em] text-indigo-600">
            <Sparkles size={12} />
            YOUR NEXT MNC CONNECTION COULD CHANGE EVERYTHING
          </div>

          <h2 className="text-5xl font-black leading-[.9] tracking-[-.065em] text-slate-900 sm:text-7xl lg:text-8xl">
            DON'T JUST
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">
              PREPARE.
            </span>
            <span className="block">CONNECT WITH INDUSTRY.</span>
          </h2>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-700">
            One relevant MNC Employee. One focused video session. Real guidance for the role
            and company you want.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="group flex items-center justify-center gap-3 rounded-xl bg-indigo-600 px-8 py-4 text-sm font-bold text-white shadow-[0_20px_50px_rgba(79,70,229,.25)] transition hover:-translate-y-1 hover:bg-indigo-700"
            >
              <GraduationCap size={18} />
              Find a MNC Employee
              in  M-N-C Connects
            </button>

            <button
              className="group flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-white px-8 py-4 text-sm font-bold text-emerald-600 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <DollarSign size={18} />
              Start Earning as a MNC Employee
              in  M-N-C Connects
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-200 bg-slate-50 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black tracking-[.28em]">
              MNC<span className="text-indigo-600">CONNECTS</span>
            </div>

            <div className="mt-2 font-mono text-[7px] tracking-[.3em] text-slate-600">
              CONNECT • LEARN • EARN • GROW
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-medium text-slate-600">
            <span>Mentors(Employees)</span>
            <span>Freshers</span>
            <span>Sessions</span>
            <span>Privacy</span>
            <span>© 2026 MNC CONNECTS</span>
          </div>
        </div>
      </footer>

      {/* VIDEO MODAL */}
      {videoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-xl">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-slate-950 shadow-2xl">
            <button
              onClick={() => setVideoOpen(false)}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20"
            >
              <X size={18} />
            </button>

            <div className="grid aspect-video grid-cols-2 gap-2 bg-slate-950 p-3">
              <VideoPerson
                image={mentors[0].image}
                videoSrc={DEMO_VIDEO_URL}
                name="Ananya"
                role="Mentor • Zoho SDE II"
                mentor
              />

              <VideoPerson
                image="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=85"
                name="Candidate"
                role="Final Year • Computer Science"
              />

              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                LIVE SESSION PREVIEW
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal - Smooth / Scroll Locked */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
          style={{
            overscrollBehavior: "contain",
            animation: "authBackdropIn 180ms ease-out both",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_35px_100px_rgba(15,23,42,.22)]"
            style={{
              overscrollBehavior: "contain",
              willChange: "transform, opacity",
              animation: "authModalIn 220ms cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <button
              onClick={() => setShowAuthModal(false)}
              aria-label="Close authentication"
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-400 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:text-slate-900"
            >
              <X size={18} />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <Auth closeModal={() => setShowAuthModal(false)} isModal={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Components ---------------- */

function HudStat({ value, suffix, label, icon }) {
  return (
    <div className="border-r border-slate-200 p-4 last:border-r-0 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-indigo-500">{icon}</span>
        <span className="font-mono text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
          {value}
          <span className="text-indigo-600">{suffix}</span>
        </span>
      </div>

      <div className="mt-1 font-mono text-[7px] tracking-[.15em] text-slate-600 sm:text-[8px]">
        {label}
      </div>
    </div>
  );
}

function VideoPerson({ image, videoSrc, name, role, mentor = false }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-slate-800">
      {videoSrc ? (
        <video
          className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105"
          src={videoSrc}
          poster={image}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`${name} live video preview`}
        />
      ) : (
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/10" />

      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2 py-1 font-mono text-[6px] font-bold tracking-wider text-white/90 backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        LIVE
      </div>

      <div className="absolute bottom-3 left-3">
        <div className="text-[10px] font-bold text-white">{name}</div>
        <div className="mt-0.5 text-[7px] text-white/65">{role}</div>
      </div>

      {mentor && (
        <div className="absolute right-3 top-3 rounded-md bg-indigo-600/90 px-2 py-1 font-mono text-[6px] font-bold tracking-wider text-white shadow-[0_0_18px_rgba(99,102,241,.45)]">
          MENTOR
        </div>
      )}
    </div>
  );
}

function MentorFloatCard({ mentor, className, delay }) {
  return (
    <div
      className={`float-block absolute z-30 w-[190px] rounded-2xl border border-white/90 bg-white/85 p-3 shadow-[0_20px_50px_rgba(15,23,42,.12)] backdrop-blur-xl ${className}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex gap-3">
        <img
          src={mentor.image}
          alt={mentor.name}
          className="h-12 w-12 rounded-xl object-cover"
        />

        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-800">
            {mentor.name}
          </div>

          <div className="mt-0.5 text-[8px] text-slate-600">
            {mentor.role}
          </div>

          <div className="mt-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[7px] font-bold text-indigo-600">
            {mentor.company}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="flex items-center gap-1 text-[8px] font-bold text-amber-500">
          <Star size={9} fill="currentColor" />
          {mentor.rating}
        </span>

        <span className="font-mono text-[8px] font-bold text-emerald-600">
          {mentor.earned}
        </span>
      </div>
    </div>
  );
}

function TelemetryBar({ label, value, width, emerald = false }) {
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[7px] tracking-[.12em] text-slate-600">
        <span>{label}</span>
        <span className={emerald ? "text-emerald-600" : "text-indigo-600"}>
          {value}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${emerald
            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
            : "bg-gradient-to-r from-indigo-400 to-violet-600"
            }`}
          style={{ width }}
        />
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  number,
  title,
  gradient,
  description,
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.9fr] lg:items-end">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[9px] font-bold tracking-[.3em] text-indigo-500">
            {number}
          </span>

          <span className="h-px w-14 bg-indigo-200" />

          <span className="font-mono text-[8px] tracking-[.28em] text-slate-600">
            {eyebrow}
          </span>
        </div>

        <h2 className="text-5xl font-black leading-[.9] tracking-[-.06em] text-slate-900 sm:text-6xl lg:text-7xl">
          {title}
          <span className="block bg-gradient-to-r from-slate-900 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            {gradient}
          </span>
        </h2>
      </div>

      <p className="max-w-xl text-base leading-7 text-slate-700 lg:justify-self-end lg:text-lg">
        {description}
      </p>
    </div>
  );
}