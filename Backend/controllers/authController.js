const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");
const { uploadFromBuffer, deleteFromCloudinary } = require("../config/cloudinary");
const { sendMail, otpVerificationEmail } = require("../utils/mailer");
const { notify, emitToUser } = require("../utils/realtime");

// =====================================================
// CONSTANTS
// =====================================================

const WELCOME_BONUS = 25;     // every new fresher gets this in the wallet
const REFERRAL_REWARD = 10;   // the referrer gets this per successful referral
const TEMP_NAME = "Temp";     // placeholder name used by send-otp

// =====================================================
// HELPERS
// =====================================================

const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign({ id: id.toString(), role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const validatePassword = (password) => typeof password === "string" && password.length >= 8 && password.length <= 128;

const generateReferralCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

// ✅ Generate 6-digit OTP
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// unique dummy 10-digit mobile for the temporary OTP record
// (so two temp records never clash on a unique mobile index)
const tempMobile = () => `+910${String(crypto.randomInt(0, 999999999)).padStart(9, "0")}`;

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
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
};

const sanitizeMentor = (mentor) => {
  return {
    id: mentor._id,
    name: mentor.name,
    email: mentor.email,
    role: "mentor",
    isEmailVerified: true,
    isVerified: mentor.isVerified,
    verificationStatus: mentor.verificationStatus,
    accountStatus: mentor.accountStatus,
    // ... (Add your other mentor fields here)
  };
};

// Gives the referrer REFERRAL_REWARD (atomic, one query) and links the new user.
// Returns true when a reward was paid.
const rewardReferrer = async ({ fresher, referralCode }) => {
  const code = String(referralCode || "").trim().toUpperCase();
  if (code.length !== 6) return false;

  const referrer = await Fresher.findOneAndUpdate(
    { referralCode: code, _id: { $ne: fresher._id } },
    { $inc: { walletBalance: REFERRAL_REWARD, referralEarnings: REFERRAL_REWARD } },
    { new: true }
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
  emitToUser(String(referrer._id), "wallet:updated", { balance: referrer.walletBalance });

  return true;
};

// =====================================================
// 1. FRESHER REGISTER (Sends OTP)
// POST /api/auth/fresher/register
// =====================================================

exports.registerFresher = async (req, res) => {
  try {
    const { name, email, mobile, countryCode, password, referralInput } = req.body;

    // ---------- validations ----------
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ success: false, message: "Name, email, mobile number and password are required." });
    }

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ success: false, message: "Name must be between 2 and 50 characters." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
    }

    const cleanName = String(name).trim();
    const normalizedEmail = normalizeEmail(email);

    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith("+")) cleanCountryCode = "+" + cleanCountryCode;
    if (!/^\+\d{1,4}$/.test(cleanCountryCode)) {
      return res.status(400).json({ success: false, message: "Please provide a valid country code (e.g., +91)." });
    }

    let cleanMobileForValidation = String(mobile).replace(/[\s\-\(\)]/g, "").replace(/[^0-9]/g, "");
    if (cleanMobileForValidation.length > 10) cleanMobileForValidation = cleanMobileForValidation.slice(-10);
    if (!/^[0-9]{10}$/.test(cleanMobileForValidation)) {
      return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number." });
    }
    const cleanMobile = cleanCountryCode + cleanMobileForValidation;

    // ---------- uniqueness checks ----------
    // A "Temp" record is only the placeholder that send-otp created for this
    // email. It is NOT a real account, so register is allowed to claim it.
    const existingFresher = await Fresher.findOne({ email: normalizedEmail });
    const isPlaceholder = Boolean(existingFresher && existingFresher.name === TEMP_NAME);

    if (existingFresher && !isPlaceholder) {
      return res.status(409).json({ success: false, message: "A fresher account already exists with this email." });
    }

    const existingMentorByEmail = await Mentor.findOne({ email: normalizedEmail });
    if (existingMentorByEmail) {
      return res.status(409).json({ success: false, message: "This email is already registered as a mentor." });
    }

    const mobileOwnerFilter = { mobile: cleanMobile };
    if (existingFresher) mobileOwnerFilter._id = { $ne: existingFresher._id };

    if (await Fresher.findOne(mobileOwnerFilter)) {
      return res.status(409).json({ success: false, message: "This mobile number is already registered with a fresher account." });
    }
    if (await Mentor.findOne({ mobile: cleanMobile })) {
      return res.status(409).json({ success: false, message: "This mobile number is already registered with a mentor account." });
    }

    // ---------- build the account ----------
    const hashedPassword = await bcrypt.hash(password, 12);

    let myReferralCode = generateReferralCode();
    while (await Fresher.exists({ referralCode: myReferralCode })) myReferralCode = generateReferralCode();

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
        existingFresher.emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
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
      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        requiresVerification: false,
        user: sanitizeFresher(fresher),
        token,
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

    return res.status(500).json({ success: false, message: "Unable to create account." });
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
      return res.status(400).json({ success: false, message: "Email is required." });
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
      return res.status(409).json({ success: false, message: "A fresher account already exists with this email." });
    }
    return res.status(500).json({ success: false, message: "Unable to send OTP." });
  }
};

