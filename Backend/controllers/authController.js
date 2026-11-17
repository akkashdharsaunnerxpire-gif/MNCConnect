// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Fresher = require("../models/Fresher");
const Mentor = require("../models/Mentor");
const { generateMentorCode } = require("../utils/mentorCode");
const { parsePhone } = require("../utils/phone");
const { uploadFromBuffer, deleteFromCloudinary } = require("../config/cloudinary");
const { sendMail, otpVerificationEmail } = require("../utils/mailer");
const { notify, emitToUser } = require("../utils/realtime");

// =====================================================
// CONSTANTS
// =====================================================

const WELCOME_BONUS = 25;
const REFERRAL_REWARD = 10;
const TEMP_NAME = "Temp"; // placeholder name used by send-otp

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_GAP_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_COOKIE_NAME = "mnc_token";

const DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DOC_BYTES = 5 * 1024 * 1024;

// =====================================================
// HELPERS
// =====================================================

const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign({ id: id.toString(), role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
};

const setAuthCookie = (res, token) =>
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const validatePassword = (password) =>
  typeof password === "string" && password.length >= 8 && password.length <= 128;

const isReservedName = (name) => String(name || "").trim().toLowerCase() === TEMP_NAME.toLowerCase();

// a placeholder, or a real account whose e-mail was NEVER verified (nobody owns it yet)
const isReplaceable = (f) => Boolean(f) && (f.name === TEMP_NAME || !f.isEmailVerified);

const generateReferralCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
};

const cleanReferral = (v) => {
  const code = String(v || "").trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
};

// ---------- OTP (hashed, limited attempts, resend cooldown) ----------

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = (email, otp) =>
  crypto
    .createHmac("sha256", String(process.env.JWT_SECRET || ""))
    .update(`${email}:${otp}`)
    .digest("hex");

