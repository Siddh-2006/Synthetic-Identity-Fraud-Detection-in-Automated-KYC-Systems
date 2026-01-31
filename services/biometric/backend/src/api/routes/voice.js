import express from 'express';
import multer from 'multer';
import { uploadStream } from '../../services/cloudinaryClient.js';
import { processVoice } from '../../services/voiceService.js';
import BiometricSession from '../../db/models/BiometricSession.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /biometric/voice/submit
router.post('/submit', upload.single('audio_file'), async (req, res) => {
  try {
    const { session_id, challenge_id } = req.body;
    const audioFile = req.file;

    if (!session_id || !challenge_id || !audioFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Fetch challenge from DB for the expected phrase
    const session = await BiometricSession.findOne({ session_id });
    const expectedPhrase = session?.challenge?.voice_phrase || "";

    // 2. Upload to Cloudinary
    const uploadResult = await uploadStream(audioFile.buffer, 'voice_audios', 'video');
    const audioUrl = uploadResult.secure_url;

    // 3. Process Voice (Phase 6)
    const voiceResult = await processVoice(audioUrl, expectedPhrase);

    // 4. Update session
    await BiometricSession.findOneAndUpdate(
      { session_id },
      {
        $set: {
          'results.voice.media_url': audioUrl,
          'results.voice.transcription': voiceResult.transcription,
          'results.voice.phrase_match': voiceResult.phrase_match,
          'results.voice.phrase_score': voiceResult.phrase_score,
          'results.voice.voice_spoof_risk': voiceResult.voice_spoof_risk,
          'results.voice.processed_at': new Date()
        }
      }
    );

    res.json({
      message: 'Voice analysis completed',
      phrase_match: voiceResult.phrase_match,
      transcription: voiceResult.transcription,
      media_url: audioUrl
    });

  } catch (error) {
    console.error('Voice submission error:', error);
    res.status(500).json({ error: 'Failed to process voice audio' });
  }
});

export default router;
