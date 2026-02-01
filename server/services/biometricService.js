import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

// Default to port 8080 as seen in the python-microservice app.py
const PYTHON_SERVICE_URL = process.env.BIOMETRIC_PYTHON_URL || 'http://localhost:8080';

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
        console.error(`[BiometricService] Error analyzing video:`, error.message);
        // Return structured error if possible
        if (error.response && error.response.data) {
             return { error: error.response.data.error || "Microservice error" };
        }
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
        console.error(`[BiometricService] Error analyzing audio:`, error.message);
        if (error.response && error.response.data) {
             return { error: error.response.data.error || "Microservice error" };
        }
        throw error;
    }
};

export const processVoice = async (audioBuffer, expectedPhrase) => {
    console.log(`[BiometricService] Analyzing voice for phrase: "${expectedPhrase}"`);

    // 1. Analyze via Python Microservice (ASR + Anti-Spoof)
    const analysis = await analyzeAudio(audioBuffer, expectedPhrase);

    if (analysis.error) {
        throw new Error(`Voice Analysis Failed: ${analysis.error}`);
    }

    return {
        transcription: analysis.transcript,
        phrase_match: analysis.verified,
        phrase_score: analysis.matching_score,
        voice_spoof_risk: 1 - analysis.liveness_score,
        liveness_score: analysis.liveness_score,
        ai_detected: analysis.ai_detected,
        analysis_engine: "Python-ASR-Engine",
        media_url: analysis.media_url // If returned, but python service currently doesn't return this
    };
};
