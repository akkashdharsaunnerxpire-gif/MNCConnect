import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DollarSign,
  GraduationCap,
  Menu,
  Play,
  Rocket,
  Search,
  Sparkles,
  Star,
  Target,
  Users,
  Video,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import Auth from "../Authpage/Auth";
import { useNavigate } from "react-router-dom";

/* ==========================================================
   DATA
   ========================================================== */
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
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
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
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80",
    gradient: "from-sky-500 to-indigo-500",
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
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80",
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
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80",
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
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80",
    gradient: "from-blue-500 to-indigo-500",
  },
];

const companies = ["ZOHO", "TCS", "WIPRO", "INFOSYS", "META", "AMAZON"];

const DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const CANDIDATE_IMAGE =
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=700&q=80";

/* Hero role picker: choosing a role changes the matched mentor */
const heroRoles = [
  { key: "backend", label: "Backend", mentor: 0, match: 96 },
  { key: "frontend", label: "Frontend", mentor: 4, match: 94 },
  { key: "dsa", label: "DSA & Interviews", mentor: 3, match: 97 },
  { key: "career", label: "Career & Projects", mentor: 2, match: 92 },
];

const notifications = [
  "Ananya accepted your session request",
  "Session booked for tomorrow, 7:00 PM",
  "New referral tip unlocked",
  "Mock interview feedback is ready",
];

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
    text: "Ask questions, stay connected and discover relevant internships, job openings and potential referral opportunities shared by MNC Employees.",
    accent: "emerald",
  },
];

const steps = [
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
];

/* ==========================================================
   HELPERS / HOOKS  (all cheap: transform + opacity only)
   ========================================================== */

/* One shared observer for every Reveal on the page */
let sharedIO = null;
const ioCallbacks = new WeakMap();

function observeOnce(el, callback) {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }

  if (!sharedIO) {
    sharedIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const fn = ioCallbacks.get(entry.target);
          if (fn) fn();
          ioCallbacks.delete(entry.target);
          sharedIO.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
  }

  ioCallbacks.set(el, callback);
  sharedIO.observe(el);

  return () => {
    ioCallbacks.delete(el);
    sharedIO && sharedIO.unobserve(el);
  };
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [query]);

  return matches;
}

function useInView(ref, { threshold = 0.15 } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  return inView;
}

