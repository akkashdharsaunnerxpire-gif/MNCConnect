const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");
const {
  uploadFromBuffer,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const { sendMail, otpVerificationEmail } = require("../utils/mailer");
const { notify, emitToUser } = require("../utils/realtime");

// =====================================================
// CONSTANTS
// =====================================================

const WELCOME_BONUS = 25; // every new fresher gets this in the wallet
const REFERRAL_REWARD = 10; // the referrer gets this per successful referral
const TEMP_NAME = "Temp"; // placeholder name used by send-otp

// =====================================================
// HELPERS
// =====================================================

const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign({ id: id.toString(), role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const AUTH_COOKIE_NAME = "mnc_token";

const setAuthCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const clearAuthCookie = (res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
};

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();
const validatePassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128;

const generateReferralCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

// ✅ Generate 6-digit OTP
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// unique dummy 10-digit mobile for the temporary OTP record
// (so two temp records never clash on a unique mobile index)
const tempMobile = () =>
  `+910${String(crypto.randomInt(0, 999999999)).padStart(9, "0")}`;

const sanitizeFresher = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || "",
    countryCode: user.countryCode || "+91",
    role: "fresher",
    profilePic: user.profilePic || "",
    isEmailVerified: user.isEmailVerified || false,
    walletBalance: user.walletBalance || 0,
    referralCode: user.referralCode || "",
    hasUsedReferral: user.hasUsedReferral || false,
    referralEarnings: user.referralEarnings || 0,
    totalRefunds: user.totalRefunds || 0,
    welcomeBonusClaimed: user.welcomeBonusClaimed || false,
    welcomeBonusSeen: Boolean(user.welcomeBonusSeen),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
};


// Gives the referrer REFERRAL_REWARD (atomic, one query) and links the new user.
// Returns true when a reward was paid.
const rewardReferrer = async ({ fresher, referralCode }) => {
  const code = String(referralCode || "")
    .trim()
    .toUpperCase();
  if (code.length !== 6) return false;

  const referrer = await Fresher.findOneAndUpdate(
    { referralCode: code, _id: { $ne: fresher._id } },
    {
      $inc: {
        walletBalance: REFERRAL_REWARD,
        referralEarnings: REFERRAL_REWARD,
      },
    },
    { new: true },
  );
  if (!referrer) return false;

  fresher.referredBy = referrer._id;
  fresher.hasUsedReferral = true;
  await fresher.save();

  notify({
    user: referrer._id,
    role: "fresher",
    title: "Referral reward",
    message: `${fresher.name} joined with your code. ₹${REFERRAL_REWARD} added to your wallet.`,
    type: "payment",
  });
  emitToUser(String(referrer._id), "wallet:updated", {
    balance: referrer.walletBalance,
  });

  return true;
};

// =====================================================
// 1. FRESHER REGISTER (Sends OTP)
// POST /api/auth/fresher/register
// =====================================================

exports.registerFresher = async (req, res) => {
  try {
    const { name, email, mobile, countryCode, password, referralInput } =
      req.body;

    // ---------- validations ----------
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required.",
      });
    }

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const cleanName = String(name).trim();
    const normalizedEmail = normalizeEmail(email);

    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith("+"))
      cleanCountryCode = "+" + cleanCountryCode;
    if (!/^\+\d{1,4}$/.test(cleanCountryCode)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid country code (e.g., +91).",
      });
    }

    let cleanMobileForValidation = String(mobile)
      .replace(/[\s\-\(\)]/g, "")
      .replace(/[^0-9]/g, "");
    if (cleanMobileForValidation.length > 10)
      cleanMobileForValidation = cleanMobileForValidation.slice(-10);
    if (!/^[0-9]{10}$/.test(cleanMobileForValidation)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit mobile number.",
      });
    }
    const cleanMobile = cleanCountryCode + cleanMobileForValidation;

    // ---------- uniqueness checks ----------
    // A "Temp" record is only the placeholder that send-otp created for this
    // email. It is NOT a real account, so register is allowed to claim it.
    const existingFresher = await Fresher.findOne({ email: normalizedEmail });
    const isPlaceholder = Boolean(
      existingFresher && existingFresher.name === TEMP_NAME,
    );

    if (existingFresher && !isPlaceholder) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }

    const existingMentorByEmail = await Mentor.findOne({
      email: normalizedEmail,
    });
    if (existingMentorByEmail) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a mentor.",
      });
    }

    const mobileOwnerFilter = { mobile: cleanMobile };
    if (existingFresher) mobileOwnerFilter._id = { $ne: existingFresher._id };

    if (await Fresher.findOne(mobileOwnerFilter)) {
      return res.status(409).json({
        success: false,
        message:
          "This mobile number is already registered with a fresher account.",
      });
    }
    if (await Mentor.findOne({ mobile: cleanMobile })) {
      return res.status(409).json({
        success: false,
        message:
          "This mobile number is already registered with a mentor account.",
      });
    }

    // ---------- build the account ----------
    const hashedPassword = await bcrypt.hash(password, 12);

    let myReferralCode = generateReferralCode();
    while (await Fresher.exists({ referralCode: myReferralCode }))
      myReferralCode = generateReferralCode();

    let fresher;
    let needsOtp = true;

    if (isPlaceholder) {
      // email may already be verified through the inline send-otp / verify-otp step
      needsOtp = !existingFresher.isEmailVerified;

      existingFresher.name = cleanName;
      existingFresher.mobile = cleanMobile;
      existingFresher.countryCode = cleanCountryCode;
      existingFresher.password = hashedPassword;
      existingFresher.referralCode = myReferralCode;
      existingFresher.walletBalance = WELCOME_BONUS; // Welcome Bonus
      existingFresher.welcomeBonusClaimed = true;

      if (needsOtp) {
        existingFresher.emailOtp = generateOtp();
        existingFresher.emailOtpExpiresAt = new Date(
          Date.now() + 10 * 60 * 1000,
        );
      }

      await existingFresher.save();
      fresher = existingFresher;
    } else {
      fresher = await Fresher.create({
        name: cleanName,
        email: normalizedEmail,
        mobile: cleanMobile,
        countryCode: cleanCountryCode,
        password: hashedPassword,
        referralCode: myReferralCode,
        walletBalance: WELCOME_BONUS, // Welcome Bonus
        welcomeBonusClaimed: true,

        // ✅ OTP Fields
        isEmailVerified: false,
        emailOtp: generateOtp(),
        emailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
      });
    }

    // ---------- referral: referrer gets +₹10 ----------
    if (referralInput) {
      try {
        await rewardReferrer({ fresher, referralCode: referralInput });
      } catch (refErr) {
        // a referral problem must never block sign up
        console.error("Referral reward error:", refErr.message);
      }
    }

    // ---------- email already verified earlier: log the user in ----------
    if (!needsOtp) {
      const token = generateToken(fresher._id, "fresher");
      setAuthCookie(res, token);

      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        requiresVerification: false,
        user: sanitizeFresher(fresher),
      });
    }

    // ---------- ✅ Send OTP Email ----------
    const emailContent = otpVerificationEmail(cleanName, fresher.emailOtp);
    await sendMail({ to: normalizedEmail, toName: cleanName, ...emailContent });

    return res.status(201).json({
      success: true,
      message: "OTP sent to your email. Please verify to continue.",
      requiresVerification: true,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Fresher registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this email or mobile number.",
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Unable to create account." });
  }
};

