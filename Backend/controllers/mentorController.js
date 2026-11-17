const Mentor = require("../models/Mentor");
const Fresher = require("../models/Fresher");
const { parsePhone } = require("../utils/phone");
// ============================================================================
// HELPERS
// ============================================================================

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeArray = (value) => {
  if (Array.isArray(value))
    return value.map((i) => normalize(i)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((i) => normalize(i))
      .filter(Boolean);
  }
  return [];
};

// Keeps original casing (for storing skills / languages). Capped so nobody stores 10 000 tags.
const toCleanArray = (value, maxItems = 30, maxLen = 40) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const s = String(item || "")
      .trim()
      .slice(0, maxLen);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
};

const valuesMatch = (value1, value2) => {
  const first = normalize(value1);
  const second = normalize(value2);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getMentorSocketIds = (onlineMentors, mentor) => {
  if (!onlineMentors || !mentor) return [];

  const possibleIds = [
    mentor._id?.toString(),
    mentor.employeeId,
    mentor.email,
  ].filter(Boolean);

  for (const id of possibleIds) {
    const sockets = onlineMentors.get(String(id));
    if (sockets && sockets.size > 0) return Array.from(sockets);
  }
  return [];
};

// true only when the logged-in user IS this mentor
const isOwner = (req, mentorId) =>
  req.user?.role === "mentor" &&
  String(req.user.id || req.user._id || "") === String(mentorId);

// ============================================================================
// GET MENTOR PROFILE
// Owner  -> full profile (own documents included, internal ids / secrets removed)
// Others -> PUBLIC fields only (no email / mobile / linkedin / employee id / documents)
// ============================================================================

const getMentorProfile = async (req, res) => {
  try {
    const email = normalize(req.params.mentoremail);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Mentor email is required" });
    }

    const mentor = await Mentor.findOne({ email })
      .select(
        "-password -passwordResetToken -passwordResetExpires -offerLetterPublicId -employeeIdProofPublicId -additionalProofPublicId",
      )
      .lean();

    if (!mentor) {
      return res
        .status(404)
        .json({ success: false, message: "Mentor not found" });
    }

    if (!isOwner(req, mentor._id)) {
      return res.status(200).json({
        success: true,
        mentor: {
          _id: mentor._id,
          name: mentor.name,
          profilePic: mentor.profilePic,
          mentorCode: mentor.mentorCode,
          currentCompany: mentor.currentCompany,
          designation: mentor.designation,
          department: mentor.department,
          officeLocation: mentor.officeLocation,
          yearsOfExperience: mentor.yearsOfExperience,
          languages: mentor.languages,
          skills: mentor.skills,
          bio: mentor.bio,
          isVerified: mentor.isVerified,
          rating: mentor.rating || 0,
          totalReviews: mentor.totalReviews || 0,
          totalSessions: mentor.totalSessions || 0,
        },
      });
    }

    return res.status(200).json({ success: true, mentor });
  } catch (error) {
    console.error("getMentorProfile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch mentor profile" });
  }
};

// ============================================================================
// GET MENTORS GROUPED BY COMPANY
// ============================================================================

const getMentorsByCompany = async (req, res) => {
  try {
    // email / employeeId are selected ONLY to check the online status.
    // They are removed before the response is sent.
    const allMentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
    })
      .select(
        "name email profilePic employeeId mentorCode currentCompany designation department officeLocation yearsOfExperience languages skills gender bio linkedinProfile isVerified rating totalReviews totalSessions",
      )
      .sort({ currentCompany: 1, name: 1 })
      .limit(1000) // raise / paginate when you have more mentors than this
      .lean();

    const onlineMentors = req.app.get("onlineMentors");
    const companiesMap = new Map();

    for (const mentor of allMentors) {
      const companyName = mentor.currentCompany?.trim();
      if (!companyName) continue;

      const isOnline = getMentorSocketIds(onlineMentors, mentor).length > 0;

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
      if (isOnline) company.onlineCount += 1;

      // strip contact details before sending to the fresher
      // eslint-disable-next-line no-unused-vars
      const { email, employeeId, linkedinProfile, ...safeMentor } = mentor;
      company.mentors.push({ ...safeMentor, isOnline });
    }

    const companies = Array.from(companiesMap.values());
    return res
      .status(200)
      .json({ success: true, count: companies.length, companies });
  } catch (error) {
    console.error("getMentorsByCompany error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch mentors" });
  }
};

