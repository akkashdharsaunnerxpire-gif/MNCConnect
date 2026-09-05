// ========================================
// SESSION REQUEST CONTROLLER
// ========================================

const Mentor = require("../models/Mentor");

const sessionRequests = new Map();


// ========================================
// NORMALIZE TEXT
// ========================================

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};


// ========================================
// GET MENTOR SOCKET IDS
// server.js:
// mentorId -> Set(socketIds)
// ========================================

const getMentorSocketIds = (onlineMentors, mentor) => {
  if (!onlineMentors || !mentor?._id) {
    return [];
  }

  const mentorId = String(mentor._id);

  const direct = onlineMentors.get(mentorId);

  if (!direct) {
    return [];
  }

  if (direct instanceof Set) {
    return Array.from(direct);
  }

  if (Array.isArray(direct)) {
    return direct;
  }

  if (typeof direct === "string") {
    return [direct];
  }

  return [];
};


// ========================================
// COMPANY MATCH
// ========================================

const companyMatches = (mentor, requestedCompany) => {
  if (!requestedCompany) {
    return true;
  }

  const requested = normalizeText(requestedCompany);

  const mentorCompany = normalizeText(
    mentor?.currentCompany
  );

  if (!mentorCompany) {
    return false;
  }

  return (
    mentorCompany === requested ||
    mentorCompany.includes(requested) ||
    requested.includes(mentorCompany)
  );
};


// ========================================
// ROLE MATCH
// ========================================

const roleMatches = (
  mentor,
  requestedRole,
  otherRole
) => {
  // No role selected
  if (!requestedRole) {
    return true;
  }

  const requested = normalizeText(
    requestedRole
  );

  // Collect all role-related fields
  const values = [
    mentor?.designation,
    mentor?.department,

    ...(Array.isArray(mentor?.skills)
      ? mentor.skills
      : []),

    ...(Array.isArray(mentor?.expertise)
      ? mentor.expertise
      : []),
  ]
    .filter(Boolean)
    .map((value) =>
      normalizeText(value)
    );

  // ========================================
  // OTHER ROLE
  // ========================================

  if (requested === "other") {
    if (!otherRole) {
      return true;
    }

    const requestedOtherRole =
      normalizeText(otherRole);

    return values.some(
      (value) =>
        value === requestedOtherRole ||
        value.includes(requestedOtherRole) ||
        requestedOtherRole.includes(value)
    );
  }

  // ========================================
  // NORMAL ROLE
  // ========================================

  return values.some(
    (value) =>
      value === requested ||
      value.includes(requested) ||
      requested.includes(value)
  );
};


// ========================================
// GENDER MATCH
// ========================================

const genderMatches = (
  mentor,
  requestedGender
) => {
  if (!requestedGender) {
    return true;
  }

  const requested = normalizeText(
    requestedGender
  );

  // Any gender
  if (
    requested === "any" ||
    requested === "all" ||
    requested === "no preference"
  ) {
    return true;
  }

  const mentorGender = normalizeText(
    mentor?.gender
  );

  if (!mentorGender) {
    return false;
  }

  return (
    mentorGender === requested ||
    mentorGender.includes(requested) ||
    requested.includes(mentorGender)
  );
};


// ========================================
// LANGUAGE MATCH
// ========================================

const languageMatches = (
  mentor,
  requestedLanguage
) => {
  if (!requestedLanguage) {
    return true;
  }

  const requested = normalizeText(
    requestedLanguage
  );

  // Any language
  if (
    requested === "any" ||
    requested === "all" ||
    requested === "no preference"
  ) {
    return true;
  }

  const mentorLanguages =
    Array.isArray(mentor?.languages)
      ? mentor.languages
      : [];

  if (mentorLanguages.length === 0) {
    return false;
  }

  return mentorLanguages.some(
    (language) => {
      const normalizedLanguage =
        normalizeText(language);

      return (
        normalizedLanguage === requested ||
        normalizedLanguage.includes(requested) ||
        requested.includes(normalizedLanguage)
      );
    }
  );
};


// ========================================
// CREATE SESSION REQUEST
// ========================================

