// utils/companyImages.js
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// kind = "logo" | "cover"
// returns { url, publicId }
const saveCompanyImage = (buffer, kind, companyKey) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "MNCConnect/companies",
        public_id: `${companyKey || "company"}-${kind}-${Date.now()}`,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// never throws, so a failed delete never breaks the request
const removeCompanyImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("Cloudinary delete failed:", err.message);
  }
};

module.exports = { saveCompanyImage, removeCompanyImage };