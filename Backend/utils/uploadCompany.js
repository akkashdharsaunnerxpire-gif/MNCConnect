// utils/uploadCompany.js
const multer = require("multer");

// file stays in memory, then goes straight to Cloudinary
const storage = multer.memoryStorage();

// SVG intentionally not allowed (can carry scripts)
const fileFilter = (req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|avif)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error("Only PNG, JPG, WEBP or AVIF images are allowed"));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB per image
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);