// =====================================================
// 1.5 SEND OTP (For inline email verification)
// POST /api/auth/fresher/send-otp
// Can be called again to RESEND the code.
// =====================================================

exports.sendFresherOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const normalizedEmail = normalizeEmail(email);

    // ✅ CHECK IF A REAL ACCOUNT ALREADY EXISTS
    const existingFresher = await Fresher.findOne({ email: normalizedEmail });
    if (existingFresher && existingFresher.name !== TEMP_NAME) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }

    const existingMentor = await Mentor.findOne({ email: normalizedEmail });
    if (existingMentor) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a mentor.",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (existingFresher) {
      // resend: same placeholder record, new code
      existingFresher.emailOtp = otp;
      existingFresher.emailOtpExpiresAt = otpExpiresAt;
      existingFresher.isEmailVerified = false;
      await existingFresher.save();
    } else {
      // Temporary placeholder (stores the OTP until the real register call)
      await Fresher.create({
        name: TEMP_NAME,
        email: normalizedEmail,
        mobile: tempMobile(),
        password: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpiresAt: otpExpiresAt,
      });
    }

    // Send OTP Email
    const emailContent = otpVerificationEmail("User", otp);
    await sendMail({ to: normalizedEmail, toName: "User", ...emailContent });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Unable to send OTP." });
  }
};

