import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: false
  },
  aadhaar: {
    number: String,
    name: String,
    dob: String,
    gender: String,
    details: { type: Map, of: mongoose.Schema.Types.Mixed } // Store all extracted fields
  },
  aadhaarForgeryDetection: {
    verdict: String,
    confidence: String,
    raw_score: Number,
    filename: String
  },
  pan: {
    number: String,
    name: String,
    fatherName: String,
    dob: String,
    details: { type: Map, of: mongoose.Schema.Types.Mixed }
  },
  faceMatch: {
    isMatch: { type: Boolean, default: false },
    distance: { type: Number }, // Euclidean distance (lower is better)
    threshold: { type: Number },
    model: { type: String },
    verified: { type: Boolean }
  },
  AadharPanMatch: {
    nameMatch: { type: Boolean, default: false },
    dobMatch: { type: Boolean, default: false },
    genderMatch: { type: Boolean, default: false }
  },
  profileMatch: {
    nameMatch: { type: Boolean, default: false },
    dobMatch: { type: Boolean, default: false }
  },
  livenessCheck: {
    movementPassed: { type: Boolean, default: false },
    score: { type: Number },
    spoofRisk: { type: Number },
    livenessScore: { type: Number },
    processedAt: { type: Date }
  },
  voiceCheck: {
    phraseMatch: { type: Boolean, default: false },
    transcription: { type: String },
    mediaUrl: { type: String },
    processedAt: { type: Date }
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Kyc = mongoose.model('Kyc', kycSchema);

export default Kyc;
