import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const VoiceDetection = ({ sessionId, onComplete }) => {
    const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'recording', 'processing', 'completed', 'error'
    const [challenge, setChallenge] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null);
    const [result, setResult] = useState(null);

    const audioCtxRef = useRef(null);
    const processorRef = useRef(null);
    const inputRef = useRef(null);
    const audioDataRef = useRef([]);
    const recordingLengthRef = useRef(0);
    const isRecordingRef = useRef(false);

    useEffect(() => {
        initiateChallenge();
        return () => {
            stopAudioTracks();
        };
    }, [sessionId]);

    const stopAudioTracks = () => {
        if (inputRef.current && inputRef.current.mediaStream) {
            inputRef.current.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close().catch(console.error);
        }
    };

    const initiateChallenge = async () => {
        setStatus('initializing');
        try {
            const resp = await fetch('http://localhost:5000/biometric/challenge/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await resp.json();
            setChallenge(data);
            setStatus('ready');
        } catch (err) {
            console.error('[Voice] Failed to fetch challenge:', err);
            setStatus('error');
            setErrorMessage('Failed to connect to verification server.');
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
            inputRef.current = audioCtxRef.current.createMediaStreamSource(stream);

            // ScriptProcessor is deprecated but widely supported and used in the original scaffold
            processorRef.current = audioCtxRef.current.createScriptProcessor(4096, 1, 1);

            audioDataRef.current = [];
            recordingLengthRef.current = 0;
            isRecordingRef.current = true;

            processorRef.current.onaudioprocess = (e) => {
                if (!isRecordingRef.current) return;
                const channelData = e.inputBuffer.getChannelData(0);
                audioDataRef.current.push(new Float32Array(channelData));
                recordingLengthRef.current += channelData.length;
            };

            inputRef.current.connect(processorRef.current);
            processorRef.current.connect(audioCtxRef.current.destination);

            setStatus('recording');
            setCountdown(3);
        } catch (err) {
            console.error('[Voice] Mic error:', err);
            setErrorMessage('Microphone access denied or unavailable.');
            setStatus('ready');
        }
    };

    useEffect(() => {
        if (status === 'recording' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (status === 'recording' && countdown === 0) {
            stopRecording();
        }
    }, [status, countdown]);

    const stopRecording = async () => {
        if (isRecordingRef.current) {
            isRecordingRef.current = false;

            stopAudioTracks();

            if (processorRef.current) processorRef.current.disconnect();
            if (inputRef.current) inputRef.current.disconnect();

            setStatus('processing');

            // Encode to WAV
            const wavBlob = encodeWAV(audioDataRef.current, recordingLengthRef.current);
            submitAudio(wavBlob);
        }
    };

    const encodeWAV = (samples, totalLength) => {
        const buffer = new ArrayBuffer(44 + totalLength * 2);
        const view = new DataView(buffer);
        const sampleRate = 16000;

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + totalLength * 2, true);
        writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true); // 16-bit

        // data sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, totalLength * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const block = samples[i];
            for (let j = 0; j < block.length; j++) {
                let s = Math.max(-1, Math.min(1, block[j]));
                s = s < 0 ? s * 0x8000 : s * 0x7FFF;
                view.setInt16(offset, s, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    };

    const submitAudio = async (blob) => {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('challenge_id', challenge.challenge_id);
        formData.append('audio_file', blob, 'voice_check.wav');

        try {
            const resp = await fetch('http://localhost:5000/biometric/voice/submit', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            console.log('[Voice] Result:', data);

            if (data.phrase_match) {
                setResult(data);
                setStatus('completed');
                setTimeout(() => onComplete(data), 2000);
            } else {
                const msg = typeof data.details === 'object'
                    ? (data.details.error || JSON.stringify(data.details))
                    : (data.details || 'Voice verification failed. Please try again.');
                setErrorMessage(msg);
                setStatus('ready');
            }
        } catch (err) {
            console.error('[Voice] Upload error:', err);
            setErrorMessage('Connection error during voice upload.');
            setStatus('ready');
        }
    };

    return (
        <div className="voice-detection-container" style={{
            background: '#1e293b',
            padding: '2rem',
            borderRadius: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: '500px',
            margin: '0 auto',
            textAlign: 'center'
        }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#818cf8' }}>
                Audio Identity Check
            </h2>

            <div className="voice-visualizer" style={{
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1.5rem 0',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '1rem'
            }}>
                {status === 'recording' ? (
                    <div className="pulse" style={{ color: '#ef4444' }}>
                        <Mic size={32} />
                    </div>
                ) : status === 'processing' ? (
                    <Loader2 size={32} className="animate-spin" color="#818cf8" />
                ) : status === 'completed' ? (
                    <CheckCircle size={32} color="#4ade80" />
                ) : (
                    <MicOff size={32} style={{ opacity: 0.3 }} />
                )}
            </div>

            {challenge && status !== 'completed' && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Please say the phrase clearly:</p>
                    <div style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#f1f5f9',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '0.5rem'
                    }}>
                        "{challenge.voice_phrase}"
                    </div>
                </div>
            )}

            {errorMessage && (
                <div style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    <AlertCircle size={16} style={{ display: 'inline', marginRight: '5px' }} />
                    {errorMessage}
                </div>
            )}

            {status === 'ready' && (
                <button onClick={startRecording} style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', background: '#818cf8', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                    Start Voice Check
                </button>
            )}

            {status === 'recording' && (
                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>
                    Recording... {countdown}s
                </div>
            )}

            {status === 'processing' && (
                <p style={{ color: '#818cf8' }}>Analyzing your secure voice print...</p>
            )}

            {status === 'completed' && (
                <p style={{ color: '#4ade80', fontWeight: 'bold' }}>Voice Verified Successfully!</p>
            )}

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pulse { animation: pulse-red 1.5s infinite; }
                @keyframes pulse-red { 
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default VoiceDetection;
