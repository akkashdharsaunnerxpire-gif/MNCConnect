const Mentor = require("../models/Mentor");

const sessionRequests = new Map();

const normalize = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalize(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalize(item))
      .filter(Boolean);
  }

  return [];
};

const valuesMatch = (value1, value2) => {
  const first = normalize(value1);
  const second = normalize(value2);

  if (!first || !second) {
    return false;
  }

  return (
    first === second ||
    first.includes(second) ||
    second.includes(first)
  );
};

const arrayContainsMatch = (array, value) => {
  const target = normalize(value);

  if (!target) {
    return false;
  }

  return array.some((item) => {
    const normalizedItem = normalize(item);

    return (
      normalizedItem === target ||
      normalizedItem.includes(target) ||
      target.includes(normalizedItem)
    );
  });
};

const roleMatches = (mentor, requestedRole, otherRole) => {
  const role = normalize(requestedRole);

  if (!role || role === "any" || role === "no preference") {
    return true;
  }

  const mentorValues = [
    mentor.designation,
    mentor.department,
    mentor.bio,
    ...(Array.isArray(mentor.skills) ? mentor.skills : []),
    ...(Array.isArray(mentor.expertise) ? mentor.expertise : []),
  ];

  if (role === "other") {
    if (!otherRole) {
      return true;
    }

    return mentorValues.some((value) =>
      valuesMatch(value, otherRole)
    );
  }

  return mentorValues.some((value) =>
    valuesMatch(value, requestedRole)
  );
};

const genderMatches = (mentor, requestedGender) => {
  const gender = normalize(requestedGender);

  if (
    !gender ||
    gender === "no preference" ||
    gender === "any" ||
    gender === "none"
  ) {
    return true;
  }

  if (!mentor.gender) {
    return false;
  }

  return valuesMatch(mentor.gender, requestedGender);
};

const languageMatches = (mentor, requestedLanguage) => {
  const language = normalize(requestedLanguage);

  if (
    !language ||
    language === "no preference" ||
    language === "any"
  ) {
    return true;
  }

  const mentorLanguages = normalizeArray(
    mentor.languages
  );

  return arrayContainsMatch(
    mentorLanguages,
    requestedLanguage
  );
};

const companyMatches = (mentor, companyName) => {
  if (!companyName) {
    return true;
  }

  return valuesMatch(
    mentor.currentCompany,
    companyName
  );
};

const getMentorSocketIds = (onlineMentors, mentor) => {
  if (!onlineMentors || !mentor) {
    return [];
  }

  const possibleIds = [
    mentor._id?.toString(),
    mentor.employeeId,
    mentor.email,
  ].filter(Boolean);

  for (const id of possibleIds) {
    const sockets = onlineMentors.get(
      String(id)
    );

    if (sockets && sockets.size > 0) {
      return Array.from(sockets);
    }
  }

  return [];
};

const getMentorProfile = async (req, res) => {
  try {
    const email = normalize(
      req.params.mentoremail
    );

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Mentor email is required",
      });
    }

    const mentor = await Mentor.findOne({
      email,
    }).lean();

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    return res.status(200).json({
      success: true,
      mentor,
    });
  } catch (error) {
    console.error(
      "getMentorProfile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor profile",
    });
  }
};

const getMentorsByCompany = async (req, res) => {
  try {
    const allMentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages bio linkedinProfile isVerified"
      )
      .sort({
        currentCompany: 1,
        name: 1,
      })
      .lean();

    const io = req.app.get("io");
    const onlineMentors =
      req.app.get("onlineMentors");

    const companiesMap = new Map();

    for (const mentor of allMentors) {
      const companyName =
        mentor.currentCompany?.trim();

      if (!companyName) {
        continue;
      }

      const socketIds = getMentorSocketIds(
        onlineMentors,
        mentor
      );

      const isOnline =
        socketIds.length > 0;

      if (!companiesMap.has(companyName)) {
        companiesMap.set(companyName, {
          companyName,
          employeeCount: 0,
          onlineCount: 0,
          mentors: [],
        });
      }

      const company =
        companiesMap.get(companyName);

      company.employeeCount += 1;

      if (isOnline) {
        company.onlineCount += 1;
      }

      company.mentors.push({
        ...mentor,
        isOnline,
      });
    }

    const companies = Array.from(
      companiesMap.values()
    );

    return res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    console.error(
      "getMentorsByCompany error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentors",
    });
  }
};

