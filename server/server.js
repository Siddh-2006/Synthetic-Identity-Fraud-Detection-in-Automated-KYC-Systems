import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import botRoutes from './routes/botRoutes.js';
import biometricRoutes from './routes/biometricRoutes.js';

dotenv.config();

connectDB();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration associated with the Frontend
const corsOptions = {
  origin: 'http://localhost:5173', // Vite default port
  credentials: true, // Allow cookies
};
app.use(cors(corsOptions));

app.use('/api/users', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/bot-detection', botRoutes);
app.use('/api/biometric', biometricRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error Handling Middlewares (Basic)
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
