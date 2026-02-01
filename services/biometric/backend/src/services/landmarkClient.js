import axios from 'axios';
import FormData from 'form-data';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export const analyzeVideo = async (videoBuffer) => {
    try {
        const formData = new FormData();
        formData.append('file', videoBuffer, { filename: 'video.webm' });

        const response = await axios.post(`${PYTHON_SERVICE_URL}/analyze-video`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        return response.data;
    } catch (error) {
        console.error(`[LandmarkClient] Error analyzing video:`, error.message);
        throw error;
    }
};

export const analyzeAudio = async (audioBuffer, expectedPhrase) => {
    try {
        const formData = new FormData();
        formData.append('file', audioBuffer, { filename: 'audio.wav' });
        formData.append('expected_phrase', expectedPhrase);

        const response = await axios.post(`${PYTHON_SERVICE_URL}/analyze-audio`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        return response.data;
    } catch (error) {
        console.error(`[LandmarkClient] Error analyzing audio:`, error.message);
        throw error;
    }
};
