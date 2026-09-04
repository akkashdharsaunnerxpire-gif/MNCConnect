import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  GraduationCap,
  Heart,
  MessageCircle,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const mentor = {
  name: "Arun",
  company: "Microsoft",
  role: "Software Engineer",
  experience: "3+ Years",
  expertise: [
    "System Design",
    "Interview Preparation",
    "Career Strategy",
    "Software Engineering",
  ],
};

const completedSessions = [
  {
    name: "Rahul Kumar",
    initials: "RK",
    role: "Software Engineer",
    skills: ["React", "Node.js", "DSA"],
    session: "System Design",
    readiness: 94,
    status: "Referral Ready",
    completed: "Today",
  },
  {
    name: "Priya S",
    initials: "PS",
    role: "Frontend Engineer",
    skills: ["React", "TypeScript", "UI"],
    session: "Interview Preparation",
    readiness: 91,
    status: "Referral Ready",
    completed: "Yesterday",
  },
  {
    name: "Vignesh R",
    initials: "VR",
    role: "Backend Engineer",
    skills: ["Node.js", "MongoDB", "APIs"],
    session: "Career Strategy",
    readiness: 88,
    status: "Needs Review",
    completed: "2 days ago",
  },
];

const referralStats = [
  {
    label: "Referral Ready",
    value: "07",
    icon: UserRoundCheck,
  },
  {
    label: "Referrals Sent",
    value: "04",
    icon: ArrowUpRight,
  },
  {
    label: "Interview Stage",
    value: "02",
    icon: Video,
  },
  {
    label: "Opportunities",
    value: "02",
    icon: TrendingUp,
  },
];

const hiringAreas = [
  {
    title: "Software Engineering",
    openings: 5,
    skills: "React · Java · Node.js",
  },
  {
    title: "AI & Machine Learning",
    openings: 3,
    skills: "Python · ML · GenAI",
  },
  {
    title: "Data Engineering",
    openings: 2,
    skills: "SQL · Spark · Python",
  },
  {
    title: "Cloud & Platform",
    openings: 2,
    skills: "Azure · DevOps · Kubernetes",
  },
];

const impactSteps = [
  {
    number: "01",
    title: "Session",
    text: "Understand the fresher's goals, skills and career direction.",
    icon: Video,
  },
  {
    number: "02",
    title: "Prepare",
    text: "Use your experience to make them interview-ready.",
    icon: Target,
  },
  {
    number: "03",
    title: "Refer",
    text: "When they're ready, refer them to your own company.",
    icon: UserRoundCheck,
  },
  {
    number: "04",
    title: "Opportunity",
    text: "Your guidance becomes a real career opportunity.",
    icon: BriefcaseBusiness,
  },
];

