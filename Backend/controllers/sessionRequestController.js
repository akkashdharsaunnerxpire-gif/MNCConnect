const Mentor = require("../models/Mentor");
const Booking = require("../models/Booking");
const { parseSessionStart } = require("../utils/sessionTime");

const sessionRequests = new Map();
const GAP_MS = 30 * 60 * 1000;

const hasConflict = (mentorId, startsAt, endsAt) =>
  Booking.exists({
    mentor: mentorId,
    status: { $in: ["accepted", "in_progress"] },
    startsAt: { $lt: new Date(new Date(endsAt).getTime() + GAP_MS) },
    endsAt: { $gt: new Date(new Date(startsAt).getTime() - GAP_MS) },
  });

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isAnyValue = (value) =>
  value === "any" || value === "all" || value === "no preference";

const looseMatch = (a, b) => a === b || a.includes(b) || b.includes(a);

const getMentorSocketIds = (onlineMentors, mentor) => {
  if (!onlineMentors || !mentor?._id) return [];

  const direct = onlineMentors.get(String(mentor._id));
  if (!direct) return [];

  if (direct instanceof Set) return Array.from(direct);
  if (Array.isArray(direct)) return direct;
  if (typeof direct === "string") return [direct];

  return [];
};

const companyMatches = (mentor, requestedCompany) => {
  if (!requestedCompany) return true;

  const requested = normalizeText(requestedCompany);
  const mentorCompany = normalizeText(mentor?.currentCompany);

  if (!mentorCompany) return false;

  return looseMatch(mentorCompany, requested);
};

const roleMatches = (mentor, requestedRole, otherRole) => {
  if (!requestedRole) return true;

  const requested = normalizeText(requestedRole);

  const values = [
    mentor?.designation,
    mentor?.department,
    ...(Array.isArray(mentor?.skills) ? mentor.skills : []),
    ...(Array.isArray(mentor?.expertise) ? mentor.expertise : []),
  ]
    .filter(Boolean)
    .map(normalizeText);

  if (requested === "other") {
    if (!otherRole) return true;

    const requestedOtherRole = normalizeText(otherRole);
    return values.some((value) => looseMatch(value, requestedOtherRole));
  }

  return values.some((value) => looseMatch(value, requested));
};

const genderMatches = (mentor, requestedGender) => {
  if (!requestedGender) return true;

  const requested = normalizeText(requestedGender);
  if (isAnyValue(requested)) return true;

  const mentorGender = normalizeText(mentor?.gender);
  if (!mentorGender) return false;

  return mentorGender === requested;
};

const languageMatches = (mentor, requestedLanguage) => {
  if (!requestedLanguage) return true;

  const requested = normalizeText(requestedLanguage);
  if (isAnyValue(requested)) return true;

  const mentorLanguages = Array.isArray(mentor?.languages) ? mentor.languages : [];
  if (mentorLanguages.length === 0) return false;

  return mentorLanguages.some((language) => looseMatch(normalizeText(language), requested));
};

const mentorSummary = (mentor) => ({
  id: mentor._id?.toString(),
  employeeId: mentor.employeeId,
  name: mentor.name,
  email: mentor.email,
  currentCompany: mentor.currentCompany,
});

const createSessionRequest = async (req, res) => {
  try {
    const {
      requestGroupId,
      companyName,
      companyLogo,
      companyImage,
      requester,
      sessionDetails,
      paymentMethod,
      status,
      expiresAt,
    } = req.body;

    if (!requestGroupId) {
      return res.status(400).json({ success: false, message: "requestGroupId is required" });
    }

    if (!requester?.email) {
      return res.status(400).json({ success: false, message: "Requester email is required" });
    }

    if (!sessionDetails) {
      return res.status(400).json({ success: false, message: "Session details are required" });
    }

    const requestedCompany = String(companyName || "").trim();
    const requestedRole = String(sessionDetails.role || "").trim();
    const otherRole = String(sessionDetails.otherRole || "").trim();
    const requestedGender = String(sessionDetails.gender || "").trim();
    const requestedLanguage = String(sessionDetails.language || "").trim();

    const date = sessionDetails.date || req.body.date || "";
    const time = sessionDetails.time || req.body.time || "";
    const durationMinutes = Number(sessionDetails.duration) || 30;

    const startsAt = parseSessionStart(date, time);
    if (!startsAt) {
      return res.status(400).json({ success: false, message: "Invalid date/time" });
    }
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    const onlineMentors = req.app.get("onlineMentors");
    if (!onlineMentors) {
      return res.status(500).json({ success: false, message: "Online mentor service is not available" });
    }

    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages bio linkedinProfile isVerified gender skills expertise"
      )
      .lean();

    const matched = mentors.filter(
      (mentor) =>
        getMentorSocketIds(onlineMentors, mentor).length > 0 &&
        companyMatches(mentor, requestedCompany) &&
        roleMatches(mentor, requestedRole, otherRole) &&
        genderMatches(mentor, requestedGender) &&
        languageMatches(mentor, requestedLanguage)
    );

    const eligibleMentors = [];
    for (const mentor of matched) {
      if (await hasConflict(mentor._id, startsAt, endsAt)) continue;
      eligibleMentors.push(mentor);
    }

    if (eligibleMentors.length === 0) {
      return res.status(409).json({
        success: false,
        assigned: false,
        message: "No eligible online mentor is available right now",
      });
    }

    const selectedMentor = eligibleMentors[0];

    const io = req.app.get("io");
    if (!io) {
      return res.status(500).json({
        success: false,
        assigned: false,
        message: "Socket service is not available",
      });
    }

    const socketIds = getMentorSocketIds(onlineMentors, selectedMentor);
    if (socketIds.length === 0) {
      return res.status(409).json({
        success: false,
        assigned: false,
        message: "Selected mentor went offline. Please try again",
      });
    }

    const request = {
      id: requestGroupId,
      requestGroupId,
      companyName: requestedCompany,
      companyLogo: companyLogo || null,
      companyImage: companyImage || null,
      name: requester.fullName || requester.name || "Fresher",
      avatar: requester.image || requester.avatar || "",
      requester: {
        fullName: requester.fullName || requester.name || "",
        email: requester.email,
        image: requester.image || requester.avatar || "",
      },
      role: sessionDetails.role || "Other",
      otherRole,
      company: requestedCompany,
      date,
      time,
      duration: sessionDetails.duration || 30,
      amount: Number(sessionDetails.amount || 0),
      type: sessionDetails.sessionType || "Video Call",
      sessionType: sessionDetails.sessionType || "",
      sessionTypeValue: sessionDetails.sessionTypeValue || "",
      gender: requestedGender,
      language: requestedLanguage,
      message: sessionDetails.message || req.body.message || "",
      paymentMethod: paymentMethod || "",
      status: status || "pending",
      expiresAt: expiresAt || null,
      assignedMentor: {
        id: selectedMentor._id?.toString(),
        employeeId: selectedMentor.employeeId,
        name: selectedMentor.name,
        email: selectedMentor.email,
        currentCompany: selectedMentor.currentCompany,
      },
      createdAt: new Date().toISOString(),
    };

    sessionRequests.set(String(requestGroupId), {
      ...request,
      assignedMentorId: selectedMentor._id?.toString(),
      startsAt,
      endsAt,
    });

    for (const socketId of socketIds) {
      io.to(socketId).emit("session-request", request);
    }

    return res.status(201).json({
      success: true,
      assigned: true,
      message: "Session request sent to an eligible online mentor",
      request,
      mentor: mentorSummary(selectedMentor),
    });
  } catch (error) {
    console.error("createSessionRequest error:", error);

    return res.status(500).json({
      success: false,
      assigned: false,
      message: "Failed to create session request",
      error: error.message,
    });
  }
};