const UpdateMentorProfile = async (
  req,
  res
) => {
  try {
    const mentoremail = normalize(
      req.params.mentoremail
    );

    if (!mentoremail) {
      return res.status(400).json({
        success: false,
        message: "Mentor email is required",
      });
    }

    const allowedFields = [
      "name",
      "phone",
      "mobile",
      "currentCompany",
      "designation",
      "department",
      "officeLocation",
      "yearsOfExperience",
      "languages",
      "bio",
      "linkedinProfile",
      "githubProfile",
      "qualification",
      "education",
      "college",
      "university",
      "skills",
      "expertise",
      "gender",
      "dob",
      "address",
      "city",
      "profilePic",
      "hourlyRate",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        updateData[field] =
          req.body[field];
      }
    }

    if (
      Object.keys(updateData).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const mentor =
      await Mentor.findOneAndUpdate(
        { email: mentoremail },
        {
          $set: updateData,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "name email countryCode mobile profilePic employeeId workEmail linkedinProfile yearsOfExperience currentCompany designation department officeLocation languages hourlyRate bio isVerified verificationStatus verificationMethod accountStatus lastLoginAt"
      );

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mentor profile updated successfully",
      mentor,
    });
  } catch (error) {
    console.error(
      "UpdateMentorProfile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update mentor profile",
      error: error.message,
    });
  }
};

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

    // ========================================
    // REQUEST VALIDATION
    // ========================================

    if (!requestGroupId) {
      return res.status(400).json({
        success: false,
        message: "requestGroupId is required",
      });
    }

    if (!requester?.email) {
      return res.status(400).json({
        success: false,
        message: "Requester email is required",
      });
    }

    if (!sessionDetails) {
      return res.status(400).json({
        success: false,
        message: "Session details are required",
      });
    }

    // ========================================
    // REQUEST FILTER VALUES
    // ========================================

    const requestedCompany =
      String(companyName || "").trim();

    const requestedRole =
      String(sessionDetails.role || "").trim();

    const otherRole =
      String(sessionDetails.otherRole || "").trim();

    const requestedGender =
      String(sessionDetails.gender || "").trim();

    const requestedLanguage =
      String(sessionDetails.language || "").trim();

    // ========================================
    // REQUEST DEBUG
    // ========================================

    console.log("\n");
    console.log("========================================");
    console.log("📥 SESSION REQUEST FILTERS");
    console.log("========================================");
    console.log("Request Group ID :", requestGroupId);
    console.log("Company          :", requestedCompany || "(Any)");
    console.log("Role             :", requestedRole || "(Any)");
    console.log("Other Role       :", otherRole || "(None)");
    console.log("Gender           :", requestedGender || "(Any)");
    console.log("Language         :", requestedLanguage || "(Any)");
    console.log("========================================");
    console.log("\n");

    // ========================================
    // GET VERIFIED ACTIVE MENTORS
    // ========================================

    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages bio linkedinProfile isVerified gender skills expertise"
      )
      .lean();

    console.log("========================================");
    console.log("👨‍🏫 DATABASE MENTORS");
    console.log("========================================");
    console.log("Total approved + active mentors:", mentors.length);
    console.log("========================================");
    console.log("\n");

    // ========================================
    // ONLINE MENTORS MAP
    // ========================================

    const onlineMentors =
      req.app.get("onlineMentors");

    if (!onlineMentors) {
      return res.status(500).json({
        success: false,
        message: "Online mentor service is not available",
      });
    }

    console.log("========================================");
    console.log("🟢 ONLINE MENTOR MAP");
    console.log("========================================");
    console.log(
      "Online Mentor IDs:",
      Array.from(onlineMentors.keys())
    );
    console.log(
      "Online Mentor Count:",
      onlineMentors.size
    );
    console.log("========================================");
    console.log("\n");

    // ========================================
    // FIND ELIGIBLE MENTORS
    // ========================================

    const eligibleMentors = mentors.filter((mentor) => {
      console.log("\n");
      console.log("========================================");
      console.log("🔍 CHECKING MENTOR");
      console.log("========================================");

      console.log("👤 Mentor Name     :", mentor.name);
      console.log("📧 Email           :", mentor.email);
      console.log("🆔 Mongo ID        :", mentor._id?.toString());
      console.log("🆔 Employee ID     :", mentor.employeeId);
      console.log("🏢 Company         :", mentor.currentCompany);
      console.log("💼 Designation     :", mentor.designation);
      console.log("⚧ Gender           :", mentor.gender);
      console.log("🗣️ Languages       :", mentor.languages);
      console.log("🛠️ Skills          :", mentor.skills);
      console.log("🎯 Expertise       :", mentor.expertise);

      console.log("\n📥 REQUESTED VALUES");
      console.log("Company           :", requestedCompany || "ANY");
      console.log("Role              :", requestedRole || "ANY");
      console.log("Other Role        :", otherRole || "NONE");
      console.log("Gender            :", requestedGender || "ANY");
      console.log("Language          :", requestedLanguage || "ANY");

      // ========================================
      // 1. ONLINE CHECK
      // ========================================

      const socketIds = getMentorSocketIds(
        onlineMentors,
        mentor
      );

      console.log("\n1️⃣ ONLINE CHECK");
      console.log("Socket IDs:", socketIds);

      if (socketIds.length === 0) {
        console.log("❌ FAIL → Mentor is OFFLINE");
        console.log("========================================");
        return false;
      }

      console.log("✅ PASS → Mentor is ONLINE");

      // ========================================
      // 2. COMPANY CHECK
      // ========================================

      console.log("\n2️⃣ COMPANY CHECK");

      if (!requestedCompany) {
        console.log("⏭️ SKIP → No company requested");
      } else {
        const result = companyMatches(
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

        console.log("Match Result:", result);

        if (!result) {
          console.log("❌ FAIL → COMPANY MISMATCH");
          console.log("========================================");
          return false;
        }

        console.log("✅ PASS → Company matched");
      }

      // ========================================
      // 3. ROLE CHECK
      // ========================================

      console.log("\n3️⃣ ROLE CHECK");

      const roleResult = roleMatches(
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
        console.log("❌ FAIL → ROLE MISMATCH");
        console.log("========================================");
        return false;
      }

      console.log("✅ PASS → Role matched");

      // ========================================
      // 4. GENDER CHECK
      // ========================================

      console.log("\n4️⃣ GENDER CHECK");

      const genderResult = genderMatches(
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
        console.log("❌ FAIL → GENDER MISMATCH");
        console.log("========================================");
        return false;
      }

      console.log("✅ PASS → Gender matched");

      // ========================================
      // 5. LANGUAGE CHECK
      // ========================================

      console.log("\n5️⃣ LANGUAGE CHECK");

      const languageResult = languageMatches(
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
        console.log("❌ FAIL → LANGUAGE MISMATCH");
        console.log("========================================");
        return false;
      }

      console.log("✅ PASS → Language matched");

      // ========================================
      // FINAL
      // ========================================

      console.log("\n🎉 ALL CHECKS PASSED!");
      console.log("✅ MENTOR IS ELIGIBLE");
      console.log("========================================");

      return true;
    });

    // ========================================
    // ELIGIBLE MENTORS RESULT
    // ========================================

    console.log("\n");
    console.log("========================================");
    console.log("🎯 ELIGIBLE MENTORS RESULT");
    console.log("========================================");

    console.log(
      eligibleMentors.map((mentor) => ({
        id: mentor._id?.toString(),
        name: mentor.name,
        email: mentor.email,
        employeeId: mentor.employeeId,
        company: mentor.currentCompany,
        designation: mentor.designation,
        gender: mentor.gender,
        languages: mentor.languages,
      }))
    );

    console.log(
      "Eligible Count:",
      eligibleMentors.length
    );

    console.log("========================================");
    console.log("\n");

    // ========================================
    // NO ELIGIBLE MENTOR
    // ========================================

    if (eligibleMentors.length === 0) {
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

    console.log("========================================");
    console.log("🏆 SELECTED MENTOR");
    console.log("========================================");

    console.log(
      "Name       :",
      selectedMentor.name
    );

    console.log(
      "Email      :",
      selectedMentor.email
    );

    console.log(
      "Employee ID:",
      selectedMentor.employeeId
    );

    console.log(
      "Mongo ID   :",
      selectedMentor._id?.toString()
    );

    console.log("========================================");
    console.log("\n");

    // ========================================
    // GET SOCKET IDS
    // ========================================

    let socketIds =
      getMentorSocketIds(
        onlineMentors,
        selectedMentor
      );

    if (socketIds.length === 0) {
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
      id: requestGroupId,

      requestGroupId,

      companyName:
        requestedCompany,

      companyLogo:
        companyLogo || null,

      companyImage:
        companyImage || null,

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

      paymentMethod:
        paymentMethod || "",

      status:
        status || "pending",

      expiresAt:
        expiresAt || null,

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
    // SAVE SESSION REQUEST
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

    // Re-check mentor online status
    socketIds =
      getMentorSocketIds(
        onlineMentors,
        selectedMentor
      );

    if (socketIds.length === 0) {
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
    // SEND REQUEST TO MENTOR
    // ========================================

    console.log("========================================");
    console.log("📤 SENDING SESSION REQUEST");
    console.log("========================================");

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

    console.log("========================================");
    console.log("\n");

    for (const socketId of socketIds) {
      io.to(socketId).emit(
        "session-request",
        request
      );
    }

    // ========================================
    // SUCCESS
    // ========================================

    console.log("========================================");
    console.log("✅ SESSION REQUEST SENT SUCCESSFULLY");
    console.log("========================================");

    console.log(
      `Request ${requestGroupId} sent to ${selectedMentor.name} (${selectedMentor.email})`
    );

    console.log("========================================");
    console.log("\n");

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
      error: error.message,
    });
  }
};

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
        request.status || "pending",
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

module.exports = {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  createSessionRequest,
  getSessionRequestStatus,
};