// ============================================================================
// UPDATE MENTOR PROFILE (only the mentor himself)
//
// EDITABLE : contact + about fields.
// LOCKED   : currentCompany, designation, department, employeeId, workEmail, gender,
//            documents, profilePic (photo has its own endpoint /auth/avatar).
//            They were verified by the admin, so a mentor must not change them here.
//            (change them through support / an admin re-verification)
// ============================================================================

const ALLOWED_UPDATE_FIELDS = [
  "name",
  "countryCode",
  "mobile",
  "officeLocation",
  "yearsOfExperience",
  "languages",
  "skills",
  "bio",
  "linkedinProfile",
];

const LINKEDIN_RE = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s]+$/i;

const UpdateMentorProfile = async (req, res) => {
  try {
    const mentoremail = normalize(req.params.mentoremail);
    if (!mentoremail) {
      return res
        .status(400)
        .json({ success: false, message: "Mentor email is required" });
    }

    // ---- ownership: nobody can edit another mentor's profile ----
    const current = await Mentor.findOne({ email: mentoremail }).select(
      "_id countryCode mobile",
    );
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: "Mentor not found" });
    }
    if (!isOwner(req, current._id)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const body = req.body || {};
    const updateData = {};

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updateData[field] = body[field];
      }
    }

    // ---- sanitize / normalize ------------------------------------------------

    if ("name" in updateData) {
      updateData.name = String(updateData.name || "")
        .trim()
        .replace(/\s+/g, " ");
    }

    if ("officeLocation" in updateData) {
      updateData.officeLocation = String(updateData.officeLocation || "")
        .trim()
        .slice(0, 120);
    }

    if ("linkedinProfile" in updateData) {
      const url = String(updateData.linkedinProfile || "").trim();
      if (url && !LINKEDIN_RE.test(url)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid LinkedIn URL (https://linkedin.com/in/...)",
        });
      }
      updateData.linkedinProfile = url;
    }

    if ("countryCode" in updateData || "mobile" in updateData) {
      const phone = parsePhone(
        "countryCode" in updateData
          ? updateData.countryCode
          : current.countryCode,
        "mobile" in updateData ? updateData.mobile : current.mobile,
      );
      if (phone.error) {
        return res.status(400).json({ success: false, message: phone.error });
      }

      const [mentorClash, fresherClash] = await Promise.all([
        Mentor.exists({ _id: { $ne: current._id }, mobile: phone.full }),
        Fresher.exists({ mobile: phone.full }),
      ]);
      if (mentorClash || fresherClash) {
        return res.status(409).json({
          success: false,
          message: "This mobile number is already registered",
        });
      }

      updateData.countryCode = phone.code;
      updateData.mobile = phone.full;
    }

    if ("languages" in updateData)
      updateData.languages = toCleanArray(updateData.languages);
    if ("skills" in updateData)
      updateData.skills = toCleanArray(updateData.skills);

    if ("yearsOfExperience" in updateData) {
      const years = Number(updateData.yearsOfExperience);
      updateData.yearsOfExperience = Number.isFinite(years)
        ? Math.min(Math.max(years, 0), 60)
        : 0;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields to update" });
    }

    const mentor = await Mentor.findOneAndUpdate(
      { _id: current._id },
      { $set: updateData },
      { returnDocument: "after", runValidators: true },
    ).select(
      "name email countryCode mobile gender skills profilePic employeeId workEmail linkedinProfile yearsOfExperience currentCompany designation department officeLocation languages bio isVerified verificationStatus verificationMethod accountStatus lastLoginAt mentorCode rating totalReviews totalSessions",
    );

    if (!mentor) {
      return res
        .status(404)
        .json({ success: false, message: "Mentor not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Mentor profile updated successfully",
      mentor,
    });
  } catch (error) {
    console.error("UpdateMentorProfile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to update mentor profile" });
  }
};