const otpMatches = (stored, email, otp) => {
  if (!stored) return false;
  const a = Buffer.from(String(stored));
  const b = Buffer.from(hashOtp(email, otp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// sets the hashed code on the document (caller saves) and returns the PLAIN code for the e-mail
const issueOtp = (doc, email) => {
  const otp = generateOtp();
  doc.emailOtp = hashOtp(email, otp);
  doc.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  doc.emailOtpAttempts = 0;
  return otp;
};

const otpTooSoon = (doc) =>
  Boolean(doc && doc.emailOtpExpiresAt) &&
  doc.emailOtpExpiresAt.getTime() - OTP_TTL_MS + OTP_RESEND_GAP_MS > Date.now();

const mailOtp = async (email, name, otp) => {
  const content = otpVerificationEmail(name, otp);
  const r = await sendMail({ to: email, toName: name, ...content });
  return !(r && r.success === false);
};

// unique dummy mobile for the temporary OTP record
const tempMobile = () =>
  `+910${String(crypto.randomInt(0, 999999999)).padStart(9, "0")}`;

// ---------- list cleaners ----------

const cleanTags = (value, max = 30, maxLen = 40) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const s = String(item || "").trim().slice(0, maxLen);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

// education / career are free-form objects: cap count + size, drop "$" keys
const cleanMixed = (value, maxItems = 10, maxJson = 1500) => {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    if (typeof item === "string") {
      const s = item.trim().slice(0, 300);
      if (s) out.push(s);
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const safe = Object.fromEntries(
        Object.entries(item).filter(([k]) => !k.startsWith("$") && !k.includes(".")),
      );
      if (JSON.stringify(safe).length <= maxJson) out.push(safe);
    }
  }
  return out;
};

const sanitizeFresher = (user) => ({
  id: user._id,
  name: user.name || "",
  email: user.email || "",

  mobile: user.mobile || "",
  phone: user.mobile || "",
  countryCode: user.countryCode || "+91",

  role: "fresher",
  gender: user.gender || "",
  profilePic: user.profilePic || "",

  dateOfBirth: user.dateOfBirth || "",
  location: user.location || "",
  nationality: user.nationality || "",
  bio: user.bio || "",

  education: user.education || [],
  career: user.career || [],
  skills: user.skills || [],
  interests: user.interests || [],

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
});

// ₹25 welcome bonus: atomic, ONLY for a verified real account, can NEVER be given twice.
// (The old version re-granted it whenever the wallet was < 25 and the gift was not opened.)
const grantWelcomeBonus = async (fresherId) =>
  Fresher.findOneAndUpdate(
    {
      _id: fresherId,
      name: { $ne: TEMP_NAME },
      isEmailVerified: true,
      welcomeBonusClaimed: { $ne: true },
    },
    {
      $inc: { bonusBalance: WELCOME_BONUS },
      $set: { welcomeBonusClaimed: true, welcomeBonusSeen: false },
    },
    { returnDocument: "after" },
  );

// Pays the referrer ₹10 (into referralBalance). The new user is claimed FIRST (atomic),
// so one account can never trigger the reward twice. Returns true when paid.
const payReferral = async (fresherId, rawCode) => {
  const code = cleanReferral(rawCode);
  if (!code) return false;

  const referrer = await Fresher.findOne({
    referralCode: code,
    _id: { $ne: fresherId },
    isEmailVerified: true,
  })
    .select("_id")
    .lean();
  if (!referrer) return false;

  const me = await Fresher.findOneAndUpdate(
    { _id: fresherId, hasUsedReferral: { $ne: true } },
    { $set: { hasUsedReferral: true, referredBy: referrer._id, pendingReferralCode: "" } },
    { returnDocument: "after", projection: { name: 1 } },
  );
  if (!me) return false;

  const updated = await Fresher.findByIdAndUpdate(
    referrer._id,
    { $inc: { referralBalance: REFERRAL_REWARD, referralEarnings: REFERRAL_REWARD } },
    { returnDocument: "after" },
  );

  notify({
    user: referrer._id,
    role: "fresher",
    title: "Referral reward",
    message: `${me.name || "Someone"} joined with your code. ₹${REFERRAL_REWARD} added to your wallet.`,
    type: "payment",
  });
  emitToUser(String(referrer._id), "wallet:updated", {
    balance: updated?.walletBalance,
  });
  return true;
};

// =====================================================
// 1. FRESHER REGISTER (sends OTP)
// POST /api/auth/fresher/register
// =====================================================

exports.registerFresher = async (req, res) => {
  try {
    const { name, email, mobile, countryCode, password, referralInput, gender } =
      req.body || {};

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required.",
      });
    }

    const cleanName = String(name).trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }
    if (isReservedName(cleanName)) {
      return res.status(400).json({ success: false, message: "Please enter your real name." });
    }

    // gender decides which employee gets a single meeting
    const cleanGender = String(gender || "").trim().toLowerCase();
    if (!["male", "female"].includes(cleanGender)) {
      return res.status(400).json({
        success: false,
        message: "Please select your gender (Male or Female).",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) {
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

    const phone = parsePhone(countryCode, mobile);
    if (phone.error) {
      return res.status(400).json({ success: false, message: phone.error });
    }

    // ---------- uniqueness ----------
    const existing = await Fresher.findOne({ email: normalizedEmail });

    // a verified account is a real one. An unverified one belongs to nobody yet,
    // so the real owner may take it over (stops e-mail squatting).
    if (existing && !isReplaceable(existing)) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }

    if (await Mentor.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a mentor.",
      });
    }

    const mobileFilter = { mobile: phone.full };
    if (existing) mobileFilter._id = { $ne: existing._id };
    if (await Fresher.exists(mobileFilter)) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a fresher account.",
      });
    }
    if (await Mentor.exists({ mobile: phone.full })) {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered with a mentor account.",
      });
    }

    if (existing && !existing.isEmailVerified && otpTooSoon(existing)) {
      return res.status(429).json({
        success: false,
        message: "Please wait a minute before requesting another code.",
      });
    }

    // ---------- build the account ----------
    const hashedPassword = await bcrypt.hash(password, 12);
    const pendingReferral = cleanReferral(referralInput);

    let myReferralCode = generateReferralCode();
    while (await Fresher.exists({ referralCode: myReferralCode })) {
      myReferralCode = generateReferralCode();
    }

    let fresher;
    let needsOtp = true;
    let otp = "";

    if (existing) {
      needsOtp = !existing.isEmailVerified;

      existing.name = cleanName;
      existing.gender = cleanGender;
      existing.mobile = phone.full;
      existing.countryCode = phone.code;
      existing.password = hashedPassword;
      if (!existing.referralCode) existing.referralCode = myReferralCode;
      if (pendingReferral && !existing.hasUsedReferral) {
        existing.pendingReferralCode = pendingReferral;
      }
      if (needsOtp) otp = issueOtp(existing, normalizedEmail);

      await existing.save();
      fresher = existing;
    } else {
      fresher = new Fresher({
        name: cleanName,
        email: normalizedEmail,
        gender: cleanGender,
        mobile: phone.full,
        countryCode: phone.code,
        password: hashedPassword,
        referralCode: myReferralCode,
        pendingReferralCode: pendingReferral,
        isEmailVerified: false,
      });
      otp = issueOtp(fresher, normalizedEmail);
      await fresher.save();
    }

    // ---------- e-mail was already verified inline: reward + log in ----------
    if (!needsOtp) {
      await grantWelcomeBonus(fresher._id).catch((e) =>
        console.error("Welcome bonus error:", e.message),
      );
      if (pendingReferral) {
        await payReferral(fresher._id, pendingReferral).catch((e) =>
          console.error("Referral reward error:", e.message),
        );
      }

      const finalUser = (await Fresher.findById(fresher._id)) || fresher;
      setAuthCookie(res, generateToken(finalUser._id, "fresher"));

      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        requiresVerification: false,
        user: sanitizeFresher(finalUser),
      });
    }

    // ---------- send OTP ----------
    const sent = await mailOtp(normalizedEmail, cleanName, otp);
    if (!sent) {
      return res.status(502).json({
        success: false,
        message: "We could not send the verification email. Please try again.",
      });
    }

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
// 1.5 SEND OTP (inline e-mail verification, also used to RESEND)
// POST /api/auth/fresher/send-otp
// =====================================================

