import React, { useState, useEffect, useRef } from 'react';

const BiometricChallenge = ({ sessionId, onComplete }) => {
    const [challenge, setChallenge] = useState(null);
    const [status, setStatus] = useState('initializing');
    const [countdown, setCountdown] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
            formData.append('video_file', blob, 'challenge_video.webm');

            const resp = await fetch('http://localhost:5000/biometric/face/submit', {
                method: 'POST',
                body: formData
            });

            const result = await resp.json();
            console.log('[BackendAPI] Response received:', result);

            if (resp.ok && result.status === 'success') {
                console.log('[BackendAPI] SUCCESS:', result);
                onComplete(result);
                setStatus('completed');
            } else if (result.status === 'retry') {
                console.warn('[BackendAPI] RETRY REQUIRED:', result.reason);
                let msg = result.reason;
                if (result.liveness_percentage !== undefined) {
                    msg = `Liveness Check: ${result.liveness_percentage}% Confidence. ${result.reason}`;
                }
                setErrorMessage(msg);
                if (result.new_challenge) {
                    initiateChallenge();
                } else {
                    setStatus('ready');
                }
            } else {
                console.warn('[BackendAPI] FAILED:', result);
                setErrorMessage(result.error || 'Verification failed. Please try again.');
                setStatus('ready');
            }
        } catch (err) {
            console.error('[BackendAPI] Network error during upload:', err);
            setErrorMessage('Connection error. Please check your internet and try again.');
            setStatus('ready');
        }
    };

    if (status === 'initializing') return <div className="loading">Loading KYC Challenge...</div>;
    if (status === 'error') return <div className="error-screen">Error loading challenge. Please refresh.</div>;

    return (
        <div className="card biometric-card">
            <h3>Biometric Verification</h3>

            <div className="camera-container">
                <video ref={videoRef} autoPlay muted className="camera-feed" />

                {status === 'active' && challenge?.face_challenge?.target_coords && (
                    <div className="challenge-overlay">
                        <div
                            className="target-dot"
                            style={{
                                top: `${challenge.face_challenge.target_coords.y * 100}%`,
                                left: `${challenge.face_challenge.target_coords.x * 100}%`
                            }}
                        />
                    </div>
                )}

                {countdown !== null && status === 'active' && (
                    <div className="instruction-toast countdown-timer">
                        {countdown}s
                    </div>
                )}

                {status === 'recording_complete' && (
                    <div className="instruction-toast processing">
                        Analyzing movement...
                    </div>
                )}
            </div>

            <div className="instructions">
                {errorMessage && (
                    <div className="error-message" style={{ color: '#ff4d4d', marginBottom: '1rem', fontWeight: 'bold' }}>
                        {errorMessage}
                    </div>
                )}

                {status === 'ready' && (
                    <>
                        <p>{errorMessage ? 'Let\'s try that again.' : 'Move your nose to the blue dot and turn your head toward it.'}</p>

                        <div className="verification-tips" style={{
                            fontSize: '0.9rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '1rem',
                            borderRadius: '0.8rem',
                            textAlign: 'left',
                            marginTop: '1rem',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#818cf8' }}>💡 Tips for Success:</strong>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                                <li>Ensure your face is **well-lit** (avoid backlighting).</li>
                                <li>Stay roughly **2 feet** away from the camera.</li>
                                <li>Remove **glasses or masks** for the scan.</li>
                                <li>Follow the dot **smoothly** with your head.</li>
                            </ul>
                        </div>

                        <button onClick={startChallenge}>
                            {errorMessage ? 'Try Again' : 'Start Verification'}
                        </button>
                    </>
                )}

                {status === 'active' && <p>Keep following the dot...</p>}

                {status === 'completed' && (
                    <div className="success-message" style={{ color: '#22c55e' }}>
                        <h4>Verification Passed! ✅</h4>
                        <p>You may now proceed.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BiometricChallenge;
