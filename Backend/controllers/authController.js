const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs/promises");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");

// =====================================================
// JWT
// =====================================================

const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      id: id.toString(),
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// =====================================================
// HELPERS
// =====================================================

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const validatePassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
};

// =====================================================
// SANITIZE FRESHER
// =====================================================

const sanitizeFresher = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || "",
    countryCode: user.countryCode || "+91",
    fullMobile: (user.countryCode || "+91") + (user.mobile || ""),
    role: "fresher",
    profilePic: user.profilePic || "",
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
};

// =====================================================
// SANITIZE MENTOR
// =====================================================

const sanitizeMentor = (mentor) => {
  return {
    id: mentor._id,
    name: mentor.name,
    email: mentor.email,
    mobile: mentor.mobile || "",
    countryCode: mentor.countryCode || "+91",
    fullMobile: (mentor.countryCode || "+91") + (mentor.mobile || ""),
    role: "mentor",
    profilePic: mentor.profilePic || "",
    lastLoginAt: mentor.lastLoginAt,
    createdAt: mentor.createdAt,
    company: mentor.currentCompany,
    designation: mentor.designation,
    department: mentor.department,
    experience: mentor.yearsOfExperience,
    location: mentor.officeLocation,
    linkedin: mentor.linkedinProfile,
    skills: mentor.languages,
    bio: mentor.bio,
    isVerified: mentor.isVerified,
    verificationStatus: mentor.verificationStatus,
    accountStatus: mentor.accountStatus,
  };
};

// =====================================================
// 1. FRESHER REGISTER
// POST /api/auth/fresher/register
// =====================================================

exports.registerFresher = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      countryCode,
      password,
    } = req.body;

    console.log("FRESHER REGISTER BODY:", req.body);

    // =====================================================
    // STRICT VALIDATIONS - FRESHER
    // =====================================================

    // 1. Check required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required.",
      });
    }

    // 2. Validate name
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // 4. Validate password
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    // 5. Validate mobile number - FIXED
    const mobileRegex = /^[0-9]{10}$/;
    let cleanMobileForValidation = String(mobile).replace(/[\s\-\(\)]/g, '');
    
    // Remove country code if present in the mobile string
    if (cleanMobileForValidation.startsWith('+')) {
      const digitsOnly = cleanMobileForValidation.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 10) {
        cleanMobileForValidation = digitsOnly.slice(-10);
      }
    }
    
    // If it has country code without + (e.g., "918015874936")
    if (cleanMobileForValidation.length > 10 && /^\d{11,13}$/.test(cleanMobileForValidation)) {
      cleanMobileForValidation = cleanMobileForValidation.slice(-10);
    }
    
    if (!mobileRegex.test(cleanMobileForValidation)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit mobile number.",
      });
    }

    // 6. Validate country code
    const countryCodeRegex = /^\+\d{1,4}$/;
    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith('+')) {
      cleanCountryCode = '+' + cleanCountryCode;
    }
    if (!countryCodeRegex.test(cleanCountryCode)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid country code (e.g., +91).",
      });
    }

    // Clean and prepare data
    const cleanName = String(name).trim();
    const normalizedEmail = normalizeEmail(email);
    const cleanMobile = cleanCountryCode + cleanMobileForValidation;

    console.log("Cleaned mobile:", cleanMobile);

    // =====================================================
    // UNIQUENESS CHECKS - FRESHER
    // =====================================================

    // Check email in Fresher collection
    const existingFresherByEmail = await Fresher.findOne({
      email: normalizedEmail,
    });

    if (existingFresherByEmail) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }

    // Check email in Mentor collection
    const existingMentorByEmail = await Mentor.findOne({
      email: normalizedEmail,
    });

    if (existingMentorByEmail) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a mentor.",
      });
    }

    // Check mobile in Fresher collection
    const existingFresherByMobile = await Fresher.findOne({
      mobile: cleanMobile,
    });

    if (existingFresherByMobile) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a fresher account.",
      });
    }

    // Check mobile in Mentor collection
    const existingMentorByMobile = await Mentor.findOne({
      mobile: cleanMobile,
    });

    if (existingMentorByMobile) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a mentor account.",
      });
    }

    // =====================================================
    // CREATE FRESHER
    // =====================================================

    const hashedPassword = await bcrypt.hash(password, 12);

    const fresher = await Fresher.create({
      name: cleanName,
      email: normalizedEmail,
      mobile: cleanMobile,
      countryCode: cleanCountryCode,
      password: hashedPassword,
      profilePic: "",
      lastLoginAt: null,
    });

    const token = generateToken(fresher._id, "fresher");

    return res.status(201).json({
      success: true,
      message: "Fresher account created successfully.",
      user: sanitizeFresher(fresher),
      token,
    });

  } catch (error) {
    console.error("Fresher registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this email or mobile number.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create fresher account. Please try again.",
    });
  }
};