const createSessionRequest = async (
  req,
  res
) => {
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


    // ========================================
    // REQUEST VALIDATION
    // ========================================

    if (!requestGroupId) {
      return res.status(400).json({
        success: false,
        message:
          "requestGroupId is required",
      });
    }


    if (!requester?.email) {
      return res.status(400).json({
        success: false,
        message:
          "Requester email is required",
      });
    }


    if (!sessionDetails) {
      return res.status(400).json({
        success: false,
        message:
          "Session details are required",
      });
    }


    // ========================================
    // REQUEST FILTER VALUES
    // ========================================

    const requestedCompany =
      String(
        companyName || ""
      ).trim();


    const requestedRole =
      String(
        sessionDetails.role || ""
      ).trim();


    const otherRole =
      String(
        sessionDetails.otherRole || ""
      ).trim();


    const requestedGender =
      String(
        sessionDetails.gender || ""
      ).trim();


    const requestedLanguage =
      String(
        sessionDetails.language || ""
      ).trim();


    // ========================================
    // DEBUG
    // ========================================

    console.log("\n");
    console.log(
      "========================================"
    );

    console.log(
      "📥 SESSION REQUEST FILTERS"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Request Group ID :",
      requestGroupId
    );

    console.log(
      "Company          :",
      requestedCompany || "(Any)"
    );

    console.log(
      "Role             :",
      requestedRole || "(Any)"
    );

    console.log(
      "Other Role       :",
      otherRole || "(None)"
    );

    console.log(
      "Gender           :",
      requestedGender || "(Any)"
    );

    console.log(
      "Language         :",
      requestedLanguage || "(Any)"
    );

    console.log(
      "========================================"
    );


    // ========================================
    // GET APPROVED ACTIVE MENTORS
    // ========================================

    const mentors =
      await Mentor.find({
        verificationStatus:
          "approved",

        accountStatus:
          "active",
      })
        .select(
          "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages bio linkedinProfile isVerified gender skills expertise"
        )
        .lean();


    console.log(
      "========================================"
    );

    console.log(
      "👨‍🏫 DATABASE MENTORS"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Total approved + active mentors:",
      mentors.length
    );


    // ========================================
    // ONLINE MENTORS MAP
    // ========================================

    const onlineMentors =
      req.app.get(
        "onlineMentors"
      );


    if (!onlineMentors) {
      return res.status(500).json({
        success: false,
        message:
          "Online mentor service is not available",
      });
    }


    console.log(
      "========================================"
    );

    console.log(
      "🟢 ONLINE MENTOR MAP"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Online Mentor IDs:",
      Array.from(
        onlineMentors.keys()
      )
    );

    console.log(
      "Online Mentor Count:",
      onlineMentors.size
    );


    // ========================================
    // FIND ELIGIBLE MENTORS
    // ========================================

    const eligibleMentors =
      mentors.filter(
        (mentor) => {

          console.log("\n");
          console.log(
            "========================================"
          );

          console.log(
            "🔍 CHECKING MENTOR"
          );

          console.log(
            "========================================"
          );


          console.log(
            "👤 Mentor Name     :",
            mentor.name
          );

          console.log(
            "📧 Email           :",
            mentor.email
          );

          console.log(
            "🆔 Mongo ID        :",
            mentor._id?.toString()
          );

          console.log(
            "🆔 Employee ID     :",
            mentor.employeeId
          );

          console.log(
            "🏢 Company         :",
            mentor.currentCompany
          );

          console.log(
            "💼 Designation     :",
            mentor.designation
          );

          console.log(
            "⚧ Gender           :",
            mentor.gender
          );

          console.log(
            "🗣️ Languages       :",
            mentor.languages
          );

          console.log(
            "🛠️ Skills          :",
            mentor.skills
          );

          console.log(
            "🎯 Expertise       :",
            mentor.expertise
          );


          // ========================================
          // 1. ONLINE CHECK
          // ========================================

          console.log(
            "\n1️⃣ ONLINE CHECK"
          );


          const socketIds =
            getMentorSocketIds(
              onlineMentors,
              mentor
            );


          console.log(
            "Socket IDs:",
            socketIds
          );


          if (
            socketIds.length === 0
          ) {

            console.log(
              "❌ FAIL → Mentor is OFFLINE"
            );

            return false;
          }


          console.log(
            "✅ PASS → Mentor is ONLINE"
          );


          // ========================================
          // 2. COMPANY CHECK
          // ========================================

          console.log(
            "\n2️⃣ COMPANY CHECK"
          );


          if (!requestedCompany) {

            console.log(
              "⏭️ SKIP → No company requested"
            );

          } else {

            const result =
              companyMatches(
                mentor,
                requestedCompany
              );


            console.log(
              "Requested Company:",
              requestedCompany
            );

            console.log(
              "Mentor Company:",
              mentor.currentCompany
            );

            console.log(
              "Match Result:",
              result
            );


            if (!result) {

              console.log(
                "❌ FAIL → COMPANY MISMATCH"
              );

              return false;
            }


            console.log(
              "✅ PASS → Company matched"
            );
          }


          // ========================================
          // 3. ROLE CHECK
          // ========================================

          console.log(
            "\n3️⃣ ROLE CHECK"
          );


          const roleResult =
            roleMatches(
              mentor,
              requestedRole,
              otherRole
            );


          console.log(
            "Requested Role:",
            requestedRole
          );

          console.log(
            "Mentor Designation:",
            mentor.designation
          );

          console.log(
            "Mentor Department:",
            mentor.department
          );

          console.log(
            "Mentor Skills:",
            mentor.skills
          );

          console.log(
            "Mentor Expertise:",
            mentor.expertise
          );

          console.log(
            "Role Match Result:",
            roleResult
          );


          if (!roleResult) {

            console.log(
              "❌ FAIL → ROLE MISMATCH"
            );

            return false;
          }


          console.log(
            "✅ PASS → Role matched"
          );


          // ========================================
          // 4. GENDER CHECK
          // ========================================

          console.log(
            "\n4️⃣ GENDER CHECK"
          );


          const genderResult =
            genderMatches(
              mentor,
              requestedGender
            );


          console.log(
            "Requested Gender:",
            requestedGender || "ANY"
          );

          console.log(
            "Mentor Gender:",
            mentor.gender
          );

          console.log(
            "Gender Match Result:",
            genderResult
          );


          if (!genderResult) {

            console.log(
              "❌ FAIL → GENDER MISMATCH"
            );

            return false;
          }


          console.log(
            "✅ PASS → Gender matched"
          );


          // ========================================
          // 5. LANGUAGE CHECK
          // ========================================

          console.log(
            "\n5️⃣ LANGUAGE CHECK"
          );


          const languageResult =
            languageMatches(
              mentor,
              requestedLanguage
            );


          console.log(
            "Requested Language:",
            requestedLanguage || "ANY"
          );

          console.log(
            "Mentor Languages:",
            mentor.languages
          );

          console.log(
            "Language Match Result:",
            languageResult
          );


          if (!languageResult) {

            console.log(
              "❌ FAIL → LANGUAGE MISMATCH"
            );

            return false;
          }


          console.log(
            "✅ PASS → Language matched"
          );


          // ========================================
          // FINAL
          // ========================================

          console.log(
            "\n🎉 ALL CHECKS PASSED!"
          );

          console.log(
            "✅ MENTOR IS ELIGIBLE"
          );


          return true;
        }
      );


    // ========================================
    // ELIGIBLE RESULT
    // ========================================

    console.log("\n");
    console.log(
      "========================================"
    );

    console.log(
      "🎯 ELIGIBLE MENTORS RESULT"
    );

    console.log(
      "========================================"
    );


    console.log(
      eligibleMentors.map(
        (mentor) => ({
          id:
            mentor._id?.toString(),

          name:
            mentor.name,

          email:
            mentor.email,

          employeeId:
            mentor.employeeId,

          company:
            mentor.currentCompany,

          designation:
            mentor.designation,

          gender:
            mentor.gender,

          languages:
            mentor.languages,
        })
      )
    );


    console.log(
      "Eligible Count:",
      eligibleMentors.length
    );


    // ========================================
    // NO ELIGIBLE MENTOR
    // ========================================

    if (
      eligibleMentors.length === 0
    ) {

      console.log(
        "❌ FINAL RESULT: NO ELIGIBLE ONLINE MENTOR"
      );


      return res.status(409).json({
        success: false,
        assigned: false,
        message:
          "No eligible online mentor is available right now",
      });
    }


    // ========================================
    // SELECT FIRST ELIGIBLE MENTOR
    // ========================================

    const selectedMentor =
      eligibleMentors[0];


    console.log(
      "========================================"
    );

    console.log(
      "🏆 SELECTED MENTOR"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Name:",
      selectedMentor.name
    );

    console.log(
      "Email:",
      selectedMentor.email
    );

    console.log(
      "Employee ID:",
      selectedMentor.employeeId
    );

    console.log(
      "Mongo ID:",
      selectedMentor._id?.toString()
    );


    // ========================================
    // GET SOCKET IDS AGAIN
    // ========================================

    let socketIds =
      getMentorSocketIds(
        onlineMentors,
        selectedMentor
      );


    if (
      socketIds.length === 0
    ) {

      return res.status(409).json({
        success: false,
        assigned: false,
        message:
          "Selected mentor went offline. Please try again",
      });
    }


    // ========================================
    // CREATE REQUEST OBJECT
    // ========================================

    const request = {

      id:
        requestGroupId,

      requestGroupId,


      companyName:
        requestedCompany,

      companyLogo:
        companyLogo || null,

      companyImage:
        companyImage || null,


      // ========================================
      // REQUESTER
      // ========================================

      name:
        requester.fullName ||
        requester.name ||
        "Fresher",

      avatar:
        requester.image ||
        requester.avatar ||
        "",


      requester: {

        fullName:
          requester.fullName ||
          requester.name ||
          "",

        email:
          requester.email,

        image:
          requester.image ||
          requester.avatar ||
          "",
      },


      // ========================================
      // SESSION
      // ========================================

      role:
        sessionDetails.role ||
        "Other",

      otherRole,

      company:
        requestedCompany,


      date:
        sessionDetails.date ||
        req.body.date ||
        "",


      time:
        sessionDetails.time ||
        req.body.time ||
        "",


      duration:
        sessionDetails.duration ||
        30,


      amount:
        Number(
          sessionDetails.amount || 0
        ),


      type:
        sessionDetails.sessionType ||
        "Video Call",


      sessionType:
        sessionDetails.sessionType ||
        "",


      sessionTypeValue:
        sessionDetails.sessionTypeValue ||
        "",


      gender:
        requestedGender,


      language:
        requestedLanguage,


      message:
        sessionDetails.message ||
        req.body.message ||
        "",


      // ========================================
      // PAYMENT
      // ========================================

      paymentMethod:
        paymentMethod || "",


      status:
        status || "pending",


      expiresAt:
        expiresAt || null,


      // ========================================
      // ASSIGNED MENTOR
      // ========================================

      assignedMentor: {

        id:
          selectedMentor._id?.toString(),

        employeeId:
          selectedMentor.employeeId,

        name:
          selectedMentor.name,

        email:
          selectedMentor.email,

        currentCompany:
          selectedMentor.currentCompany,
      },


      createdAt:
        new Date().toISOString(),
    };


    // ========================================
    // SAVE REQUEST
    // ========================================

    sessionRequests.set(
      String(requestGroupId),
      {
        ...request,

        assignedMentorId:
          selectedMentor._id?.toString(),
      }
    );


    // ========================================
    // SOCKET.IO
    // ========================================

    const io =
      req.app.get("io");


    if (!io) {

      sessionRequests.delete(
        String(requestGroupId)
      );


      return res.status(500).json({
        success: false,
        assigned: false,
        message:
          "Socket service is not available",
      });
    }


    // ========================================
    // FINAL ONLINE RE-CHECK
    // ========================================

    socketIds =
      getMentorSocketIds(
        onlineMentors,
        selectedMentor
      );


    if (
      socketIds.length === 0
    ) {

      sessionRequests.delete(
        String(requestGroupId)
      );


      return res.status(409).json({
        success: false,
        assigned: false,
        message:
          "Mentor went offline before request delivery",
      });
    }


    // ========================================
    // SEND REQUEST
    // ========================================

    console.log(
      "========================================"
    );

    console.log(
      "📤 SENDING SESSION REQUEST"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Request ID:",
      requestGroupId
    );

    console.log(
      "Mentor:",
      selectedMentor.name
    );

    console.log(
      "Socket IDs:",
      socketIds
    );


    for (
      const socketId of socketIds
    ) {

      io.to(socketId).emit(
        "session-request",
        request
      );
    }


    // ========================================
    // SUCCESS
    // ========================================

    console.log(
      "========================================"
    );

    console.log(
      "✅ SESSION REQUEST SENT SUCCESSFULLY"
    );

    console.log(
      "========================================"
    );


    return res.status(201).json({

      success: true,

      assigned: true,

      message:
        "Session request sent to an eligible online mentor",

      request,

      mentor: {

        id:
          selectedMentor._id?.toString(),

        employeeId:
          selectedMentor.employeeId,

        name:
          selectedMentor.name,

        email:
          selectedMentor.email,

        currentCompany:
          selectedMentor.currentCompany,
      },
    });


  } catch (error) {

    console.error(
      "========================================"
    );

    console.error(
      "❌ createSessionRequest ERROR"
    );

    console.error(error);

    console.error(
      "========================================"
    );


    return res.status(500).json({

      success: false,

      assigned: false,

      message:
        "Failed to create session request",

      error:
        error.message,
    });
  }
};


