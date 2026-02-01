import express from 'express';
import { upload } from '../config/cloudinary.js'; 
import multer from 'multer';
import { initiateChallenge, submitFace, submitVoice } from '../controllers/biometricController.js';

const router = express.Router();
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// router.use(protect); 

router.post('/challenge/initiate', initiateChallenge);
router.post('/face/submit', uploadMemory.single('video_file'), submitFace);
router.post('/voice/submit', uploadMemory.single('audio_file'), submitVoice);

export default router;
