const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ============================================================
// UPLOAD DIRECTORY CONFIGURATION
// ============================================================

const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
);

// Create upload directory if it doesn't exist
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
  "application/pdf",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
]);

// ============================================================
// STORAGE CONFIGURATION - For Local Storage (Optional)
// ============================================================

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    cb(null, uniqueName);
  },
});

// ============================================================
// MEMORY STORAGE - For Cloudinary Upload
// ============================================================

const memoryStorage = multer.memoryStorage();

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  
  // Check if file type is allowed
  if (
    allowedExtensions.has(extension) &&
    allowedMimeTypes.has(file.mimetype)
  ) {
    return cb(null, true);
  }

  // Reject file with proper error
  return cb(
    new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE",
      "Only JPG, JPEG, PNG and PDF files are allowed."
    ),
    false
  );
};

// ============================================================
// MULTER INSTANCES
// ============================================================

// For Cloudinary - Memory Storage
const uploadToCloudinary = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 3,
  },
});

// For Local Storage - Disk Storage (Backup/Alternative)
const uploadToLocal = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 3,
  },
});

// ============================================================
// UPLOAD MIDDLEWARES
// ============================================================

// For mentor registration - multiple files (Cloudinary)
const uploadMentorFiles = uploadToCloudinary.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'employeeIdProof', maxCount: 1 },
  { name: 'additionalProof', maxCount: 1 }
]);

// For mentor registration - multiple files (Local - Backup)
const uploadMentorFilesLocal = uploadToLocal.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'employeeIdProof', maxCount: 1 },
  { name: 'additionalProof', maxCount: 1 }
]);

// For single file uploads
const uploadSingleFile = uploadToCloudinary.single('file');
const uploadSingleFileLocal = uploadToLocal.single('file');

// For profile pictures
const uploadProfilePic = uploadToCloudinary.single('profilePic');
const uploadProfilePicLocal = uploadToLocal.single('profilePic');

// ============================================================
// ERROR HANDLING MIDDLEWARE FOR MULTER
// ============================================================

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded. Maximum 3 files allowed.'
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: err.message || 'Unexpected file upload.'
      });
    }
    
    if (err.code === 'LIMIT_FIELD_KEY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid field name in upload.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error.'
    });
  }
  
  // Pass other errors to next middleware
  next(err);
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Upload instances
  upload: uploadToCloudinary,
  uploadToCloudinary,
  uploadToLocal,
  
  // Specific middlewares
  uploadMentorFiles,
  uploadMentorFilesLocal,
  uploadSingleFile,
  uploadSingleFileLocal,
  uploadProfilePic,
  uploadProfilePicLocal,
  
  // Utility
  uploadDir,
  allowedMimeTypes,
  allowedExtensions,
  handleMulterError,
};