import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const VoiceVerification = ({ sessionId, onComplete }) => {
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
        if (sessionId) {
            initiateChallenge();
        }
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
            // Using the biometric routes at /api/biometric
            const resp = await fetch('http://localhost:5000/api/biometric/challenge/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId || 'temp-voice-session' })
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
        formData.append('session_id', challenge.session_id); // Ensure correct session id
        formData.append('challenge_id', challenge.challenge_id);
        formData.append('audio_file', blob, 'voice_check.wav');

        try {
            const resp = await fetch('http://localhost:5000/api/biometric/voice/submit', {
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
        <div className="w-full max-w-md mx-auto p-8 bg-slate-900 rounded-2xl border border-white/10 text-center backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4 text-indigo-400">
                Audio Identity Check
            </h2>

            <div className="flex items-center justify-center h-20 my-6 bg-black/20 rounded-2xl">
                {status === 'recording' ? (
                    <div className="animate-pulse text-red-500">
                        <Mic size={32} />
                    </div>
                ) : status === 'processing' ? (
                    <Loader2 size={32} className="animate-spin text-indigo-400" />
                ) : status === 'completed' ? (
                    <CheckCircle size={32} className="text-green-400" />
                ) : (
                    <MicOff size={32} className="opacity-30 text-white" />
                )}
            </div>

            {challenge && status !== 'completed' && (
                <div className="mb-6">
                    <p className="text-slate-400 text-sm mb-2">Please say the phrase clearly:</p>
                    <div className="text-xl font-bold text-slate-100 p-4 bg-white/5 rounded-lg border border-white/5">
                        "{challenge.voice_phrase}"
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="text-red-400 text-sm mb-4 flex items-center justify-center gap-2">
                    <AlertCircle size={16} />
                    {errorMessage}
                </div>
            )}

            {status === 'ready' && (
                <button
                    onClick={startRecording}
                    className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors"
                >
                    Start Voice Check
                </button>
            )}

            {status === 'recording' && (
                <div className="font-bold text-red-400">
                    Recording... {countdown}s
                </div>
            )}

            {status === 'processing' && (
                <p className="text-indigo-400 text-sm">Analyzing your secure voice print...</p>
            )}

            {status === 'completed' && (
                <p className="text-green-400 font-bold">Voice Verified Successfully!</p>
            )}
        </div>
    );
};

export default VoiceVerification;