exports.sendFresherOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }

    const existing = await Fresher.findOne({ email: normalizedEmail });

    // only a VERIFIED real account blocks this. An unverified one may ask for a new code.
    if (existing && !isReplaceable(existing)) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
    }

    if (await Mentor.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as a mentor.",
      });
    }

    let doc = existing;
    if (doc) {
      if (otpTooSoon(doc)) {
        return res.status(429).json({
          success: false,
          message: "Please wait a minute before requesting another code.",
        });
      }
    } else {
      doc = new Fresher({
        name: TEMP_NAME,
        email: normalizedEmail,
        mobile: tempMobile(),
        password: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      });
    }

    const otp = issueOtp(doc, normalizedEmail);
    doc.isEmailVerified = false;
    await doc.save();

    const sent = await mailOtp(normalizedEmail, doc.name === TEMP_NAME ? "User" : doc.name, otp);
    if (!sent) {
      return res.status(502).json({
        success: false,
        message: "We could not send the email. Please try again.",
      });
    }

    return res.status(200).json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.error("Send OTP error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A fresher account already exists with this email.",
      });
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
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Email and a 6-digit OTP are required.",
      });
    }

    const fresher = await Fresher.findOne({ email });
    if (!fresher) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    if (fresher.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. Please login.",
      });
    }

    if (!fresher.emailOtp || !fresher.emailOtpExpiresAt) {
      return res.status(400).json({ success: false, message: "Please request a new OTP." });
    }

    if (new Date() > fresher.emailOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if ((fresher.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    if (!otpMatches(fresher.emailOtp, email, otp)) {
      await Fresher.updateOne({ _id: fresher._id }, { $inc: { emailOtpAttempts: 1 } });
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // atomic: only ONE request can flip it to verified
    const verified = await Fresher.findOneAndUpdate(
      { _id: fresher._id, isEmailVerified: false },
      {
        $set: {
          isEmailVerified: true,
          emailOtp: null,
          emailOtpExpiresAt: null,
          emailOtpAttempts: 0,
        },
      },
      { returnDocument: "after" },
    );
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. Please login.",
      });
    }

    // rewards only now (real, verified account)
    let finalUser = verified;
    if (verified.name !== TEMP_NAME) {
      await grantWelcomeBonus(verified._id).catch(() => null);
      if (verified.pendingReferralCode) {
        await payReferral(verified._id, verified.pendingReferralCode).catch((e) =>
          console.error("Referral reward error:", e.message),
        );
      }
      finalUser = (await Fresher.findById(verified._id)) || verified;
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user: sanitizeFresher(finalUser),
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify OTP." });
  }
};

// =====================================================
// 3. FRESHER LOGIN
// POST /api/auth/fresher/login
// =====================================================

