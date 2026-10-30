const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");

// ============================================================================
// HELPERS
// ============================================================================

const normalize = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalize(item))
      .filter(Boolean);
  }

  return [];
};

// Keeps original casing (for storing skills / languages)
const toCleanArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
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

  return first === second || first.includes(second) || second.includes(first);
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
  ];

  if (role === "other") {
    if (!otherRole) {
      return true;
    }

    return mentorValues.some((value) => valuesMatch(value, otherRole));
  }

  return mentorValues.some((value) => valuesMatch(value, requestedRole));
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

  if (!language || language === "no preference" || language === "any") {
    return true;
  }

  const mentorLanguages = normalizeArray(mentor.languages);

  return arrayContainsMatch(mentorLanguages, requestedLanguage);
};

const companyMatches = (mentor, companyName) => {
  if (!companyName) {
    return true;
  }

  return valuesMatch(mentor.currentCompany, companyName);
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
    const sockets = onlineMentors.get(String(id));

    if (sockets && sockets.size > 0) {
      return Array.from(sockets);
    }
  }

  return [];
};

// ============================================================================
// GET MENTOR PROFILE
// ============================================================================

const getMentorProfile = async (req, res) => {
  try {
    const email = normalize(req.params.mentoremail);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Mentor email is required",
      });
    }

    // Private verification documents and reset tokens are never returned here.
    const mentor = await Mentor.findOne({ email })
      .select(
        "-password -passwordResetToken -passwordResetExpires -offerLetter -employeeIdProof -additionalProof -offerLetterPublicId -employeeIdProofPublicId -additionalProofPublicId",
      )
      .lean();

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
    console.error("getMentorProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor profile",
    });
  }
};

// ============================================================================
// GET MENTORS GROUPED BY COMPANY
// ============================================================================

const getMentorsByCompany = async (req, res) => {
  try {
    const allMentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId currentCompany designation department officeLocation yearsOfExperience languages skills gender bio linkedinProfile isVerified",
      )
      .sort({
        currentCompany: 1,
        name: 1,
      })
      .lean();

    const onlineMentors = req.app.get("onlineMentors");

    const companiesMap = new Map();

    for (const mentor of allMentors) {
      const companyName = mentor.currentCompany?.trim();

      if (!companyName) {
        continue;
      }

      const socketIds = getMentorSocketIds(onlineMentors, mentor);
      const isOnline = socketIds.length > 0;

      if (!companiesMap.has(companyName)) {
        companiesMap.set(companyName, {
          companyName,
          employeeCount: 0,
          onlineCount: 0,
          mentors: [],
        });
      }

      const company = companiesMap.get(companyName);

      company.employeeCount += 1;

      if (isOnline) {
        company.onlineCount += 1;
      }

      company.mentors.push({
        ...mentor,
        isOnline,
      });
    }

    const companies = Array.from(companiesMap.values());

    return res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    console.error("getMentorsByCompany error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentors",
    });
  }
};

// ============================================================================
// UPDATE MENTOR PROFILE
// ============================================================================

// Only fields that really exist in the Mentor schema.
// (phone, githubProfile, education, dob, city ... were removed because
// mongoose silently drops fields that are not in the schema.)
const ALLOWED_UPDATE_FIELDS = [
  "name",
  "countryCode",
  "mobile",
  "currentCompany",
  "designation",
  "department",
  "officeLocation",
  "yearsOfExperience",
  "languages",
  "skills",
  "bio",
  "linkedinProfile",
  "gender",
  "profilePic",
];

