import express from 'express';
import { upload } from '../config/cloudinary.js'; 
import multer from 'multer';
import { initiateChallenge, submitFace, submitVoice } from '../controllers/biometricController.js';
import fs from 'fs';
import path from 'path';

const debugLog = (msg) => {
    const logPath = path.join(process.cwd(), 'biometric_debug_routes.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
};

const router = express.Router();
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// router.use(protect); 

const faceUpload = (req, res, next) => {
  debugLog(`[Routes] Received face submit request. Content-Type: ${req.headers['content-type']}`);
  uploadMemory.single('video_file')(req, res, (err) => {
    if (err) {
      debugLog(`[Multer] Face Upload Error: ${err.message}`);
      console.error('[Multer] Face Upload Error:', err);
      return res.status(400).json({ error: 'Upload failed', details: err.message });
    }
    debugLog(`[Multer] Face Upload Success. File: ${!!req.file}`);
    next();
  });
};

router.post('/challenge/initiate', initiateChallenge);
router.post('/face/submit', faceUpload, submitFace);
router.post('/voice/submit', uploadMemory.single('audio_file'), submitVoice);

export default router;
