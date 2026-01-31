import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import BiometricSession from '../../db/models/BiometricSession.js';

const router = express.Router();

// POST /biometric/challenge/initiate
router.post('/initiate', async (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({ error: 'session_id is required' });
        }

        console.log(`[Challenge] Initiating challenge for session: ${session_id}`);

        // Generate challenge metadata
        const challenge_id = uuidv4();
        const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

        // Randomized face challenge (example: target a corner)
        const targets = [
            { x: 0.1, y: 0.1 }, // Top-left
            { x: 0.9, y: 0.1 }, // Top-right
            { x: 0.1, y: 0.9 }, // Bottom-left
            { x: 0.9, y: 0.9 }  // Bottom-right
        ];
        const target = targets[Math.floor(Math.random() * targets.length)];

        const voice_phrases = [
            "I verify my identity for this secure session",
            "My name is authorized to access this platform",
            "The quick brown fox jumps over the lazy dog"
        ];
        const phrase = voice_phrases[Math.floor(Math.random() * voice_phrases.length)];

        const challenge_data = {
            challenge_id,
            type: 'movement',
            target_coords: target,
            voice_phrase: phrase,
            expires_at
        };

        // Upsert session with new challenge
        const session = await BiometricSession.findOneAndUpdate(
            { session_id },
            {
                $set: {
                    challenge: challenge_data,
                    metadata: {
                        ip_address: req.ip,
                        user_agent: req.headers['user-agent']
                    }
                }
            },
            { upsert: true, new: true }
        );

        res.json({
            challenge_id,
            face_challenge: {
                type: 'movement',
                target_coords: target,
                duration: 5
            },
            voice_phrase: phrase,
            expires_at
        });

    } catch (error) {
        console.error('Challenge initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate challenge' });
    }
});

export default router;