exports.loginFresher = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const normalizedEmail = normalizeEmail(email);
    const fresher = await Fresher.findOne({ email: normalizedEmail }).select("+password");

    // a "Temp" placeholder is not a real account
    if (!fresher || fresher.name === TEMP_NAME) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(String(password), fresher.password);
    if (!passwordMatched) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!fresher.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: fresher.email,
      });
    }

    // updateOne: never fails because of some old invalid field on the document
    await Fresher.updateOne({ _id: fresher._id }, { $set: { lastLoginAt: new Date() } });

    // old verified accounts that never got the bonus (atomic, only once)
    if (!fresher.welcomeBonusClaimed) {
      await grantWelcomeBonus(fresher._id).catch(() => null);
    }
    const finalUser = (await Fresher.findById(fresher._id)) || fresher;

    setAuthCookie(res, generateToken(fresher._id, "fresher"));

    return res.status(200).json({
      success: true,
      message: "Fresher login successful.",
      user: sanitizeFresher(finalUser),
    });
  } catch (error) {
    console.error("Fresher login error:", error);
    return res.status(500).json({ success: false, message: "Unable to login." });
  }
};

// =====================================================
// 3.5 APPLY A REFERRAL CODE (from the wallet page)
// POST /api/auth/apply-referral   { referralCode }
// =====================================================

exports.applyReferral = async (req, res) => {
  try {
    if (!req.user?.id || req.user.role !== "fresher") {
      return res.status(403).json({ success: false, message: "Only freshers can do this." });
    }

    const code = cleanReferral(req.body?.referralCode);
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Referral code must contain 6 characters.",
      });
    }

    const me = await Fresher.findById(req.user.id).select("referralCode hasUsedReferral");
    if (!me) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
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

    const paid = await payReferral(me._id, code);
    if (!paid) {
      const again = await Fresher.exists({ _id: me._id, hasUsedReferral: true });
      return again
        ? res.status(400).json({ success: false, message: "You have already used a referral code." })
        : res.status(404).json({ success: false, message: "Invalid referral code." });
    }

    return res.json({ success: true, message: "Referral applied." });
  } catch (error) {
    console.error("applyReferral error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to apply referral code." });
  }
};

// =====================================================
// 3.6 WELCOME GIFT SEEN
// PATCH /api/auth/welcome-bonus-seen
// =====================================================

exports.markWelcomeBonusSeen = async (req, res) => {
  try {
    if (!req.user?.id || req.user.role !== "fresher") {
      return res.status(403).json({ success: false, message: "Only freshers can do this." });
    }

    await Fresher.updateOne({ _id: req.user.id }, { $set: { welcomeBonusSeen: true } });
    return res.json({ success: true });
  } catch (error) {
    console.error("markWelcomeBonusSeen error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update." });
  }
};

// =====================================================
// MENTOR
// =====================================================

const sanitizeMentor = (mentor) => ({
  id: mentor._id,
  name: mentor.name,
  email: mentor.email,
  role: "mentor",
  countryCode: mentor.countryCode || "+91",
  mobile: mentor.mobile || "",
  gender: mentor.gender || "",
  profilePic: mentor.profilePic || "",
  employeeId: mentor.employeeId || "",
  mentorCode: mentor.mentorCode || "",
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
});

const badDocument = (f) => Boolean(f) && (!DOC_TYPES.has(f.mimetype) || f.size > MAX_DOC_BYTES);

