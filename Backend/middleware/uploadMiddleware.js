const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDir = path.resolve(
  process.env.UPLOAD_DIR ||
    path.join(process.cwd(), "uploads")
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
]);

// ============================================================
// DISK STORAGE
// ============================================================

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, uniqueName);
  },
});

// ============================================================
// MEMORY STORAGE - CLOUDINARY
// ============================================================

const memoryStorage =
  multer.memoryStorage();

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (
  req,
  file,
  cb
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    allowedExtensions.has(extension) &&
    allowedMimeTypes.has(file.mimetype)
  ) {
    return cb(null, true);
  }

  return cb(
    new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE"
    ),
    false
  );
};

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

const uploadToCloudinary =
  multer({
    storage: memoryStorage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 4,
    },
  });

// ============================================================
// LOCAL UPLOAD
// ============================================================

const uploadToLocal =
  multer({
    storage: diskStorage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 4,
    },
  });

// ============================================================
// MENTOR FILES
// ============================================================

const mentorUploadFields = [
  {
    name: "employee_profileimage",
    maxCount: 1,
  },
  {
    name: "offerLetter",
    maxCount: 1,
  },
  {
    name: "employeeIdProof",
    maxCount: 1,
  },
  {
    name: "additionalProof",
    maxCount: 1,
  },
];

// Cloudinary
const uploadMentorFiles =
  uploadToCloudinary.fields(
    mentorUploadFields
  );

// Local backup
const uploadMentorFilesLocal =
  uploadToLocal.fields(
    mentorUploadFields
  );

// ============================================================
// SINGLE FILE
// ============================================================

const uploadSingleFile =
  uploadToCloudinary.single("file");

const uploadSingleFileLocal =
  uploadToLocal.single("file");

// ============================================================
// PROFILE PICTURE
// ============================================================

const uploadProfilePic =
  uploadToCloudinary.single(
    "employee_profileimage"
  );

const uploadProfilePicLocal =
  uploadToLocal.single(
    "employee_profileimage"
  );

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

const handleMulterError = (
  err,
  req,
  res,
  next
) => {
  if (!err) {
    return next();
  }

  if (
    err instanceof multer.MulterError
  ) {
    if (
      err.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "File size too large. Maximum size is 10MB.",
      });
    }

    if (
      err.code ===
      "LIMIT_FILE_COUNT"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Too many files uploaded. Maximum 4 files allowed.",
      });
    }

    if (
      err.code ===
      "LIMIT_UNEXPECTED_FILE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type or unexpected upload field. Allowed: JPG, JPEG, PNG, WEBP and PDF.",
      });
    }

    if (
      err.code ===
      "LIMIT_FIELD_KEY"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid field name in upload.",
      });
    }

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "File upload error.",
    });
  }

  return next(err);
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  upload: uploadToCloudinary,
  uploadToCloudinary,
  uploadToLocal,

  uploadMentorFiles,
  uploadMentorFilesLocal,

  uploadSingleFile,
  uploadSingleFileLocal,

  uploadProfilePic,
  uploadProfilePicLocal,

  uploadDir,
  allowedMimeTypes,
  allowedExtensions,

  handleMulterError,
};