// ========================================
// GET SESSION REQUEST STATUS
// ========================================

const getSessionRequestStatus = async (
  req,
  res
) => {

  try {

    const requestGroupId =
      String(
        req.params.requestGroupId || ""
      ).trim();


    if (!requestGroupId) {

      return res.status(400).json({
        success: false,
        message:
          "requestGroupId is required",
      });
    }


    const request =
      sessionRequests.get(
        requestGroupId
      );


    if (!request) {

      return res.status(404).json({
        success: false,
        message:
          "Session request not found",
      });
    }


    return res.status(200).json({

      success: true,

      request,

      status:
        request.status ||
        "pending",

      assigned:
        Boolean(
          request.assignedMentorId
        ),
    });


  } catch (error) {

    console.error(
      "getSessionRequestStatus error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch session request status",
    });
  }
};


// ========================================
// UPDATE SESSION REQUEST STATUS
// ========================================

const updateSessionRequest = async (
  req,
  res
) => {

  try {

    const requestGroupId =
      String(
        req.params.requestGroupId || ""
      ).trim();


    const newStatus =
      String(
        req.body.status || ""
      )
        .trim()
        .toLowerCase();


    if (!requestGroupId) {

      return res.status(400).json({
        success: false,
        message:
          "requestGroupId is required",
      });
    }


    if (
      ![
        "accepted",
        "rejected",
      ].includes(newStatus)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Status must be either accepted or rejected",
      });
    }


    const request =
      sessionRequests.get(
        requestGroupId
      );


    if (!request) {

      return res.status(404).json({
        success: false,
        message:
          "Session request not found",
      });
    }


    const currentStatus =
      String(
        request.status ||
        "pending"
      )
        .trim()
        .toLowerCase();


    if (
      currentStatus !== "pending"
    ) {

      return res.status(400).json({
        success: false,
        message:
          `Request is already ${currentStatus}`,
      });
    }


    // ========================================
    // UPDATE STATUS
    // ========================================

    request.status =
      newStatus;


    request.updatedAt =
      new Date().toISOString();


    if (
      newStatus === "accepted"
    ) {

      request.acceptedAt =
        new Date().toISOString();
    }


    if (
      newStatus === "rejected"
    ) {

      request.rejectedAt =
        new Date().toISOString();
    }


    sessionRequests.set(
      requestGroupId,
      request
    );


    // ========================================
    // SEND STATUS TO FRESHER
    // ========================================

    const io =
      req.app.get("io");


    if (io) {

      io.emit(
        "session-request-status",
        {
          requestGroupId,
          status: newStatus,
          request,
        }
      );
    }


    return res.status(200).json({

      success: true,

      message:
        `Session request ${newStatus} successfully`,

      request,

      status:
        newStatus,
    });


  } catch (error) {

    console.error(
      "updateSessionRequest ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to update session request",

      error:
        error.message,
    });
  }
};