// =====================================================
// 2. VERIFY EMAIL OTP
// POST /api/auth/fresher/verify-otp
// =====================================================

exports.verifyFresherOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP are required." });

    const fresher = await Fresher.findOne({ email: normalizeEmail(email) });
    if (!fresher) return res.status(404).json({ success: false, message: "Account not found." });

    if (fresher.isEmailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified. Please login." });
    }

    if (!fresher.emailOtp || String(fresher.emailOtp) !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    if (!fresher.emailOtpExpiresAt || new Date() > fresher.emailOtpExpiresAt) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // ✅ Mark as verified
    fresher.isEmailVerified = true;
    fresher.emailOtp = null;
    fresher.emailOtpExpiresAt = null;
    await fresher.save();

    const token = generateToken(fresher._id, "fresher");

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user: sanitizeFresher(fresher),
      token,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify OTP." });
  }
};

// =====================================================
// 3. FRESHER LOGIN (Check if verified)
// POST /api/auth/fresher/login
// =====================================================

exports.loginFresher = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });

    const normalizedEmail = normalizeEmail(email);
    const fresher = await Fresher.findOne({ email: normalizedEmail }).select("+password");

    // a "Temp" placeholder is not a real account
    if (!fresher || fresher.name === TEMP_NAME) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(password, fresher.password);
    if (!passwordMatched) return res.status(401).json({ success: false, message: "Invalid email or password." });

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

    return res.status(200).json({
      success: true,
      message: "Fresher login successful.",
      user: sanitizeFresher(fresher),
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to login." });
  }
};

// =====================================================
// 3.5 APPLY A REFERRAL CODE (from the wallet page)
// POST /api/auth/apply-referral   { referralCode }
// The code owner gets +₹10. A user can use a code only once.
// =====================================================

exports.applyReferral = async (req, res) => {
  try {
    const code = String(req.body?.referralCode || "").trim().toUpperCase();
    if (code.length !== 6) {
      return res.status(400).json({ success: false, message: "Referral code must contain 6 characters." });
    }

    const me = await Fresher.findById(req.user.id).select("referralCode hasUsedReferral name");
    if (!me) return res.status(404).json({ success: false, message: "Account not found." });

    if (me.hasUsedReferral) {
      return res.status(400).json({ success: false, message: "You have already used a referral code." });
    }
    if (me.referralCode === code) {
      return res.status(400).json({ success: false, message: "You cannot use your own referral code." });
    }

    const referrer = await Fresher.findOne({ referralCode: code }).select("_id");
    if (!referrer) {
      return res.status(404).json({ success: false, message: "Invalid referral code." });
    }

    // claim once: only succeeds if this user has not used a code yet
    const claimed = await Fresher.findOneAndUpdate(
      { _id: me._id, hasUsedReferral: { $ne: true } },
      { $set: { hasUsedReferral: true, referredBy: referrer._id } }
    );
    if (!claimed) {
      return res.status(400).json({ success: false, message: "You have already used a referral code." });
    }

    // referrer gets +₹10
    const updated = await Fresher.findByIdAndUpdate(
      referrer._id,
      { $inc: { walletBalance: REFERRAL_REWARD, referralEarnings: REFERRAL_REWARD } },
      { new: true }
    );

    notify({
      user: referrer._id,
      role: "fresher",
      title: "Referral reward",
      message: `${me.name || "Someone"} used your code. ₹${REFERRAL_REWARD} added to your wallet.`,
      type: "payment",
    });
    emitToUser(String(referrer._id), "wallet:updated", { balance: updated?.walletBalance });

    return res.json({ success: true, message: "Referral applied." });
  } catch (error) {
    console.error("applyReferral error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to apply referral code." });
  }
};

