import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const VoiceVerification = ({ sessionId, onComplete }) => {
    const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'recording', 'processing', 'completed', 'error'
    const [challenge, setChallenge] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null);
    const [result, setResult] = useState(null);
    const [liveTranscript, setLiveTranscript] = useState('');

    const audioCtxRef = useRef(null);
    const processorRef = useRef(null);
    const inputRef = useRef(null);
    const audioDataRef = useRef([]);
    const recordingLengthRef = useRef(0);
    const isRecordingRef = useRef(false);
    const recognitionRef = useRef(null);

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

            // Integrate Browser Web Speech API for real-time visual feedback
            setLiveTranscript('');
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                try {
                    const rec = new SpeechRecognition();
                    rec.continuous = false;
                    rec.interimResults = true;
                    rec.lang = 'en-US';
                    rec.onresult = (e) => {
                        const transcript = Array.from(e.results)
                            .map(r => r[0].transcript)
                            .join('');
                        setLiveTranscript(transcript);
                    };
                    rec.start();
                    recognitionRef.current = rec;
                } catch (e) {
                    console.error('[WebSpeech] Init error:', e);
                }
            }

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
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }

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
        <div className="w-full max-w-xl mx-auto p-10 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl text-center animate-slide-in">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-secondary mb-8">
                Biometric Stage 2: Voice Print
            </h2>

            <div className="flex items-center justify-center h-32 my-8 bg-black/40 rounded-3xl border border-white/5 relative overflow-hidden group">
                {status === 'recording' && (
                    <div className="absolute inset-0 flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="w-1 bg-secondary rounded-full animate-pulse" style={{
                                height: `${Math.random() * 60 + 20}%`,
                                animationDelay: `${i * 0.1}s`
                            }} />
                        ))}
                    </div>
                )}

                <div className="relative z-10">
                    {status === 'recording' ? (
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500 animate-pulse">
                            <Mic size={32} className="text-red-500" />
                        </div>
                    ) : status === 'processing' ? (
                        <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center border-2 border-secondary animate-spin">
                            <Loader2 size={32} className="text-secondary" />
                        </div>
                    ) : status === 'completed' ? (
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                            <CheckCircle size={32} className="text-[#00ffaa]" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-secondary transition-colors duration-500">
                            <MicOff size={32} className="opacity-30 text-white" />
                        </div>
                    )}
                </div>
            </div>

            {challenge && status !== 'completed' && (
                <div className="mb-10 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Secure Passphrase</p>
                    <div className="text-3xl font-black text-white p-8 bg-white/5 rounded-2xl border border-white/5 shadow-inner leading-relaxed">
                        "{challenge.voice_phrase}"
                    </div>
                    {liveTranscript && (
                        <div className="mt-4 p-4 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-sm font-bold animate-pulse">
                            🎤 Spoken: "{liveTranscript}"
                        </div>
                    )}
                    <p className="text-xs text-text-muted italic opacity-60">Please read the phrase clearly into your microphone</p>
                </div>
            )}

            {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold mb-6 flex items-center justify-center gap-3">
                    <AlertCircle size={16} />
                    {errorMessage}
                </div>
            )}

            {status === 'ready' && (
                <button
                    onClick={startRecording}
                    className="btn-primary w-full py-4 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-3"
                >
                    <Mic size={18} />
                    Initialize Voice Print
                </button>
            )}

            {status === 'recording' && (
                <div className="flex flex-col items-center gap-2">
                    <div className="font-black text-2xl text-red-500 tracking-tighter">
                        CAPTURING {countdown}s
                    </div>
                    <p className="text-[10px] uppercase font-bold text-text-muted">Do note speak too fast</p>
                </div>
            )}

            {status === 'processing' && (
                <div className="space-y-2">
                    <p className="text-secondary text-sm font-black uppercase tracking-widest animate-pulse">Analyzing Neural Voice Frequencies...</p>
                    <div className="w-48 h-1 bg-white/10 mx-auto rounded-full overflow-hidden">
                        <div className="h-full bg-secondary animate-progress" />
                    </div>
                </div>
            )}

            {status === 'completed' && (
                <div className="space-y-1 animate-in slide-in-from-bottom-2 duration-500">
                    <p className="text-[#00ffaa] font-black uppercase tracking-widest text-lg">Identity Signature Verified</p>
                    <p className="text-text-muted text-xs">Biometric verification stage complete</p>
                </div>
            )}
        </div>
    );
};

export default VoiceVerification;
