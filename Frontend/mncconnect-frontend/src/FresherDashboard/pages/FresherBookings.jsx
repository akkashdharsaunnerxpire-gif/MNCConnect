import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Video,
  Building2,
  UserRound,
  CheckCircle2,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ACCEPTED_SESSIONS_KEY = "mncconnect_accepted_sessions";

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const loadBookings = () => {
      try {
        const stored = localStorage.getItem(ACCEPTED_SESSIONS_KEY);

        if (!stored) {
          setBookings([]);
          return;
        }

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          setBookings(parsed);
        } else {
          setBookings([]);
        }
      } catch {
        setBookings([]);
      }
    };

    loadBookings();

    window.addEventListener("storage", loadBookings);
    window.addEventListener("acceptedSessionsUpdated", loadBookings);

    return () => {
      window.removeEventListener("storage", loadBookings);
      window.removeEventListener(
        "acceptedSessionsUpdated",
        loadBookings
      );
    };
  }, []);

  const formatDate = (date) => {
    if (!date) return "Date not available";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "Time not available";

    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [hour, minute] = time.split(":");
      const date = new Date();
      date.setHours(Number(hour), Number(minute), 0, 0);

      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    return time;
  };

  const getSessionDate = (booking) => {
    return (
      booking.date ||
      booking.sessionDate ||
      booking.scheduledDate ||
      booking.startDate ||
      ""
    );
  };

  const getSessionTime = (booking) => {
    return (
      booking.time ||
      booking.sessionTime ||
      booking.scheduledTime ||
      booking.startTime ||
      ""
    );
  };

  const getCompanyName = (booking) => {
    return (
      booking.companyName ||
      booking.company ||
      booking.mncName ||
      "MNC Company"
    );
  };

  const getMentorName = (booking) => {
    return (
      booking.mentorName ||
      booking.mentor ||
      booking.name ||
      "Mentor"
    );
  };

  const getJoinLink = (booking) => {
    return (
      booking.joinLink ||
      booking.meetingLink ||
      booking.meetLink ||
      booking.videoLink ||
      ""
    );
  };

  const joinSession = (booking) => {
    const link = getJoinLink(booking);

    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }

    if (booking.companyName) {
      navigate(
        `/Home/sessionboard/${encodeURIComponent(
          booking.companyName
        )}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">
            MNCConnect
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            My Bookings
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Your confirmed mentoring sessions
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center shadow-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-8 w-8 text-slate-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-800">
              No confirmed bookings
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Once a session is confirmed, it will appear here.
              You can join the session directly from this page.
            </p>

            <button
              onClick={() => navigate("/Home")}
              className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Browse Sessions
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((booking, index) => {
              const date = getSessionDate(booking);
              const time = getSessionTime(booking);
              const company = getCompanyName(booking);
              const mentor = getMentorName(booking);

              return (
                <div
                  key={booking.id || booking.sessionId || index}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                          <Video className="h-7 w-7 text-blue-600" />
                        </div>

                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-bold text-slate-900">
                              {booking.title ||
                                booking.sessionTitle ||
                                "Mentoring Session"}
                            </h2>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Confirmed
                            </span>
                          </div>

                          <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <span>{company}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <UserRound className="h-4 w-4 text-slate-400" />
                              <span>{mentor}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-slate-400" />
                              <span>{formatDate(date)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-slate-400" />
                              <span>{formatTime(time)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => joinSession(booking)}
                        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] lg:w-auto"
                      >
                        <Video className="h-4 w-4" />
                        Join Session
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        Booking ID:{" "}
                        <span className="font-semibold text-slate-700">
                          {booking.id ||
                            booking.sessionId ||
                            `BOOK-${index + 1}`}
                        </span>
                      </span>

                      <span className="font-medium text-emerald-600">
                        Session Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;