// =====================================================
// 2. FRESHER LOGIN
// POST /api/auth/fresher/login
// =====================================================

exports.loginFresher = async (req, res) => {
  try {
    const { email, password } = req.body;

    // =====================================================
    // STRICT VALIDATIONS - LOGIN
    // =====================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const fresher = await Fresher.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!fresher) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, fresher.password);

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    fresher.lastLoginAt = new Date();
    await fresher.save();

    const token = generateToken(fresher._id, "fresher");

    return res.status(200).json({
      success: true,
      message: "Fresher login successful.",
      user: sanitizeFresher(fresher),
      token,
    });

  } catch (error) {
    console.error("Fresher login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to login. Please try again.",
    });
  }
};

// =====================================================
// 3. MENTOR REGISTER
// POST /api/auth/mentor/register
// =====================================================

// =====================================================
// 3. MENTOR REGISTER
// POST /api/auth/mentor/register
// =====================================================

exports.registerMentor = async (req, res) => {
  const uploadedFiles = [];

  try {
    const {
      name,
      email,
      mobile,
      countryCode,
      password,
      company,
      designation,
      department,
      experience,
      location,
      linkedin,
      skills,
      bio,
      companyId,
      confirmationAccepted,
    } = req.body;

    console.log("MENTOR REGISTER BODY:", req.body);

    // =====================================================
    // STRICT VALIDATIONS - MENTOR
    // =====================================================

    // ... [Keep all your existing validations exactly as they are]

    // 1. Check required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required.",
      });
    }

    // 2. Validate name
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // 4. Validate password
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    // 5. Validate mobile number - FIXED with country code support
    const mobileRegex = /^[0-9]{10}$/;
    let cleanMobileForValidation = String(mobile).replace(/[\s\-\(\)]/g, '');
    
    if (cleanMobileForValidation.startsWith('+')) {
      const digitsOnly = cleanMobileForValidation.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 10) {
        cleanMobileForValidation = digitsOnly.slice(-10);
      }
    }
    
    if (cleanMobileForValidation.length > 10 && /^\d{11,13}$/.test(cleanMobileForValidation)) {
      cleanMobileForValidation = cleanMobileForValidation.slice(-10);
    }
    
    if (!mobileRegex.test(cleanMobileForValidation)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit mobile number.",
      });
    }

    // 6. Validate country code
    const countryCodeRegex = /^\+\d{1,4}$/;
    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith('+')) {
      cleanCountryCode = '+' + cleanCountryCode;
    }
    if (!countryCodeRegex.test(cleanCountryCode)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid country code (e.g., +91).",
      });
    }

    // 7. Validate company
    if (!company || typeof company !== "string" || company.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Company name is required and must be at least 2 characters.",
      });
    }

    // 8. Validate designation
    if (!designation || typeof designation !== "string" || designation.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Designation is required and must be at least 2 characters.",
      });
    }

    // 9. Validate department
    if (!department || typeof department !== "string" || department.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Department is required and must be at least 2 characters.",
      });
    }

    // 10. Validate companyId (Employee ID)
    if (!companyId || typeof companyId !== "string" || companyId.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required and must be at least 2 characters.",
      });
    }

    // 11. Validate confirmation
    if (confirmationAccepted !== "true") {
      return res.status(400).json({
        success: false,
        message: "Please confirm that the submitted information is correct.",
      });
    }

    // 12. Validate experience
    const parsedExperience = Number(experience);
    if (Number.isNaN(parsedExperience) || parsedExperience < 0 || parsedExperience > 60) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid years of experience (0-60 years).",
      });
    }

    // 13. Validate location (optional but if provided, must be valid)
    if (location && (typeof location !== "string" || location.trim().length < 2)) {
      return res.status(400).json({
        success: false,
        message: "Location must be at least 2 characters if provided.",
      });
    }

    // 14. Validate LinkedIn (optional but if provided, must be valid URL)
    if (linkedin && typeof linkedin === "string" && linkedin.trim().length > 0) {
      const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_]+\/?$/;
      if (!linkedinRegex.test(linkedin.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid LinkedIn profile URL.",
        });
      }
    }

    // 15. Validate bio (optional)
    if (bio && (typeof bio !== "string" || bio.trim().length > 500)) {
      return res.status(400).json({
        success: false,
        message: "Bio must be less than 500 characters.",
      });
    }

    // 16. Validate skills
    const languages = String(skills || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (languages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one skill/language is required.",
      });
    }

    // 17. Validate files
    const offerLetter = req.files?.offerLetter?.[0];
    const employeeIdProof = req.files?.employeeIdProof?.[0];
    const additionalProof = req.files?.additionalProof?.[0];

    if (!offerLetter) {
      return res.status(400).json({
        success: false,
        message: "Offer letter is required.",
      });
    }

    if (!employeeIdProof) {
      return res.status(400).json({
        success: false,
        message: "Employee ID proof is required.",
      });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(offerLetter.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Offer letter must be a PDF, PNG, or JPG file.",
      });
    }

    if (offerLetter.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "Offer letter must be less than 10MB.",
      });
    }

    if (!allowedTypes.includes(employeeIdProof.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Employee ID proof must be a PDF, PNG, or JPG file.",
      });
    }

    if (employeeIdProof.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "Employee ID proof must be less than 10MB.",
      });
    }

    if (additionalProof) {
      if (!allowedTypes.includes(additionalProof.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Additional proof must be a PDF, PNG, or JPG file.",
        });
      }
      if (additionalProof.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: "Additional proof must be less than 10MB.",
        });
      }
    }

    uploadedFiles.push(offerLetter, employeeIdProof);
    if (additionalProof) {
      uploadedFiles.push(additionalProof);
    }

    // =====================================================
    // CLEAN AND PREPARE DATA
    // =====================================================

    const cleanName = String(name).trim();
    const normalizedEmail = normalizeEmail(email);
    const cleanMobile = cleanCountryCode + cleanMobileForValidation;
    const cleanCompany = String(company).trim();
    const cleanDesignation = String(designation).trim();
    const cleanDepartment = String(department).trim();
    const cleanEmployeeId = String(companyId).trim();
    const cleanLocation = location ? String(location).trim() : "";
    const cleanLinkedin = linkedin ? String(linkedin).trim() : "";
    const cleanBio = bio ? String(bio).trim() : "";

    console.log("Cleaned mentor data:", {
      name: cleanName,
      email: normalizedEmail,
      mobile: cleanMobile,
      countryCode: cleanCountryCode,
      company: cleanCompany,
      designation: cleanDesignation,
      department: cleanDepartment,
      employeeId: cleanEmployeeId,
      experience: parsedExperience,
      languages: languages.length,
    });

    // =====================================================
    // UNIQUENESS CHECKS - MENTOR
    // =====================================================

    const existingMentorByEmail = await Mentor.findOne({
      email: normalizedEmail,
    });

    if (existingMentorByEmail) {
      return res.status(409).json({
        success: false,
        message: "A mentor account already exists with this email.",
      });
    }

    const existingFresherByEmail = await Fresher.findOne({
      email: normalizedEmail,
    });

    if (existingFresherByEmail) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a fresher.",
      });
    }

    const existingMentorByMobile = await Mentor.findOne({
      mobile: cleanMobile,
    });

    if (existingMentorByMobile) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a mentor account.",
      });
    }

    const existingFresherByMobile = await Fresher.findOne({
      mobile: cleanMobile,
    });

    if (existingFresherByMobile) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a fresher account.",
      });
    }

    const existingMentorByEmployeeId = await Mentor.findOne({
      employeeId: cleanEmployeeId,
    });

    if (existingMentorByEmployeeId) {
      return res.status(409).json({
        success: false,
        message: "This Employee ID is already registered with another mentor account.",
      });
    }

    // =====================================================
    // CREATE MENTOR - FIXED VERSION
    // =====================================================

    const hashedPassword = await bcrypt.hash(password, 12);

    const mentorData = {
      name: cleanName,
      email: normalizedEmail,
      mobile: cleanMobile,
      countryCode: cleanCountryCode, // This won't be stored if not in schema
      password: hashedPassword,
      employeeId: cleanEmployeeId,
      workEmail: normalizedEmail,
      linkedinProfile: cleanLinkedin,
      yearsOfExperience: parsedExperience,
      currentCompany: cleanCompany,
      designation: cleanDesignation,
      department: cleanDepartment,
      officeLocation: cleanLocation,
      languages: languages,
      hourlyRate: 0,
      bio: cleanBio,
      offerLetter: offerLetter.filename,
      employeeIdProof: employeeIdProof.filename,
      additionalProof: additionalProof ? additionalProof.filename : "",
      isVerified: false,
      verificationStatus: "pending",
      verificationMethod: "document",
      rejectionReason: "",
      accountStatus: "pending",
      // FIX: Use null instead of undefined for Date fields
      lastLoginAt: null,
      profilePic: "",
    };

    // Remove countryCode if it's not in the schema
    // If your schema doesn't have countryCode, remove it from mentorData
    // delete mentorData.countryCode; // Uncomment if countryCode is not in schema

    const mentor = await Mentor.create(mentorData);

    console.log("Mentor created successfully:", mentor._id);

    return res.status(201).json({
      success: true,
      message: "MNC employee profile submitted successfully. Your account is pending admin verification.",
      user: sanitizeMentor(mentor),
    });

  } catch (error) {
    console.error("Mentor registration error:", error);

    // Delete uploaded files if DB save failed
    for (const file of uploadedFiles) {
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error("Unable to delete uploaded file:", unlinkError.message);
      }
    }

    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error: " + Object.values(error.errors).map(e => e.message).join(', '),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this email, mobile number, or employee ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to submit MNC employee registration. Please try again.",
    });
  }
};