function useCountUp(target, active, duration = 1600) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();

    const tick = (time) => {
      const p = Math.min((time - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return value;
}

/* ==========================================================
   MAIN PAGE
   ========================================================== */
export default function Landing() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [persona, setPersona] = useState("fresher");
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [heroRole, setHeroRole] = useState(0);
  const [notifIndex, setNotifIndex] = useState(0);

  const [mentorIndex, setMentorIndex] = useState(0);
  const [mentorPaused, setMentorPaused] = useState(false);

  const progressRef = useRef(null);
  const heroZoneRef = useRef(null);
  const stageRef = useRef(null);
  const parallaxRaf = useRef(0);

  const mentorSectionRef = useRef(null);
  const mentorStageRef = useRef(null);
  const dragStartX = useRef(0);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const dragRaf = useRef(0);

  const heroInView = useInView(heroZoneRef, { threshold: 0.1 });
  const mentorVisible = useInView(mentorSectionRef, { threshold: 0.15 });

  const fresherMode = persona === "fresher";
  const activeRole = heroRoles[heroRole];
  const heroMentor = mentors[activeRole.mentor];

  /* ---------- scroll progress + navbar state (one passive listener) ---------- */
  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }

      const isScrolled = window.scrollY > 12;
      setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- auth modal scroll lock (unchanged behaviour) ---------- */
  useEffect(() => {
    if (!showAuthModal) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.paddingRight = prev.paddingRight;
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [showAuthModal]);

  /* ---------- Escape closes modals / menu ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setShowAuthModal(false);
      setVideoOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- rotating live notification (only while hero is visible) ---------- */
  useEffect(() => {
    if (!heroInView || reduceMotion) return;
    const timer = window.setInterval(
      () => setNotifIndex((v) => (v + 1) % notifications.length),
      3400
    );
    return () => window.clearInterval(timer);
  }, [heroInView, reduceMotion]);

  /* ---------- hero 3D pointer parallax (mouse only, writes CSS vars) ---------- */
  const onHeroMove = (event) => {
    if (isMobile || reduceMotion || event.pointerType !== "mouse") return;
    const zone = heroZoneRef.current;
    if (!zone) return;

    const rect = zone.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(parallaxRaf.current);
    parallaxRaf.current = requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.style.setProperty("--px", x.toFixed(3));
      stage.style.setProperty("--py", y.toFixed(3));
    });
  };

  const onHeroLeave = () => {
    cancelAnimationFrame(parallaxRaf.current);
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--px", "0");
    stage.style.setProperty("--py", "0");
  };

  /* ---------- mentor carousel ---------- */
  const nextMentor = () => setMentorIndex((v) => (v + 1) % mentors.length);
  const prevMentor = () =>
    setMentorIndex((v) => (v - 1 + mentors.length) % mentors.length);

  useEffect(() => {
    if (
      mentorPaused ||
      !mentorVisible ||
      showAuthModal ||
      videoOpen ||
      reduceMotion
    )
      return;

    const timer = window.setInterval(
      () => setMentorIndex((v) => (v + 1) % mentors.length),
      isMobile ? 4200 : 3200
    );
    return () => window.clearInterval(timer);
  }, [mentorPaused, mentorVisible, showAuthModal, videoOpen, isMobile, reduceMotion]);

  const setDrag = (px) => {
    cancelAnimationFrame(dragRaf.current);
    dragRaf.current = requestAnimationFrame(() => {
      mentorStageRef.current?.style.setProperty("--drag", `${px}px`);
    });
  };

  const onMentorDown = (event) => {
    dragging.current = true;
    dragMoved.current = false;
    dragStartX.current = event.clientX;
    mentorStageRef.current?.setAttribute("data-drag", "1");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onMentorMove = (event) => {
    if (!dragging.current) return;
    const dx = event.clientX - dragStartX.current;
    if (Math.abs(dx) > 6) dragMoved.current = true;
    setDrag(Math.max(-160, Math.min(160, dx * 0.6)));
  };

  const endMentorDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = event.clientX - dragStartX.current;
    mentorStageRef.current?.removeAttribute("data-drag");
    setDrag(0);
    if (Math.abs(dx) > 55) (dx < 0 ? nextMentor : prevMentor)();
  };

  const onMentorKey = (event) => {
    if (event.key === "ArrowRight") nextMentor();
    if (event.key === "ArrowLeft") prevMentor();
  };

  const openAuth = () => {
    setMenuOpen(false);
    setShowAuthModal(true);
  };

  /* ========================================================== */
  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-white text-slate-900">
      <style>{LANDING_CSS}</style>

      {/* Scroll progress */}
      <div
        ref={progressRef}
        className="fixed left-0 top-0 z-[70] h-[3px] w-full origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500"
        style={{ transform: "scaleX(0)" }}
        aria-hidden="true"
      />

      {/* Background (single fixed layer; blobs are desktop only) */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-white" />
      <div className="pointer-events-none fixed inset-0 z-0 cyber-grid opacity-50" />
      <div className="mobile-hide pointer-events-none fixed left-[-10%] top-[10%] z-0 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px]" />
      <div className="mobile-hide pointer-events-none fixed right-[-10%] top-[25%] z-0 h-[600px] w-[600px] rounded-full bg-emerald-400/10 blur-[150px]" />

      {!isMobile && !reduceMotion && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="grid-scan absolute left-0 right-0 h-48 bg-gradient-to-b from-transparent via-indigo-400/10 to-transparent" />
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="particle absolute h-1 w-1 rounded-full bg-indigo-400/30"
              style={{
                left: `${(i * 19 + 7) % 100}%`,
                animationDelay: `${(i * 1.9) % 10}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ===================== NAVBAR ===================== */}
      <nav
        className={`fixed left-0 right-0 top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-slate-200 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,.06)] md:bg-white/80 md:backdrop-blur-2xl"
            : "border-transparent bg-white/70 md:backdrop-blur-xl"
        }`}
      >
        <div
          className={`mx-auto flex max-w-[1500px] items-center justify-between px-5 transition-all duration-300 sm:px-8 lg:px-12 ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
          <a href="#top" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-sm">
              <div className="absolute inset-1 rounded-lg border border-indigo-200/60" />
              <span className="relative font-black text-indigo-600">M</span>
            </div>

            <div>
              <div className="text-sm font-black tracking-[.26em]">
                MNC <span className="text-indigo-600">CONNECTS</span>
              </div>
              <div className="font-mono text-[7px] tracking-[.28em] text-slate-600">
                CONNECTING FRESHER TO EMPLOYEE
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {[
              ["MNC Connect", "section-0"],
              ["How It Works", "section-3"],
              ["For Freshers", "section-2"],
              ["For Professionals", "section-4"],
            ].map(([item, id]) => (
              <a key={item} href={`#${id}`} className="nav-link text-sm font-medium text-slate-700">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              className="px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600"
              onClick={openAuth}
            >
              Log in
            </button>

            <button
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-600"
              onClick={openAuth}
            >
              Get Started
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="menu-drop border-t border-slate-200 bg-white px-6 py-6 md:hidden">
            <div className="flex flex-col gap-5 text-sm font-semibold text-slate-600">
              <a href="#section-0" onClick={() => setMenuOpen(false)}>MNC Connect</a>
              <a href="#section-3" onClick={() => setMenuOpen(false)}>How It Works</a>
              <a href="#section-2" onClick={() => setMenuOpen(false)}>For Freshers</a>
              <a href="#section-4" onClick={() => setMenuOpen(false)}>For Professionals</a>

              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <button
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                  onClick={openAuth}
                >
                  Log in
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white"
                  onClick={openAuth}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ===================== HERO ===================== */}
      <section
        id="top"
        className="relative z-10 px-5 pb-20 pt-28 sm:px-8 lg:px-12 lg:pt-32"
      >
        <div className="mx-auto grid min-h-[740px] max-w-[1500px] items-center gap-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-10">
          {/* Left copy */}
          <div className="relative z-20">
            <Reveal>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono text-[8px] font-bold tracking-[.25em] text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="live-pulse absolute inset-0 rounded-full bg-emerald-500" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                1:1 VIDEO MENTORSHIP // LIVE
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="max-w-4xl text-5xl font-black leading-[.9] tracking-[-.06em] text-slate-900 sm:text-6xl md:text-7xl xl:text-[5.6rem]">
                CONNECT WITH
                <span className="hero-gradient block bg-gradient-to-r from-slate-900 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                  MNC EMPLOYEES
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
                <b className="text-slate-900">Freshers:</b> find working MNC
                professionals for your target role, connect 1:1 on video, crack
                interviews and discover internships, jobs and referrals.
                <br />
                <b className="text-slate-900">MNC Employees:</b> share your real
                industry experience and
                <span className="font-bold text-emerald-600"> earn </span>
                in your spare time.
              </p>
            </Reveal>

            {/* Interactive role picker */}
            <Reveal delay={220}>
              <div className="mt-8">
                <div className="mb-3 font-mono text-[8px] font-bold tracking-[.25em] text-slate-500">
                  I AM PREPARING FOR
                </div>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Target role">
                  {heroRoles.map((role, index) => (
                    <button
                      key={role.key}
                      type="button"
                      role="tab"
                      aria-selected={heroRole === index}
                      onClick={() => setHeroRole(index)}
                      className={`role-chip rounded-full border px-4 py-2 text-sm font-semibold ${
                        heroRole === index
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_10px_25px_rgba(79,70,229,.28)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <MagneticButton
                  onClick={openAuth}
                  className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(79,70,229,.25)]"
                >
                  <span className="btn-shine" aria-hidden="true" />
                  <GraduationCap size={18} />
                  Find an Employee
                  <span className="rounded-md bg-white/15 px-2 py-1 text-[8px]">FRESHERS</span>
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </MagneticButton>

                <MagneticButton
                  onClick={() => navigate("/mentor/register")}
                  className="group flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-white px-7 py-4 text-sm font-bold text-slate-700 hover:border-emerald-400"
                >
                  <CircleDollarSign size={18} className="text-emerald-600" />
                  Become a Paid Employee
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </MagneticButton>
              </div>
            </Reveal>

            <Reveal delay={340}>
              <HudPanel />
            </Reveal>
          </div>

          {/* ---------- Right: 3D scene ---------- */}
          <div
            ref={heroZoneRef}
            onPointerMove={onHeroMove}
            onPointerLeave={onHeroLeave}
            className="relative flex min-h-[520px] items-center justify-center sm:min-h-[600px] lg:min-h-[660px]"
          >
            <div
              ref={stageRef}
              className="hero-stage relative h-[500px] w-full max-w-[640px] sm:h-[560px]"
            >
              {/* Floor grid plate */}
              <Layer d={6} className="inset-0 flex items-end justify-center mobile-hide">
                <div className="hero-floor" />
              </Layer>

              {/* Rings */}
              <Layer d={10} className="inset-0 flex items-center justify-center mobile-hide">
                <div className="ring-a h-[470px] w-[470px] rounded-full border border-indigo-300/40" />
              </Layer>
              <Layer d={14} className="inset-0 flex items-center justify-center mobile-hide">
                <div className="ring-b h-[520px] w-[280px] rounded-[50%] border border-violet-300/40" />
              </Layer>
              <Layer d={0} className="inset-0 flex items-center justify-center">
                <div className="h-[330px] w-[330px] rounded-full border border-slate-200/70 sm:h-[420px] sm:w-[420px]" />
              </Layer>

              {/* Main video window */}
              <Layer d={22} z={30} className="inset-0 flex items-center justify-center">
                <div className="pointer-events-auto w-[min(94%,540px)]">
                  <div className="float-a glass-card pulse-glow overflow-hidden rounded-[26px] border border-white/90">
                    <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3.5 sm:px-5 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <Video size={15} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">LIVE MOCK INTERVIEW</div>
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

                    <div className="relative grid aspect-[16/9] grid-cols-2 gap-2 bg-slate-900 p-2">
                      <div key={heroMentor.name} className="swap-in contents">
                        <VideoPerson
                          image={heroMentor.image}
                          videoSrc={isMobile ? undefined : DEMO_VIDEO_URL}
                          name={heroMentor.name}
                          role={`Mentor • ${heroMentor.company} ${heroMentor.role}`}
                          mentor
                        />
                      </div>

                      <VideoPerson image={CANDIDATE_IMAGE} name="You" role="Candidate • Final Year" />

                      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white">
                        <Zap size={15} />
                      </div>

                      <div className="absolute bottom-3 left-3 flex items-end gap-0.5" aria-hidden="true">
                        {[3, 6, 10, 5, 8].map((h, i) => (
                          <span
                            key={i}
                            className="eq-bar w-1 rounded-full bg-emerald-400"
                            style={{ height: h, animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>

                      <div className="absolute bottom-3 right-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[7px] text-white">
                        00:42:18
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white px-4 py-3.5 sm:px-5 sm:py-4">
                      <div className="flex gap-2">
                        {["MUTE", "CAM", "CHAT"].map((label) => (
                          <span key={label} className="rounded-md bg-slate-50 px-2 py-1 font-mono text-[7px] text-slate-600">
                            {label}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => setVideoOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[9px] font-bold text-white transition hover:bg-indigo-700 active:scale-95"
                      >
                        <Play size={11} fill="currentColor" />
                        ENTER SESSION
                      </button>
                    </div>
                  </div>
                </div>
              </Layer>

              {/* Best match card (changes with role) */}
              <Layer d={34} z={60} className="-left-1 top-6 sm:-left-4 sm:top-10">
                <div key={activeRole.key} className="swap-in">
                  <div className="float-b w-[188px] rounded-2xl border border-white/90 bg-white/95 p-3 shadow-[0_20px_50px_rgba(15,23,42,.14)]">
                    <div className="font-mono text-[7px] font-bold tracking-[.2em] text-indigo-500">
                      BEST MATCH
                    </div>
                    <div className="mt-2 flex gap-3">
                      <img
                        src={heroMentor.image}
                        alt={heroMentor.name}
                        width="48"
                        height="48"
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-slate-800">{heroMentor.name}</div>
                        <div className="mt-0.5 text-[8px] text-slate-600">{heroMentor.role}</div>
                        <div className="mt-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[7px] font-bold text-indigo-600">
                          {heroMentor.company}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between font-mono text-[7px] text-slate-600">
                        <span>{activeRole.label.toUpperCase()}</span>
                        <span className="font-bold text-emerald-600">{activeRole.match}% MATCH</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          key={`m-${activeRole.key}`}
                          className="bar-grow h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          style={{ width: `${activeRole.match}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Layer>

              {/* Second profile */}
              <Layer d={28} z={50} className="-right-2 bottom-24 sm:-right-3 hidden sm:block">
                <div className="float-c">
                  <MentorFloatCard mentor={mentors[2]} />
                </div>
              </Layer>

              {/* Earnings */}
              <Layer d={40} z={70} className="bottom-0 left-[10%] sm:left-[16%]">
                <div className="float-b rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-[0_15px_45px_rgba(16,185,129,.14)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <DollarSign size={17} />
                    </div>
                    <div>
                      <div className="font-mono text-[7px] tracking-[.15em] text-slate-600">MENTOR EARNINGS</div>
                      <div className="mt-0.5 text-sm font-black text-emerald-600">₹2,500 / HR</div>
                    </div>
                  </div>
                </div>
              </Layer>

              {/* Live notification */}
              <Layer d={30} z={65} className="right-0 top-2 sm:right-2 sm:top-4">
                <div className="float-c flex max-w-[210px] items-start gap-2 rounded-2xl border border-indigo-100 bg-white/95 px-3 py-2.5 shadow-[0_16px_40px_rgba(79,70,229,.12)]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <BellRing size={12} />
                  </span>
                  <span key={notifIndex} className="swap-in text-[10px] font-semibold leading-snug text-slate-700">
                    {notifications[notifIndex]}
                  </span>
                </div>
              </Layer>

              {/* Orbit dot */}
              <Layer d={12} className="inset-0 flex items-center justify-center mobile-hide">
                <div className="orbit-dot h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,.8)]" />
              </Layer>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== COMPANY MARQUEE ===================== */}
      <MarqueeStrip />

      {/* ===================== PERSONA ===================== */}
      <section
        id="section-2"
        className="cv-auto relative z-10 scroll-mt-20 px-5 py-24 sm:px-8 md:py-28 lg:px-12"
      >
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-[8px] tracking-[.25em] text-slate-600 shadow-sm">
                <Users size={12} className="text-indigo-500" />
                CHOOSE YOUR PATH
              </div>

              <h2 className="text-4xl font-black tracking-[-.06em] text-slate-900 sm:text-6xl">
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
          </Reveal>

          {/* Sliding toggle */}
          <Reveal delay={80}>
            <div className="relative mx-auto mt-10 grid w-full max-w-[460px] grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-sm">
              <span
                className="toggle-pill absolute bottom-1.5 left-1.5 top-1.5 w-[calc(50%-6px)] rounded-xl bg-white shadow-md"
                style={{ transform: fresherMode ? "translateX(0)" : "translateX(100%)" }}
                aria-hidden="true"
              />
              <button
                onClick={() => setPersona("fresher")}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold transition-colors sm:px-5 sm:text-sm ${
                  fresherMode ? "text-indigo-600" : "text-slate-600"
                }`}
              >
                <GraduationCap size={16} />I am a Fresher
              </button>
              <button
                onClick={() => setPersona("mentor")}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold transition-colors sm:px-5 sm:text-sm ${
                  !fresherMode ? "text-emerald-600" : "text-slate-600"
                }`}
              >
                <Award size={16} />I am an MNC Employee
              </button>
            </div>
          </Reveal>

          <Reveal delay={120} className="mt-12">
            <div
              className={`overflow-hidden rounded-[28px] border p-6 shadow-[0_30px_100px_rgba(15,23,42,.08)] transition-colors duration-500 sm:p-8 md:rounded-[32px] md:p-12 ${
                fresherMode
                  ? "border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60"
                  : "border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60"
              }`}
            >
              <div key={persona} className="swap-in grid items-center gap-10 lg:grid-cols-[1fr_.8fr] lg:gap-12">
                <div>
                  <div
                    className={`font-mono text-[8px] font-bold tracking-[.3em] ${
                      fresherMode ? "text-indigo-500" : "text-emerald-600"
                    }`}
                  >
                    {fresherMode ? "FRESHER CAREER ENGINE" : "MENTOR EARNING ENGINE"}
                  </div>

                  <h3 className="mt-5 text-3xl font-black tracking-[-.05em] text-slate-900 sm:text-5xl">
                    {fresherMode
                      ? "Go from target role to real MNC guidance."
                      : "Turn your MNC experience into mentorship."}
                  </h3>

                  <p className="mt-6 max-w-xl text-base leading-7 text-slate-700">
                    {fresherMode
                      ? "Choose professionals who match your target role and company. Connect on video, ask questions, learn interview strategies, get feedback and stay connected for future opportunities."
                      : "Register as a working professional, choose your availability and share your experience through focused 1:1 sessions, while earning from your expertise."}
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
                        className="spot flex items-center gap-2 rounded-xl border border-white bg-white/80 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"
                        onPointerMove={spotMove}
                      >
                        <CheckCircle2
                          size={15}
                          className={fresherMode ? "text-indigo-500" : "text-emerald-500"}
                        />
                        {item}
                      </div>
                    ))}
                  </div>

                  <MagneticButton
                    onClick={() => (fresherMode ? openAuth() : navigate("/mentor/register"))}
                    className={`mt-9 inline-flex items-center gap-3 rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg ${
                      fresherMode ? "bg-indigo-600 shadow-indigo-200" : "bg-emerald-600 shadow-emerald-200"
                    }`}
                  >
                    {fresherMode ? "Explore MNC Working Employees" : "Start Earning"}
                    <ArrowRight size={16} />
                  </MagneticButton>
                </div>

                <div className="relative flex min-h-[300px] items-center justify-center">
                  <div
                    className={`mobile-hide absolute h-64 w-64 rounded-full blur-[70px] ${
                      fresherMode ? "bg-indigo-300/30" : "bg-emerald-300/30"
                    }`}
                  />

                  <TiltCard
                    className="relative w-full max-w-sm rounded-3xl border border-white bg-white/90 p-6 shadow-[0_25px_70px_rgba(15,23,42,.1)]"
                    max={7}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] tracking-[.2em] text-slate-600">
                        {fresherMode ? "CAREER TELEMETRY" : "EARNING TELEMETRY"}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${fresherMode ? "bg-indigo-500" : "bg-emerald-500"}`} />
                    </div>

                    <div className="mt-7 flex items-end gap-3">
                      <div className={`text-5xl font-black ${fresherMode ? "text-indigo-600" : "text-emerald-600"}`}>
                        {fresherMode ? "1:1" : "₹3K"}
                      </div>
                      <div className="pb-2 font-mono text-[8px] tracking-[.15em] text-slate-600">
                        {fresherMode ? "VIDEO MENTORSHIP" : "MAX / SESSION HOUR"}
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      <TelemetryBar
                        label={fresherMode ? "Role match" : "Profile strength"}
                        value={fresherMode ? 92 : 96}
                        emerald={!fresherMode}
                      />
                      <TelemetryBar
                        label={fresherMode ? "Interview guidance" : "Availability"}
                        value={fresherMode ? 90 : 72}
                        emerald={!fresherMode}
                      />
                      <TelemetryBar
                        label={fresherMode ? "Opportunity access" : "Session demand"}
                        value={fresherMode ? 84 : 89}
                        emerald={!fresherMode}
                      />
                    </div>

                    <div className="mt-7 rounded-xl bg-slate-50 px-4 py-3 font-mono text-[8px] tracking-[.12em] text-slate-600">
                      STATUS:{" "}
                      <span className={fresherMode ? "text-indigo-600" : "text-emerald-600"}>
                        {fresherMode ? "READY FOR INTERVIEW" : "ACCEPTING SESSIONS"}
                      </span>
                    </div>
                  </TiltCard>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section
        id="section-1"
        className="premium-feature-section relative z-10 scroll-mt-20 overflow-hidden border-y border-slate-800 px-5 py-24 sm:px-8 md:py-28 lg:px-12"
      >
        <div className="absolute inset-0 fine-grid opacity-50" />

        <div className="relative mx-auto max-w-[1450px]">
          <Reveal>
            <SectionHeading
              eyebrow="THE PLATFORM"
              number="01"
              title="BUILT FOR"
              gradient="REAL CONNECTION."
              description="Not another course library. A live career network where freshers connect with working MNC professionals for role-specific guidance, interview preparation and opportunity insights."
            />
          </Reveal>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const tone =
                feature.accent === "emerald"
                  ? { border: "border-emerald-400/25", chip: "bg-emerald-400/10 text-emerald-300", glow: "bg-emerald-400/10" }
                  : feature.accent === "violet"
                    ? { border: "border-violet-400/20", chip: "bg-violet-400/10 text-violet-300", glow: "bg-violet-400/10" }
                    : { border: "border-indigo-400/20", chip: "bg-indigo-400/10 text-indigo-300", glow: "bg-indigo-400/10" };

              return (
                <Reveal key={feature.title} delay={i * 110}>
                  <TiltCard
                    max={9}
                    className={`feature-card-premium spot group relative min-h-[380px] overflow-hidden rounded-[26px] border p-7 sm:p-8 ${tone.border}`}
                  >
                    <div className={`mobile-hide absolute -right-20 -top-20 h-48 w-48 rounded-full blur-[70px] ${tone.glow}`} />

                    <div className="relative" style={{ transform: "translateZ(30px)" }}>
                      <div className="flex items-start justify-between">
                        <div className={`feature-icon-premium flex h-14 w-14 items-center justify-center rounded-2xl ${tone.chip}`}>
                          <Icon size={24} />
                        </div>
                        <span className="text-5xl font-black tracking-[-.08em] text-white/10">{feature.number}</span>
                      </div>

                      <div className="mt-16 font-mono text-[12px] font-bold tracking-[.22em] text-white/55 sm:mt-20 sm:text-[13px]">
                        {feature.label}
                      </div>

                      <h3 className="mt-3 text-2xl font-black tracking-[-.04em] text-white">{feature.title}</h3>
                      <p className="mt-4 text-sm leading-6 text-white/65">{feature.text}</p>

                      <div className="mt-7 flex items-center gap-2 text-xs font-bold text-cyan-300">
                        Learn more
                        <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== MENTOR CAROUSEL ===================== */}
      <section
        id="section-0"
        ref={mentorSectionRef}
        className="relative z-10 scroll-mt-20 overflow-hidden px-5 py-24 sm:px-8 md:py-28 lg:px-12"
        onMouseEnter={() => setMentorPaused(true)}
        onMouseLeave={() => setMentorPaused(false)}
        onTouchStart={() => setMentorPaused(true)}
        onTouchEnd={() => setMentorPaused(false)}
      >
        <div className="mx-auto max-w-[1500px]">
          <Reveal>
            <SectionHeading
              eyebrow="MENTOR NETWORK"
              number="02"
              title="CONNECT WITH"
              gradient="MNC EMPLOYEES WHO WORK THERE."
              description="Meet verified working professionals from leading MNC companies. Pick Employees based on your target company, role and expertise, then connect through 1:1 video sessions."
            />
          </Reveal>

          <div
            ref={mentorStageRef}
            className="mentor-stage relative mx-auto mt-12 h-[540px] max-w-[1400px] select-none outline-none sm:h-[600px]"
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Mentor carousel. Use left and right arrow keys."
            onKeyDown={onMentorKey}
            onPointerDown={onMentorDown}
            onPointerMove={onMentorMove}
            onPointerUp={endMentorDrag}
            onPointerCancel={endMentorDrag}
          >
            <div className="mobile-hide pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[850px] rounded-[50%] border border-indigo-200/60 [transform:translate(-50%,-50%)_rotateX(67deg)]" />
            <div className="mobile-hide pointer-events-none absolute left-1/2 top-1/2 h-[330px] w-[680px] rounded-[50%] border border-violet-200/50 [transform:translate(-50%,-50%)_rotateX(67deg)]" />

            {mentors.map((mentor, index) => {
              let offset = index - mentorIndex;
              if (offset > mentors.length / 2) offset -= mentors.length;
              if (offset < -mentors.length / 2) offset += mentors.length;

              const abs = Math.abs(offset);
              const spacing = isMobile ? 200 : 305;
              const x = offset * spacing;
              const z = abs === 0 ? 100 : abs === 1 ? -45 : -190;
              const rotateY = offset === 0 ? 0 : offset > 0 ? -34 : 34;
              const scale = abs === 0 ? 1 : abs === 1 ? 0.82 : 0.64;
              const opacity = isMobile
                ? abs === 0 ? 1 : abs === 1 ? 0.55 : 0
                : abs === 0 ? 1 : abs === 1 ? 0.78 : 0.2;
              const active = abs === 0;

              return (
                <div
                  key={mentor.name}
                  onClick={() => {
                    if (dragMoved.current) return;
                    setMentorIndex(index);
                  }}
                  className={`mentor-card absolute left-1/2 top-1/2 h-[400px] w-[290px] overflow-hidden rounded-[28px] border border-white/90 bg-white sm:w-[300px] ${
                    abs > (isMobile ? 1 : 2) ? "pointer-events-none" : "cursor-pointer"
                  }`}
                  style={{
                    transform: `translate(-50%, -50%) translateX(calc(${x}px + var(--drag, 0px))) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                    opacity,
                    zIndex: 30 - abs,
                    visibility: isMobile && abs > 1 ? "hidden" : "visible",
                    boxShadow: active
                      ? "0 30px 80px rgba(15,23,42,.22)"
                      : "0 14px 36px rgba(15,23,42,.14)",
                  }}
                  aria-hidden={!active}
                >
                  <div className="relative h-[265px] overflow-hidden bg-slate-100">
                    <img
                      src={mentor.image}
                      alt={`${mentor.name} - ${mentor.role} at ${mentor.company}`}
                      width="300"
                      height="265"
                      draggable="false"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <div className={`absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t ${mentor.gradient} opacity-30`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                    <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 font-mono text-[7px] font-bold tracking-[.16em] text-slate-700">
                      ✓ VERIFIED MENTOR
                    </div>

                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="text-2xl font-black tracking-tight text-white drop-shadow-lg">{mentor.name}</div>
                      <div className="mt-1 text-xs font-semibold text-white/85">
                        {mentor.role} • {mentor.company}
                      </div>
                      <div className="mt-1 text-[9px] text-white/70">{mentor.expertise}</div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                        <Star size={13} fill="currentColor" />
                        {mentor.rating}
                      </span>
                      <span className="font-mono text-[8px] font-bold text-slate-500">{mentor.sessions} SESSIONS</span>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        {mentor.earned ? (
                          <>
                            <div className="font-mono text-[7px] tracking-[.18em] text-slate-500">SESSION RATE</div>
                            <div className="mt-1 text-2xl font-black text-emerald-600">{mentor.earned}</div>
                          </>
                        ) : (
                          <div className="font-mono text-[8px] font-bold tracking-[.15em] text-emerald-600">
                            ● AVAILABLE FOR 1:1
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (active) openAuth();
                          else setMentorIndex(index);
                        }}
                        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 text-xs font-bold text-indigo-600 transition hover:bg-indigo-600 hover:text-white active:scale-95"
                        aria-label={active ? `Book ${mentor.name}` : `View ${mentor.name}`}
                      >
                        {active ? "Book" : "View"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={prevMentor}
              aria-label="Previous mentor"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              {mentors.map((mentor, index) => (
                <button
                  key={mentor.name}
                  type="button"
                  onClick={() => setMentorIndex(index)}
                  aria-label={`Show ${mentor.name}`}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    mentorIndex === index ? "w-9 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextMentor}
              aria-label="Next mentor"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <HowItWorks />

      {/* Professionals anchor */}
      <div id="section-4" className="relative z-10 h-0 scroll-mt-24" aria-hidden="true" />

      {/* ===================== FINAL CTA ===================== */}
      <section className="cv-auto relative z-10 overflow-hidden px-5 py-28 sm:px-8 md:py-32 lg:px-12">
        <div className="mobile-hide absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[130px]" />

        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal>
            <div className="mx-auto mb-6 flex w-fit max-w-full items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 font-mono text-[8px] font-bold tracking-[.2em] text-indigo-600 sm:tracking-[.3em]">
              <Sparkles size={12} className="shrink-0" />
              YOUR NEXT MNC CONNECTION COULD CHANGE EVERYTHING
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="text-5xl font-black leading-[.9] tracking-[-.065em] text-slate-900 sm:text-7xl lg:text-8xl">
              DON'T JUST
              <span className="hero-gradient block bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">
                PREPARE.
              </span>
              <span className="block">CONNECT WITH INDUSTRY.</span>
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-700">
              One relevant MNC Employee. One focused video session. Real guidance for the role and company you want.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <MagneticButton
                onClick={openAuth}
                className="group flex items-center justify-center gap-3 rounded-xl bg-indigo-600 px-8 py-4 text-sm font-bold text-white shadow-[0_20px_50px_rgba(79,70,229,.25)] hover:bg-indigo-700"
              >
                <GraduationCap size={18} />
                Find an MNC Employee
              </MagneticButton>

              <MagneticButton
                onClick={() => navigate("/mentor/register")}
                className="group flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-white px-8 py-4 text-sm font-bold text-emerald-600 shadow-sm hover:shadow-lg"
              >
                <DollarSign size={18} />
                Start Earning as an MNC Employee
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
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
            <span>Mentors (Employees)</span>
            <span>Freshers</span>
            <span>Sessions</span>
            <span>Privacy</span>
            <span>© 2026 MNC CONNECTS</span>
          </div>
        </div>
      </footer>

      {/* ===================== VIDEO MODAL ===================== */}
      {videoOpen && (
        <div
          className="modal-fade fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 sm:p-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="modal-pop relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoOpen(false)}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close video"
            >
              <X size={18} />
            </button>

            <div className="relative grid aspect-video grid-cols-2 gap-2 bg-slate-950 p-3">
              <VideoPerson
                image={heroMentor.image}
                videoSrc={DEMO_VIDEO_URL}
                name={heroMentor.name}
                role={`Mentor • ${heroMentor.company} ${heroMentor.role}`}
                mentor
              />
              <VideoPerson image={CANDIDATE_IMAGE} name="Candidate" role="Final Year • Computer Science" />

              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                LIVE SESSION PREVIEW
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== AUTH MODAL ===================== */}
      {showAuthModal && (
        <div
          className="modal-fade fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
          style={{ overscrollBehavior: "contain" }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-pop relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_35px_100px_rgba(15,23,42,.22)]"
            style={{ overscrollBehavior: "contain" }}
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

/* ==========================================================
   SMALL INTERACTION HELPERS
   ========================================================== */

/* Cursor spotlight (writes two CSS vars, desktop mouse only) */
function spotMove(event) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  el.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

/* Fade/slide in once when scrolled into view */
function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeOnce(el, () => setShown(true));
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "in" : ""} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

/* 3D tilt + glare, mouse only. On touch devices it stays flat (no cost). */
function TiltCard({ children, className = "", max = 8 }) {
  const ref = useRef(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onMove = (event) => {
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg)`;
      el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
      el.style.setProperty("--mx", `${mx}px`);
      el.style.setProperty("--my", `${my}px`);
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt ${className}`}
    >
      {children}
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  );
}

/* Button that leans toward the cursor (mouse only) */
function MagneticButton({ children, className = "", onClick }) {
  const ref = useRef(null);

  const onMove = (event) => {
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.14;
    const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.22;
    el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`magnetic ${className}`}
    >
      {children}
    </button>
  );
}

/* Parallax layer: depth `d` moves with --px/--py set on the stage */
function Layer({ d = 0, z = 0, className = "", children }) {
  return (
    <div
      className={`pointer-events-none absolute ${className}`}
      style={{
        transform: `translate3d(calc(var(--px, 0) * ${d}px), calc(var(--py, 0) * ${d}px), ${z}px)`,
      }}
    >
      {children}
    </div>
  );
}

/* ==========================================================
   SECTIONS / COMPONENTS
   ========================================================== */
function HudPanel() {
  const ref = useRef(null);
  const visible = useInView(ref, { threshold: 0.3 });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (visible) setStarted(true);
  }, [visible]);

  const sessions = useCountUp(5000, started, 1800);
  const paid = useCountUp(50, started, 1800);
  const success = useCountUp(94, started, 1800);

  return (
    <div
      ref={ref}
      className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,.06)]"
    >
      <div className="grid grid-cols-3">
        <HudStat value={sessions.toLocaleString()} suffix="+" label="ACTIVE SESSIONS" icon={<Video size={13} />} />
        <HudStat value={`₹${paid}`} suffix="L+" label="PAID TO EMPLOYEE" icon={<WalletCards size={13} />} />
        <HudStat value={success} suffix="%" label="EMPLOYEE MATCHING" icon={<Target size={13} />} />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 font-mono text-[7px] tracking-[.22em] text-slate-600">
        <span>NETWORK STATUS: OPERATIONAL</span>
        <span className="flex items-center gap-2 text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          LIVE
        </span>
      </div>
    </div>
  );
}