// ============================================================================
// DEPARTMENTS / ROLES OF A COMPANY (used by the booking form)
// GET /api/mentor/company-departments/:companyName   (fresher login)
// ============================================================================

const getCompanyDepartments = async (req, res) => {
  try {
    const company = normalize(req.params.companyName);
    if (!company) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }

    // narrow in the DATABASE first (contains, case-insensitive), then the same loose rule
    // the matching code uses -> no more loading every mentor into memory
    const mentors = await Mentor.find({
      verificationStatus: "approved",
      accountStatus: "active",
      currentCompany: new RegExp(escapeRegex(company), "i"),
    })
      .select("currentCompany designation")
      .lean();

    // normalized designation -> first spelling seen
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

// ============================================================================
// SEARCH ONE EMPLOYEE OF A COMPANY (name or public mentor code) -> direct booking
// GET /api/mentor/company-search/:companyName?q=...   (fresher login)
// Returns NO contact details (no email / mobile / linkedin / employee id).
// The company's private employeeId is NOT searchable (it would let a fresher guess IDs).
// ============================================================================

const searchCompanyMentors = async (req, res) => {
  try {
    const company = String(req.params.companyName || "").trim();
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 40);
    const LIMIT = 10;
    const SELECT =
      "name designation department profilePic mentorCode currentCompany yearsOfExperience languages skills rating totalReviews totalSessions";

    if (!company) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }

    // ONLY this company (exact match, case-insensitive)
    const filter = {
      verificationStatus: "approved",
      accountStatus: "active",
      currentCompany: new RegExp(`^${escapeRegex(company)}$`, "i"),
    };

    if (q) {
      const safe = escapeRegex(q);
      filter.$or = [
        { name: new RegExp(safe, "i") }, // name: partial match
        { mentorCode: new RegExp(`^${safe}`, "i") }, // ARUN#4356356: full or starting part
      ];
    }

    const total = await Mentor.countDocuments(filter);

    const online = req.app.get("onlineMentors");
    const isOnlineId = (id) => {
      const entry = online && online.get(String(id));
      return Boolean(entry && (entry.size === undefined || entry.size > 0));
    };

    // online employees first, then the rest (A-Z). Only 10 in total.
    let list = [];

    if (online && online.size) {
      const onlineIds = [...online.keys()].filter(
        (id) => /^[a-f\d]{24}$/i.test(String(id)) && isOnlineId(id),
      );
      if (onlineIds.length) {
        list = await Mentor.find({ ...filter, _id: { $in: onlineIds } })
          .select(SELECT)
          .sort({ name: 1, _id: 1 })
          .limit(LIMIT)
          .lean();
      }
    }

    if (list.length < LIMIT) {
      const rest = await Mentor.find({
        ...filter,
        _id: { $nin: list.map((m) => m._id) },
      })
        .select(SELECT)
        .sort({ name: 1, _id: 1 })
        .limit(LIMIT - list.length)
        .lean();
      list = [...list, ...rest];
    }

    const mentors = list.map((m) => ({
      id: String(m._id),
      name: m.name,
      designation: m.designation || "",
      department: m.department || "",
      image: m.profilePic || "",
      companyName: m.currentCompany || company,
      code: m.mentorCode || "",
      yearsOfExperience: m.yearsOfExperience || 0,
      languages: m.languages || [],
      skills: m.skills || [],
      // counters are kept on the Mentor document (createReview / settleCompleted)
      rating: Number(m.rating) || 0,
      reviewsCount: Number(m.totalReviews) || 0,
      sessionsCompleted: Number(m.totalSessions) || 0,
      isOnline: isOnlineId(m._id),
    }));

    return res.json({ success: true, mentors, total, limit: LIMIT });
  } catch (error) {
    console.error("searchCompanyMentors error:", error);
    return res.status(500).json({ success: false, message: "Search failed" });
  }
};

module.exports = {
  getMentorProfile,
  getMentorsByCompany,
  UpdateMentorProfile,
  getCompanyDepartments,
  searchCompanyMentors,
};
