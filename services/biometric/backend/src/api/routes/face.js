import express from 'express';
import multer from 'multer';
import { uploadStream, uploadBase64 } from '../../services/cloudinaryClient.js';
import { analyzeVideo } from '../../services/landmarkClient.js';
import { calculateEAR, validateMovement, countBlinks } from '../../services/movementValidator.js';
import BiometricSession from '../../db/models/BiometricSession.js';
import BiometricAttempt from '../../db/models/BiometricAttempt.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /biometric/face/submit
router.post('/submit', upload.single('video_file'), async (req, res) => {
  try {
    const { session_id, challenge_id } = req.body;
    const videoFile = req.file;

    if (!session_id || !challenge_id || !videoFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Step 1 — Upload original video to Cloudinary (Temporary/Audit)
    console.log(`[FaceSubmit] Step 1: Uploading temporary video for session ${session_id}...`);
    const tempVideo = await uploadStream(videoFile.buffer, `biometric_sessions/${session_id}`, 'video');

    // Step 2-4 — Video Analysis via Python Microservice
    console.log(`[FaceSubmit] Step 2-4: Requesting video analysis (landmarks + anti-spoof)...`);
    const analysisResult = await analyzeVideo(videoFile.buffer);

    if (analysisResult.error) {
      return res.status(502).json({ error: `CV Service Error: ${analysisResult.error}` });
    }

    if (!analysisResult.face_detected) {
      return res.status(422).json({
        status: 'retry',
        reason: 'No face detected in video. Ensure your face is clearly visible.',
        new_challenge: true
      });
    }

    // Landmark Motion Validation
    const session = await BiometricSession.findOne({ session_id });
    const target = session?.challenge?.target_coords || { x: 0.5, y: 0.5 };
    const movementResult = validateMovement(analysisResult.landmarks_sequence, target);

    console.log(`[FaceSubmit] Step 3: Movement Check for ${session_id}`);
    console.log(` >> Target: x=${target.x}, y=${target.y}`);
    console.log(` >> Result: distance=${movementResult.distance?.toFixed(4)}, passed=${movementResult.passed}`);

    if (!movementResult.passed) {
      console.warn(`[FaceSubmit] Movement validation failed (Distance > 0.30)`);
      await BiometricAttempt.create({
        session_id, challenge_id,
        movement_score: movementResult.score,
        result: 'RETRY', reason: 'movement_not_matched',
        temporary_video_url: tempVideo.secure_url
      });
      return res.status(400).json({
        status: 'retry',
        reason: 'Movement did not match the challenge.',
        new_challenge: true
      });
    }

    // Step 4 — Anti-Spoof Model Check
    console.log(`[FaceSubmit] Step 4: Spoof Check for ${session_id}`);
    console.log(` >> Liveness: ${analysisResult.liveness_percentage}%`);
    if (analysisResult.liveness_signals) {
      const s = analysisResult.liveness_signals;
      console.log(` >> Signals: Frequency=${s.frequency}, Texture=${s.texture}, Chroma=${s.chroma}`);
    }

    if (analysisResult.is_spoof) {
      console.warn(`[FaceSubmit] Anti-spoofing detection triggered! Threshold: < 0.15`);
      await BiometricAttempt.create({
        session_id, challenge_id,
        movement_score: movementResult.score,
        spoof_score: analysisResult.spoof_score,
        result: 'RETRY', reason: 'spoof_detected',
        temporary_video_url: tempVideo.secure_url
      });
      return res.status(401).json({
        status: 'retry',
        reason: `Liveness check failed (${analysisResult.liveness_percentage || 0}% human). Please ensure you are not using a screen or photo.`,
        liveness_percentage: analysisResult.liveness_percentage,
        new_challenge: true
      });
    }

    // Step 5-6 — Upload Verified Frames
    console.log(`[FaceSubmit] Step 5-6: Uploading ${analysisResult.verified_frames_b64?.length} verified frames...`);
    const verifiedFrameUrls = [];
    if (analysisResult.verified_frames_b64) {
      for (const [index, b64] of analysisResult.verified_frames_b64.entries()) {
        const uploadResult = await uploadBase64(b64, `biometric_verified/${session_id}`);
        verifiedFrameUrls.push(uploadResult.secure_url);
      }
    }

    // Step 7 — Store Record in MongoDB (Attempt Log)
    await BiometricAttempt.create({
      session_id,
      challenge_id,
      movement_score: movementResult.score,
      spoof_score: analysisResult.spoof_score,
      verified_frame_urls: verifiedFrameUrls,
      temporary_video_url: tempVideo.secure_url,
      result: 'SUCCESS'
    });

    // Step 8 — Update Main Session Results
    await BiometricSession.findOneAndUpdate(
      { session_id },
      {
        $set: {
          'results.face.movement_score': movementResult.score,
          'results.face.movement_passed': movementResult.passed,
          'results.face.spoof_risk': 1 - (analysisResult.spoof_score || 0),
          'results.face.liveness_score': analysisResult.spoof_score,
          'results.face.media_url': tempVideo.secure_url,
          'results.face.processed_at': new Date()
        }
      }
    );

    // Step 9 — Response
    res.json({
      status: 'success',
      movement_score: movementResult.score,
      spoof_score: analysisResult.spoof_score,
      liveness_percentage: analysisResult.liveness_percentage,
      verified_frames: verifiedFrameUrls,
      message: 'Biometric verification passed'
    });

  } catch (error) {
    console.error(`[FaceSubmit] CRITICAL ERROR:`, error);
    res.status(500).json({ error: 'Failed to process face video', details: error.message });
  }
});

export default router;
