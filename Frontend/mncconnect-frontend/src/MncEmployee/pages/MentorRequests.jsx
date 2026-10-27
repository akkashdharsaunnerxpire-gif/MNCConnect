import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {socket} from "../../utils/socket";
import useMentorSessions from "../../hooks/useMentorSessions";
import {
  assignPaymentToMentor,
  formatDuration,
  getConflictMessage,
  getDurationMinutes,
  getSessionConflict,
  normalizeSessionRequest,
  persistAcceptedSession,
  respondToSessionRequest,
  SESSION_GAP_MINUTES,
} from "../../utils/sessionRequests";

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=12";

const TABS = [
  { label: "Pending", icon: Clock3 },
  { label: "Rejected", icon: XCircle },
];

const TIMING_OPTIONS = ["All", "Morning", "Afternoon", "Evening", "Night"];
const ROLE_OPTIONS = ["All", "Student", "Fresher", "Developer", "Other"];
const DURATION_OPTIONS = ["All", "30 mins", "60 mins", "120 mins"];
const AMOUNT_OPTIONS = ["All", "Below ₹300", "₹300 - ₹400", "Above ₹400"];

/* ---------- filter helpers (pure, so they live outside the component) ---------- */

const getTiming = (time) => {
  const match = String(time)
    .trim()
    .match(/^(\d{1,2})(?::\d{2})?\s*(AM|PM)$/i);

  if (!match) return "Other";

  let hour = Number(match[1]);
  const period = match[2].toUpperCase();

  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
};

const getRole = (role) => {
  const value = String(role).toLowerCase();

  if (value.includes("student")) return "Student";
  if (value.includes("fresher")) return "Fresher";
  if (value.includes("developer") || value.includes("engineer")) return "Developer";
  return "Other";
};

const matchesAmount = (amount, filter) => {
  if (filter === "Below ₹300") return amount < 300;
  if (filter === "₹300 - ₹400") return amount >= 300 && amount <= 400;
  if (filter === "Above ₹400") return amount > 400;
  return true;
};

/* ---------- page ---------- */

