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

// @desc    Upload KYC Documents (Step 2)
// @route   POST /api/kyc/upload
// @access  Private
const uploadDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const files = req.files; // Multer adds files here

    if (files.aadhaar && files.aadhaar[0]) {
      const result = await cloudinary.uploader.upload(files.aadhaar[0].path);
      user.aadhaarUrl = result.secure_url;
      // Cleanup local file
      fs.unlinkSync(files.aadhaar[0].path);
    }
    
    if (files.pan && files.pan[0]) {
       const result = await cloudinary.uploader.upload(files.pan[0].path);
       user.panUrl = result.secure_url;
       // Cleanup local file
       fs.unlinkSync(files.pan[0].path);
    }

    user.verificationStep = 3;
    const updatedUser = await user.save();

    res.json({
        kycStatus: updatedUser.kycStatus,
        verificationStep: updatedUser.verificationStep,
        aadhaarUrl: updatedUser.aadhaarUrl,
        panUrl: updatedUser.panUrl
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'File upload failed' });
  }
};

export { updatePersonalInfo, uploadDocuments };