// =====================================================
// 2. VERIFY EMAIL OTP
// POST /api/auth/fresher/verify-otp
// =====================================================

exports.verifyFresherOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required." });

    const fresher = await Fresher.findOne({ email: normalizeEmail(email) });
    if (!fresher)
      return res
        .status(404)
        .json({ success: false, message: "Account not found." });

    if (fresher.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. Please login.",
      });
    }

    if (!fresher.emailOtp || String(fresher.emailOtp) !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    if (!fresher.emailOtpExpiresAt || new Date() > fresher.emailOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // ✅ Mark as verified
    fresher.isEmailVerified = true;
    fresher.emailOtp = null;
    fresher.emailOtpExpiresAt = null;
    await fresher.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user: sanitizeFresher(fresher),
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to verify OTP." });
  }
};

// =====================================================
// 3. FRESHER LOGIN (Check if verified)
// POST /api/auth/fresher/login
// =====================================================

exports.loginFresher = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });

    const normalizedEmail = normalizeEmail(email);
    const fresher = await Fresher.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    // a "Temp" placeholder is not a real account
    if (!fresher || fresher.name === TEMP_NAME) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(password, fresher.password);
    if (!passwordMatched)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });

    // ✅ Check if Email is Verified
    if (!fresher.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: fresher.email,
      });
    }

    fresher.lastLoginAt = new Date();
    await fresher.save();

    const token = generateToken(fresher._id, "fresher");
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Fresher login successful.",
      user: sanitizeFresher(fresher),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Unable to login." });
  }
};

// =====================================================
// 3.5 APPLY A REFERRAL CODE (from the wallet page)
// POST /api/auth/apply-referral   { referralCode }
// The code owner gets +₹10. A user can use a code only once.
// =====================================================

exports.applyReferral = async (req, res) => {
  try {
    const code = String(req.body?.referralCode || "")
      .trim()
      .toUpperCase();
    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Referral code must contain 6 characters.",
      });
    }

    const me = await Fresher.findById(req.user.id).select(
      "referralCode hasUsedReferral name",
    );
    if (!me)
      return res
        .status(404)
        .json({ success: false, message: "Account not found." });

    if (me.hasUsedReferral) {
      return res.status(400).json({
        success: false,
        message: "You have already used a referral code.",
      });
    }
    if (me.referralCode === code) {
      return res.status(400).json({
        success: false,
        message: "You cannot use your own referral code.",
      });
    }

    const referrer = await Fresher.findOne({ referralCode: code }).select(
      "_id",
    );
    if (!referrer) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid referral code." });
    }

    // claim once: only succeeds if this user has not used a code yet
    const claimed = await Fresher.findOneAndUpdate(
      { _id: me._id, hasUsedReferral: { $ne: true } },
      { $set: { hasUsedReferral: true, referredBy: referrer._id } },
    );
    if (!claimed) {
      return res.status(400).json({
        success: false,
        message: "You have already used a referral code.",
      });
    }

    // referrer gets +₹10
    const updated = await Fresher.findByIdAndUpdate(
      referrer._id,
      {
        $inc: {
          walletBalance: REFERRAL_REWARD,
          referralEarnings: REFERRAL_REWARD,
        },
      },
      { new: true },
    );

    notify({
      user: referrer._id,
      role: "fresher",
      title: "Referral reward",
      message: `${me.name || "Someone"} used your code. ₹${REFERRAL_REWARD} added to your wallet.`,
      type: "payment",
    });
    emitToUser(String(referrer._id), "wallet:updated", {
      balance: updated?.walletBalance,
    });

    return res.json({ success: true, message: "Referral applied." });
  } catch (error) {
    console.error("applyReferral error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to apply referral code." });
  }
};
// =====================================================
// 3.6 WELCOME GIFT SEEN
// PATCH /api/auth/welcome-bonus-seen
// Called when the fresher clicks "Add ₹25 to my wallet".
// After this the gift animation never plays again (any device).
// =====================================================

