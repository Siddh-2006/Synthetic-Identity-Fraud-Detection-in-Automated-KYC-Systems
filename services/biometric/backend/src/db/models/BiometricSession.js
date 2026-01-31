import mongoose from 'mongoose';

const BiometricSessionSchema = new mongoose.Schema({
    session_id: { type: String, required: true, unique: true },
    challenge: {
        challenge_id: { type: String, required: true },
        type: { type: String, default: 'movement' },
        target_coords: {
            x: Number,
            y: Number
        },
        voice_phrase: String,
        expires_at: Date,
        created_at: { type: Date, default: Date.now }
    },
    results: {
        face: {
            movement_score: Number,
            movement_passed: Boolean,
            blink_count: Number,
            pose_delta: Number,
            spoof_risk: Number,
            media_url: String,
            landmarks: Array,
            processed_at: Date
        },
        voice: {
            phrase_match: Boolean,
            phrase_score: Number,
            voice_spoof_risk: Number,
            transcription: String,
            media_url: String,
            processed_at: Date
        },
        combined_biometric_score: Number,
        flags: [String],
        status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' }
    },
    metadata: {
        ip_address: String,
        user_agent: String
    }
}, { timestamps: true });

export default mongoose.model('BiometricSession', BiometricSessionSchema);
