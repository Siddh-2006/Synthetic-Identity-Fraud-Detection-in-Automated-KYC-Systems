import mongoose from 'mongoose';

const BiometricAttemptSchema = new mongoose.Schema({
    session_id: { type: String, required: true },
    challenge_id: { type: String, required: true },
    movement_score: { type: Number, default: 0 },
    spoof_score: { type: Number, default: 0 },
    verified_frame_urls: [{ type: String }],
    temporary_video_url: { type: String },
    result: { type: String, enum: ['SUCCESS', 'RETRY', 'FAILED'], required: true },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('BiometricAttempt', BiometricAttemptSchema);