// =====================================================
// 4. MENTOR LOGIN
// POST /api/auth/mentor/login
// =====================================================

exports.loginMentor = async (req, res) => {
  try {
    const { email, password } = req.body;

    // =====================================================
    // STRICT VALIDATIONS - LOGIN
    // =====================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const mentor = await Mentor.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!mentor) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, mentor.password);

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Check account status
    if (mentor.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    if (mentor.accountStatus === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your mentor application was rejected.",
        rejectionReason: mentor.rejectionReason || "",
      });
    }

    if (mentor.accountStatus !== "active" || 
        mentor.verificationStatus !== "approved" || 
        !mentor.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Your MNC employee profile is still pending admin verification.",
        verificationStatus: mentor.verificationStatus || "pending",
        accountStatus: mentor.accountStatus,
      });
    }

    mentor.lastLoginAt = new Date();
    await mentor.save();

    const token = generateToken(mentor._id, "mentor");

    return res.status(200).json({
      success: true,
      message: "Mentor login successful.",
      user: sanitizeMentor(mentor),
      token,
    });

  } catch (error) {
    console.error("Mentor login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to login. Please try again.",
    });
  }
};

// =====================================================
// 5. CURRENT USER
// GET /api/auth/me
// =====================================================

exports.getMe = async (req, res) => {
  try {
    if (req.user.role === "fresher") {
      const fresher = await Fresher.findById(req.user.id);

      if (!fresher) {
        return res.status(404).json({
          success: false,
          message: "Fresher account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        user: sanitizeFresher(fresher),
      });
    }

    if (req.user.role === "mentor") {
      const mentor = await Mentor.findById(req.user.id);

      if (!mentor) {
        return res.status(404).json({
          success: false,
          message: "Mentor account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        user: sanitizeMentor(mentor),
      });
    }

    return res.status(403).json({
      success: false,
      message: "Invalid user role.",
    });

  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to get user information.",
    });
  }
};