// POST /api/auth/mentor/register
exports.registerMentor = async (req, res) => {
  let uploadedFiles = [];

  const cleanupUploads = async () => {
    for (const publicId of uploadedFiles) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (deleteError) {
        console.error("Unable to delete file from Cloudinary:", deleteError.message);
      }
    }
    uploadedFiles = [];
  };

  const bad = (message, status = 400) => res.status(status).json({ success: false, message });

  try {
    const {
      name, email, mobile, countryCode, password, company, designation, department,
      gender, experience, location, linkedin, skills, bio, companyId, confirmationAccepted,
    } = req.body || {};

    if (!name || !email || !mobile || !password) {
      return bad("Name, email, mobile number and password are required.");
    }

    const cleanName = String(name).trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 50) {
      return bad("Name must be between 2 and 50 characters.");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) return bad("Please provide a valid email address.");

    if (!validatePassword(password)) return bad("Password must be between 8 and 128 characters.");

    const phone = parsePhone(countryCode, mobile);
    if (phone.error) return bad(phone.error);

    const strMin2 = (v) => typeof v === "string" && v.trim().length >= 2;
    if (!strMin2(company)) return bad("Company name is required and must be at least 2 characters.");
    if (!strMin2(designation)) return bad("Designation is required and must be at least 2 characters.");
    if (!strMin2(department)) return bad("Department is required and must be at least 2 characters.");

    const cleanGender = String(gender || "").trim().toLowerCase();
    if (!cleanGender) return bad("Gender is required.");
    if (!["male", "female", "other"].includes(cleanGender)) {
      return bad("Invalid gender. Please select Male, Female or Other.");
    }

    if (!strMin2(companyId)) return bad("Employee ID is required and must be at least 2 characters.");

    if (confirmationAccepted !== "true") {
      return bad("Please confirm that the submitted information is correct.");
    }

    const parsedExperience = Number(experience);
    if (
      experience === undefined || experience === "" ||
      Number.isNaN(parsedExperience) || parsedExperience < 0 || parsedExperience > 60
    ) {
      return bad("Please provide valid years of experience (0-60 years).");
    }

    if (location && (typeof location !== "string" || location.trim().length < 2)) {
      return bad("Location must be at least 2 characters if provided.");
    }

    if (linkedin && typeof linkedin === "string" && linkedin.trim()) {
      const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/;
      if (!linkedinRegex.test(linkedin.trim())) {
        return bad("Please provide a valid LinkedIn profile URL.");
      }
    }

    if (bio && (typeof bio !== "string" || bio.trim().length > 2000)) {
      return bad("Bio must be less than 2000 characters.");
    }

    const skillList = cleanTags(skills);
    if (skillList.length === 0) return bad("At least one skill is required.");

    // files
    const offerLetter = req.files?.offerLetter?.[0];
    const employeeIdProof = req.files?.employeeIdProof?.[0];
    const additionalProof = req.files?.additionalProof?.[0];

    if (!offerLetter) return bad("Offer letter is required.");
    if (!employeeIdProof) return bad("Employee ID proof is required.");
    if ([offerLetter, employeeIdProof, additionalProof].some(badDocument)) {
      return bad("Documents must be PDF, JPG or PNG files up to 5 MB.");
    }

    const cleanCompany = String(company).trim();
    const cleanDesignation = String(designation).trim();
    const cleanDepartment = String(department).trim();
    const cleanEmployeeId = String(companyId).trim();
    const cleanLocation = location ? String(location).trim() : "";
    const cleanLinkedin = linkedin ? String(linkedin).trim() : "";
    const cleanBio = bio ? String(bio).trim() : "";

    // UNIQUENESS (before uploading, so nothing to clean up)
    if (await Mentor.exists({ email: normalizedEmail })) {
      return bad("A mentor account already exists with this email.", 409);
    }
    // a verified fresher blocks it; a "Temp" placeholder or unverified one does not
    if (
      await Fresher.exists({
        email: normalizedEmail,
        name: { $ne: TEMP_NAME },
        isEmailVerified: true,
      })
    ) {
      return bad("This email is already registered as a fresher.", 409);
    }
    if (await Mentor.exists({ mobile: phone.full })) {
      return bad("This mobile number is already registered with a mentor account.", 409);
    }
    if (await Fresher.exists({ mobile: phone.full })) {
      return bad("This mobile number is already registered with a fresher account.", 409);
    }

    // the SAME employee id may exist in ANOTHER company, so it is unique per company
    if (
      await Mentor.findOne({ currentCompany: cleanCompany, employeeId: cleanEmployeeId })
        .collation({ locale: "en", strength: 2 })
        .select("_id")
        .lean()
    ) {
      return bad("This Employee ID is already registered for this company.", 409);
    }

    // UPLOAD (random folder: no e-mail inside the file URL)
    const timestamp = Date.now();
    const folderName = `mentors/${crypto.randomBytes(8).toString("hex")}/documents`;

    const offerLetterUpload = await uploadFromBuffer(
      offerLetter.buffer, folderName, `offer_letter_${timestamp}`,
    );
    uploadedFiles.push(offerLetterUpload.public_id);

    const employeeIdProofUpload = await uploadFromBuffer(
      employeeIdProof.buffer, folderName, `employee_id_${timestamp}`,
    );
    uploadedFiles.push(employeeIdProofUpload.public_id);

    let additionalProofUpload = null;
    if (additionalProof) {
      additionalProofUpload = await uploadFromBuffer(
        additionalProof.buffer, folderName, `additional_proof_${timestamp}`,
      );
      uploadedFiles.push(additionalProofUpload.public_id);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const mentorCode = await generateMentorCode(Mentor, cleanName);

    const mentor = await Mentor.create({
      name: cleanName,
      email: normalizedEmail,
      countryCode: phone.code,
      mobile: phone.full,
      password: hashedPassword,
      employeeId: cleanEmployeeId,
      mentorCode,
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
      additionalProof: additionalProofUpload ? additionalProofUpload.secure_url : "",
      additionalProofPublicId: additionalProofUpload ? additionalProofUpload.public_id : "",
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
      return bad(
        "Validation error: " +
          Object.values(error.errors).map((e) => e.message).join(", "),
      );
    }
    if (error.code === 11000) {
      return bad("An account already exists with this email, mobile number, or employee ID.", 409);
    }
    return bad("Unable to submit MNC employee registration. Please try again.", 500);
  }
};

