import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Clock3,
  XCircle,
  CalendarDays,
  Video,
  IndianRupee,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import socket from "../../socket";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const ACCEPTED_SESSIONS_KEY =
  "mncconnect_accepted_sessions";

const ACCEPTED_SESSIONS_EVENT =
  "mncconnect_session_accepted";

const SESSION_GAP_MINUTES = 30;
const INDIA_TIMEZONE = "Asia/Kolkata";

const getSessionDateTime = (date, time) => {
  if (!date || !time) return null;

  const dateMatch = String(date)
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);

  if (!dateMatch) return null;

  const [, monthName, day, year] = dateMatch;

  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const month = months[monthName.toLowerCase()];

  if (month === undefined) return null;

  const timeMatch = String(time)
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!timeMatch) return null;

  let [, hour, minute = "00", period] = timeMatch;

  hour = Number(hour);
  minute = Number(minute);
  period = period.toUpperCase();

  if (
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  const iso =
    `${year}-${String(month + 1).padStart(2, "0")}` +
    `-${String(day).padStart(2, "0")}` +
    `T${String(hour).padStart(2, "0")}` +
    `:${String(minute).padStart(2, "0")}:00+05:30`;

  const result = new Date(iso);

  return Number.isNaN(result.getTime())
    ? null
    : result;
};

const getDurationMinutes = (duration) => {
  if (typeof duration === "number") {
    return duration;
  }

  const value = String(duration || "");

  const hourMatch = value.match(
    /(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours)/i
  );

  const minuteMatch = value.match(
    /(\d+)\s*(min|mins|minute|minutes)/i
  );

  let total = 0;

  if (hourMatch) {
    total += Number(hourMatch[1]) * 60;
  }

  if (minuteMatch) {
    total += Number(minuteMatch[1]);
  }

  if (!hourMatch && !minuteMatch) {
    const numericValue = Number(value);

    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }
  }

  return total || 30;
};