const UpdateMentorProfile = async (req, res) => {
  try {
    const mentoremail = normalize(req.params.mentoremail);

    if (!mentoremail) {
      return res.status(400).json({
        success: false,
        message: "Mentor email is required",
      });
    }

    const body = req.body || {};
    const updateData = {};

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updateData[field] = body[field];
      }
    }

    // ---- sanitize / normalize ------------------------------------------------

    if ("countryCode" in updateData || "mobile" in updateData) {
      const current = await Mentor.findOne({ email: mentoremail }).select(
        "countryCode mobile",
      );

      if (!current) {
        return res.status(404).json({
          success: false,
          message: "Mentor not found",
        });
      }

      const oldCode = current.countryCode || "+91";

      let code =
        "countryCode" in updateData
          ? String(updateData.countryCode || "").trim()
          : oldCode;
      if (code && !code.startsWith("+")) code = `+${code}`;

      if (!/^\+\d{1,4}$/.test(code)) {
        return res.status(400).json({
          success: false,
          message: "Invalid country code",
        });
      }

      // national digits: from the request, or from the stored number
      let national;
      if ("mobile" in updateData) {
        const raw = String(updateData.mobile || "").replace(/[\s\-()]/g, "");
        national = raw.startsWith(code) ? raw.slice(code.length) : raw;
      } else {
        const stored = String(current.mobile || "");
        national = stored.startsWith(oldCode)
          ? stored.slice(oldCode.length)
          : stored;
      }
      national = national.replace(/\D/g, "");

      const totalDigits = code.length - 1 + national.length;
      const invalid =
        code === "+91"
          ? national.length !== 10
          : national.length < 6 || totalDigits > 15;

      if (invalid) {
        return res.status(400).json({
          success: false,
          message:
            code === "+91"
              ? "Indian mobile number must be exactly 10 digits"
              : "Enter a valid mobile number for the selected country",
        });
      }

      const fullMobile = `${code}${national}`;

      const [mentorClash, fresherClash] = await Promise.all([
        Mentor.exists({ mobile: fullMobile, email: { $ne: mentoremail } }),
        Fresher.exists({ mobile: fullMobile }),
      ]);

      if (mentorClash || fresherClash) {
        return res.status(409).json({
          success: false,
          message: "This mobile number is already registered",
        });
      }

      updateData.countryCode = code;
      updateData.mobile = fullMobile;
    }

    if ("gender" in updateData) {
      updateData.gender = normalize(updateData.gender);
    }

    if ("languages" in updateData) {
      updateData.languages = toCleanArray(updateData.languages);
    }

    if ("skills" in updateData) {
      updateData.skills = toCleanArray(updateData.skills);
    }

    if ("yearsOfExperience" in updateData) {
      updateData.yearsOfExperience = Number(updateData.yearsOfExperience) || 0;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const mentor = await Mentor.findOneAndUpdate(
      { email: mentoremail },
      { $set: updateData },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select(
      "name email countryCode mobile gender skills profilePic employeeId workEmail linkedinProfile yearsOfExperience currentCompany designation department officeLocation languages  bio isVerified verificationStatus verificationMethod accountStatus lastLoginAt",
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
    console.error("UpdateMentorProfile error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update mentor profile",
    });
  }
};

// ============================================================================
// DEPARTMENTS OF A COMPANY (used by the booking form)
// GET /api/mentor/company-departments/:companyName
// ============================================================================

const getCompanyDepartments = async (req, res) => {
  try {
    const company = normalize(req.params.companyName);

    if (!company) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }

    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select("currentCompany designation")
      .lean();

    // normalized designation -> first spelling seen
    // ("software engineer" and "Software Engineer" become ONE entry)
    const seen = new Map();

    for (const m of mentors) {
      if (!valuesMatch(m.currentCompany, company)) continue;

      const role = String(m.designation || "")
        .trim()
        .replace(/\s+/g, " ");
      const key = normalize(role);

      if (key && !seen.has(key)) seen.set(key, role);
    }

    const departments = [...seen.values()].sort((a, b) => a.localeCompare(b));

    // key stays "departments" so the frontend does not change
    return res.status(200).json({ success: true, departments });
  } catch (error) {
    console.error("getCompanyDepartments error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load roles" });
  }
};

module.exports = {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  getCompanyDepartments,
};
