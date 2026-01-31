import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updatePersonalInfo, uploadDocuments } from '../controllers/kycController.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.post('/info', protect, updatePersonalInfo);
router.post('/upload', protect, upload.fields([{ name: 'aadhaar', maxCount: 1 }, { name: 'pan', maxCount: 1 }]), uploadDocuments);

export default router;
