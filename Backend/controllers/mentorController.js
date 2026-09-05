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




module.exports = {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
};