const getSessionRequestStatus = async (req, res) => {
  try {
    const requestGroupId = String(req.params.requestGroupId || "").trim();

    if (!requestGroupId) {
      return res.status(400).json({ success: false, message: "requestGroupId is required" });
    }

    const request = sessionRequests.get(requestGroupId);

    if (!request) {
      return res.status(404).json({ success: false, message: "Session request not found" });
    }

    return res.status(200).json({
      success: true,
      request,
      status: request.status || "pending",
      assigned: Boolean(request.assignedMentorId),
    });
  } catch (error) {
    console.error("getSessionRequestStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch session request status",
    });
  }
};

const updateSessionRequest = async (req, res) => {
  try {
    const requestGroupId = String(req.params.requestGroupId || "").trim();
    const newStatus = String(req.body.status || "").trim().toLowerCase();

    if (!requestGroupId) {
      return res.status(400).json({ success: false, message: "requestGroupId is required" });
    }

    if (!["accepted", "rejected"].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either accepted or rejected",
      });
    }

    const request = sessionRequests.get(requestGroupId);

    if (!request) {
      return res.status(404).json({ success: false, message: "Session request not found" });
    }

    const currentStatus = String(request.status || "pending").trim().toLowerCase();

    if (currentStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${currentStatus}`,
      });
    }

    if (newStatus === "accepted" && request.assignedMentorId && request.startsAt && request.endsAt) {
      if (await hasConflict(request.assignedMentorId, request.startsAt, request.endsAt)) {
        return res.status(409).json({
          success: false,
          message: "You have another session near this time",
        });
      }
    }

    request.status = newStatus;
    request.updatedAt = new Date().toISOString();

    if (newStatus === "accepted") request.acceptedAt = new Date().toISOString();
    if (newStatus === "rejected") request.rejectedAt = new Date().toISOString();

    sessionRequests.set(requestGroupId, request);

    const io = req.app.get("io");

    if (io) {
      io.emit("session-request-status", {
        requestGroupId,
        status: newStatus,
        request,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Session request ${newStatus} successfully`,
      request,
      status: newStatus,
    });
  } catch (error) {
    console.error("updateSessionRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update session request",
      error: error.message,
    });
  }
};

const getAcceptedBookings = async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const bookings = [];

    for (const request of sessionRequests.values()) {
      const requesterEmail = String(request.requester?.email || "").trim().toLowerCase();
      const status = String(request.status || "pending").trim().toLowerCase();

      if (requesterEmail === email && status === "accepted") {
        bookings.push({
          ...request,
          bookingId: request.requestGroupId,
          sessionId: request.requestGroupId,
          mentorName: request.assignedMentor?.name || "Mentor",
          mentor: request.assignedMentor?.name || "Mentor",
          companyName: request.companyName || request.company || "MNC Company",
          date: request.date || "",
          time: request.time || "",
          status: "accepted",
          confirmed: true,
        });
      }
    }

    bookings.sort(
      (a, b) => new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt)
    );

    return res.status(200).json({
      success: true,
      bookings,
      count: bookings.length,
    });
  } catch (error) {
    console.error("getAcceptedBookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch accepted bookings",
      error: error.message,
    });
  }
};

module.exports = {
  createSessionRequest,
  getSessionRequestStatus,
  updateSessionRequest,
  getAcceptedBookings,
};