import express from 'express';
import BiometricSession from '../../db/models/BiometricSession.js';

const router = express.Router();

// GET /biometric/result/:session_id
router.get('/:session_id', async (req, res) => {
    try {
        const { session_id } = req.params;
        const session = await BiometricSession.findOne({ session_id });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const face = session.results.face;
        const voice = session.results.voice;

        // Combined Score logic (Simple weighted average)
        // movement_passed is critical
        let combinedScore = 0;
        const weights = { movement: 0.4, match: 0.3, voice: 0.3 };

        if (face.movement_passed) {
            combinedScore = (face.movement_score * weights.movement) +
                ((face.face_match_score || 0) * weights.match) +
                ((voice.phrase_score || 0) * weights.voice);
        }

        const flags = [];
        if (!face.movement_passed) flags.push('FACE_MOVEMENT_FAILED');
        if (face.blink_count === 0) flags.push('NO_BLINKS_DETECTED');
        if (voice.phrase_score < 0.8) flags.push('VOICE_PHRASE_MISMATCH');
        if (face.face_match_score < 0.7) flags.push('FACE_MATCH_LOW_CONFIDENCE');

        const result = {
            session_id,
            face: {
                movement_score: face.movement_score,
                movement_passed: face.movement_passed,
                blink_count: face.blink_count,
                face_match_score: face.face_match_score,
                media_url: face.media_url
            },
            voice: {
                phrase_match: voice.phrase_match,
                phrase_score: voice.phrase_score,
                transcription: voice.transcription,
                media_url: voice.media_url
            },
            combined_biometric_score: combinedScore,
            flags,
            status: (face.processed_at && voice.processed_at) ? 'COMPLETED' : 'PENDING'
        };

        res.json(result);

    } catch (error) {
        console.error('Aggregation error:', error);
        res.status(500).json({ error: 'Failed to aggregate biometric results' });
    }
});

export default router;
