import express from 'express';
import multer from 'multer';
import { uploadStream } from '../../services/cloudinaryClient.js';
import { analyzeVideo } from '../../services/landmarkClient.js';
import { calculateEAR, validateMovement, countBlinks } from '../../services/movementValidator.js';
import BiometricSession from '../../db/models/BiometricSession.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /biometric/face/submit
router.post('/submit', upload.single('video_file'), async (req, res) => {
  try {
    const { session_id, challenge_id } = req.body;
    const videoFile = req.file;

    if (!session_id || !challenge_id || !videoFile) {
      console.warn(`[FaceSubmit] Missing required fields in request`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[FaceSubmit] Received video for session: ${session_id}, file size: ${videoFile.size} bytes`);

    // 1. Analyze Video via Python Microservice FIRST
    console.log(`[FaceSubmit] Requesting video analysis from Python CV service...`);
    const analysisResult = await analyzeVideo(videoFile.buffer);

    if (analysisResult.error) {
      console.warn(`[FaceSubmit] Python Service Error: ${analysisResult.error}`);
      return res.status(502).json({ error: `CV Service Error: ${analysisResult.error}` });
    }

    if (!analysisResult.face_detected) {
      console.warn(`[FaceSubmit] No face detected in video`);
      return res.status(422).json({ error: 'No face detected in video. Please ensure your face is clearly visible and try again.' });
    }

    const landmarksSequence = analysisResult.landmarks_sequence;
    const ears = landmarksSequence.map(calculateEAR);
    console.log(`[FaceSubmit] Received landmarks for ${landmarksSequence.length} frames`);

    // 2. Validate Movement and Blinks
    const session = await BiometricSession.findOne({ session_id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const target = session.challenge?.target_coords || { x: 0.5, y: 0.5 };
    const movementResult = validateMovement(landmarksSequence, target);
    const blinkCount = countBlinks(ears);

    console.log(`[FaceSubmit] Result: score=${movementResult.score}, passed=${movementResult.passed}, distance=${(movementResult.distance || 0).toFixed(4)}`);

    if (!movementResult.passed) {
      console.warn(`[FaceSubmit] Movement validation failed for session ${session_id}`);
      return res.status(400).json({
        error: 'Face was not centered on the target dot. Please try again and move your head closer to the dot.',
        movement_score: movementResult.score,
        distance: movementResult.distance,
        retry_suggested: true
      });
    }

    // 3. ONLY if passed, Upload to Cloudinary
    console.log(`[FaceSubmit] Verification PASSED. Uploading to Cloudinary for permanent record...`);
    const uploadResult = await uploadStream(videoFile.buffer, 'face_videos', 'video');
    const videoUrl = uploadResult.secure_url;

    // 4. Update session results
    await BiometricSession.findOneAndUpdate(
      { session_id },
      {
        $set: {
          'results.face.media_url': videoUrl,
          'results.face.movement_score': movementResult.score,
          'results.face.movement_passed': true,
          'results.face.blink_count': blinkCount,
          'results.face.processed_at': new Date()
        }
      }
    );

    res.json({
      message: 'Face verification successful!',
      movement_score: movementResult.score,
      movement_passed: true,
      blink_count: blinkCount,
      media_url: videoUrl
    });

  } catch (error) {
    console.error(`[FaceSubmit] CRITICAL ERROR:`, error);
    res.status(500).json({
      error: 'Failed to process face video',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
