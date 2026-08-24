import React, { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_URL =
      import.meta.env.VITE_API_URL || "http://localhost:5000";

const MentorDashboard = () => {
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const [notifications] = useState([
    {
      id: 1,
      title: "Profile verified",
      message: "Your mentor profile has been approved.",
      time: "Just now",
      unread: true,
    },
    {
      id: 2,
      title: "Welcome to MNCConnect",
      message: "Your mentor account is ready.",
      time: "5 min ago",
      unread: true,
    },
    {
      id: 3,
      title: "Complete your profile",
      message: "Add more skills to improve your profile.",
      time: "1 hour ago",
      unread: false,
    },
  ]);

  useEffect(() => {
    const fetchMentor = async () => {
      try {
        const token = localStorage.getItem("mnc_mentor_token");

        if (!token) {
          setError("Mentor login required.");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to fetch mentor data"
          );
        }

        setMentor(data.user);
      } catch (error) {
        console.error(error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMentor();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <X className="mx-auto text-red-500 mb-3" size={40} />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!mentor) return null;

  const unreadCount = notifications.filter(
    (item) => item.unread
  ).length;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-900">

      {/* ================= HEADER ================= */}

      <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-5 md:px-10 sticky top-0 z-40">

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            MNCConnect
          </h1>

          <p className="text-xs text-gray-400">
            Mentor Workspace
          </p>
        </div>

        <div className="flex items-center gap-4">

          <div className="relative">

            <button
              onClick={() =>
                setShowNotifications(
                  !showNotifications
                )
              }
              className="relative w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
            >
              <Bell size={19} />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-14 w-[350px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

                <div className="p-5 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      Notifications
                    </h3>

                    <p className="text-xs text-gray-400 mt-1">
                      {unreadCount} unread
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setShowNotifications(false)
                    }
                    className="text-gray-400 hover:text-black"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto">

                  {notifications.map(
                    (notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b hover:bg-gray-50 transition ${
                          notification.unread
                            ? "bg-blue-50/40"
                            : ""
                        }`}
                      >
                        <div className="flex gap-3">

                          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                            <Bell size={15} />
                          </div>

                          <div>
                            <p className="font-medium text-sm">
                              {notification.title}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {notification.message}
                            </p>

                            <p className="text-[10px] text-gray-400 mt-2">
                              {notification.time}
                            </p>
                          </div>

                        </div>
                      </div>
                    )
                  )}

                </div>

                <Link
                  to="/mentor/notifications"
                  className="block text-center py-4 text-sm font-medium hover:bg-gray-50"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                >
                  View all notifications
                </Link>

              </div>
            )}

          </div>

          <Link
            to="/mentor/profile"
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center font-semibold">
              {mentor.profilePic ? (
                <img
                  src={mentor.profilePic}
                  alt={mentor.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                mentor.name
                  ?.charAt(0)
                  ?.toUpperCase()
              )}
            </div>

            <div className="hidden md:block">
              <p className="text-sm font-semibold">
                {mentor.name}
              </p>

              <p className="text-xs text-gray-400">
                Mentor
              </p>
            </div>
          </Link>

        </div>

      </header>


      {/* ================= MAIN ================= */}

      <main className="max-w-7xl mx-auto px-5 md:px-10 py-8">

        {/* HERO */}

        <section className="mb-8">

          <p className="text-sm text-gray-400 mb-2">
            Overview
          </p>

          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Good to see you,{" "}
            <span className="text-gray-400">
              {mentor.name?.split(" ")[0]}
            </span>
          </h2>

          <p className="text-gray-500 mt-2">
            Here’s what’s happening with your mentor profile.
          </p>

        </section>


        {/* ================= STATS ================= */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <StatCard
            icon={<BriefcaseBusiness size={20} />}
            title="Experience"
            value={`${mentor.experience || 0} Years`}
          />

          <StatCard
            icon={<Building2 size={20} />}
            title="Company"
            value={mentor.company || "—"}
          />

          <StatCard
            icon={<Users size={20} />}
            title="Department"
            value={mentor.department || "—"}
          />

          <StatCard
            icon={<ShieldCheck size={20} />}
            title="Account"
            value={mentor.accountStatus || "Pending"}
            success={
              mentor.accountStatus === "active"
            }
          />

        </section>


        {/* ================= MAIN GRID ================= */}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* PROFILE CARD */}

          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 md:p-8">

            <div className="flex items-center justify-between mb-7">

              <div>
                <h3 className="text-lg font-semibold">
                  Professional Profile
                </h3>

                <p className="text-sm text-gray-400 mt-1">
                  Your professional information
                </p>
              </div>

              <Link
                to="/mentor/profile"
                className="flex items-center gap-1 text-sm font-medium hover:gap-2 transition-all"
              >
                View profile
                <ChevronRight size={16} />
              </Link>

            </div>


            <div className="space-y-6">

              <InfoRow
                icon={<UserRound size={18} />}
                label="Full Name"
                value={mentor.name}
              />

              <InfoRow
                icon={<BriefcaseBusiness size={18} />}
                label="Designation"
                value={mentor.designation}
              />

              <InfoRow
                icon={<Building2 size={18} />}
                label="Company"
                value={mentor.company}
              />

              <InfoRow
                icon={<MapPin size={18} />}
                label="Location"
                value={mentor.location || "Not provided"}
              />

              <InfoRow
                icon={<Clock3 size={18} />}
                label="Experience"
                value={`${mentor.experience || 0} years`}
              />

            </div>

          </div>


          {/* VERIFICATION CARD */}

          <div className="bg-black text-white rounded-3xl p-7 relative overflow-hidden">

            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/10 blur-3xl" />

            <div className="relative">

              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <ShieldCheck size={24} />
              </div>

              <p className="text-gray-400 text-sm">
                Verification
              </p>

              <h3 className="text-2xl font-semibold mt-1">
                {mentor.verificationStatus}
              </h3>

              <div className="mt-8 flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle2
                  size={18}
                  className="text-green-400"
                />
                Account verified
              </div>

              <Link
                to="/mentor/profile"
                className="mt-8 inline-flex items-center gap-2 px-5 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
              >
                Manage profile
                <ChevronRight size={16} />
              </Link>

            </div>

          </div>

        </section>


        {/* ================= SKILLS ================= */}

        <section className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 mt-6">

          <div className="mb-5">

            <h3 className="text-lg font-semibold">
              Expertise
            </h3>

            <p className="text-sm text-gray-400 mt-1">
              Skills available on your profile
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            {mentor.skills?.length > 0 ? (
              mentor.skills.map(
                (skill, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium hover:bg-black hover:text-white transition cursor-default"
                  >
                    {skill}
                  </span>
                )
              )
            ) : (
              <span className="text-gray-400">
                No skills added yet.
              </span>
            )}

          </div>

        </section>

      </main>

    </div>
  );
};


const StatCard = ({
  icon,
  title,
  value,
  success,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-200">

      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        {icon}
      </div>

      <p className="text-xs text-gray-400 uppercase tracking-wider">
        {title}
      </p>

      <p
        className={`mt-1 text-xl font-semibold ${
          success
            ? "text-green-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>

    </div>
  );
};


const InfoRow = ({
  icon,
  label,
  value,
}) => {
  return (
    <div className="flex items-center gap-4">

      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>

      <div>
        <p className="text-xs text-gray-400">
          {label}
        </p>

        <p className="text-sm font-medium mt-1">
          {value || "Not provided"}
        </p>
      </div>

    </div>
  );
};


export default MentorDashboard;