exports.markWelcomeBonusSeen = async (req, res) => {
  try {
    if (!req.user?.id || req.user.role !== "fresher") {
      return res
        .status(403)
        .json({ success: false, message: "Only freshers can do this." });
    }

    await Fresher.updateOne(
      { _id: req.user.id },
      { $set: { welcomeBonusSeen: true } },
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("markWelcomeBonusSeen error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update." });
  }
};

// =====================================================
// 3. MENTOR REGISTER WITH CLOUDINARY
// POST /api/auth/mentor/register
// =====================================================

// =====================================================
// REPLACE these 2 things in your authController.js
//   1. sanitizeMentor   (helpers section)
//   2. exports.registerMentor
// Everything else in the file stays exactly the same.
// =====================================================

// ---------- 1. sanitizeMentor (helpers section) ----------

const sanitizeMentor = (mentor) => {
  return {
    id: mentor._id,
    name: mentor.name,
    email: mentor.email,
    role: "mentor",
    countryCode: mentor.countryCode || "+91",
    mobile: mentor.mobile || "",
    gender: mentor.gender || "",
    profilePic: mentor.profilePic || "",
    employeeId: mentor.employeeId || "",
    currentCompany: mentor.currentCompany || "",
    designation: mentor.designation || "",
    department: mentor.department || "",
    officeLocation: mentor.officeLocation || "",
    yearsOfExperience: mentor.yearsOfExperience || 0,
    linkedinProfile: mentor.linkedinProfile || "",
    skills: mentor.skills || [],
    languages: mentor.languages || [],
    bio: mentor.bio || "",
    isEmailVerified: true,
    isVerified: mentor.isVerified,
    verificationStatus: mentor.verificationStatus,
    accountStatus: mentor.accountStatus,
    rejectionReason: mentor.rejectionReason || "",
    lastLoginAt: mentor.lastLoginAt,
    createdAt: mentor.createdAt,
  };
};

// ---------- 2. MENTOR REGISTER WITH CLOUDINARY ----------
// POST /api/auth/mentor/register