const getAcceptedSessions = () => {
  try {
    const stored = localStorage.getItem(
      ACCEPTED_SESSIONS_KEY
    );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getSessionInterval = (session) => {
  const start = getSessionDateTime(
    session.date,
    session.time
  );

  if (!start) {
    return null;
  }

  const duration = getDurationMinutes(
    session.duration
  );

  const startMs = start.getTime();

  const endMs =
    startMs + duration * 60 * 1000;

  return {
    startMs,
    endMs,
  };
};

const getSessionConflict = (request) => {
  const requested =
    getSessionInterval(request);

  if (!requested) {
    return null;
  }

  const acceptedSessions =
    getAcceptedSessions();

  const gapMs =
    SESSION_GAP_MINUTES *
    60 *
    1000;

  for (const session of acceptedSessions) {
    if (
      String(session.id) ===
      String(request.id)
    ) {
      continue;
    }

    const existing =
      getSessionInterval(session);

    if (!existing) {
      continue;
    }

    const conflict =
      requested.startMs <
        existing.endMs + gapMs &&
      requested.endMs + gapMs >
        existing.startMs;

    if (conflict) {
      return {
        session,
        requested,
        existing,
      };
    }
  }

  return null;
};

const persistAcceptedSession = (session) => {
  try {
    const existing =
      getAcceptedSessions();

    const filtered =
      existing.filter(
        (item) =>
          String(item.id) !==
          String(session.id)
      );

    const updated = [
      ...filtered,
      session,
    ];

    localStorage.setItem(
      ACCEPTED_SESSIONS_KEY,
      JSON.stringify(updated)
    );

    window.dispatchEvent(
      new Event(
        ACCEPTED_SESSIONS_EVENT
      )
    );
  } catch (error) {
    console.error(
      "Failed to save accepted session:",
      error
    );
  }
};

const formatTime = (date) => {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: INDIA_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(date);
};

const MentorRequests = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState("Pending");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [showFilters, setShowFilters] =
    useState(false);

  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [actionType, setActionType] =
    useState(null);

  const [acceptError, setAcceptError] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState(false);

  const [socketConnected, setSocketConnected] =
    useState(socket.connected);

  const [requests, setRequests] =
    useState([]);

  const [filters, setFilters] =
    useState({
      timing: "All",
      role: "All",
      duration: "All",
      amount: "All",
    });

  useEffect(() => {
    const mentorId =
      localStorage.getItem("mentorId");

    if (!mentorId) {
      console.warn(
        "mentorId not found in localStorage"
      );
      return;
    }

    const handleConnect = () => {
      console.log(
        "MentorRequests socket connected:",
        socket.id
      );

      setSocketConnected(true);

      socket.emit("mentor-online", {
        mentorId,
      });
    };

    const handleDisconnect = (reason) => {
      console.log(
        "MentorRequests socket disconnected:",
        reason
      );

      setSocketConnected(false);
    };

    const handleConnectError = (error) => {
      console.error(
        "MentorRequests socket error:",
        error.message
      );

      setSocketConnected(false);
    };

    const handleSessionRequest = (
      incomingRequest
    ) => {
      console.log(
        "New session request received:",
        incomingRequest
      );

      const normalizedRequest = {
        ...incomingRequest,

        id:
          incomingRequest.id ||
          incomingRequest.requestGroupId,

        name:
          incomingRequest.name ||
          incomingRequest.requester?.fullName ||
          "Fresher",

        avatar:
          incomingRequest.avatar ||
          incomingRequest.requester?.image ||
          "https://i.pravatar.cc/150?img=12",

        role:
          incomingRequest.role ||
          "Other",

        company:
          incomingRequest.company ||
          incomingRequest.companyName ||
          "",

        date:
          incomingRequest.date ||
          incomingRequest.sessionDetails?.date ||
          "",

        time:
          incomingRequest.time ||
          incomingRequest.sessionDetails?.time ||
          "",

        duration:
          incomingRequest.duration ||
          incomingRequest.sessionDetails?.duration ||
          30,

        amount:
          Number(
            incomingRequest.amount ||
              incomingRequest.sessionDetails?.amount ||
              0
          ),

        type:
          incomingRequest.type ||
          incomingRequest.sessionDetails?.sessionType ||
          "Video Call",

        message:
          incomingRequest.message ||
          incomingRequest.sessionDetails?.message ||
          "",

        status: "Pending",
      };

      setRequests((prev) => {
        const alreadyExists = prev.some(
          (request) =>
            String(request.id) ===
            String(
              normalizedRequest.id
            )
        );

        if (alreadyExists) {
          return prev;
        }

        return [
          normalizedRequest,
          ...prev,
        ];
      });
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    socket.on(
      "session-request",
      handleSessionRequest
    );

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.off(
        "session-request",
        handleSessionRequest
      );
    };
  }, []);

  const getTiming = (time) => {
    const match = String(time)
      .trim()
      .match(
        /^(\d{1,2})(?::\d{2})?\s*(AM|PM)$/i
      );

    if (!match) {
      return "Other";
    }

    let hour = Number(match[1]);

    const period =
      match[2].toUpperCase();

    if (
      period === "AM" &&
      hour === 12
    ) {
      hour = 0;
    }

    if (
      period === "PM" &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (hour >= 5 && hour < 12) {
      return "Morning";
    }

    if (hour >= 12 && hour < 17) {
      return "Afternoon";
    }

    if (hour >= 17 && hour < 21) {
      return "Evening";
    }

    return "Night";
  };

  const getRole = (role) => {
    const value =
      String(role).toLowerCase();

    if (value.includes("student")) {
      return "Student";
    }

    if (value.includes("fresher")) {
      return "Fresher";
    }

    if (
      value.includes("developer") ||
      value.includes("engineer")
    ) {
      return "Developer";
    }

    return "Other";
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(
      (request) => {
        if (
          request.status !==
          activeTab
        ) {
          return false;
        }

        if (
          request.type !==
          "Video Call"
        ) {
          return false;
        }

        const search =
          searchQuery
            .toLowerCase()
            .trim();

        if (search) {
          const searchableText =
            `
              ${request.name}
              ${request.role}
              ${request.company}
              ${request.message}
            `.toLowerCase();

          if (
            !searchableText.includes(
              search
            )
          ) {
            return false;
          }
        }

        if (
          filters.timing !==
            "All" &&
          getTiming(request.time) !==
            filters.timing
        ) {
          return false;
        }

        if (
          filters.role !==
            "All" &&
          getRole(request.role) !==
            filters.role
        ) {
          return false;
        }

        if (
          filters.duration !==
            "All"
        ) {
          const duration =
            getDurationMinutes(
              request.duration
            );

          const selectedDuration =
            getDurationMinutes(
              filters.duration
            );

          if (
            duration !==
            selectedDuration
          ) {
            return false;
          }
        }

        if (
          filters.amount !==
          "All"
        ) {
          if (
            filters.amount ===
              "Below ₹300" &&
            request.amount >= 300
          ) {
            return false;
          }

          if (
            filters.amount ===
              "₹300 - ₹400" &&
            (
              request.amount < 300 ||
              request.amount > 400
            )
          ) {
            return false;
          }

          if (
            filters.amount ===
              "Above ₹400" &&
            request.amount <= 400
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }, [
    requests,
    activeTab,
    searchQuery,
    filters,
  ]);

  const openConfirmation = (
    request,
    type
  ) => {
    setSelectedRequest(request);
    setActionType(type);
    setAcceptError("");
  };

  const closeConfirmation = () => {
    if (actionLoading) {
      return;
    }

    setSelectedRequest(null);
    setActionType(null);
    setAcceptError("");
  };

  const updateRequestStatus = async (
    request,
    newStatus
  ) => {
    const requestGroupId =
      request.requestGroupId ||
      request.id;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_URL}/mentor/session-requests/${requestGroupId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status:
              newStatus.toLowerCase(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update request"
        );
      }

      return true;
    } catch (error) {
      console.error(
        "Request status update error:",
        error
      );

      setAcceptError(
        error.message ||
          "Failed to update request"
      );

      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const confirmAction = async () => {
    if (
      !selectedRequest ||
      !actionType
    ) {
      return;
    }

    if (
      actionType === "accept"
    ) {
      const conflict =
        getSessionConflict(
          selectedRequest
        );

      if (conflict) {
        const existingSession =
          conflict.session;

        const existingStart =
          new Date(
            conflict.existing.startMs
          );

        const existingEnd =
          new Date(
            conflict.existing.endMs
          );

        const newSessionStart =
          new Date(
            conflict.requested.startMs
          );

        let message = "";

        if (
          newSessionStart.getTime() >=
          existingStart.getTime()
        ) {
          message =
            `Cannot accept this request. ` +
            `There must be at least ${SESSION_GAP_MINUTES} minutes gap after "${existingSession.name}" session. ` +
            `"${existingSession.name}" ends at ${formatTime(
              existingEnd
            )}.`;
        } else {
          message =
            `Cannot accept this request. ` +
            `There must be at least ${SESSION_GAP_MINUTES} minutes gap before "${existingSession.name}" session. ` +
            `"${existingSession.name}" starts at ${formatTime(
              existingStart
            )}.`;
        }

        setAcceptError(message);

        return;
      }

      const updated =
        await updateRequestStatus(
          selectedRequest,
          "Accepted"
        );

      if (!updated) {
        return;
      }

      const sessionForCalendar = {
        ...selectedRequest,
        type: "Video Call",
        status: "Upcoming",
      };

      persistAcceptedSession(
        sessionForCalendar
      );

      setRequests((prev) =>
        prev.filter(
          (request) =>
            String(request.id) !==
            String(
              selectedRequest.id
            )
        )
      );

      closeConfirmation();

      navigate(
        "/mentor/sessions",
        {
          state: {
            acceptedSession:
              sessionForCalendar,
          },
        }
      );

      return;
    }

    if (
      actionType === "reject"
    ) {
      const updated =
        await updateRequestStatus(
          selectedRequest,
          "Rejected"
        );

      if (!updated) {
        return;
      }

      setRequests((prev) =>
        prev.map(
          (request) =>
            String(request.id) ===
            String(
              selectedRequest.id
            )
              ? {
                  ...request,
                  status: "Rejected",
                }
              : request
        )
      );

      closeConfirmation();
    }
  };

  const tabs = [
    {
      label: "Pending",
      icon: Clock3,
    },
    {
      label: "Rejected",
      icon: XCircle,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Mentor Requests
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Fresher session requests assigned to you.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                socketConnected
                  ? "bg-emerald-500"
                  : "bg-red-500"
              }`}
            />

            <span className="text-slate-500">
              {socketConnected
                ? "Live"
                : "Offline"}
            </span>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.label
                    )
                  }
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    activeTab ===
                    tab.label
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">

            <div className="relative flex-1 lg:w-80">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                placeholder="Search requests..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (prev) => !prev
                )
              }
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <SlidersHorizontal
                size={17}
              />

              <span className="hidden sm:inline">
                Filters
              </span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Filters
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    false
                  )
                }
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <FilterSelect
                label="Timing"
                value={
                  filters.timing
                }
                options={[
                  "All",
                  "Morning",
                  "Afternoon",
                  "Evening",
                  "Night",
                ]}
                onChange={(value) =>
                  setFilters(
                    (prev) => ({
                      ...prev,
                      timing:
                        value,
                    })
                  )
                }
              />

              <FilterSelect
                label="Role"
                value={
                  filters.role
                }
                options={[
                  "All",
                  "Student",
                  "Fresher",
                  "Developer",
                  "Other",
                ]}
                onChange={(value) =>
                  setFilters(
                    (prev) => ({
                      ...prev,
                      role: value,
                    })
                  )
                }
              />

              <FilterSelect
                label="Duration"
                value={
                  filters.duration
                }
                options={[
                  "All",
                  "30 mins",
                  "60 mins",
                  "120 mins",
                ]}
                onChange={(value) =>
                  setFilters(
                    (prev) => ({
                      ...prev,
                      duration:
                        value,
                    })
                  )
                }
              />

              <FilterSelect
                label="Amount"
                value={
                  filters.amount
                }
                options={[
                  "All",
                  "Below ₹300",
                  "₹300 - ₹400",
                  "Above ₹400",
                ]}
                onChange={(value) =>
                  setFilters(
                    (prev) => ({
                      ...prev,
                      amount:
                        value,
                    })
                  )
                }
              />

            </div>
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <CalendarDays
                size={24}
                className="text-slate-400"
              />
            </div>

            <h2 className="text-lg font-semibold text-slate-900">
              No requests
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              New fresher requests will appear here automatically.
            </p>

            {!socketConnected && (
              <p className="mt-3 text-xs font-medium text-red-500">
                Real-time connection is currently offline.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map(
              (request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onAccept={() =>
                    openConfirmation(
                      request,
                      "accept"
                    )
                  }
                  onReject={() =>
                    openConfirmation(
                      request,
                      "reject"
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {actionType ===
                  "accept"
                    ? "Accept Request?"
                    : "Reject Request?"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedRequest.name}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeConfirmation
                }
                disabled={
                  actionLoading
                }
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {actionType ===
              "accept" && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <CalendarDays
                    size={19}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      30-minute gap rule
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Every session must have at least 30 minutes gap from the previous or next session.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {acceptError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm leading-5 text-red-700">
                  {acceptError}
                </p>
              </div>
            )}

            <div className="mb-6 rounded-xl bg-slate-50 p-4">

              <div className="mb-4 flex items-center gap-3">
                <img
                  src={
                    selectedRequest.avatar ||
                    "https://i.pravatar.cc/150?img=12"
                  }
                  alt={
                    selectedRequest.name
                  }
                  className="h-12 w-12 rounded-full object-cover"
                />

                <div>
                  <p className="font-semibold text-slate-900">
                    {
                      selectedRequest.name
                    }
                  </p>

                  <p className="text-xs text-slate-500">
                    {
                      selectedRequest.role
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <p className="text-xs text-slate-500">
                    Date
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedRequest.date ||
                      "Not specified"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Time
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedRequest.time ||
                      "Not specified"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Duration
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedRequest.duration
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Amount
                  </p>

                  <p className="mt-1 flex items-center text-sm font-semibold text-slate-900">
                    <IndianRupee
                      size={14}
                    />
                    {
                      selectedRequest.amount
                    }
                  </p>
                </div>

              </div>
            </div>

            <div className="flex gap-3">

              <button
                type="button"
                onClick={
                  closeConfirmation
                }
                disabled={
                  actionLoading
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmAction
                }
                disabled={
                  actionLoading
                }
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  actionType ===
                  "accept"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Processing...
                  </span>
                ) : actionType ===
                  "accept" ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2
                      size={16}
                    />
                    Accept Request
                  </span>
                ) : (
                  "Reject Request"
                )}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}) => {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
      >
        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}
      </select>
    </div>
  );
};

const RequestCard = ({
  request,
  onAccept,
  onReject,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex min-w-0 gap-4">

          <img
            src={
              request.avatar ||
              "https://i.pravatar.cc/150?img=12"
            }
            alt={request.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="font-semibold text-slate-900">
                {request.name}
              </h3>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {request.role}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {request.company}
            </p>

            {request.message && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {request.message}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">

              {request.date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays
                    size={14}
                  />
                  {request.date}
                </span>
              )}

              {request.time && (
                <span className="flex items-center gap-1.5">
                  <Clock3
                    size={14}
                  />
                  {request.time}
                </span>
              )}

              <span className="flex items-center gap-1.5">
                <Clock3
                  size={14}
                />
                {request.duration}
              </span>

              <span className="flex items-center gap-1.5">
                <Video
                  size={14}
                />
                Video Call
              </span>

              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <IndianRupee
                  size={14}
                />
                {request.amount}
              </span>

            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">

          {request.status ===
            "Pending" && (
            <>
              <button
                type="button"
                onClick={onReject}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Reject
              </button>

              <button
                type="button"
                onClick={onAccept}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Accept Request
              </button>
            </>
          )}

          {request.status ===
            "Rejected" && (
            <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
              Rejected
            </span>
          )}

        </div>
      </div>
    </div>
  );
};

export default MentorRequests;