
import BiometricSession from '../models/BiometricSession.js';
import BiometricAttempt from '../models/BiometricAttempt.js';
import { analyzeVideo, processVoice } from '../services/biometricService.js';
import { validateMovement } from '../services/movementValidator.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import Kyc from '../models/Kyc.js';
import mongoose from 'mongoose';

const findKycBySessionOrUser = async (session_id, user_id) => {
    const queryConditions = [];
    if (session_id && mongoose.Types.ObjectId.isValid(session_id)) {
        queryConditions.push({ user: session_id });
    }
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        queryConditions.push({ user: user_id });
    }
    if (queryConditions.length === 0) return null;
    return await Kyc.findOne({ $or: queryConditions });
};

const debugLog = (msg) => {
    const logPath = path.join(process.cwd(), 'biometric_debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
};




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
    const logPrefix = `[FaceSubmit][${new Date().toISOString()}]`;
    try {
        const { session_id, challenge_id } = req.body;
        const videoFile = req.file;

        debugLog(`${logPrefix} Incoming: session_id=${session_id}, challenge_id=${challenge_id}, file=${!!videoFile}`);
        console.log(`[FaceSubmit] Incoming session: ${session_id}`);
        
        if (!session_id || !challenge_id || !videoFile) {
            return res.status(400).json({ error: 'Missing required fields', details: { session_id: !!session_id, challenge_id: !!challenge_id, videoFile: !!videoFile } });
        }

        // 1. Skip Cloudinary upload for video to save time (User Request)
        console.log(`[FaceSubmit] Skipping video upload to Cloudinary for speed.`);
        const videoUrl = null; 

        // 2. Video Analysis
        debugLog(`${logPrefix} Step 2: Requesting video analysis from Python service...`);
        const analysisStart = Date.now();
        let analysisResult;
        try {
            analysisResult = await analyzeVideo(videoFile.buffer);
            const analysisDuration = Date.now() - analysisStart;
            console.log(`⏱️ [FaceAnalysis] Microservice response took ${analysisDuration}ms for session: ${session_id}`);
            debugLog(`${logPrefix} Step 2 Success: face_detected=${analysisResult.face_detected} (${analysisDuration}ms)`);
            console.log(`[FaceSubmit] Analysis complete. Face Detected: ${analysisResult.face_detected}`);
        } catch (err) {
            debugLog(`${logPrefix} Step 2 FAILED: ${err.message}`);
            return res.status(502).json({ error: `CV Service Error: ${err.message}` });
        }

        if (analysisResult.error) {
            debugLog(`${logPrefix} CV Service reported error: ${analysisResult.error}`);
            return res.status(502).json({ error: `CV Service Error: ${analysisResult.error}` });
        }

        if (!analysisResult.face_detected) {
            debugLog(`${logPrefix} No face detected in video.`);
            return res.status(422).json({
                status: 'retry',
                reason: 'No face detected in video. Ensure your face is clearly visible.',
                new_challenge: true
            });
        }

        // 3. Movement Validation
        debugLog(`${logPrefix} Step 3: Movement Check...`);
        const session = await BiometricSession.findOne({ session_id });
        if (!session) {
            debugLog(`${logPrefix} Session NOT FOUND for ID: ${session_id}`);
            return res.status(404).json({ error: 'Session not found. Please restart verification.' });
        }

        const target = session.challenge?.target_coords || { x: 0.5, y: 0.5 };
        const movementResult = validateMovement(analysisResult.landmarks_sequence, target);

        debugLog(`${logPrefix} Step 3 Results: distance=${movementResult.distance?.toFixed(4)}, passed=${movementResult.passed}`);
        console.log(`[FaceSubmit] Movement Match: ${movementResult.passed} (Distance: ${movementResult.distance?.toFixed(4)})`);

        if (!movementResult.passed) {
             debugLog(`${logPrefix} Movement validation failed.`);
             await BiometricAttempt.create({
                 session_id, challenge_id,
                 movement_score: movementResult.score,
                 result: 'RETRY', reason: 'movement_not_matched',
                 temporary_video_url: videoUrl
             });
             return res.status(400).json({
                 status: 'retry',
                 reason: 'Movement check failed. Please follow the blue dot closely.',
                 new_challenge: true
             });
        }

        // 4. Anti-Spoof
        debugLog(`${logPrefix} Step 4: Spoof Check...`);
        console.log(`[FaceSubmit] Anti-Spoof Score: ${analysisResult.spoof_score?.toFixed(4)} (Threshold: < 0.5)`);
        
        if (analysisResult.is_spoof) {
            debugLog(`${logPrefix} Spoof detected! Score: ${analysisResult.spoof_score}`);
            console.log(`[FaceSubmit] SPOOF DETECTED! Liveness: ${analysisResult.liveness_percentage || 0}%`);
            await BiometricAttempt.create({
                session_id, challenge_id,
                movement_score: movementResult.score,
                spoof_score: analysisResult.spoof_score,
                result: 'RETRY', reason: 'spoof_detected',
                temporary_video_url: videoUrl
            });
            return res.status(401).json({
                status: 'retry',
                reason: `Liveness check failed (${analysisResult.liveness_percentage || 0}% human). Please ensure you are not using a screen or photo.`,
                liveness_percentage: analysisResult.liveness_percentage,
                new_challenge: true
            });
        }

        // 5. Upload Verified Frames
        debugLog(`${logPrefix} Step 5: Uploading verified frames...`);
        const verifiedFrameUrls = [];
        if (analysisResult.verified_frames_b64) {
            for (const b64 of analysisResult.verified_frames_b64) {
                const result = await uploadBase64(b64, `biometric_verified/${session_id}`);
                verifiedFrameUrls.push(result.secure_url);
            }
        }

        // 6. Store Successful Attempt
        debugLog(`${logPrefix} Step 6: Storing successful attempt...`);
        await BiometricAttempt.create({
            session_id,
            challenge_id,
            movement_score: movementResult.score,
            spoof_score: analysisResult.spoof_score,
            verified_frame_urls: verifiedFrameUrls,
            temporary_video_url: videoUrl,
            result: 'SUCCESS'
        });

        // 7. Update Session
        debugLog(`${logPrefix} Step 7: Updating session...`);
        await BiometricSession.findOneAndUpdate(
            { session_id },
            {
                $set: {
                    'results.face.movement_score': movementResult.score,
                    'results.face.movement_passed': movementResult.passed,
                    'results.face.spoof_risk': 1 - (analysisResult.spoof_score || 0),
                    'results.face.liveness_score': analysisResult.spoof_score,
                    'results.face.media_url': videoUrl,
                    'results.face.processed_at': new Date(),
                    'results.status': 'COMPLETED'
                }
            }
        );

        // 8. ALSO Store in Kyc Model (Persistent Record)
        const userKyc = await findKycBySessionOrUser(session_id, req.user?._id);

        if (userKyc) {
            userKyc.livenessCheck = {
                movementPassed: movementResult.passed,
                score: movementResult.score,
                spoofRisk: 1 - (analysisResult.spoof_score || 0),
                livenessScore: analysisResult.spoof_score,
                processedAt: new Date()
            };
            await userKyc.save();
            console.log(`[FaceSubmit] Persisted liveness results to Kyc record for user.`);
        }

        res.json({
            status: 'success',
            movement_score: movementResult.score,
            spoof_score: analysisResult.spoof_score,
            liveness_percentage: analysisResult.liveness_percentage,
            liveness_signals: analysisResult.liveness_signals,
            verified_frames: verifiedFrameUrls,
            message: 'Biometric verification passed'
        });
        console.log(`[FaceSubmit] Verification SUCCESS for session ${session_id}`);

    } catch (error) {
        debugLog(`${logPrefix} GLOBAL ERROR: ${error.message} \n ${error.stack}`);
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

        const voiceStart = Date.now();
        const voiceResult = await processVoice(audioFile.buffer, expectedPhrase);
        const voiceDuration = Date.now() - voiceStart;
        console.log(`⏱️ [VoiceAnalysis] Microservice response took ${voiceDuration}ms for session: ${session_id}`);

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

        // 8. ALSO Store in Kyc Model
        const userKycVoice = await findKycBySessionOrUser(session_id, req.user?._id);

        if (userKycVoice) {
            userKycVoice.voiceCheck = {
                phraseMatch: voiceResult.phrase_match,
                transcription: voiceResult.transcription,
                mediaUrl: audioUrl,
                processedAt: new Date()
            };
            await userKycVoice.save();
            console.log(`[VoiceSubmit] Persisted voice results to Kyc record.`);
        }

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