exports.registerMentor = async (req, res) => {
  let uploadedFiles = [];

  const cleanupUploads = async () => {
    for (const publicId of uploadedFiles) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (deleteError) {
        console.error(
          "Unable to delete file from Cloudinary:",
          deleteError.message,
        );
      }
    }
    uploadedFiles = [];
  };

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
      gender,
      experience,
      location,
      linkedin,
      skills,
      bio,
      companyId,
      confirmationAccepted,
    } = req.body;

    // 1. Required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required.",
      });
    }

    // 2. Validate name
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }

    // 3. Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // 4. Validate password (never trim a password)
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    // 5. Validate country code
    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith("+")) {
      cleanCountryCode = "+" + cleanCountryCode;
    }
    if (!/^\+\d{1,4}$/.test(cleanCountryCode)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid country code (e.g., +91).",
      });
    }

    // 6. Validate mobile (national number, any country)
    let nationalNumber = String(mobile).replace(/[\s\-\(\)]/g, "");
    // old clients may send the full "+91XXXXXXXXXX"
    if (nationalNumber.startsWith(cleanCountryCode)) {
      nationalNumber = nationalNumber.slice(cleanCountryCode.length);
    }
    nationalNumber = nationalNumber.replace(/\D/g, "");

    const totalDigits = cleanCountryCode.length - 1 + nationalNumber.length;

    if (cleanCountryCode === "+91") {
      if (!/^\d{10}$/.test(nationalNumber)) {
        return res.status(400).json({
          success: false,
          message: "Indian mobile number must be exactly 10 digits.",
        });
      }
    } else if (nationalNumber.length < 6 || totalDigits > 15) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid mobile number for the selected country.",
      });
    }

    // stored the same way as Fresher: "+" + countryCode + national digits
    const cleanMobile = cleanCountryCode + nationalNumber;

    // 7. Validate company
    if (!company || typeof company !== "string" || company.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Company name is required and must be at least 2 characters.",
      });
    }

    // 8. Validate designation
    if (
      !designation ||
      typeof designation !== "string" ||
      designation.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: "Designation is required and must be at least 2 characters.",
      });
    }

    // 9. Validate department
    if (
      !department ||
      typeof department !== "string" ||
      department.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: "Department is required and must be at least 2 characters.",
      });
    }

    // 10. Validate gender
    const allowedGenders = ["male", "female", "other"];
    const cleanGender = String(gender || "")
      .trim()
      .toLowerCase();
    if (!cleanGender) {
      return res
        .status(400)
        .json({ success: false, message: "Gender is required." });
    }
    if (!allowedGenders.includes(cleanGender)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender. Please select Male, Female or Other.",
      });
    }

    // 11. Validate Employee ID
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required and must be at least 2 characters.",
      });
    }

    // 12. Validate confirmation
    if (confirmationAccepted !== "true") {
      return res.status(400).json({
        success: false,
        message: "Please confirm that the submitted information is correct.",
      });
    }

    // 13. Validate experience
    const parsedExperience = Number(experience);
    if (
      experience === undefined ||
      experience === "" ||
      Number.isNaN(parsedExperience) ||
      parsedExperience < 0 ||
      parsedExperience > 60
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid years of experience (0-60 years).",
      });
    }

    // 14. Validate location
    if (
      location &&
      (typeof location !== "string" || location.trim().length < 2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must be at least 2 characters if provided.",
      });
    }

    // 15. Validate LinkedIn
    if (
      linkedin &&
      typeof linkedin === "string" &&
      linkedin.trim().length > 0
    ) {
      const linkedinRegex =
        /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/;
      if (!linkedinRegex.test(linkedin.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid LinkedIn profile URL.",
        });
      }
    }

    // 16. Validate bio (limit matches the model: 2000)
    if (bio && (typeof bio !== "string" || bio.trim().length > 2000)) {
      return res.status(400).json({
        success: false,
        message: "Bio must be less than 2000 characters.",
      });
    }

    // 17. Validate skills  (saved in `skills`, NOT in `languages`)
    const skillList = String(skills || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (skillList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one skill is required.",
      });
    }

    // 18. Validate files
    const offerLetter = req.files?.offerLetter?.[0];
    const employeeIdProof = req.files?.employeeIdProof?.[0];
    const additionalProof = req.files?.additionalProof?.[0];

    if (!offerLetter)
      return res
        .status(400)
        .json({ success: false, message: "Offer letter is required." });
    if (!employeeIdProof)
      return res
        .status(400)
        .json({ success: false, message: "Employee ID proof is required." });

    // CLEAN DATA
    const cleanName = String(name).trim();
    const normalizedEmail = normalizeEmail(email);
    const cleanCompany = String(company).trim();
    const cleanDesignation = String(designation).trim();
    const cleanDepartment = String(department).trim();
    const cleanEmployeeId = String(companyId).trim();
    const cleanLocation = location ? String(location).trim() : "";
    const cleanLinkedin = linkedin ? String(linkedin).trim() : "";
    const cleanBio = bio ? String(bio).trim() : "";

    // UNIQUENESS CHECKS  (done BEFORE uploading, so nothing to clean up)
    if (await Mentor.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "A mentor account already exists with this email.",
      });
    }

    if (await Fresher.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a fresher.",
      });
    }

    if (await Mentor.findOne({ mobile: cleanMobile })) {
      return res.status(409).json({
        success: false,
        message:
          "This mobile number is already registered with a mentor account.",
      });
    }

    if (await Fresher.findOne({ mobile: cleanMobile })) {
      return res.status(409).json({
        success: false,
        message:
          "This mobile number is already registered with a fresher account.",
      });
    }

    if (await Mentor.findOne({ employeeId: cleanEmployeeId })) {
      return res.status(409).json({
        success: false,
        message:
          "This Employee ID is already registered with another mentor account.",
      });
    }

    // UPLOAD FILES TO CLOUDINARY
    const timestamp = Date.now();
    const folderName = `mentors/${normalizedEmail}`;

    const offerLetterUpload = await uploadFromBuffer(
      offerLetter.buffer,
      `${folderName}/documents`,
      `offer_letter_${timestamp}`,
    );
    uploadedFiles.push(offerLetterUpload.public_id);

    const employeeIdProofUpload = await uploadFromBuffer(
      employeeIdProof.buffer,
      `${folderName}/documents`,
      `employee_id_${timestamp}`,
    );
    uploadedFiles.push(employeeIdProofUpload.public_id);

    let additionalProofUpload = null;
    if (additionalProof) {
      additionalProofUpload = await uploadFromBuffer(
        additionalProof.buffer,
        `${folderName}/documents`,
        `additional_proof_${timestamp}`,
      );
      uploadedFiles.push(additionalProofUpload.public_id);
    }

    // CREATE MENTOR
    const hashedPassword = await bcrypt.hash(password, 12);

    const mentor = await Mentor.create({
      name: cleanName,
      email: normalizedEmail,
      countryCode: cleanCountryCode,
      mobile: cleanMobile,
      password: hashedPassword,
      employeeId: cleanEmployeeId,
      workEmail: normalizedEmail,
      linkedinProfile: cleanLinkedin,
      yearsOfExperience: parsedExperience,
      currentCompany: cleanCompany,
      designation: cleanDesignation,
      department: cleanDepartment,
      gender: cleanGender,
      officeLocation: cleanLocation,
      skills: skillList,
      languages: [],
      bio: cleanBio,
      offerLetter: offerLetterUpload.secure_url,
      offerLetterPublicId: offerLetterUpload.public_id,
      employeeIdProof: employeeIdProofUpload.secure_url,
      employeeIdProofPublicId: employeeIdProofUpload.public_id,
      additionalProof: additionalProofUpload
        ? additionalProofUpload.secure_url
        : "",
      additionalProofPublicId: additionalProofUpload
        ? additionalProofUpload.public_id
        : "",
      isVerified: false,
      verificationStatus: "pending",
      verificationMethod: "document",
      rejectionReason: "",
      accountStatus: "pending",
      lastLoginAt: null,
      profilePic: "",
    });

    return res.status(201).json({
      success: true,
      message:
        "MNC employee profile submitted successfully. Your account is pending admin verification.",
      verificationStatus: mentor.verificationStatus,
      user: sanitizeMentor(mentor),
    });
  } catch (error) {
    console.error("Mentor registration error:", error);

    await cleanupUploads();

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message:
          "Validation error: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account already exists with this email, mobile number, or employee ID.",
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

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const mentor = await Mentor.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!mentor) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(password, mentor.password);
    if (!passwordMatched) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

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

    if (
      mentor.accountStatus !== "active" ||
      mentor.verificationStatus !== "approved" ||
      !mentor.isVerified
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your MNC employee profile is still pending admin verification.",
        verificationStatus: mentor.verificationStatus || "pending",
        accountStatus: mentor.accountStatus,
      });
    }

    mentor.lastLoginAt = new Date();
    await mentor.save();

    const token = generateToken(mentor._id, "mentor");
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Mentor login successful",
      verificationStatus: mentor.verificationStatus,
      accountStatus: mentor.accountStatus,
      mentor: {
        id: mentor._id,
        name: mentor.name,
        email: mentor.email,
        company: mentor.currentCompany,
        designation: mentor.designation,
        verificationStatus: mentor.verificationStatus,
        accountStatus: mentor.accountStatus,
      },
    });
  } catch (error) {
    console.error("Mentor login error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to login. Please try again." });
  }
};

