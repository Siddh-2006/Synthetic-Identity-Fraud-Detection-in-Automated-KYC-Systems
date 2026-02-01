import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { analyzeBehavior } from '../controllers/botController.js';

const router = express.Router();

// router.post('/analyze', protect, analyzeBehavior);
router.post('/analyze', analyzeBehavior); // Disabled auth for debugging

export default router;
