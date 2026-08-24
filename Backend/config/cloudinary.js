const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const fs = require('fs');
const path = require('path');

// ============================================================
// CLOUDINARY CONFIGURATION
// ============================================================

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// ============================================================
// UPLOAD TO CLOUDINARY FROM BUFFER
// ============================================================

const uploadFromBuffer = (fileBuffer, folder, fileName, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: `MNCConnect/${folder}`,
            public_id: fileName || Date.now().toString(),
            resource_type: 'auto',
            ...options
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        
        // Convert buffer to stream and pipe to Cloudinary
        const readableStream = streamifier.createReadStream(fileBuffer);
        readableStream.pipe(uploadStream);
    });
};

// ============================================================
// UPLOAD TO CLOUDINARY FROM LOCAL FILE
// ============================================================

const uploadFromLocalFile = (filePath, folder, fileName, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: `MNCConnect/${folder}`,
            public_id: fileName || path.parse(filePath).name,
            resource_type: 'auto',
            ...options
        };

        cloudinary.uploader.upload(
            filePath,
            uploadOptions,
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
    });
};

// ============================================================
// UPLOAD MENTOR DOCUMENTS
// ============================================================

const uploadMentorDocuments = async (files, email) => {
    const uploadedFiles = [];
    const results = {};

    try {
        const timestamp = Date.now();
        const userEmail = email.toLowerCase().trim();
        const folderName = `mentors/${userEmail}/documents`;

        // Upload offer letter
        if (files.offerLetter && files.offerLetter[0]) {
            const file = files.offerLetter[0];
            const result = await uploadFromBuffer(
                file.buffer,
                folderName,
                `offer_letter_${timestamp}`,
                { resource_type: 'auto' }
            );
            results.offerLetter = result.secure_url;
            results.offerLetterPublicId = result.public_id;
            uploadedFiles.push(result.public_id);
        }

        // Upload employee ID proof
        if (files.employeeIdProof && files.employeeIdProof[0]) {
            const file = files.employeeIdProof[0];
            const result = await uploadFromBuffer(
                file.buffer,
                folderName,
                `employee_id_${timestamp}`,
                { resource_type: 'auto' }
            );
            results.employeeIdProof = result.secure_url;
            results.employeeIdProofPublicId = result.public_id;
            uploadedFiles.push(result.public_id);
        }

        // Upload additional proof
        if (files.additionalProof && files.additionalProof[0]) {
            const file = files.additionalProof[0];
            const result = await uploadFromBuffer(
                file.buffer,
                folderName,
                `additional_proof_${timestamp}`,
                { resource_type: 'auto' }
            );
            results.additionalProof = result.secure_url;
            results.additionalProofPublicId = result.public_id;
            uploadedFiles.push(result.public_id);
        }

        return {
            success: true,
            results,
            uploadedFiles
        };

    } catch (error) {
        // Delete uploaded files if any failed
        for (const publicId of uploadedFiles) {
            try {
                await deleteFromCloudinary(publicId);
            } catch (deleteError) {
                console.error('Failed to delete file:', deleteError);
            }
        }

        throw error;
    }
};

// ============================================================
// DELETE FROM CLOUDINARY
// ============================================================

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
};

// ============================================================
// DELETE MULTIPLE FILES FROM CLOUDINARY
// ============================================================

const deleteMultipleFromCloudinary = async (publicIds) => {
    const results = [];
    
    for (const publicId of publicIds) {
        try {
            const result = await deleteFromCloudinary(publicId);
            results.push({ publicId, success: true, result });
        } catch (error) {
            results.push({ publicId, success: false, error: error.message });
        }
    }
    
    return results;
};

// ============================================================
// GET FILE URL
// ============================================================

const getFileUrl = (publicId, options = {}) => {
    return cloudinary.url(publicId, {
        secure: true,
        ...options
    });
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    cloudinary,
    uploadFromBuffer,
    uploadFromLocalFile,
    uploadMentorDocuments,
    deleteFromCloudinary,
    deleteMultipleFromCloudinary,
    getFileUrl
};