// ========================================
// GET ACCEPTED BOOKINGS FOR FRESHER
// ========================================

const getAcceptedBookings = async (req, res) => {
  try {
    const email = String(
      req.query.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const bookings = [];

    for (const request of sessionRequests.values()) {
      const requesterEmail = String(
        request.requester?.email || ""
      )
        .trim()
        .toLowerCase();

      const status = String(
        request.status || "pending"
      )
        .trim()
        .toLowerCase();

      if (
        requesterEmail === email &&
        status === "accepted"
      ) {
        bookings.push({
          ...request,

          bookingId:
            request.requestGroupId,

          sessionId:
            request.requestGroupId,

          mentorName:
            request.assignedMentor?.name ||
            "Mentor",

          mentor:
            request.assignedMentor?.name ||
            "Mentor",

          companyName:
            request.companyName ||
            request.company ||
            "MNC Company",

          date:
            request.date || "",

          time:
            request.time || "",

          status: "accepted",

          confirmed: true,
        });
      }
    }

    // Latest booking first
    bookings.sort(
      (a, b) =>
        new Date(
          b.acceptedAt || b.createdAt
        ) -
        new Date(
          a.acceptedAt || a.createdAt
        )
    );

    return res.status(200).json({
      success: true,
      bookings,
      count: bookings.length,
    });

  } catch (error) {
    console.error(
      "getAcceptedBookings ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch accepted bookings",
      error: error.message,
    });
  }
};

// ========================================
// EXPORTS
// ========================================

module.exports = {

  createSessionRequest,

  getSessionRequestStatus,

  updateSessionRequest,

    getAcceptedBookings,
};