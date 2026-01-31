// In a real MERN app, this would use OpenAI Whisper, Google Speech-to-Text, etc.
import { analyzeAudio } from './landmarkClient.js';

export const processVoice = async (audioBuffer, expectedPhrase) => {
    console.log(`[VoiceService] Analyzing voice for phrase: "${expectedPhrase}"`);

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
        analysis_engine: "Python-ASR-Engine"
    };
};