// POST /api/auth/mentor/login
exports.loginMentor = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address." });
    }

    const mentor = await Mentor.findOne({ email: normalizedEmail }).select("+password");
    if (!mentor || !(await bcrypt.compare(String(password), mentor.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
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
        message: "Your MNC employee profile is still pending admin verification.",
        verificationStatus: mentor.verificationStatus || "pending",
        accountStatus: mentor.accountStatus,
      });
    }

    await Mentor.updateOne({ _id: mentor._id }, { $set: { lastLoginAt: new Date() } });

    setAuthCookie(res, generateToken(mentor._id, "mentor"));

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
      if (!mentor) {
        return res.status(404).json({ success: false, message: "Mentor account not found." });
      }

      // a JWT stays valid after the admin suspends / rejects the mentor: check the database
      if (mentor.accountStatus !== "active") {
        clearAuthCookie(res);
        return res
          .status(403)
          .json({ success: false, message: "Your mentor account is not active." });
      }

      return res.status(200).json({
        success: true,
        message: "Mentor data fetched successfully.",
        user: sanitizeMentor(mentor),
      });
    }

    if (req.user.role === "fresher") {
      let fresher = await Fresher.findById(req.user.id).select("-password");
      if (!fresher) {
        return res.status(404).json({ success: false, message: "Fresher account not found." });
      }

      // self-heal only for verified accounts that never got the bonus (no query otherwise)
      if (!fresher.welcomeBonusClaimed && fresher.isEmailVerified && fresher.name !== TEMP_NAME) {
        const bonusUser = await grantWelcomeBonus(fresher._id).catch(() => null);
        if (bonusUser) fresher = bonusUser;
      }

      return res.status(200).json({
        success: true,
        message: "Fresher data fetched successfully.",
        user: sanitizeFresher(fresher),
      });
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
// ⚠ NO auth inside this function: the ROUTE must be behind the admin login.
// =====================================================

exports.updateMentorVerification = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid mentor id." });
    }
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required." });
    }
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'.",
      });
    }
    if (
      status === "rejected" &&
      (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required and must be at least 5 characters.",
      });
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
    } else {
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
  return res.status(200).json({ success: true, message: "Logged out successfully." });
};

// ============================================================
// UPLOAD PROFILE AVATAR   POST /api/auth/avatar
// ============================================================

exports.uploadProfileAvatar = async (req, res) => {
  let uploadedPublicId = "";

  try {
    if (!req.user?.id || !["fresher", "mentor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Invalid user." });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Please select a profile image." });
    }
    if (!AVATAR_TYPES.has(file.mimetype)) {
      return res.status(400).json({ success: false, message: "Choose a JPG, PNG or WEBP image." });
    }
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Maximum image size is 5MB." });
    }

    const Model = req.user.role === "mentor" ? Mentor : Fresher;

    // profilePicPublicId is select:false -> it must be requested, otherwise the old photo is never deleted
    const user = await Model.findById(req.user.id).select("+profilePicPublicId");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const result = await uploadFromBuffer(
      file.buffer,
      `profiles/${req.user.role}`,
      `${req.user.role}_${user._id}_${Date.now()}`,
      { resource_type: "image" },
    );
    uploadedPublicId = result.public_id;

    const oldPublicId = user.profilePicPublicId;

    await Model.updateOne(
      { _id: user._id },
      { $set: { profilePic: result.secure_url, profilePicPublicId: result.public_id } },
    );

    if (oldPublicId && oldPublicId !== result.public_id) {
      await deleteFromCloudinary(oldPublicId).catch((e) =>
        console.error("Old avatar deletion failed:", e.message),
      );
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully.",
      user: { profilePic: result.secure_url },
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    if (uploadedPublicId) await deleteFromCloudinary(uploadedPublicId).catch(() => {});
    return res.status(500).json({ success: false, message: "Unable to upload profile photo." });
  }
};

