import React, { useState, useEffect, useRef } from 'react';

const FaceLiveness = ({ sessionId, onComplete }) => {
  const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'active', 'recording_complete', 'completed', 'error'
  const [challenge, setChallenge] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Initialize challenge on mount
  useEffect(() => {
    if (sessionId) {
      initiateChallenge();
      setupCamera();
    }
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
      setErrorMessage('Camera access denied. Please enable camera permissions.');
    }
  };

  const initiateChallenge = async () => {
    setErrorMessage(null);
    console.log(`[Challenge] Requesting challenge...`);
    try {
      const resp = await fetch('http://localhost:5000/api/biometric/challenge/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId || 'temp-session' })
      });
      const data = await resp.json();
      console.log('[Challenge] Received data:', data);
      setChallenge(data);
      setStatus('ready');
    } catch (err) {
      console.error('[Challenge] Failed to fetch:', err);
      setStatus('error');
      setErrorMessage('Failed to connect to server.');
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
    // Use a supported mime type
    const options = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? { mimeType: 'video/webm; codecs=vp9' }
      : { mimeType: 'video/webm' };

    mediaRecorderRef.current = new MediaRecorder(stream, options);
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
    } else if (countdown === 0 && status === 'active') {
      console.log('[Challenge] Countdown finished.');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('[MediaRecorder] Stopping recorder...');
        mediaRecorderRef.current.stop();
      }
      setStatus('recording_complete');
    }
  }, [countdown, status]);

  const submitVideo = async (blob) => {
    console.log('[BackendAPI] Submitting face video for analysis...');
    try {
      const formData = new FormData();
      formData.append('session_id', challenge.session_id); // Use session form challenge response if available, or prop
      formData.append('challenge_id', challenge.challenge_id);
      formData.append('video_file', blob, 'recording.webm');

      const resp = await fetch('http://localhost:5000/api/biometric/face/submit', {
        method: 'POST',
        body: formData
      });
      const result = await resp.json();
      console.log('[BackendAPI] Response received:', result);

      if (resp.ok && (result.status?.toLowerCase() === 'success' || result.result?.toLowerCase() === 'success')) {
        console.log('[BackendAPI] Face verification success');
        setStatus('completed');
        setTimeout(() => onComplete(result), 1500);
      } else {
        console.warn('[BackendAPI] Verification Failed:', result.reason);
        setErrorMessage(result.reason || result.error || 'Verification failed.');
        // Don't auto-retry immediately, let user see error
        setStatus('ready');
        // Optionally auto-fetch new challenge
        initiateChallenge();
      }
    } catch (err) {
      console.error('[BackendAPI] Network error during upload:', err);
      setErrorMessage('Connection error. Please try again.');
      setStatus('ready');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-black/40 rounded-xl border border-white/10 backdrop-blur-sm">
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <video ref={videoRef} className="w-full h-full object-contain transform scale-x-[-1]" autoPlay muted playsInline />

        {status === 'active' && challenge?.face_challenge?.target_coords && (
          <div className="absolute w-6 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] transition-all duration-300 pointer-events-none" style={{
            top: `${challenge.face_challenge.target_coords.y * 100}%`,
            left: `${challenge.face_challenge.target_coords.x * 100}%`, // Ensure this matches mirrored or unmirrored logic
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }} />
        )}

        {status === 'active' && (
          <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-white font-mono text-sm border border-white/20">
            {countdown}s
          </div>
        )}

        {status === 'recording_complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20">
            <div className="text-white flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Analyzing Liveness...</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        {status === 'initializing' && <p className="text-white/60 text-sm">Initializing camera...</p>}

        {status === 'ready' && (
          <div className="flex flex-col gap-3">
            <p className={`text-sm ${errorMessage ? 'text-red-400' : 'text-white/80'}`}>
              {errorMessage ? errorMessage : 'Position your face. Follow the blue dot with your nose.'}
            </p>
            <button
              onClick={startChallenge}
              className="btn-primary w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
            >
              {errorMessage ? 'Retry Verification' : 'Start Face Scan'}
            </button>
          </div>
        )}

        {status === 'active' && (
          <p className="text-blue-400 text-sm animate-pulse font-medium">Keep your eyes on the blue dot...</p>
        )}

        {status === 'completed' && (
          <div className="flex flex-col items-center gap-2 text-green-400">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500">
              <span className="text-xl">✓</span>
            </div>
            <p className="font-bold">Verification Successful!</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-red-400 text-sm">
            <p>{errorMessage || 'Camera Error. Please check permissions.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceLiveness;
