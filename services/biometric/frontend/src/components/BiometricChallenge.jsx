import React, { useState, useEffect, useRef } from 'react';

const BiometricChallenge = ({ sessionId, onComplete }) => {
    const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'active', 'recording_complete', 'completed', 'error'
    const [challenge, setChallenge] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [livenessResult, setLivenessResult] = useState(null);
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => {
        initiateChallenge();
        setupCamera();
    }, [sessionId]);

    const setupCamera = async () => {
        console.log('[Camera] Requesting permissions...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            console.log('[Camera] Access granted. Feed active.');
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('[Camera] Access denied:', err);
            setStatus('error');
        }
    };

    const initiateChallenge = async () => {
        setErrorMessage(null);
        console.log(`[Challenge] Requesting challenge for Session: ${sessionId}...`);
        try {
            const resp = await fetch('http://localhost:5000/biometric/challenge/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await resp.json();
            console.log('[Challenge] Received data:', data);
            setChallenge(data);
            setStatus('ready');
        } catch (err) {
            console.error('[Challenge] Failed to fetch:', err);
            setStatus('error');
        }
    };

    const startChallenge = () => {
        setErrorMessage(null);
        console.log('[Challenge] Verification started by user.');
        setStatus('active');
        setCountdown(challenge.face_challenge.duration);

        // Start Recording
        console.log('[MediaRecorder] Initializing recording stream...');
        const stream = videoRef.current.srcObject;
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
            console.log('[MediaRecorder] Stop event triggered.');
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            console.log(`[MediaRecorder] Final blob created. Size: ${(blob.size / 1024).toFixed(2)} KB`);
            submitVideo(blob);
        };

        console.log('[MediaRecorder] Recording started.');
        mediaRecorderRef.current.start();
    };

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            console.log('[Challenge] Countdown finished.');
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.log('[MediaRecorder] Stopping recorder...');
                mediaRecorderRef.current.stop();
            }
            setStatus('recording_complete');
        }
    }, [countdown]);

    const submitVideo = async (blob) => {
        console.log('[BackendAPI] Submitting face video for analysis...');
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('challenge_id', challenge.challenge_id);
            formData.append('video_file', blob, 'recording.webm');

            const resp = await fetch('http://localhost:5000/biometric/face/submit', {
                method: 'POST',
                body: formData
            });
            const result = await resp.json();
            console.log('[BackendAPI] Response received:', result);

            if (resp.ok && (result.status?.toLowerCase() === 'success' || result.result?.toLowerCase() === 'success')) {
                console.log('[BackendAPI] Face verification success');
                setLivenessResult(result);
                setStatus('completed');
                setTimeout(() => onComplete(result), 1500);
            } else if (result.status === 'retry') {
                console.warn('[BackendAPI] RETRY REQUIRED:', result.reason);
                setErrorMessage(result.reason);
                initiateChallenge();
            } else {
                setErrorMessage(result.error || 'Verification failed. Please try again.');
                setStatus('ready');
            }
        } catch (err) {
            console.error('[BackendAPI] Network error during upload:', err);
            setErrorMessage('Connection error. Please try again.');
            setStatus('ready');
        }
    };

    return (
        <div className="card" style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="camera-container" style={{ position: 'relative', overflow: 'hidden' }}>
                <video ref={videoRef} className="camera-feed" autoPlay muted playsInline />

                {status === 'active' && challenge?.face_challenge?.target_coords && (
                    <div className="target-dot" style={{
                        top: `${challenge.face_challenge.target_coords.y * 100}%`,
                        left: `${challenge.face_challenge.target_coords.x * 100}%`,
                        position: 'absolute',
                        zIndex: 10
                    }} />
                )}

                {status === 'active' && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px', color: 'white' }}>
                        {countdown}s
                    </div>
                )}

                {status === 'recording_complete' && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px 20px', borderRadius: '20px', zIndex: 20 }}>
                        Analyzing movement...
                    </div>
                )}
            </div>

            <div className="instructions" style={{ padding: '1rem' }}>
                {status === 'initializing' && <p>Initializing biometric layer...</p>}

                {status === 'ready' && (
                    <>
                        <p style={{ color: errorMessage ? '#f87171' : 'inherit' }}>
                            {errorMessage ? errorMessage : 'Stage 1: Position your nose on the blue dot and follow it.'}
                        </p>
                        <button onClick={startChallenge}>
                            {errorMessage ? 'Try Again' : 'Start Face Scan'}
                        </button>
                    </>
                )}

                {status === 'active' && <p>Keep your eyes on the blue dot...</p>}

                {status === 'completed' && (
                    <div className="success-message" style={{ color: '#4ade80', fontWeight: 'bold' }}>
                        Face Verified! ✅
                    </div>
                )}

                {status === 'error' && (
                    <div className="error-message" style={{ color: '#f87171' }}>
                        <p>Camera Error: Please check permissions.</p>
                        <button onClick={() => window.location.reload()}>Reload</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BiometricChallenge;