function HudStat({ value, suffix, label, icon }) {
  return (
    <div className="border-r border-slate-200 p-3.5 last:border-r-0 sm:p-5">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="hidden text-indigo-500 sm:inline">{icon}</span>
        <span className="font-mono text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
          {value}
          <span className="text-indigo-600">{suffix}</span>
        </span>
      </div>
      <div className="mt-1 font-mono text-[6px] tracking-[.12em] text-slate-600 sm:text-[8px] sm:tracking-[.15em]">
        {label}
      </div>
    </div>
  );
}

/* Marquee only animates while visible; pauses on hover */
function MarqueeStrip() {
  const ref = useRef(null);
  const visible = useInView(ref, { threshold: 0.01 });

  return (
    <section
      ref={ref}
      className="relative z-10 overflow-hidden border-y border-slate-200 bg-slate-50/70 py-8"
    >
      <div className="mb-5 text-center font-mono text-[8px] font-bold tracking-[.3em] text-slate-600">
        LEARN FROM PEOPLE WHO WORK HERE
      </div>

      <div className="marquee-mask overflow-hidden">
        <div className={`marquee-track flex w-max items-center ${visible ? "" : "is-paused"}`}>
          {[...companies, ...companies].map((company, index) => (
            <div
              key={`${company}-${index}`}
              className="mx-10 flex items-center gap-3 text-xl font-black tracking-[-.04em] text-slate-500 transition-colors hover:text-indigo-600 sm:mx-14 sm:text-2xl"
            >
              <span className="h-2 w-2 rounded-full bg-indigo-300" />
              {company}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Steps with a progress line that fills when scrolled into view */
function HowItWorks() {
  const lineRef = useRef(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    return observeOnce(el, () => setFilled(true));
  }, []);

  return (
    <section
      id="section-3"
      className="cv-auto relative z-10 scroll-mt-20 border-y border-slate-200 bg-slate-50/70 px-5 py-24 sm:px-8 md:py-28 lg:px-12"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <SectionHeading
            eyebrow="HOW IT WORKS"
            number="03"
            title="FROM TARGET ROLE"
            gradient="TO REAL OPPORTUNITIES."
            description="Find the right working professional, learn directly from their experience, prepare for your target role and stay connected to opportunities that can move your career forward."
          />
        </Reveal>

        <div ref={lineRef} className="relative mt-14 md:mt-16">
          {/* Progress line (desktop) */}
          <div className="absolute left-0 right-0 top-[3.1rem] hidden h-px bg-slate-200 md:block" aria-hidden="true">
            <div
              className="step-line h-full origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500"
              style={{ transform: filled ? "scaleX(1)" : "scaleX(0)" }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-5 md:gap-0">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.n} delay={index * 100}>
                  <div className="step group relative h-full rounded-2xl border border-slate-200 bg-white p-6 md:rounded-none md:border-0 md:border-l md:bg-transparent md:p-8 md:first:border-l-0">
                    <div className="flex items-center justify-between">
                      <span className="text-5xl font-black text-slate-200 transition-colors duration-300 group-hover:text-indigo-200">
                        {item.n}
                      </span>
                      <div className="step-icon relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
                        <Icon size={19} />
                      </div>
                    </div>

                    <h3 className="mt-8 font-mono text-sm font-bold tracking-[.3em] text-slate-900 md:mt-14">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-sm leading-6 text-slate-700">{item.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
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
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/10" />

      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2 py-1 font-mono text-[6px] font-bold tracking-wider text-white/90">
        <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" />
        LIVE
      </div>

      <div className="absolute bottom-3 left-3 right-3">
        <div className="truncate text-[10px] font-bold text-white">{name}</div>
        <div className="mt-0.5 truncate text-[7px] text-white/65">{role}</div>
      </div>

      {mentor && (
        <div className="absolute right-3 top-3 rounded-md bg-indigo-600/90 px-2 py-1 font-mono text-[6px] font-bold tracking-wider text-white">
          MENTOR
        </div>
      )}
    </div>
  );
}

function MentorFloatCard({ mentor }) {
  return (
    <div className="w-[190px] rounded-2xl border border-white/90 bg-white/95 p-3 shadow-[0_20px_50px_rgba(15,23,42,.12)]">
      <div className="flex gap-3">
        <img
          src={mentor.image}
          alt={mentor.name}
          width="48"
          height="48"
          loading="lazy"
          decoding="async"
          className="h-12 w-12 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-800">{mentor.name}</div>
          <div className="mt-0.5 text-[8px] text-slate-600">{mentor.role}</div>
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
          {mentor.earned || `${mentor.sessions} sessions`}
        </span>
      </div>
    </div>
  );
}

function TelemetryBar({ label, value, emerald = false }) {
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[7px] tracking-[.12em] text-slate-600">
        <span>{label}</span>
        <span className={emerald ? "text-emerald-600" : "text-indigo-600"}>{value}%</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`bar-grow h-full rounded-full ${
            emerald
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
              : "bg-gradient-to-r from-indigo-400 to-violet-600"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, number, title, gradient, description }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.9fr] lg:items-end">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[9px] font-bold tracking-[.3em] text-indigo-500">{number}</span>
          <span className="h-px w-14 bg-indigo-200" />
          <span className="font-mono text-[8px] tracking-[.28em] text-slate-600">{eyebrow}</span>
        </div>

        <h2 className="text-4xl font-black leading-[.92] tracking-[-.06em] text-slate-900 sm:text-6xl lg:text-7xl">
          {title}
          <span className="block bg-gradient-to-r from-slate-900 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            {gradient}
          </span>
        </h2>
      </div>

      <p className="max-w-xl text-base leading-7 text-slate-700 lg:justify-self-end lg:text-lg">{description}</p>
    </div>
  );
}

/* ==========================================================
   CSS
   Rules of thumb used here:
   - animate only transform / opacity (no box-shadow, no blur animation)
   - no backdrop-filter on phones
   - infinite animations are switched off on phones, off-screen and
     when the user prefers reduced motion
   ========================================================== */
const LANDING_CSS = `
.landing-root { -webkit-tap-highlight-color: transparent; }
html { scroll-behavior: smooth; }

.cv-auto { content-visibility: auto; contain-intrinsic-size: 1px 900px; }

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

.nav-link { position: relative; transition: color .2s; }
.nav-link::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 2px;
  background: #4f46e5; transform: scaleX(0); transform-origin: left; transition: transform .25s;
}
.nav-link:hover { color: #4f46e5; }
.nav-link:hover::after { transform: scaleX(1); }

/* ---------- reveal on scroll ---------- */
.reveal { opacity: 0; transform: translate3d(0, 22px, 0); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.reveal.in { opacity: 1; transform: none; }

/* ---------- swap animation (role / persona / notification change) ---------- */
@keyframes swapIn { from { opacity: 0; transform: translate3d(0, 8px, 0) scale(.985); } to { opacity: 1; transform: none; } }
.swap-in { animation: swapIn .45s cubic-bezier(.22,1,.36,1) both; }
.contents { display: contents; }

@keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.bar-grow { transform-origin: left; animation: barGrow .9s cubic-bezier(.22,1,.36,1) both; }

.role-chip { transition: transform .15s, background-color .2s, border-color .2s, color .2s, box-shadow .2s; }
.role-chip:active { transform: scale(.95); }

.toggle-pill { transition: transform .35s cubic-bezier(.22,1,.36,1); }

/* ---------- buttons ---------- */
.magnetic { transition: transform .2s ease-out, background-color .2s, box-shadow .2s, border-color .2s; will-change: transform; }
.magnetic:active { transform: scale(.97) !important; }
.btn-shine { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.28) 50%, transparent 70%); transform: translateX(-120%); }
.magnetic:hover .btn-shine { transform: translateX(120%); transition: transform .8s ease; }

/* ---------- gradient text shimmer (desktop) ---------- */
.hero-gradient { background-size: 200% 100%; }
@keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

/* ---------- hero 3D stage ---------- */
.hero-stage {
  transform-style: preserve-3d;
  transform: perspective(1400px) rotateX(calc(var(--py, 0) * -6deg)) rotateY(calc(var(--px, 0) * 8deg));
  transition: transform .25s ease-out;
}
.hero-stage > div { transition: transform .25s ease-out; }
.hero-floor {
  width: 540px; height: 330px; margin-bottom: 8px;
  transform: rotateX(68deg);
  background-image:
    linear-gradient(rgba(99,102,241,.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,.22) 1px, transparent 1px);
  background-size: 34px 34px;
  -webkit-mask-image: radial-gradient(closest-side, #000 40%, transparent 100%);
  mask-image: radial-gradient(closest-side, #000 40%, transparent 100%);
}

.glass-card { background: rgba(255,255,255,.82); box-shadow: 0 35px 90px rgba(15,23,42,.16); position: relative; }
.glass-card::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: 0 25px 90px rgba(99,102,241,.28), 0 0 45px rgba(99,102,241,.18); opacity: 0;
}

@keyframes floatA { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-14px,0); } }
@keyframes floatB { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-10px,0) rotate(.6deg); } }
@keyframes floatC { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-12px,0) rotate(-.6deg); } }
.float-a { animation: floatA 7s ease-in-out infinite; }
.float-b { animation: floatB 6s ease-in-out infinite; }
.float-c { animation: floatC 8s ease-in-out infinite; animation-delay: -2s; }