// ============================================================
// REMOVE PROFILE AVATAR   DELETE /api/auth/avatar
// ============================================================

exports.removeProfileAvatar = async (req, res) => {
  try {
    if (!req.user?.id || !["fresher", "mentor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Invalid user." });
    }

    const Model = req.user.role === "mentor" ? Mentor : Fresher;

    const user = await Model.findById(req.user.id).select("+profilePicPublicId");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const oldPublicId = user.profilePicPublicId;

    await Model.updateOne(
      { _id: user._id },
      { $set: { profilePic: "", profilePicPublicId: "" } },
    );

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId).catch((e) =>
        console.error("Avatar deletion failed:", e.message),
      );
    }

    return res.json({ success: true, message: "Profile photo removed.", user: { profilePic: "" } });
  } catch (error) {
    console.error("Avatar removal error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove profile photo." });
  }
};

// ============================================================
// UPDATE FRESHER PROFILE   PATCH /api/auth/update
// ============================================================

exports.updateFresherProfile = async (req, res) => {
  try {
    if (!req.user?.id || req.user.role !== "fresher") {
      return res
        .status(403)
        .json({ success: false, message: "Only freshers can update this profile." });
    }

    const current = await Fresher.findById(req.user.id).select("name countryCode mobile");
    if (!current || current.name === TEMP_NAME) {
      return res.status(404).json({ success: false, message: "Fresher account not found." });
    }

    const body = req.body || {};
    const set = {};
    const bad = (message) => res.status(400).json({ success: false, message });

    if (body.name !== undefined) {
      const name = String(body.name).trim().replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 50) return bad("Name must be between 2 and 50 characters.");
      if (isReservedName(name)) return bad("Please enter your real name.");
      set.name = name;
    }

    if (body.gender !== undefined) {
      const g = String(body.gender).trim().toLowerCase();
      if (!["male", "female"].includes(g)) return bad("Please select Male or Female.");
      set.gender = g;
    }

    if (body.dateOfBirth !== undefined) {
      if (body.dateOfBirth === "" || body.dateOfBirth === null) {
        set.dateOfBirth = null;
      } else {
        const d = new Date(body.dateOfBirth);
        if (Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) {
          return bad("Please enter a valid date of birth.");
        }
        set.dateOfBirth = d;
      }
    }

    if (body.location !== undefined) set.location = String(body.location).trim().slice(0, 100);
    if (body.nationality !== undefined) set.nationality = String(body.nationality).trim().slice(0, 100);
    if (body.bio !== undefined) set.bio = String(body.bio).trim().slice(0, 2000);

    // frontend may send "phone"; the database field is "mobile"
    const rawMobile = body.mobile !== undefined ? body.mobile : body.phone;
    if (rawMobile !== undefined || body.countryCode !== undefined) {
      const phone = parsePhone(
        body.countryCode !== undefined ? body.countryCode : current.countryCode,
        rawMobile !== undefined ? rawMobile : current.mobile,
      );
      if (phone.error) return bad(phone.error);

      const [fresherClash, mentorClash] = await Promise.all([
        Fresher.exists({ _id: { $ne: current._id }, mobile: phone.full }),
        Mentor.exists({ mobile: phone.full }),
      ]);
      if (fresherClash || mentorClash) {
        return res
          .status(409)
          .json({ success: false, message: "This mobile number is already registered." });
      }

      set.mobile = phone.full;
      set.countryCode = phone.code;
    }

    if (body.skills !== undefined) set.skills = cleanTags(body.skills);
    if (body.interests !== undefined) set.interests = cleanTags(body.interests);
    if (body.education !== undefined) set.education = cleanMixed(body.education);
    if (body.career !== undefined) set.career = cleanMixed(body.career);

    if (Object.keys(set).length === 0) return bad("Nothing to update.");

    const updated = await Fresher.findByIdAndUpdate(
      current._id,
      { $set: set },
      { returnDocument: "after", runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: sanitizeFresher(updated),
    });
  } catch (error) {
    console.error("Fresher profile update error:", error);

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "This mobile number is already registered." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Unable to update fresher profile." });
  }
};