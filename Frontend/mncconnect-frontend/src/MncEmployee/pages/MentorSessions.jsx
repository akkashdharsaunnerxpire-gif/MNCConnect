import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Video,
  Search,
  MessageSquare,
  Star,
  XCircle,
} from "lucide-react";

const ACCEPTED_SESSIONS_KEY = "mncconnect_accepted_sessions";
const ACCEPTED_SESSIONS_EVENT = "mncconnect_session_accepted";

const INDIA_TIMEZONE = "Asia/Kolkata";
const JOIN_WINDOW_MINUTES = 2;

const getStoredAcceptedSessions = () => {
  try {
    const stored = localStorage.getItem(
      ACCEPTED_SESSIONS_KEY
    );

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      "Unable to load accepted sessions:",
      error
    );

    return [];
  }
};

const getSessionDateTime = (date, time) => {
  if (!date || !time) return null;

  try {
    const dateText = String(date).trim();
    const timeText = String(time).trim();

    const dateMatch = dateText.match(
      /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/
    );

    const timeMatch = timeText.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

    if (!dateMatch || !timeMatch) {
      console.error(
        "Invalid session date/time:",
        date,
        time
      );

      return null;
    }

    const [, monthName, day, year] = dateMatch;

    let [, hour, minute, meridiem] = timeMatch;

    const monthMap = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };

    const month =
      monthMap[monthName.toLowerCase()];

    if (!month) return null;

    hour = Number(hour);
    minute = Number(minute);
    meridiem = meridiem.toUpperCase();

    if (hour < 1 || hour > 12) return null;

    if (minute < 0 || minute > 59) return null;

    if (meridiem === "AM") {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }

    const isoString =
      `${year}-${String(month).padStart(2, "0")}` +
      `-${String(day).padStart(2, "0")}` +
      `T${String(hour).padStart(2, "0")}` +
      `:${String(minute).padStart(2, "0")}:00+05:30`;

    const parsed = new Date(isoString);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(
      "Date parsing error:",
      error
    );

    return null;
  }
};

const getDurationMinutes = (duration) => {
  const value = String(duration || "");

  const hourMatch = value.match(
    /(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours)/i
  );

  const minuteMatch = value.match(
    /(\d+)\s*(min|mins|minute|minutes)/i
  );

  let totalMinutes = 0;

  if (hourMatch) {
    totalMinutes +=
      Number(hourMatch[1]) * 60;
  }

  if (minuteMatch) {
    totalMinutes += Number(minuteMatch[1]);
  }

  if (!hourMatch && !minuteMatch) {
    const numericValue = Number(value);

    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }
  }

  return totalMinutes || 30;
};

const getJoinStatus = (session, now) => {
  const sessionStart = getSessionDateTime(
    session.date,
    session.time
  );

  if (!sessionStart) {
    return {
      canJoin: false,
      hasStarted: false,
      hasEnded: false,
      joinOpenAt: null,
      sessionEndAt: null,
      sessionStartAt: null,
      msUntilJoin: 0,
      msUntilStart: 0,
      isJoinWindow: false,
    };
  }

  const sessionStartTime =
    sessionStart.getTime();

  const joinOpenTime =
    sessionStartTime -
    JOIN_WINDOW_MINUTES *
      60 *
      1000;

  const durationMinutes =
    getDurationMinutes(
      session.duration
    );

  const sessionEndTime =
    sessionStartTime +
    durationMinutes *
      60 *
      1000;

  const nowTime = now.getTime();

  return {
    canJoin:
      nowTime >= joinOpenTime &&
      nowTime < sessionEndTime,

    hasStarted:
      nowTime >= sessionStartTime,

    hasEnded:
      nowTime >= sessionEndTime,

    joinOpenAt:
      new Date(joinOpenTime),

    sessionEndAt:
      new Date(sessionEndTime),

    sessionStartAt:
      sessionStart,

    msUntilJoin: Math.max(
      0,
      joinOpenTime - nowTime
    ),

    msUntilStart: Math.max(
      0,
      sessionStartTime - nowTime
    ),

    isJoinWindow:
      nowTime >= joinOpenTime &&
      nowTime < sessionStartTime,
  };
};

