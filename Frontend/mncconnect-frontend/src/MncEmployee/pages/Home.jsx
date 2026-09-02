import React from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Users,
  CalendarDays,
  Star,
  Clock3,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Video,
  TrendingUp,
  Bell,
  UserPlus,
  CircleDollarSign,
  Award,
  ChevronRight,
} from "lucide-react";

/* =========================================================
   MENTOR HOME
========================================================= */

const Home = () => {
  /* =======================================================
     TEMPORARY DATA
     Later API data can be connected here
  ======================================================= */

  const mentor = {
    name: "Arun",
    company: "Microsoft",
    role: "Software Engineer",
    rating: 4.9,
    totalReviews: 128,
    profileCompletion: 92,
  };

  /* =======================================================
     STATS
  ======================================================= */

  const stats = [
    {
      title: "Total Earnings",
      value: "₹48,500",
      subtitle: "Lifetime earnings",
      icon: Wallet,
      link: "/mentor/earnings",
    },
    {
      title: "This Month",
      value: "₹12,800",
      subtitle: "+18.4% from last month",
      icon: TrendingUp,
      link: "/mentor/earnings",
    },
    {
      title: "Total Sessions",
      value: "186",
      subtitle: "Sessions completed",
      icon: CalendarDays,
      link: "/mentor/sessions",
    },
    {
      title: "Rating",
      value: "4.9",
      subtitle: "128 reviews",
      icon: Star,
      link: "/mentor/reviews",
    },
  ];

  /* =======================================================
     FRESHER REQUESTS
  ======================================================= */

  const requests = [
    {
      id: 1,
      name: "Rahul Kumar",
      role: "Final Year CSE Student",
      topic: "Interview Preparation",
      duration: "30 mins",
      time: "Today, 5:30 PM",
      avatar: "https://i.pravatar.cc/100?img=12",
    },
    {
      id: 2,
      name: "Priya S",
      role: "Fresher",
      topic: "Resume Review",
      duration: "45 mins",
      time: "Tomorrow, 11:00 AM",
      avatar: "https://i.pravatar.cc/100?img=47",
    },
    {
      id: 3,
      name: "Vignesh R",
      role: "BE CSE Student",
      topic: "System Design",
      duration: "60 mins",
      time: "Tomorrow, 4:00 PM",
      avatar: "https://i.pravatar.cc/100?img=33",
    },
  ];

  /* =======================================================
     UPCOMING SESSIONS
  ======================================================= */

  const upcomingSessions = [
    {
      id: 1,
      name: "Karthik Raj",
      topic: "Mock Interview",
      date: "Today",
      time: "3:30 PM",
      duration: "30 mins",
      avatar: "https://i.pravatar.cc/100?img=11",
      status: "Upcoming",
    },
    {
      id: 2,
      name: "Anjali M",
      topic: "Career Guidance",
      date: "Today",
      time: "6:00 PM",
      duration: "45 mins",
      avatar: "https://i.pravatar.cc/100?img=44",
      status: "Upcoming",
    },
    {
      id: 3,
      name: "Sanjay P",
      topic: "Frontend Development",
      date: "Tomorrow",
      time: "10:30 AM",
      duration: "60 mins",
      avatar: "https://i.pravatar.cc/100?img=68",
      status: "Upcoming",
    },
  ];

  /* =======================================================
     RECENT ACTIVITIES
  ======================================================= */

  const activities = [
    {
      icon: CheckCircle2,
      title: "Session completed",
      description: "You completed a session with Rahul",
      time: "2 hours ago",
    },
    {
      icon: CircleDollarSign,
      title: "Payment received",
      description: "₹750 has been added to your earnings",
      time: "4 hours ago",
    },
    {
      icon: Star,
      title: "New 5-star review",
      description: "Priya gave you a 5-star rating",
      time: "Yesterday",
    },
    {
      icon: UserPlus,
      title: "New fresher request",
      description: "A new session request is waiting",
      time: "Yesterday",
    },
  ];

  /* =======================================================
     ACCEPT REQUEST
  ======================================================= */

  const handleAccept = (request) => {
    console.log("Accepted request:", request);
  };

  /* =======================================================
     REJECT REQUEST
  ======================================================= */

  const handleReject = (request) => {
    console.log("Rejected request:", request);
  };

  return (
    <div className="min-h-screen bg-[#f4f9ff] text-slate-800">

      {/* ===================================================
          BACKGROUND
      =================================================== */}

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">

        <div
          className="
            absolute inset-0
            bg-[radial-gradient(circle_at_10%_5%,rgba(59,130,246,0.13),transparent_32%),
            radial-gradient(circle_at_90%_15%,rgba(14,165,233,0.12),transparent_32%),
            radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.07),transparent_35%)]
          "
        />

        <div
          className="
            absolute
            w-[550px]
            h-[550px]
            -top-48
            -left-48
            rounded-full
            bg-blue-400/[0.06]
            blur-[120px]
          "
        />

        <div
          className="
            absolute
            w-[550px]
            h-[550px]
            -bottom-48
            -right-48
            rounded-full
            bg-sky-400/[0.06]
            blur-[120px]
          "
        />
      </div>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <main
        className="
          relative
          z-10
          max-w-[1450px]
          mx-auto
          px-4
          sm:px-6
          lg:px-8
          py-6
          sm:py-8
        "
      >

        {/* =================================================
            WELCOME SECTION
        ================================================= */}

        <section className="mb-7">

          <div
            className="
              flex
              flex-col
              gap-5
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            {/* LEFT */}

            <div>

              <div className="flex items-center gap-2 mb-2">

                <span
                  className="
                    px-3
                    py-1
                    text-[10px]
                    font-semibold
                    tracking-widest
                    uppercase
                    rounded-full
                    text-blue-700
                    bg-blue-50
                    border
                    border-blue-100
                  "
                >
                  Mentor Dashboard
                </span>

                <span className="flex items-center gap-1.5 text-xs text-emerald-600">

                  <span
                    className="
                      w-2
                      h-2
                      rounded-full
                      bg-emerald-500
                      animate-pulse
                    "
                  />

                  Online

                </span>

              </div>

              <h1
                className="
                  text-2xl
                  sm:text-3xl
                  lg:text-4xl
                  font-bold
                  tracking-tight
                  text-slate-900
                "
              >
                Welcome back,{" "}

                <span
                  className="
                    text-transparent
                    bg-gradient-to-r
                    from-blue-600
                    via-indigo-600
                    to-sky-500
                    bg-clip-text
                  "
                >
                  {mentor.name}
                </span>{" "}

              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Here's what's happening with your mentorship today.
              </p>

            </div>

            {/* PROFILE COMPLETION */}

            <Link
              to="/mentor/profile"
              className="
                w-full
                lg:w-auto
                flex
                items-center
                gap-4
                p-4
                rounded-2xl
                border
                border-blue-100
                bg-white
                shadow-sm
                hover:border-blue-300
                hover:shadow-md
                transition-all
              "
            >

              <div className="relative flex items-center justify-center w-12 h-12">

                <svg
                  className="
                    absolute
                    inset-0
                    w-12
                    h-12
                    -rotate-90
                  "
                  viewBox="0 0 42 42"
                >

                  <circle
                    cx="21"
                    cy="21"
                    r="17"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-slate-100"
                  />

                  <circle
                    cx="21"
                    cy="21"
                    r="17"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${mentor.profileCompletion} 100`}
                    pathLength="100"
                    strokeLinecap="round"
                    className="text-blue-600"
                  />

                </svg>

                <span className="text-xs font-bold text-slate-700">
                  {mentor.profileCompletion}%
                </span>

              </div>

              <div>

                <p className="text-xs text-slate-400">
                  Profile Completion
                </p>

                <p className="text-sm font-semibold text-slate-800">
                  Complete your profile
                </p>

              </div>

              <ChevronRight
                size={17}
                className="ml-auto text-slate-400"
              />

            </Link>

          </div>

        </section>

        {/* =================================================
            STATS
        ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
            mb-7
          "
        >

          {stats.map((stat) => {

            const Icon = stat.icon;

            return (
              <Link
                key={stat.title}
                to={stat.link}
                className="
                  group
                  relative
                  overflow-hidden
                  p-5
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  shadow-sm
                  hover:border-blue-300
                  hover:shadow-md
                  hover:-translate-y-0.5
                  transition-all
                  duration-200
                "
              >

                <div
                  className="
                    absolute
                    top-0
                    right-0
                    w-28
                    h-28
                    rounded-full
                    bg-blue-100/60
                    blur-2xl
                  "
                />

                <div className="relative flex items-start justify-between">

                  <div>

                    <p className="text-xs text-slate-400">
                      {stat.title}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {stat.value}
                    </h2>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {stat.subtitle}
                    </p>

                  </div>

                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      w-11
                      h-11
                      rounded-xl
                      bg-blue-50
                      border
                      border-blue-100
                    "
                  >
                    <Icon
                      size={20}
                      className="text-blue-600"
                    />
                  </div>

                </div>

              </Link>
            );
          })}

        </section>

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div
          className="
            grid
            grid-cols-1
            xl:grid-cols-[1.4fr_1fr]
            gap-6
          "
        >

          {/* ===============================================
              FRESHER REQUESTS
          =============================================== */}

          <section
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                px-5
                py-4
                border-b
                border-slate-100
              "
            >

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-base font-semibold text-slate-900">
                    Fresher Requests
                  </h2>

                  <span
                    className="
                      flex
                      items-center
                      justify-center
                      min-w-6
                      h-6
                      px-1.5
                      text-[10px]
                      font-bold
                      rounded-full
                      bg-blue-50
                      text-blue-600
                    "
                  >
                    {requests.length}
                  </span>

                </div>

                <p className="mt-1 text-xs text-slate-400">
                  People waiting for your guidance
                </p>

              </div>

              <Link
                to="/mentor/requests"
                className="
                  flex
                  items-center
                  gap-1
                  text-xs
                  font-medium
                  text-blue-600
                  hover:text-blue-700
                "
              >
                View All
                <ArrowRight size={14} />
              </Link>

            </div>

            <div className="divide-y divide-slate-100">

              {requests.map((request) => (

                <div
                  key={request.id}
                  className="
                    p-5
                    hover:bg-blue-50/50
                    transition-colors
                  "
                >

                  <div
                    className="
                      flex
                      flex-col
                      gap-4
                      sm:flex-row
                      sm:items-center
                    "
                  >

                    {/* USER */}

                    <div className="flex items-center gap-3 flex-1 min-w-0">

                      <img
                        src={request.avatar}
                        alt={request.name}
                        className="
                          object-cover
                          w-11
                          h-11
                          rounded-full
                          border-2
                          border-blue-100
                        "
                      />

                      <div className="min-w-0">

                        <h3 className="text-sm font-semibold text-slate-800 truncate">
                          {request.name}
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-400 truncate">
                          {request.role}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-2">

                          <span
                            className="
                              px-2
                              py-1
                              text-[10px]
                              rounded-md
                              bg-blue-50
                              text-blue-600
                            "
                          >
                            {request.topic}
                          </span>

                          <span
                            className="
                              flex
                              items-center
                              gap-1
                              text-[10px]
                              text-slate-400
                            "
                          >
                            <Clock3 size={11} />
                            {request.duration}
                          </span>

                        </div>

                      </div>

                    </div>

                    {/* TIME */}

                    <div className="sm:text-right">

                      <p className="text-xs font-medium text-slate-600">
                        {request.time}
                      </p>

                      <div className="flex gap-2 mt-3 sm:justify-end">

                        <button
                          onClick={() =>
                            handleReject(request)
                          }
                          className="
                            flex
                            items-center
                            justify-center
                            w-9
                            h-9
                            rounded-lg
                            border
                            border-red-100
                            bg-red-50
                            text-red-500
                            hover:bg-red-100
                            transition-colors
                          "
                          title="Reject"
                        >
                          <XCircle size={16} />
                        </button>

                        <button
                          onClick={() =>
                            handleAccept(request)
                          }
                          className="
                            flex
                            items-center
                            justify-center
                            gap-1.5
                            px-3
                            h-9
                            rounded-lg
                            bg-blue-600
                            text-white
                            text-xs
                            font-semibold
                            hover:bg-blue-700
                            transition-colors
                          "
                        >
                          <CheckCircle2 size={15} />
                          Accept
                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          </section>

          {/* ===============================================
              UPCOMING SESSIONS
          =============================================== */}

          <section
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                px-5
                py-4
                border-b
                border-slate-100
              "
            >

              <div>

                <h2 className="text-base font-semibold text-slate-900">
                  Upcoming Sessions
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Your next mentorship sessions
                </p>

              </div>

              <Link
                to="/mentor/sessions"
                className="
                  flex
                  items-center
                  gap-1
                  text-xs
                  font-medium
                  text-blue-600
                  hover:text-blue-700
                "
              >
                View All
                <ArrowRight size={14} />
              </Link>

            </div>

            <div className="p-4 space-y-3">

              {upcomingSessions.map((session) => (

                <div
                  key={session.id}
                  className="
                    p-4
                    rounded-xl
                    border
                    border-slate-100
                    bg-slate-50/50
                    hover:bg-blue-50/50
                    hover:border-blue-100
                    transition-colors
                  "
                >

                  <div className="flex items-center gap-3">

                    <img
                      src={session.avatar}
                      alt={session.name}
                      className="
                        object-cover
                        w-10
                        h-10
                        rounded-full
                        border
                        border-slate-200
                      "
                    />

                    <div className="flex-1 min-w-0">

                      <h3 className="text-sm font-medium text-slate-800 truncate">
                        {session.name}
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-400 truncate">
                        {session.topic}
                      </p>

                    </div>

                    <span
                      className="
                        px-2
                        py-1
                        text-[9px]
                        font-medium
                        rounded-md
                        bg-emerald-50
                        text-emerald-600
                      "
                    >
                      {session.status}
                    </span>

                  </div>

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-2
                      mt-4
                      pt-3
                      border-t
                      border-slate-100
                    "
                  >

                    <div className="flex items-center gap-3">

                      <span
                        className="
                          flex
                          items-center
                          gap-1.5
                          text-[11px]
                          text-slate-500
                        "
                      >
                        <CalendarDays size={13} />
                        {session.date}
                      </span>

                      <span
                        className="
                          flex
                          items-center
                          gap-1.5
                          text-[11px]
                          text-slate-500
                        "
                      >
                        <Clock3 size={13} />
                        {session.time}
                      </span>

                    </div>

                    <Link
                      to="/mentor/sessions"
                      className="
                        flex
                        items-center
                        justify-center
                        w-8
                        h-8
                        rounded-lg
                        text-blue-600
                        bg-blue-50
                        hover:bg-blue-100
                        transition-colors
                      "
                    >
                      <Video size={15} />
                    </Link>

                  </div>

                </div>

              ))}

            </div>

          </section>

        </div>

        {/* =================================================
            BOTTOM GRID
        ================================================= */}

        <div
          className="
            grid
            grid-cols-1
            lg:grid-cols-[1fr_1fr]
            gap-6
            mt-6
          "
        >

          {/* ===============================================
              QUICK ACTIONS
          =============================================== */}

          <section
            className="
              p-5
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div className="mb-5">

              <h2 className="text-base font-semibold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Manage your mentor account
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <QuickAction
                to="/mentor/requests"
                icon={UserPlus}
                title="Fresher Requests"
                description="Review requests"
              />

              <QuickAction
                to="/mentor/sessions"
                icon={CalendarDays}
                title="My Sessions"
                description="Manage sessions"
              />

              <QuickAction
                to="/mentor/earnings"
                icon={Wallet}
                title="Earnings"
                description="View payments"
              />

              <QuickAction
                to="/mentor/profile"
                icon={Award}
                title="My Profile"
                description="Update profile"
              />

            </div>

          </section>

          {/* ===============================================
              RECENT ACTIVITY
          =============================================== */}

          <section
            className="
              p-5
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div className="flex items-center justify-between mb-5">

              <div>

                <h2 className="text-base font-semibold text-slate-900">
                  Recent Activity
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Latest updates on your account
                </p>

              </div>

              <Link
                to="/mentor/notifications"
                className="
                  flex
                  items-center
                  justify-center
                  w-9
                  h-9
                  rounded-lg
                  bg-blue-50
                  text-blue-600
                  hover:bg-blue-100
                  transition-colors
                "
              >
                <Bell size={17} />
              </Link>

            </div>

            <div className="space-y-4">

              {activities.map((activity, index) => {

                const Icon = activity.icon;

                return (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >

                    <div
                      className="
                        flex
                        items-center
                        justify-center
                        w-9
                        h-9
                        rounded-lg
                        bg-blue-50
                        shrink-0
                      "
                    >
                      <Icon
                        size={16}
                        className="text-blue-600"
                      />
                    </div>

                    <div className="flex-1 min-w-0">

                      <h3 className="text-xs font-medium text-slate-700">
                        {activity.title}
                      </h3>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {activity.description}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-300">
                        {activity.time}
                      </p>

                    </div>

                  </div>
                );
              })}

            </div>

          </section>

        </div>

        {/* =================================================
            MENTOR PERFORMANCE
        ================================================= */}

        <section
          className="
            mt-6
            p-5
            sm:p-6
            rounded-2xl
            border
            border-blue-100
            bg-gradient-to-r
            from-blue-50
            via-white
            to-sky-50
            shadow-sm
          "
        >

          <div
            className="
              flex
              flex-col
              gap-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div className="flex items-center gap-4">

              <div
                className="
                  flex
                  items-center
                  justify-center
                  w-14
                  h-14
                  rounded-2xl
                  bg-blue-50
                  border
                  border-blue-100
                "
              >
                <Star
                  size={25}
                  className="text-yellow-500"
                  fill="currentColor"
                />
              </div>

              <div>

                <p className="text-xs text-slate-400">
                  Your Mentor Performance
                </p>

                <div className="flex items-center gap-2 mt-1">

                  <span className="text-xl font-bold text-slate-900">
                    {mentor.rating}
                  </span>

                  <div className="flex gap-0.5">

                    {[1, 2, 3, 4, 5].map((star) => (

                      <Star
                        key={star}
                        size={13}
                        className="text-yellow-500"
                        fill="currentColor"
                      />

                    ))}

                  </div>

                  <span className="text-xs text-slate-400">
                    ({mentor.totalReviews} reviews)
                  </span>

                </div>

              </div>

            </div>

            <Link
              to="/mentor/reviews"
              className="
                flex
                items-center
                justify-center
                gap-2
                px-4
                py-2.5
                rounded-xl
                border
                border-blue-200
                bg-white
                text-sm
                font-medium
                text-blue-600
                hover:bg-blue-50
                transition-colors
              "
            >
              View Reviews
              <ArrowRight size={15} />
            </Link>

          </div>

        </section>

      </main>

    </div>
  );
};

/* =========================================================
   QUICK ACTION COMPONENT
========================================================= */

const QuickAction = ({
  to,
  icon: Icon,
  title,
  description,
}) => {
  return (
    <Link
      to={to}
      className="
        group
        flex
        items-center
        gap-3
        p-4
        rounded-xl
        border
        border-slate-200
        bg-white
        hover:border-blue-200
        hover:bg-blue-50/50
        hover:shadow-sm
        transition-all
      "
    >

      <div
        className="
          flex
          items-center
          justify-center
          w-10
          h-10
          rounded-xl
          bg-blue-50
          shrink-0
        "
      >
        <Icon
          size={18}
          className="
            text-blue-600
            group-hover:text-blue-700
          "
        />
      </div>

      <div className="min-w-0">

        <h3 className="text-xs font-semibold text-slate-800 truncate">
          {title}
        </h3>

        <p className="mt-1 text-[10px] text-slate-400 truncate">
          {description}
        </p>

      </div>

      <ChevronRight
        size={14}
        className="
          ml-auto
          text-slate-300
          group-hover:text-blue-500
          transition-colors
          shrink-0
        "
      />

    </Link>
  );
};

export default Home;