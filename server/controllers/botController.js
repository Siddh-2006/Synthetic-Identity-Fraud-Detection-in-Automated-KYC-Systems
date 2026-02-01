import axios from 'axios';

// @desc    Analyze behavior for bot detection
// @route   POST /api/bot-detection/analyze
// @access  Private
const analyzeBehavior = async (req, res) => {
    try {
        const { events, features, metadata } = req.body;

        if ((!events || !Array.isArray(events)) && (!features || typeof features !== 'object')) {
            return res.status(400).json({ message: 'Invalid payload: Provide events array or features object' });
        }

        console.log(`[BotController] Received request. Events: ${events?.length || 0}, Features: ${!!features}`);

        // Forward to Python Service (Port 5001)
        const pythonServiceUrl = 'http://127.0.0.1:5001/predict';

        const response = await axios.post(pythonServiceUrl, {
            events: events || [],
            features: features || null,
            metadata: metadata || {}
        });

        console.log('[BotController] Python Response:', response.data.prediction);

        res.json(response.data);
    } catch (error) {
        console.error('Bot Detection Proxy Error:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Bot detection service unavailable' });
    }
};

export { analyzeBehavior };