const formatCountdownParts = (ms) => {
  if (!ms || ms <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(
    ms / 1000
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
  };
};

const formatIndiaDateTime = (date) => {
  if (!date) return "";

  return date.toLocaleString(
    "en-IN",
    {
      timeZone: INDIA_TIMEZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
};

const formatIndiaTime = (date) => {
  if (!date) return "";

  return date.toLocaleTimeString(
    "en-IN",
    {
      timeZone: INDIA_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
};

const MentorSessions = () => {
  const [sessions, setSessions] =
    useState(() =>
      getStoredAcceptedSessions()
    );

  const [activeTab, setActiveTab] =
    useState("Upcoming");

  const [search, setSearch] =
    useState("");

  const [currentTime, setCurrentTime] =
    useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const syncAcceptedSessions = () => {
      setSessions(
        getStoredAcceptedSessions()
      );
    };

    syncAcceptedSessions();

    window.addEventListener(
      ACCEPTED_SESSIONS_EVENT,
      syncAcceptedSessions
    );

    window.addEventListener(
      "storage",
      syncAcceptedSessions
    );

    return () => {
      window.removeEventListener(
        ACCEPTED_SESSIONS_EVENT,
        syncAcceptedSessions
      );

      window.removeEventListener(
        "storage",
        syncAcceptedSessions
      );
    };
  }, []);

  const tabs = [
    "Upcoming",
    "Completed",
    "Cancelled",
  ];

  const filteredSessions = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return sessions.filter(
      (session) => {
        const matchesStatus =
          session.status ===
          activeTab;

        if (!keyword) {
          return matchesStatus;
        }

        const searchableText =
          `${session.name} ${session.role} ${session.topic} ${session.type}`
            .toLowerCase();

        return (
          matchesStatus &&
          searchableText.includes(
            keyword
          )
        );
      }
    );
  }, [
    sessions,
    activeTab,
    search,
  ]);

  const upcomingCount =
    sessions.filter(
      (session) =>
        session.status === "Upcoming"
    ).length;

  const completedCount =
    sessions.filter(
      (session) =>
        session.status === "Completed"
    ).length;

  const cancelledCount =
    sessions.filter(
      (session) =>
        session.status === "Cancelled"
    ).length;

  const handleJoinSession = (
    session
  ) => {
    console.log(
      "Joining session:",
      session
    );

    alert(
      `Joining session with ${session.name}`
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-100 text-slate-800">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] -top-52 -left-52 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="absolute w-[500px] h-[500px] -bottom-52 -right-52 rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      <main className="relative z-10 max-w-7xl px-5 py-8 mx-auto">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 p-1 overflow-x-auto border rounded-xl w-fit border-slate-200 bg-white shadow-sm">
            {tabs.map((tab) => {
              const count =
                tab === "Upcoming"
                  ? upcomingCount
                  : tab === "Completed"
                  ? completedCount
                  : cancelledCount;

              const active =
                activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab)
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {tab}

                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-md ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search sessions..."
              className="w-full py-2.5 pl-10 pr-4 text-sm bg-white border rounded-xl border-slate-200 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredSessions.length ===
          0 ? (
            <EmptyState
              title={`No ${activeTab.toLowerCase()} sessions`}
              description="Your accepted sessions will appear here."
            />
          ) : (
            filteredSessions.map(
              (session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  currentTime={
                    currentTime
                  }
                  onJoin={
                    handleJoinSession
                  }
                />
              )
            )
          )}
        </div>
      </main>
    </div>
  );
};

const SessionCard = ({
  session,
  currentTime,
  onJoin,
}) => {
  const isUpcoming =
    session.status ===
    "Upcoming";

  const isCompleted =
    session.status ===
    "Completed";

  const isCancelled =
    session.status ===
    "Cancelled";

  const joinStatus =
    getJoinStatus(
      session,
      currentTime
    );

  const {
    canJoin,
    hasEnded,
    joinOpenAt,
    sessionEndAt,
    msUntilStart,
    isJoinWindow,
  } = joinStatus;

  const countdownParts =
    formatCountdownParts(
      msUntilStart
    );

  const getButtonStyle = () => {
    if (
      !isUpcoming ||
      hasEnded
    ) {
      return "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed";
    }

    if (canJoin) {
      return "bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 cursor-pointer";
    }

    if (isJoinWindow) {
      return "bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-200 cursor-pointer";
    }

    return "bg-blue-600 text-white cursor-not-allowed";
  };

  const getButtonContent = () => {
    if (
      !isUpcoming ||
      hasEnded
    ) {
      return (
        <>
          <Video size={14} />
          <span>
            Session Ended
          </span>
        </>
      );
    }

    if (canJoin) {
      return (
        <>
          <Video size={14} />
          <span>
            Join Session
          </span>
        </>
      );
    }

    if (isJoinWindow) {
      return (
        <>
          <Video size={14} />
          <span>
            Join Now
          </span>
        </>
      );
    }

    return (
      <>
        <Clock3 size={13} />

        <span className="font-mono text-[10px] sm:text-[11px]">
          {countdownParts.days >
            0 && (
            <>
              {
                countdownParts.days
              }
              d :{" "}
            </>
          )}

          {(
            countdownParts.days >
              0 ||
            countdownParts.hours >
              0
          ) && (
            <>
              {String(
                countdownParts.hours
              ).padStart(2, "0")}
              h :{" "}
            </>
          )}

          {String(
            countdownParts.minutes
          ).padStart(2, "0")}
          m :{" "}
          {String(
            countdownParts.seconds
          ).padStart(2, "0")}
          s
        </span>
      </>
    );
  };

  return (
    <div className="p-5 transition border rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center flex-1 gap-4">
          <img
            src={session.avatar}
            alt={session.name}
            className="object-cover w-12 h-12 border-2 rounded-full border-blue-100"
          />

          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">
              {session.name}
            </h3>

            <p className="mt-0.5 text-xs text-slate-500">
              {session.role}
            </p>

            <div className="flex flex-wrap gap-2 mt-2">
              {session.topic && (
                <span className="px-2.5 py-1 text-[10px] font-medium rounded-lg bg-blue-50 text-blue-600">
                  {session.topic}
                </span>
              )}

              <span className="px-2.5 py-1 text-[10px] font-medium rounded-lg bg-slate-100 text-slate-500">
                {session.type}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[500px]">
          <SessionInfo
            icon={
              <CalendarDays
                size={15}
              />
            }
            label="Date"
            value={session.date}
          />

          <SessionInfo
            icon={
              <Clock3 size={15} />
            }
            label="Time"
            value={session.time}
          />

          <SessionInfo
            icon={
              <Video size={15} />
            }
            label="Duration"
            value={
              session.duration
            }
          />

          <SessionInfo
            icon={
              <Star size={15} />
            }
            label="Amount"
            value={`₹${session.amount}`}
          />
        </div>
      </div>

      {session.message && (
        <div className="flex gap-3 p-4 mt-5 border rounded-xl border-blue-100 bg-blue-50/50">
          <MessageSquare
            size={17}
            className="mt-0.5 text-blue-500 shrink-0"
          />

          <p className="text-xs leading-5 text-slate-600">
            {session.message}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-5 mt-5 border-t sm:flex-row sm:items-center sm:justify-between border-slate-100">
        <div className="flex items-center gap-2">
          {isUpcoming &&
            !hasEnded && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

                <span className="text-xs font-medium text-emerald-600">
                  Upcoming Session
                </span>
              </>
            )}

          {isUpcoming &&
            hasEnded && (
              <>
                <CheckCircle2
                  size={16}
                  className="text-slate-400"
                />

                <span className="text-xs font-medium text-slate-500">
                  Session Ended
                </span>
              </>
            )}

          {isCompleted && (
            <>
              <CheckCircle2
                size={16}
                className="text-emerald-500"
              />

              <span className="text-xs font-medium text-emerald-600">
                Completed
              </span>
            </>
          )}

          {isCancelled && (
            <>
              <XCircle
                size={16}
                className="text-red-500"
              />

              <span className="text-xs font-medium text-red-500">
                Cancelled
              </span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {isUpcoming &&
            !hasEnded && (
              <>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-600 transition border rounded-xl border-slate-200 bg-white hover:bg-slate-50"
                >
                  <MessageSquare
                    size={15}
                  />
                  Message
                </button>

                <button
                  type="button"
                  disabled={
                    !canJoin &&
                    !isJoinWindow
                  }
                  onClick={() => {
                    if (
                      canJoin ||
                      isJoinWindow
                    ) {
                      onJoin(
                        session
                      );
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition min-w-[150px] ${getButtonStyle()}`}
                >
                  {getButtonContent()}
                </button>
              </>
            )}

          {isUpcoming &&
            hasEnded && (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-400 border rounded-xl border-slate-200 bg-slate-100 cursor-not-allowed"
              >
                <Video size={14} />
                Session Ended
              </button>
            )}

          {isCompleted && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-blue-600 transition border rounded-xl border-blue-100 bg-blue-50 hover:bg-blue-100"
            >
              View Details
            </button>
          )}

          {isCancelled && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-500 transition border rounded-xl border-slate-200 bg-slate-50 hover:bg-slate-100"
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {isUpcoming &&
        !hasEnded &&
        !canJoin &&
        !isJoinWindow && (
          <div className="flex items-center gap-2 px-3 py-2 mt-4 text-[11px] text-blue-600 border border-blue-100 rounded-lg bg-blue-50">
            <Clock3 size={14} />

            <span>
              Join opens at{" "}
              <strong>
                {joinOpenAt &&
                  formatIndiaDateTime(
                    joinOpenAt
                  )}
              </strong>

              {sessionEndAt && (
                <>
                  {" · "}Ends at{" "}
                  <strong>
                    {formatIndiaTime(
                      sessionEndAt
                    )}
                  </strong>
                </>
              )}
            </span>
          </div>
        )}

      {isUpcoming &&
        isJoinWindow &&
        !canJoin && (
          <div className="flex items-center gap-2 px-3 py-2 mt-4 text-[11px] font-medium text-yellow-700 border border-yellow-200 rounded-lg bg-yellow-50">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />

            <span>
              Join window opens now!
              Click "Join Now" to
              enter the session.
            </span>
          </div>
        )}

      {isUpcoming &&
        canJoin && (
          <div className="flex items-center gap-2 px-3 py-2 mt-4 text-[11px] font-medium text-green-600 border border-green-100 rounded-lg bg-green-50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

            <span>
              Session is live! Click
              "Join Session" to enter.
            </span>
          </div>
        )}
    </div>
  );
};

const SessionInfo = ({
  icon,
  label,
  value,
}) => {
  return (
    <div className="p-3 border rounded-xl border-slate-100 bg-slate-50">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}

        <span className="text-[10px]">
          {label}
        </span>
      </div>

      <p className="mt-1.5 text-xs font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
};

const EmptyState = ({
  title,
  description,
}) => {
  return (
    <div className="py-20 text-center border rounded-2xl border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50">
        <CalendarDays
          size={25}
          className="text-blue-500"
        />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
};

export default MentorSessions;