@keyframes glowPulse { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
.pulse-glow::after { animation: glowPulse 4s ease-in-out infinite; }

@keyframes ringRotate { from { transform: rotateX(68deg) rotateZ(0deg); } to { transform: rotateX(68deg) rotateZ(360deg); } }
@keyframes ringRotateReverse { from { transform: rotateY(66deg) rotateZ(360deg); } to { transform: rotateY(66deg) rotateZ(0deg); } }
.ring-a { animation: ringRotate 22s linear infinite; }
.ring-b { animation: ringRotateReverse 18s linear infinite; }

@keyframes orbitDot { from { transform: rotate(0deg) translateX(190px) rotate(0deg); } to { transform: rotate(360deg) translateX(190px) rotate(-360deg); } }
.orbit-dot { animation: orbitDot 9s linear infinite; }

@keyframes livePulse { 0%,100% { transform: scale(.92); opacity: .45; } 50% { transform: scale(1.15); opacity: .95; } }
.live-pulse { animation: livePulse 2.6s ease-in-out infinite; }

@keyframes eq { 0%,100% { transform: scaleY(.45); } 50% { transform: scaleY(1.25); } }
.eq-bar { transform-origin: bottom; animation: eq 1s ease-in-out infinite; }

@keyframes gridScan { 0% { transform: translateY(-100%); opacity: 0; } 15% { opacity: .35; } 80% { opacity: .2; } 100% { transform: translateY(100vh); opacity: 0; } }
.grid-scan { animation: gridScan 9s linear infinite; }
@keyframes particleUp { 0% { transform: translateY(110vh) scale(.4); opacity: 0; } 15% { opacity: .45; } 80% { opacity: .2; } 100% { transform: translateY(-20vh) scale(1); opacity: 0; } }
.particle { animation: particleUp 13s linear infinite; }

/* ---------- marquee ---------- */
@keyframes marqueeSlide { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.marquee-track { animation: marqueeSlide 30s linear infinite; will-change: transform; }
.marquee-track.is-paused { animation-play-state: paused; }
.marquee-mask:hover .marquee-track { animation-play-state: paused; }
.marquee-mask { -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }

/* ---------- tilt cards ---------- */
.tilt { position: relative; transform-style: preserve-3d; transition: transform .18s ease-out; }
.tilt-glare {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .25s;
  background: radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,.22), transparent 55%);
}
.tilt:hover .tilt-glare { opacity: 1; }