const MentorRequests = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [acceptError, setAcceptError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({
    timing: "All",
    role: "All",
    duration: "All",
    amount: "All",
  });

  // server sessions = source of truth for the 30-minute gap rule
  const { sessions, loading: sessionsLoading, error: sessionsError } = useMentorSessions();
  const serverUpcoming = useMemo(
    () => sessions.filter((s) => s.status === "Upcoming"),
    [sessions]
  );

  /* ---------- live request feed ---------- */
  useEffect(() => {
    const mentorId = localStorage.getItem("mentorId");

    if (!mentorId) {
      console.warn("mentorId not found in localStorage");
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit("mentor-online", mentorId); // server re-sends pending requests
    };

    const handleDisconnect = () => setSocketConnected(false);

    const handleConnectError = (error) => {
      console.error("MentorRequests socket error:", error.message);
      setSocketConnected(false);
    };

    const handleSessionRequest = (incoming) => {
      const request = { ...normalizeSessionRequest(incoming), status: "Pending" };
      if (!request.id) return;

      setRequests((prev) =>
        prev.some((r) => String(r.id) === String(request.id)) ? prev : [request, ...prev]
      );
    };

    // another mentor took it -> remove it so nobody tries to accept a dead request
    const handleTaken = ({ id, requestGroupId } = {}) => {
      const key = String(id ?? requestGroupId ?? "");
      if (!key) return;
      setRequests((prev) =>
        prev.filter((r) => String(r.id) !== key && String(r.requestGroupId) !== key)
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("session-request", handleSessionRequest);
    socket.on("session-request-taken", handleTaken);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("session-request", handleSessionRequest);
      socket.off("session-request-taken", handleTaken);
    };
  }, []);

  /* ---------- filtering ---------- */
  const filteredRequests = useMemo(() => {
    const search = searchQuery.toLowerCase().trim();
    const selectedDuration = filters.duration !== "All" ? getDurationMinutes(filters.duration) : null;

    return requests.filter((request) => {
      if (request.status !== activeTab) return false;
      if (request.type !== "Video Call") return false;

      if (search) {
        const text = [request.name, request.role, request.company, request.message]
          .join(" ")
          .toLowerCase();
        if (!text.includes(search)) return false;
      }

      if (filters.timing !== "All" && getTiming(request.time) !== filters.timing) return false;
      if (filters.role !== "All" && getRole(request.role) !== filters.role) return false;
      if (selectedDuration !== null && getDurationMinutes(request.duration) !== selectedDuration) return false;
      if (filters.amount !== "All" && !matchesAmount(request.amount, filters.amount)) return false;

      return true;
    });
  }, [requests, activeTab, searchQuery, filters]);

  /* ---------- confirmation modal ---------- */
  const resetModal = useCallback(() => {
    setSelectedRequest(null);
    setActionType(null);
    setAcceptError("");
  }, []);

  const openConfirmation = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setAcceptError("");
  };

  // user-initiated close (Cancel / X / Escape) is blocked while a request is in flight
  const closeConfirmation = useCallback(() => {
    if (!actionLoading) resetModal();
  }, [actionLoading, resetModal]);

  useEffect(() => {
    if (!selectedRequest) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeConfirmation();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRequest, closeConfirmation]);

  const removeRequest = (id) =>
    setRequests((prev) => prev.filter((r) => String(r.id) !== String(id)));

  const confirmAction = async () => {
    if (!selectedRequest || !actionType || actionLoading) return;

    const isAccept = actionType === "accept";

    if (isAccept) {
      const serverReady = !sessionsLoading && !sessionsError;
      const conflict = getSessionConflict(selectedRequest, serverReady ? serverUpcoming : null);

      if (conflict) {
        setAcceptError(getConflictMessage(conflict));
        return;
      }
    }

    setActionLoading(true);
    setAcceptError("");

    try {
      const result = await respondToSessionRequest(
        selectedRequest,
        isAccept ? "accepted" : "rejected"
      );

      if (result.taken) {
        removeRequest(selectedRequest.id);
        setAcceptError("Another mentor already accepted this request.");
        return;
      }

      if (!result.ok) {
        setAcceptError(result.data.message || "Failed to update request");
        return;
      }

      if (isAccept) {
        assignPaymentToMentor(result.requestGroupId);

        const session = { ...selectedRequest, type: "Video Call", status: "Upcoming" };
        persistAcceptedSession(session); // fallback copy for the gap check

        removeRequest(selectedRequest.id);
        resetModal();

        navigate("/mentor/sessions", { state: { acceptedSession: session } });
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(selectedRequest.id) ? { ...r, status: "Rejected" } : r
        )
      );
      resetModal();
    } catch (error) {
      console.error("Request status update error:", error);
      setAcceptError(error.message || "Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const updateFilter = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mentor Requests</h1>
            <p className="mt-1 text-sm text-slate-500">Fresher session requests assigned to you.</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-slate-500">{socketConnected ? "Live" : "Offline"}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
            {TABS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(label)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === label ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 lg:w-80">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <SlidersHorizontal size={17} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Filters</h2>

              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect label="Timing" value={filters.timing} options={TIMING_OPTIONS} onChange={updateFilter("timing")} />
              <FilterSelect label="Role" value={filters.role} options={ROLE_OPTIONS} onChange={updateFilter("role")} />
              <FilterSelect label="Duration" value={filters.duration} options={DURATION_OPTIONS} onChange={updateFilter("duration")} />
              <FilterSelect label="Amount" value={filters.amount} options={AMOUNT_OPTIONS} onChange={updateFilter("amount")} />
            </div>
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <CalendarDays size={24} className="text-slate-400" />
            </div>

            <h2 className="text-lg font-semibold text-slate-900">No requests</h2>

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
            {filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onAccept={() => openConfirmation(request, "accept")}
                onReject={() => openConfirmation(request, "reject")}
              />
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="confirm-title" className="text-lg font-bold text-slate-900">
                  {actionType === "accept" ? "Accept Request?" : "Reject Request?"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">{selectedRequest.name}</p>
              </div>

              <button
                type="button"
                onClick={closeConfirmation}
                disabled={actionLoading}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {actionType === "accept" && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <CalendarDays size={19} className="mt-0.5 shrink-0 text-blue-600" />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {SESSION_GAP_MINUTES}-minute gap rule
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Every session must have at least {SESSION_GAP_MINUTES} minutes gap from the
                      previous or next session.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {acceptError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                <p className="text-sm leading-5 text-red-700">{acceptError}</p>
              </div>
            )}

            <div className="mb-6 rounded-xl bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={selectedRequest.avatar || FALLBACK_AVATAR}
                  alt={selectedRequest.name}
                  className="h-12 w-12 rounded-full object-cover"
                />

                <div>
                  <p className="font-semibold text-slate-900">{selectedRequest.name}</p>
                  <p className="text-xs text-slate-500">{selectedRequest.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRequest.date || "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Time</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRequest.time || "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDuration(selectedRequest.duration)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="mt-1 flex items-center text-sm font-semibold text-slate-900">
                    <IndianRupee size={14} />
                    {selectedRequest.amount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmAction}
                disabled={actionLoading}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  actionType === "accept"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </span>
                ) : actionType === "accept" ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} />
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

const FilterSelect = ({ label, value, options, onChange }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>

    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const RequestCard = ({ request, onAccept, onReject }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 gap-4">
        <img
          src={request.avatar || FALLBACK_AVATAR}
          alt={request.name}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{request.name}</h3>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {request.role}
            </span>
          </div>

          {request.company && <p className="mt-1 text-sm text-slate-500">{request.company}</p>}

          {request.message && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{request.message}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
            {request.date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                {request.date}
              </span>
            )}

            {request.time && (
              <span className="flex items-center gap-1.5">
                <Clock3 size={14} />
                {request.time}
              </span>
            )}

            <span className="flex items-center gap-1.5">
              <Clock3 size={14} />
              {formatDuration(request.duration)}
            </span>

            <span className="flex items-center gap-1.5">
              <Video size={14} />
              Video Call
            </span>

            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <IndianRupee size={14} />
              {request.amount}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {request.status === "Pending" && (
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

        {request.status === "Rejected" && (
          <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
            Rejected
          </span>
        )}
      </div>
    </div>
  </div>
);

export default MentorRequests;