// =====================================================
// 3. MENTOR REGISTER WITH CLOUDINARY
// POST /api/auth/mentor/register
// =====================================================

exports.registerMentor = async (req, res) => {
  let uploadedFiles = [];

  try {
    const {
      name, email, mobile, countryCode, password, company, designation, department,
      gender, experience, location, linkedin, skills, bio, companyId, confirmationAccepted,
    } = req.body;

    // 1. Required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ success: false, message: "Name, email, mobile number and password are required." });
    }

    // 2. Validate name
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ success: false, message: "Name must be between 2 and 50 characters." });
    }

    // 3. Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    // 4. Validate password
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
    }

    // 5. Validate mobile number
    const mobileRegex = /^[0-9]{10}$/;
    let cleanMobileForValidation = String(mobile).replace(/[\s\-\(\)]/g, "");

    if (cleanMobileForValidation.startsWith("+")) {
      const digitsOnly = cleanMobileForValidation.replace(/[^0-9]/g, "");
      if (digitsOnly.length >= 10) {
        cleanMobileForValidation = digitsOnly.slice(-10);
      }
    }

    if (cleanMobileForValidation.length > 10 && /^\d{11,13}$/.test(cleanMobileForValidation)) {
      cleanMobileForValidation = cleanMobileForValidation.slice(-10);
    }

    if (!mobileRegex.test(cleanMobileForValidation)) {
      return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number." });
    }

    // 6. Validate country code
    const countryCodeRegex = /^\+\d{1,4}$/;
    let cleanCountryCode = String(countryCode || "+91").trim();
    if (!cleanCountryCode.startsWith("+")) {
      cleanCountryCode = "+" + cleanCountryCode;
    }
    if (!countryCodeRegex.test(cleanCountryCode)) {
      return res.status(400).json({ success: false, message: "Please provide a valid country code (e.g., +91)." });
    }

    // 7. Validate company
    if (!company || typeof company !== "string" || company.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Company name is required and must be at least 2 characters." });
    }

    // 8. Validate designation
    if (!designation || typeof designation !== "string" || designation.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Designation is required and must be at least 2 characters." });
    }

    // 9. Validate department
    if (!department || typeof department !== "string" || department.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Department is required and must be at least 2 characters." });
    }

    // 10. VALIDATE GENDER
    const allowedGenders = ["male", "female", "other"];
    const cleanGender = String(gender || "").trim().toLowerCase();
    if (!cleanGender) {
      return res.status(400).json({ success: false, message: "Gender is required." });
    }
    if (!allowedGenders.includes(cleanGender)) {
      return res.status(400).json({ success: false, message: "Invalid gender. Please select Male, Female or Other." });
    }

    // 11. Validate Employee ID
    if (!companyId || typeof companyId !== "string" || companyId.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Employee ID is required and must be at least 2 characters." });
    }

    // 12. Validate confirmation
    if (confirmationAccepted !== "true") {
      return res.status(400).json({ success: false, message: "Please confirm that the submitted information is correct." });
    }

    // 13. Validate experience
    const parsedExperience = Number(experience);
    if (Number.isNaN(parsedExperience) || parsedExperience < 0 || parsedExperience > 60) {
      return res.status(400).json({ success: false, message: "Please provide valid years of experience (0-60 years)." });
    }

    // 14. Validate location
    if (location && (typeof location !== "string" || location.trim().length < 2)) {
      return res.status(400).json({ success: false, message: "Location must be at least 2 characters if provided." });
    }

    // 15. Validate LinkedIn
    if (linkedin && typeof linkedin === "string" && linkedin.trim().length > 0) {
      const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_]+\/?$/;
      if (!linkedinRegex.test(linkedin.trim())) {
        return res.status(400).json({ success: false, message: "Please provide a valid LinkedIn profile URL." });
      }
    }

    // 16. Validate bio
    if (bio && (typeof bio !== "string" || bio.trim().length > 500)) {
      return res.status(400).json({ success: false, message: "Bio must be less than 500 characters." });
    }

    // 17. Validate skills
    const languages = String(skills || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (languages.length === 0) {
      return res.status(400).json({ success: false, message: "At least one skill/language is required." });
    }

    // 18. Validate files
    const offerLetter = req.files?.offerLetter?.[0];
    const employeeIdProof = req.files?.employeeIdProof?.[0];
    const additionalProof = req.files?.additionalProof?.[0];

    if (!offerLetter) return res.status(400).json({ success: false, message: "Offer letter is required." });
    if (!employeeIdProof) return res.status(400).json({ success: false, message: "Employee ID proof is required." });

    // UPLOAD FILES TO CLOUDINARY
    const timestamp = Date.now();
    const userEmail = normalizeEmail(email);
    const folderName = `mentors/${userEmail}`;

    const offerLetterUpload = await uploadFromBuffer(offerLetter.buffer, `${folderName}/documents`, `offer_letter_${timestamp}`);
    uploadedFiles.push(offerLetterUpload.public_id);

    const employeeIdProofUpload = await uploadFromBuffer(employeeIdProof.buffer, `${folderName}/documents`, `employee_id_${timestamp}`);
    uploadedFiles.push(employeeIdProofUpload.public_id);

    let additionalProofUpload = null;
    if (additionalProof) {
      additionalProofUpload = await uploadFromBuffer(additionalProof.buffer, `${folderName}/documents`, `additional_proof_${timestamp}`);
      uploadedFiles.push(additionalProofUpload.public_id);
    }

    // CLEAN DATA
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

    // UNIQUENESS CHECKS
    const existingMentorByEmail = await Mentor.findOne({ email: normalizedEmail });
    if (existingMentorByEmail) {
      for (const publicId of uploadedFiles) await deleteFromCloudinary(publicId).catch(console.error);
      return res.status(409).json({ success: false, message: "A mentor account already exists with this email." });
    }

    const existingFresherByEmail = await Fresher.findOne({ email: normalizedEmail });
    if (existingFresherByEmail) {
      for (const publicId of uploadedFiles) await deleteFromCloudinary(publicId).catch(console.error);
      return res.status(409).json({ success: false, message: "This email is already registered as a fresher." });
    }

    const existingMentorByMobile = await Mentor.findOne({ mobile: cleanMobile });
    if (existingMentorByMobile) {
      for (const publicId of uploadedFiles) await deleteFromCloudinary(publicId).catch(console.error);
      return res.status(409).json({ success: false, message: "This mobile number is already registered with a mentor account." });
    }

    const existingFresherByMobile = await Fresher.findOne({ mobile: cleanMobile });
    if (existingFresherByMobile) {
      for (const publicId of uploadedFiles) await deleteFromCloudinary(publicId).catch(console.error);
      return res.status(409).json({ success: false, message: "This mobile number is already registered with a fresher account." });
    }

    const existingMentorByEmployeeId = await Mentor.findOne({ employeeId: cleanEmployeeId });
    if (existingMentorByEmployeeId) {
      for (const publicId of uploadedFiles) await deleteFromCloudinary(publicId).catch(console.error);
      return res.status(409).json({ success: false, message: "This Employee ID is already registered with another mentor account." });
    }

    // CREATE MENTOR
    const hashedPassword = await bcrypt.hash(password, 12);

    const mentorData = {
      name: cleanName,
      email: normalizedEmail,
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
      languages: languages,
      hourlyRate: 0,
      bio: cleanBio,
      offerLetter: offerLetterUpload.secure_url,
      offerLetterPublicId: offerLetterUpload.public_id,
      employeeIdProof: employeeIdProofUpload.secure_url,
      employeeIdProofPublicId: employeeIdProofUpload.public_id,
      additionalProof: additionalProofUpload ? additionalProofUpload.secure_url : "",
      additionalProofPublicId: additionalProofUpload ? additionalProofUpload.public_id : "",
      isVerified: false,
      verificationStatus: "pending",
      verificationMethod: "document",
      rejectionReason: "",
      accountStatus: "pending",
      lastLoginAt: null,
      profilePic: "",
    };

    const mentor = await Mentor.create(mentorData);

    return res.status(201).json({
      success: true,
      message: "MNC employee profile submitted successfully. Your account is pending admin verification.",
      user: sanitizeMentor(mentor),
    });

  } catch (error) {
    console.error("Mentor registration error:", error);

    for (const publicId of uploadedFiles) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (deleteError) {
        console.error("Unable to delete file from Cloudinary:", deleteError.message);
      }
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error: " + Object.values(error.errors).map((e) => e.message).join(", "),
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

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const normalizedEmail = normalizeEmail(email);

    const mentor = await Mentor.findOne({ email: normalizedEmail }).select("+password");

    if (!mentor) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(password, mentor.password);
    if (!passwordMatched) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (mentor.accountStatus === "suspended") {
      return res.status(403).json({ success: false, message: "Your account has been suspended. Please contact support." });
    }

    if (mentor.accountStatus === "rejected") {
      return res.status(403).json({ success: false, message: "Your mentor application was rejected.", rejectionReason: mentor.rejectionReason || "" });
    }

    if (mentor.accountStatus !== "active" || mentor.verificationStatus !== "approved" || !mentor.isVerified) {
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
      message: "Mentor login successful",
      token,
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
    return res.status(500).json({ success: false, message: "Unable to login. Please try again." });
  }
};