// =====================================================
// 5. CURRENT USER
// GET /api/auth/me
// =====================================================

exports.getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }

    if (req.user.role === "mentor") {
      const mentor = await Mentor.findById(req.user.id).select("-password");
      if (!mentor)
        return res
          .status(404)
          .json({ success: false, message: "Mentor account not found." });
      return res.status(200).json({
        success: true,
        message: "Mentor data fetched successfully.",
        user: sanitizeMentor(mentor),
      });
    }

    if (req.user.role === "fresher") {
      const fresher = await Fresher.findById(req.user.id).select("-password");
      if (!fresher)
        return res
          .status(404)
          .json({ success: false, message: "Fresher account not found." });
      return res.status(200).json({
        success: true,
        message: "Fresher data fetched successfully.",
        user: sanitizeFresher(fresher),
      });
    }

    return res
      .status(403)
      .json({ success: false, message: "Invalid user role." });
  } catch (error) {
    console.error("Get current user error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch user information." });
  }
};

// =====================================================
// 6. ADMIN APPROVE / REJECT MENTOR
// PUT /api/auth/admin/mentors/:id/verification
// =====================================================

exports.updateMentorVerification = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "Status is required." });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'.",
      });
    }

    if (status === "rejected") {
      if (
        !rejectionReason ||
        typeof rejectionReason !== "string" ||
        rejectionReason.trim().length < 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection reason is required and must be at least 5 characters.",
        });
      }
    }

    const mentor = await Mentor.findById(req.params.id);

    if (!mentor) {
      return res
        .status(404)
        .json({ success: false, message: "Mentor account not found." });
    }

    if (status === "approved" && mentor.verificationStatus === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "This mentor is already approved." });
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
      message:
        status === "approved"
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
exports.logout = (req, res) => {
  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

// ============================================================
// UPLOAD PROFILE AVATAR
// POST /api/auth/avatar
// ============================================================

exports.uploadProfileAvatar = async (req, res) => {
  let uploadedPublicId = "";

  try {
    if (!req.user?.id || !["fresher", "mentor"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user.",
      });
    }

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please select a profile image.",
      });
    }

    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed.",
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Maximum image size is 5MB.",
      });
    }

    const Model =
      req.user.role === "mentor" ? Mentor : Fresher;

    const user = await Model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Upload new image first
    const result = await uploadFromBuffer(
      file.buffer,
      `profiles/${req.user.role}`,
      `${req.user.role}_${user._id}_${Date.now()}`,
      { resource_type: "image" }
    );

    uploadedPublicId = result.public_id;

    const oldPublicId = user.profilePicPublicId;

    // Save new image in MongoDB
    user.profilePic = result.secure_url;
    user.profilePicPublicId = result.public_id;

    await user.save();

    // Delete old image only after successful database update
    if (oldPublicId && oldPublicId !== result.public_id) {
      try {
        await deleteFromCloudinary(oldPublicId);
      } catch (deleteError) {
        console.error(
          "Old avatar deletion failed:",
          deleteError.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully.",
      user: {
        profilePic: user.profilePic,
      },
    });

  } catch (error) {
    console.error("Avatar upload error:", error);

    // Clean up newly uploaded image if database update failed
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId).catch(() => {});
    }

    return res.status(500).json({
      success: false,
      message: "Unable to upload profile photo.",
    });
  }
};


