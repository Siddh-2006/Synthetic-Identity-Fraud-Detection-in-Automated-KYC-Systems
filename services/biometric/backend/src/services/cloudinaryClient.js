import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary instance (Mocked if env vars are missing)
let cloudinaryInstance = null;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    cloudinaryInstance = cloudinary;
}

export const uploadStream = (buffer, folder, resourceType = 'auto') => {
    if (!cloudinaryInstance) {
        console.log(`[CloudinaryMock] Simulating upload for ${folder}...`);
        return Promise.resolve({
            secure_url: `https://res.cloudinary.com/demo/video/upload/v1/sample_video.mp4`,
            public_id: 'mock_id'
        });
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinaryInstance.uploader.upload_stream(
            {
                folder: `kyc_biometrics/${folder}`,
                resource_type: resourceType,
                transformation: [
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
};

export const uploadBase64 = (base64Str, folder) => {
    if (!cloudinaryInstance) {
        console.log(`[CloudinaryMock] Simulating B64 upload for ${folder}...`);
        // Return a functional data URL so the user sees their actual frame
        return Promise.resolve({ secure_url: `data:image/jpeg;base64,${base64Str}` });
    }
    return cloudinaryInstance.uploader.upload(`data:image/jpeg;base64,${base64Str}`, {
        folder: `kyc_biometrics/${folder}`
    });
};

export default cloudinary;