function Home() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setIsOnline(true);

      const mentorId = localStorage.getItem("mentorId");

      if (mentorId) {
        socket.emit("mentor-online", {
          mentorId,
        });
      }
    });

    socket.on("disconnect", () => {
      setIsOnline(false);
    });

    socket.on("connect_error", () => {
      setIsOnline(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const toggleOnlineStatus = () => {
    const mentorId = localStorage.getItem("mentorId");
    const nextStatus = !isOnline;

    setIsOnline(nextStatus);

    if (!mentorId) {
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socket.emit(nextStatus ? "mentor-online" : "mentor-offline", {
      mentorId,
    });

    setTimeout(() => {
      socket.disconnect();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">

        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-2xl">
          <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative grid gap-12 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-12">

            <div className="flex flex-col justify-center">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white">
                  <Sparkles size={13} />
                  NEXT GENERATION
                </div>

                <button
                  onClick={toggleOnlineStatus}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? "bg-emerald-400" : "bg-slate-500"
                    }`}
                  />

                  {isOnline
                    ? "Available for mentorship"
                    : "Currently offline"}
                </button>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Mentor → MNC → Opportunity
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-[64px]">
                Your session can become their{" "}
                <span className="text-slate-500">
                  first opportunity.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Share your experience, prepare the next generation and,
                when a fresher is ready, open a door inside the company
                you already know.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/mentor/sessions"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <Video size={18} />
                  Start a Session
                  <ArrowRight size={16} />
                </Link>

                <Link
                  to="/mentor/requests"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <UserRoundCheck size={18} />
                  Refer a Fresher
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
                <span className="flex items-center gap-2">
                  <Building2 size={16} />
                  {mentor.company}
                </span>

                <span className="flex items-center gap-2">
                  <BriefcaseBusiness size={16} />
                  {mentor.role}
                </span>

                <span className="flex items-center gap-2">
                  <Clock3 size={16} />
                  {mentor.experience}
                </span>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center"
            >
              <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl sm:p-6">

                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Your Company
                    </p>

                    <h2 className="mt-2 text-3xl font-semibold">
                      {mentor.company}
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      Your network can become their next step.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950">
                    <Building2 size={21} />
                  </div>
                </div>

                <div className="mt-7 rounded-2xl border border-white/10 bg-black/10 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        Fresher readiness
                      </p>

                      <p className="mt-1 text-lg font-semibold">
                        7 students ready
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                      <Check size={20} />
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "78%" }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full bg-emerald-400"
                    />
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>Preparation</span>
                    <span>78% average readiness</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-2xl font-semibold">04</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Referrals sent
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-2xl font-semibold">02</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Interviews started
                    </p>
                  </div>
                </div>

                <Link
                  to="/mentor/requests"
                  className="mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <Zap size={17} />
                    Find someone to refer
                  </span>

                  <ChevronRight size={18} />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {referralStats.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <Icon size={19} />
                  </div>

                  <ArrowUpRight
                    size={17}
                    className="text-slate-300"
                  />
                </div>

                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  {item.value}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {item.label}
                </p>
              </motion.div>
            );
          })}
        </section>

        <section className="mt-10 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              The MNCConnect difference
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One session can change the direction of a career.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
              Your role doesn't stop when the video call ends. If the
              fresher is ready, your professional experience and company
              network can help them take the next step.
            </p>
          </div>

          <div className="mt-9 grid gap-3 md:grid-cols-4">
            {impactSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="relative rounded-2xl bg-slate-50 p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      {step.number}
                    </span>

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Icon size={17} />
                    </div>
                  </div>

                  <h3 className="mt-6 text-lg font-semibold">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {step.text}
                  </p>

                  {index < impactSteps.length - 1 && (
                    <ChevronRight
                      size={18}
                      className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-slate-300 shadow-sm md:block"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Completed sessions
                </p>

                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Freshers you can help next.
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Your completed sessions can become your referral pipeline.
                </p>
              </div>

              <Link
                to="/mentor/sessions"
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                View sessions
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-7 space-y-3">
              {completedSessions.map((student, index) => (
                <motion.div
                  key={student.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                        {student.initials}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            {student.name}
                          </h3>

                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {student.completed}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {student.role}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {student.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-500"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                      <div className="min-w-[145px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Readiness
                          </span>

                          <span className="font-semibold">
                            {student.readiness}%
                          </span>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-900"
                            style={{
                              width: `${student.readiness}%`,
                            }}
                          />
                        </div>
                      </div>

                      {student.status === "Referral Ready" ? (
                        <Link
                          to="/mentor/requests"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <UserRoundCheck size={15} />
                          Refer to {mentor.company}
                        </Link>
                      ) : (
                        <Link
                          to="/mentor/sessions"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold transition hover:bg-slate-50"
                        >
                          <Target size={15} />
                          Review Student
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                    <MessageCircle size={13} />
                    Last session: {student.session}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Heart size={21} />
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Next Generation
            </p>

            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              Your experience can become their advantage.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-400">
              You know the interview process. You know the culture. You know
              what your company looks for. Give the next generation access
              to that knowledge.
            </p>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Students mentored
                </span>

                <span className="text-2xl font-semibold">
                  48
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Goals completed
                </span>

                <span className="text-2xl font-semibold">
                  37
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Success rate
                </span>

                <span className="text-2xl font-semibold">
                  86%
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Company opportunities
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Where your referral can make a difference.
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Roles where your company knowledge can help a fresher prepare
                better.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              <Building2 size={14} />
              {mentor.company}
            </div>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {hiringAreas.map((area) => (
              <div
                key={area.title}
                className="group rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {area.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      {area.skills}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                    {area.openings} openings
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CheckCircle2 size={14} />
                  Suitable for referral
                  <ArrowUpRight
                    size={14}
                    className="ml-auto transition group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mt-10 overflow-hidden rounded-[30px] bg-slate-900 p-7 text-white sm:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <GraduationCap size={15} />
                From mentor to opportunity
              </div>

              <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                Don't let the session be the end of the journey.
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
                If a fresher has the skills, preparation and potential,
                your referral can be the bridge between what they know
                and where they want to go.
              </p>
            </div>

            <Link
              to="/mentor/requests"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Refer a Fresher
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Mentor
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                {mentor.name} · {mentor.role}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {mentor.expertise.join(" · ")}
              </p>
            </div>

            <Link
              to="/mentor/profile"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
            >
              Manage Profile
              <ExternalLink size={15} />
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-8 text-xs text-slate-400">
          <Link
            to="/mentor/requests"
            className="transition hover:text-slate-700"
          >
            Requests
          </Link>

          <Link
            to="/mentor/sessions"
            className="transition hover:text-slate-700"
          >
            Sessions
          </Link>

          <Link
            to="/mentor/earnings"
            className="transition hover:text-slate-700"
          >
            Earnings
          </Link>

          <Link
            to="/mentor/reviews"
            className="transition hover:text-slate-700"
          >
            Reviews
          </Link>

          <span className="flex items-center gap-1.5">
            <Radio size={12} />
            {isOnline ? "Online" : "Offline"}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default Home;