// ============================================================
// REMOVE PROFILE AVATAR
// DELETE /api/auth/avatar
// ============================================================

exports.removeProfileAvatar = async (req, res) => {
  try {
    if (!req.user?.id || !["fresher", "mentor"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user.",
      });
    }

    const Model =
      req.user.role === "mentor" ? Mentor : Fresher;

    const user = await Model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const oldPublicId = user.profilePicPublicId;

    user.profilePic = "";
    user.profilePicPublicId = "";

    await user.save();

    if (oldPublicId) {
      try {
        await deleteFromCloudinary(oldPublicId);
      } catch (error) {
        console.error("Avatar deletion failed:", error.message);
      }
    }

    return res.json({
      success: true,
      message: "Profile photo removed.",
      user: {
        profilePic: "",
      },
    });

  } catch (error) {
    console.error("Avatar removal error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove profile photo.",
    });
  }
};

// ============================================================
// UPDATE FRESHER PROFILE
// PATCH /api/auth/update
// ============================================================

exports.updateFresherProfile = async (req, res) => {
  try {
    if (!req.user?.id || req.user.role !== "fresher") {
      return res.status(403).json({
        success: false,
        message: "Only freshers can update this profile.",
      });
    }

    const fresher = await Fresher.findById(req.user.id);

    if (!fresher || fresher.name === TEMP_NAME) {
      return res.status(404).json({
        success: false,
        message: "Fresher account not found.",
      });
    }

    // Only allow approved profile fields.
    const allowedFields = [
      "name",
      "gender",
      "dateOfBirth",
      "location",
      "nationality",
      "mobile",
      "bio",
      "education",
      "career",
      "skills",
      "interests",
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        fresher[field] = req.body[field];
      }
    }

    // Frontend uses "phone"; database uses "mobile".
    if (
      req.body.phone !== undefined &&
      req.body.mobile === undefined
    ) {
      fresher.mobile = req.body.phone;
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 50 characters.",
        });
      }

      fresher.name = name;
    }

    await fresher.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        ...sanitizeFresher(fresher),
        gender: fresher.gender || "",
        dateOfBirth: fresher.dateOfBirth || "",
        location: fresher.location || "",
        nationality: fresher.nationality || "",
        bio: fresher.bio || "",
        education: fresher.education || [],
        career: fresher.career || [],
        skills: fresher.skills || [],
        interests: fresher.interests || [],
      },
    });
  } catch (error) {
    console.error("Fresher profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update fresher profile.",
    });
  }
};