/* ---------- cursor spotlight ---------- */
.spot { position: relative; overflow: hidden; }
.spot::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .25s;
  background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(99,102,241,.14), transparent 60%);
}
.spot:hover::before { opacity: 1; }
.feature-card-premium.spot::before {
  background: radial-gradient(340px circle at var(--mx, 50%) var(--my, 50%), rgba(129,140,248,.2), transparent 60%);
}

/* ---------- premium feature section ---------- */
.premium-feature-section {
  background:
    radial-gradient(circle at 15% 20%, rgba(99,102,241,.18), transparent 30%),
    radial-gradient(circle at 85% 75%, rgba(16,185,129,.12), transparent 32%),
    linear-gradient(135deg, #050816 0%, #0a1022 48%, #050b17 100%);
  color: #f8fafc;
}
.premium-feature-section .text-slate-900 { color: #f8fafc !important; }
.premium-feature-section .text-slate-700 { color: rgba(226,232,240,.72) !important; }
.premium-feature-section .text-slate-600 { color: rgba(226,232,240,.58) !important; }
.premium-feature-section .bg-indigo-200 { background: rgba(165,180,252,.4) !important; }
.premium-feature-section .fine-grid { opacity: .18 !important; }

.feature-card-premium {
  isolation: isolate;
  background: linear-gradient(145deg, rgba(20,30,58,.96), rgba(8,15,31,.96));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.28);
}
.feature-card-premium::after {
  content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; pointer-events: none; opacity: .6;
  background: linear-gradient(120deg, rgba(129,140,248,.55), transparent 32%, transparent 65%, rgba(45,212,191,.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.feature-card-premium .feature-icon-premium { box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 28px rgba(99,102,241,.12); }

/* ---------- mentor carousel ---------- */
.mentor-stage { perspective: 1500px; transform-style: preserve-3d; touch-action: pan-y; cursor: grab; }
.mentor-stage:active { cursor: grabbing; }
.mentor-stage:focus-visible { box-shadow: 0 0 0 3px rgba(99,102,241,.3); border-radius: 24px; }
.mentor-card {
  transform-style: preserve-3d; backface-visibility: hidden; will-change: transform, opacity;
  transition: transform .7s cubic-bezier(.22,1,.36,1), opacity .7s cubic-bezier(.22,1,.36,1);
}
.mentor-stage[data-drag="1"] .mentor-card { transition: none; }

/* ---------- how it works ---------- */
.step-line { transform: scaleX(0); transition: transform 1.6s cubic-bezier(.22,1,.36,1) .2s; }
.step { transition: transform .3s, box-shadow .3s, border-color .3s; }
.step:hover { transform: translateY(-4px); }
.step-icon { transition: transform .3s, background-color .3s, color .3s; }
.step:hover .step-icon { transform: scale(1.1) rotate(-6deg); background: #4f46e5; color: #fff; }

/* ---------- modals ---------- */
@keyframes modalFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes modalPop { from { opacity: 0; transform: translate3d(0,16px,0) scale(.985); } to { opacity: 1; transform: none; } }
.modal-fade { animation: modalFade .18s ease-out both; }
.modal-pop { animation: modalPop .22s cubic-bezier(.22,1,.36,1) both; }
.menu-drop { animation: swapIn .25s ease-out both; }

/* ==========================================================
   PHONES: no heavy stuff
   ========================================================== */
@media (max-width: 768px) {
  .mobile-hide { display: none !important; }

  .reveal { transform: translate3d(0, 14px, 0); transition-duration: .5s; }

  .hero-stage { transform: none !important; transition: none; }
  .hero-stage > div { transform: none !important; }

  .float-a, .float-b, .float-c { animation-duration: 9s; }
  .float-a { animation-name: floatA; }
  .pulse-glow::after, .eq-bar, .grid-scan, .particle, .ring-a, .ring-b, .orbit-dot { animation: none !important; }
  .marquee-track { animation-duration: 38s; }

  .glass-card { background: rgba(255,255,255,.96); box-shadow: 0 18px 40px rgba(15,23,42,.14); }
  .feature-card-premium { box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 12px 30px rgba(0,0,0,.25); }

  .backdrop-blur, .backdrop-blur-xl, .backdrop-blur-2xl {
    -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
  }

  .mentor-stage { perspective: 1000px; }
  .mentor-card { transition-duration: .5s; will-change: auto; }
  .tilt-glare, .spot::before { display: none; }

  .step-line { transition-duration: 1s; }
}

@media (hover: hover) and (pointer: fine) {
  .hero-gradient { animation: gradientShift 8s ease-in-out infinite; }
}

/* ==========================================================
   Reduced motion: everything calm
   ========================================================== */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .float-a, .float-b, .float-c, .pulse-glow::after, .marquee-track, .grid-scan, .particle,
  .ring-a, .ring-b, .orbit-dot, .live-pulse, .eq-bar, .hero-gradient, .swap-in, .bar-grow { animation: none !important; }
  .hero-stage, .hero-stage > div, .tilt, .mentor-card, .step-line { transition: none !important; }
}
`;