import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updatePersonalInfo, uploadDocuments, verifyBiometric } from '../controllers/kycController.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.post('/info', protect, updatePersonalInfo);
router.post('/upload', protect, upload.fields([{ name: 'aadhaar', maxCount: 1 }, { name: 'pan', maxCount: 1 }]), uploadDocuments);
router.post('/biometric', protect, upload.single('selfie'), verifyBiometric);

export default router;
