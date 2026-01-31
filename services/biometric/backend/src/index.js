import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import challengeRoutes from './api/routes/challenge.js';
import faceRoutes from './api/routes/face.js';
import voiceRoutes from './api/routes/voice.js';
import resultRoutes from './api/routes/result.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/biometric/challenge', challengeRoutes);
app.use('/biometric/face', faceRoutes);
app.use('/biometric/voice', voiceRoutes);
app.use('/biometric/result', resultRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'BiometricService' });
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kyc_biometrics')
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Biometric Service running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });
