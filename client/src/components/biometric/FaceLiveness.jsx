import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ArrowRight, CheckCircle } from 'lucide-react';

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
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const resp = await fetch(`${API_BASE}/api/biometric/challenge/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId || 'temp-session' })
      });
      const data = await resp.json();
      console.log('[Challenge] Received data:', data);
      setChallenge(data);
      console.log('[Challenge] Challenge State Updated:', data);
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
      console.log('[BackendAPI] Constructing FormData with:', {
        sessionId_prop: sessionId,
        challenge_session: challenge?.session_id,
        challenge_id: challenge?.challenge_id
      });
      const formData = new FormData();
      formData.append('session_id', challenge?.session_id || sessionId || 'missing');
      formData.append('challenge_id', challenge?.challenge_id || 'missing');
      formData.append('video_file', blob, 'recording.webm');

      console.log('[BackendAPI] Form Data Check:', {
        session_id: challenge.session_id,
        challenge_id: challenge.challenge_id,
        blobSize: blob.size
      });

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const resp = await fetch(`${API_BASE}/api/biometric/face/submit`, {
        method: 'POST',
        body: formData
      });
      const result = await resp.json();
      console.log('[BackendAPI] Response received:', result);

      if (resp.ok && (result.status?.toLowerCase() === 'success' || result.result?.toLowerCase() === 'success')) {
        console.log('[BackendAPI] Face verification success');
        setStatus('completed');
        setTimeout(() => onComplete(result), 1);
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
    <div className="w-full max-w-xl mx-auto p-8 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl animate-slide-in">
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
        <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />

        {/* Scanning Overlay */}
        <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40" />
        <div className="absolute inset-[20px] border border-primary/20 rounded-xl pointer-events-none" />

        {status === 'active' && challenge?.face_challenge?.target_coords && (
          <div className="absolute w-12 h-12 border-4 border-primary rounded-full shadow-[0_0_20px_rgba(0,242,254,0.6)] transition-all duration-300 pointer-events-none flex items-center justify-center bg-primary/10" style={{
            top: `${challenge.face_challenge.target_coords.y * 100}%`,
            left: `${challenge.face_challenge.target_coords.x * 100}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}>
            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
          </div>
        )}

        {status === 'active' && (
          <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-primary font-black text-xl border border-primary/20 shadow-xl">
            {countdown}s
          </div>
        )}

        {status === 'recording_complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20">
            <div className="text-white flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,242,254,0.3)]"></div>
              <span className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Analyzing Liveness...</span>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/80">
          {status === 'active' ? 'Verification In Progress' : 'Biometric Sensor Active'}
        </div>
      </div>

      <div className="mt-8 text-center flex flex-col gap-4">
        {status === 'initializing' && (
          <div className="flex items-center justify-center gap-2 text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            <p className="text-sm font-medium">Booting Biometric Engine...</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-xl border transition-colors duration-300 ${errorMessage ? 'border-red-500/30 bg-red-500/5 text-red-400' : 'border-primary/20 bg-primary/5 text-primary/80'}`}>
              <p className="text-sm font-semibold tracking-wide">
                {errorMessage ? errorMessage : 'Stage 1: Position your face and follow the target point with your nose.'}
              </p>
            </div>
            <button
              onClick={startChallenge}
              className="btn-primary w-full py-4 uppercase tracking-widest font-black text-xs group"
            >
              {errorMessage ? 'Retry Neural Scan' : 'Initialize Face Scan'}
              <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" size={16} />
            </button>
          </div>
        )}

        {status === 'active' && (
          <p className="text-primary text-sm font-black uppercase tracking-[0.2em] animate-pulse">Follow the coordinate point</p>
        )}

        {status === 'completed' && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <CheckCircle size={32} className="text-[#00ffaa]" />
            </div>
            <p className="font-black uppercase tracking-widest text-[#00ffaa]">Liveness Confirmed</p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold">
            <p>{errorMessage || 'Hardware access failure. check system permissions.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceLiveness;