// =====================================================
// 6. ADMIN APPROVE / REJECT MENTOR
// PUT /api/auth/admin/mentors/:id/verification
// =====================================================

exports.updateMentorVerification = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    // =====================================================
    // STRICT VALIDATIONS - ADMIN
    // =====================================================

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'.",
      });
    }

    if (status === "rejected") {
      if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required and must be at least 5 characters.",
        });
      }
    }

    const mentor = await Mentor.findById(req.params.id);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor account not found.",
      });
    }

    // Prevent re-approving already approved mentors
    if (status === "approved" && mentor.verificationStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "This mentor is already approved.",
      });
    }

    if (status === "approved") {
      mentor.accountStatus = "active";
      mentor.isVerified = true;
      mentor.verificationStatus = "approved";
      mentor.rejectionReason = "";
    }

    if (status === "rejected") {
      mentor.accountStatus = "rejected";
      mentor.isVerified = false;
      mentor.verificationStatus = "rejected";
      mentor.rejectionReason = String(rejectionReason).trim();
    }

    await mentor.save();

    return res.status(200).json({
      success: true,
      message: status === "approved" 
        ? "Mentor approved successfully." 
        : "Mentor verification rejected.",
      user: sanitizeMentor(mentor),
    });

  } catch (error) {
    console.error("Mentor verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update mentor verification.",
    });
  }
};