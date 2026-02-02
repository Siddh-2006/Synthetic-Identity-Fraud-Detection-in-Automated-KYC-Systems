import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updatePersonalInfo, uploadDocuments, verifyBiometric, getKycAnalysis } from '../controllers/kycController.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

console.log("[KYC Routes] Initializing endpoints... /api/kyc/analysis is active.");

router.post('/info', protect, updatePersonalInfo);
router.post('/upload', protect, upload.fields([{ name: 'aadhaar', maxCount: 1 }, { name: 'pan', maxCount: 1 }]), uploadDocuments);
router.post('/biometric', protect, upload.single('selfie'), verifyBiometric);
router.get('/analysis', getKycAnalysis);

export default router;
