import User from '../models/User.js';
import { cloudinary } from '../config/cloudinary.js';
import fs from 'fs';

// @desc    Update personal info (Step 1)
// @route   POST /api/kyc/info
// @access  Private
const updatePersonalInfo = async (req, res) => {
  const { firstName, lastName, dateOfBirth, nationalIdNumber } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = `${firstName} ${lastName}`;
      user.dateOfBirth = dateOfBirth;
      user.nationalIdNumber = nationalIdNumber;
      user.verificationStep = 2; // Move to next step

      const updatedUser = await user.save();

      res.json({
         _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        kycStatus: updatedUser.kycStatus,
        verificationStep: updatedUser.verificationStep
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

import Kyc from '../models/Kyc.js';
import { extractAadhaar, extractPan } from '../services/fastapiService.js';

// @desc    Upload KYC Documents (Step 2)
// @route   POST /api/kyc/upload
// @access  Private
const uploadDocuments = async (req, res) => {
  console.log("Files Upload Request Received");
  let aadhaarLocalPath = null;
  let panLocalPath = null;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const files = req.files;
    if (!files.aadhaar || !files.aadhaar[0] || !files.pan || !files.pan[0]) {
        return res.status(400).json({ message: 'Both Aadhaar and PAN documents are required' });
    }

    aadhaarLocalPath = files.aadhaar[0].path;
    panLocalPath = files.pan[0].path;

    // 1. Upload to Cloudinary (Parallel)
    const [aadhaarUpload, panUpload] = await Promise.all([
      cloudinary.uploader.upload(aadhaarLocalPath),
      cloudinary.uploader.upload(panLocalPath)
    ]);

    user.aadhaarUrl = aadhaarUpload.secure_url;
    user.panUrl = panUpload.secure_url;

    // 2. Extract OCR Data (FastAPI)
    // We send local file paths to the service which sends them to FastAPI
    const [aadhaarOcr, panOcr] = await Promise.all([
      extractAadhaar(aadhaarLocalPath),
      extractPan(panLocalPath)
    ]);
    
    console.log("Aadhaar OCR Result:", aadhaarOcr);
    console.log("PAN OCR Result:", panOcr);

    // 3. Save to Kyc Model
    console.log("Saving KYC Entry with details:");
    console.log("Aadhaar Data:", aadhaarOcr.data);
    console.log("PAN Data:", panOcr.data);
    
    const kycEntry = await Kyc.create({
        user: user._id,
        aadhaar: {
            number: aadhaarOcr.data?.Aadhaar_Number || aadhaarOcr.data?.UID,
            name: aadhaarOcr.data?.Name,
            dob: aadhaarOcr.data?.DOB,
            gender: aadhaarOcr.data?.Gender,
            details: aadhaarOcr.data
        },
        pan: {
            number: panOcr.data?.PAN_Number,
            name: panOcr.data?.Name,
            fatherName: panOcr.data?.Father_Name,
            dob: panOcr.data?.Date_of_Birth,
            details: panOcr.data
        },
        status: 'pending' 
    });

    // 4. Update User Status
    user.kycStatus = kycEntry.status;
    user.verificationStep = 3;
    await user.save();

    res.json({
        kycStatus: user.kycStatus,
        verificationStep: user.verificationStep,
        aadhaarUrl: user.aadhaarUrl,
        panUrl: user.panUrl,
        ocrResult: { aadhaar: aadhaarOcr.data, pan: panOcr.data }
    });

  } catch (error) {
    console.error("KYC Upload Error:", error);
    res.status(500).json({ message: 'KYC Processing Failed: ' + error.message });
  } finally {
    // Cleanup local files
    try {
        if (aadhaarLocalPath && fs.existsSync(aadhaarLocalPath)) fs.unlinkSync(aadhaarLocalPath);
        if (panLocalPath && fs.existsSync(panLocalPath)) fs.unlinkSync(panLocalPath);
    } catch (e) {
        console.error("File cleanup error:", e);
    }
  }
};

export { updatePersonalInfo, uploadDocuments };