// =====================================================
// 5. CURRENT USER
// GET /api/auth/me
// =====================================================

exports.getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    if (req.user.role === "mentor") {
      const mentor = await Mentor.findById(req.user.id).select("-password");
      if (!mentor) return res.status(404).json({ success: false, message: "Mentor account not found." });
      return res.status(200).json({ success: true, message: "Mentor data fetched successfully.", user: sanitizeMentor(mentor) });
    }

    if (req.user.role === "fresher") {
      const fresher = await Fresher.findById(req.user.id).select("-password");
      if (!fresher) return res.status(404).json({ success: false, message: "Fresher account not found." });
      return res.status(200).json({ success: true, message: "Fresher data fetched successfully.", user: sanitizeFresher(fresher) });
    }

    return res.status(403).json({ success: false, message: "Invalid user role." });

  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch user information." });
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
      return res.status(400).json({ success: false, message: "Status is required." });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be either 'approved' or 'rejected'." });
    }

    if (status === "rejected") {
      if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 5) {
        return res.status(400).json({ success: false, message: "Rejection reason is required and must be at least 5 characters." });
      }
    }

    const mentor = await Mentor.findById(req.params.id);

    if (!mentor) {
      return res.status(404).json({ success: false, message: "Mentor account not found." });
    }

    if (status === "approved" && mentor.verificationStatus === "approved") {
      return res.status(400).json({ success: false, message: "This mentor is already approved." });
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
      message: status === "approved" ? "Mentor approved successfully." : "Mentor verification rejected.",
      user: sanitizeMentor(mentor),
    });

  } catch (error) {
    console.error("Mentor verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to update mentor verification." });
  }
};