
const multer = require("multer");

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error("Only PNG, JPG, WEBP or AVIF images are allowed")
    );
  }

  cb(null, true);
};

const uploadCompany = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 2,
    fields: 10,
  },
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

module.exports = uploadCompany;
