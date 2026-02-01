
import BiometricSession from '../models/BiometricSession.js';
import BiometricAttempt from '../models/BiometricAttempt.js';
import { analyzeVideo, processVoice } from '../services/biometricService.js';
import { validateMovement } from '../services/movementValidator.js';
import { v4 as uuidv4 } from 'uuid';




import { uploadStream, uploadBase64 } from '../config/cloudinary.js';


// @desc    Initiate Biometric Challenge
// @route   POST /api/biometric/challenge
export const initiateChallenge = async (req, res) => {
    try {
        // We can create a session ID or use User ID
        // The biometric service used 'session_id'. We can generate one.
        const session_id = uuidv4();
        
        console.log(`[Challenge] Initiating challenge for session: ${session_id}`);

        // Generate challenge metadata
        const challenge_id = uuidv4();
        const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

        // Random coordinates (0.1 to 0.9)
        const target = {
            x: Math.round((0.1 + Math.random() * 0.8) * 100) / 100,
            y: Math.round((0.1 + Math.random() * 0.8) * 100) / 100
        };

        const voice_phrases = ["Indigo", "Matrix", "Cipher", "Nebula", "Quantum"];
        const phrase = voice_phrases[Math.floor(Math.random() * voice_phrases.length)];

        const challenge_data = {
            challenge_id,
            type: 'movement',
            target_coords: target,
            voice_phrase: phrase,
            expires_at
        };

        // Create Session
        await BiometricSession.create({
            session_id,
            challenge: challenge_data,
            results: { status: 'PENDING' },
            metadata: {
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            }
        });

        res.json({
            session_id,
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
};

// @desc    Submit Face Video
// @route   POST /api/biometric/face/submit
export const submitFace = async (req, res) => {
    try {
        const { session_id, challenge_id } = req.body;
        const videoFile = req.file; // Assuming 'video_file'

        if (!session_id || !challenge_id || !videoFile) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`[FaceSubmit] Processing session ${session_id}...`);

        // 1. Upload original video
        const tempVideo = await uploadStream(videoFile.buffer, `biometric_sessions/${session_id}`, 'video');

        // 2. Video Analysis
        console.log(`[FaceSubmit] Step 2: Requesting video analysis from Python service...`);
        const analysisResult = await analyzeVideo(videoFile.buffer);

        if (analysisResult.error) {
            console.error(`[FaceSubmit] CV Service Error:`, analysisResult.error);
            return res.status(502).json({ error: `CV Service Error: ${analysisResult.error}` });
        }

        if (!analysisResult.face_detected) {
            console.warn(`[FaceSubmit] No face detected in video.`);
            return res.status(422).json({
                status: 'retry',
                reason: 'No face detected in video. Ensure your face is clearly visible.',
                new_challenge: true
            });
        }

        // 3. Movement Validation
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
                 reason: 'Movement check failed. Please follow the blue dot closely.',
                 new_challenge: true
             });
        }

        // 4. Anti-Spoof
        console.log(`[FaceSubmit] Step 4: Spoof Check for ${session_id}`);
        console.log(` >> Liveness: ${analysisResult.liveness_percentage}%`);

        if (analysisResult.is_spoof) {
            console.warn(`[FaceSubmit] Anti-spoofing detection triggered! (Score: ${analysisResult.spoof_score})`);
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

        // 5. Upload Verified Frames
        console.log(`[FaceSubmit] Step 5: Uploading ${analysisResult.verified_frames_b64?.length || 0} verified frames...`);
        const verifiedFrameUrls = [];
        if (analysisResult.verified_frames_b64) {
            for (const b64 of analysisResult.verified_frames_b64) {
                const result = await uploadBase64(b64, `biometric_verified/${session_id}`);
                verifiedFrameUrls.push(result.secure_url);
            }
        }

        // 6. Store Successful Attempt
        await BiometricAttempt.create({
            session_id,
            challenge_id,
            movement_score: movementResult.score,
            spoof_score: analysisResult.spoof_score,
            verified_frame_urls: verifiedFrameUrls,
            temporary_video_url: tempVideo.secure_url,
            result: 'SUCCESS'
        });

        // 7. Update Session
        await BiometricSession.findOneAndUpdate(
            { session_id },
            {
                $set: {
                    'results.face.movement_score': movementResult.score,
                    'results.face.movement_passed': movementResult.passed,
                    'results.face.spoof_risk': 1 - (analysisResult.spoof_score || 0),
                    'results.face.liveness_score': analysisResult.spoof_score,
                    'results.face.media_url': tempVideo.secure_url,
                    'results.face.processed_at': new Date(),
                    'results.status': 'COMPLETED'
                }
            }
        );

        res.json({
            status: 'success',
            movement_score: movementResult.score,
            spoof_score: analysisResult.spoof_score,
            liveness_percentage: analysisResult.liveness_percentage,
            liveness_signals: analysisResult.liveness_signals,
            debug_face_count: analysisResult.debug_face_count,
            verified_frames: verifiedFrameUrls,
            message: 'Biometric verification passed'
        });

    } catch (error) {
        console.error('[FaceSubmit] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// @desc    Submit Audio
// @route   POST /api/biometric/voice/submit
export const submitVoice = async (req, res) => {
    try {
        const { session_id, challenge_id } = req.body;
        const audioFile = req.file;

        if (!session_id || !challenge_id || !audioFile) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const session = await BiometricSession.findOne({ session_id });
        const expectedPhrase = session?.challenge?.voice_phrase || "";

        const uploadResult = await uploadStream(audioFile.buffer, 'voice_audios');
        const audioUrl = uploadResult.secure_url;

        const voiceResult = await processVoice(audioFile.buffer, expectedPhrase);

        await BiometricSession.findOneAndUpdate(
            { session_id },
            {
                $set: {
                    'results.voice.media_url': audioUrl,
                    'results.voice.transcription': voiceResult.transcription,
                    'results.voice.phrase_match': voiceResult.phrase_match,
                    'results.voice.processed_at': new Date()
                }
            }
        );

        res.json({
            message: 'Voice analysis completed',
            phrase_match: voiceResult.phrase_match,
            transcription: voiceResult.transcription
        });

    } catch (error) {
        console.error('[VoiceSubmit] Error:', error);
        res.status(500).json({ error: error.message });
    }
};
