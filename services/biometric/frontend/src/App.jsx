import React, { useState } from 'react';
import BiometricChallenge from './components/BiometricChallenge';
import VoiceDetection from './components/VoiceDetection';
import './App.css';

function App() {
  const sessionId = "sample-session-123";
  const [step, setStep] = useState('face'); // 'face', 'voice', 'success'
  const [verificationData, setVerificationData] = useState({ face: null, voice: null });

  console.log(`[App] Current Step: ${step} | Session: ${sessionId}`);

  const handleFaceComplete = (result) => {
    console.log('[App] Face stage complete:', result);
    setVerificationData(prev => ({ ...prev, face: result }));
    setStep('voice');
  };

  const handleVoiceComplete = (result) => {
    console.log('[App] Voice stage complete:', result);
    setVerificationData(prev => ({ ...prev, voice: result }));
    setStep('success');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>KYC Identity Platform</h1>
        <div className="status-stepper" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem', fontSize: '0.8rem' }}>
          <span style={{ color: step === 'face' ? '#818cf8' : '#4ade80', fontWeight: step === 'face' ? 'bold' : 'normal' }}>1. Face Scan</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: step === 'voice' ? '#818cf8' : (step === 'success' ? '#4ade80' : 'inherit'), fontWeight: step === 'voice' ? 'bold' : 'normal' }}>2. Voice Verify</span>
        </div>
      </header>

      <main>
        {step === 'face' && (
          <BiometricChallenge sessionId={sessionId} onComplete={handleFaceComplete} />
        )}

        {step === 'voice' && (
          <VoiceDetection sessionId={sessionId} onComplete={handleVoiceComplete} />
        )}

        {step === 'success' && (
          <div className="final-success" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="success-message" style={{ color: '#22c55e', textAlign: 'left', background: 'rgba(34, 197, 94, 0.05)', padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)', maxWidth: '500px', margin: '0 auto' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 1.5rem 0' }}>KYC Verified ✅</h2>

              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div className="res-card">
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Face Liveness</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.8rem' }}>{verificationData.face?.liveness_percentage}% Confidence</div>

                  {verificationData.face?.verified_frames && (
                    <div className="frames-strip" style={{ display: 'flex', gap: '5px', overflowX: 'auto', padding: '5px 0' }}>
                      {verificationData.face.verified_frames.map((url, i) => (
                        <img key={i} src={url} alt={`Frame ${i}`} style={{ height: '60px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="res-card" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Voice Match</span>
                  <div style={{ fontStyle: 'italic', margin: '0.5rem 0', color: '#818cf8' }}>"{verificationData.voice?.transcription}"</div>
                  <div style={{ fontSize: '0.9rem', color: '#4ade80' }}>Verified Signature Match</div>
                </div>
              </div>

              <button
                onClick={() => window.location.reload()}
                style={{ marginTop: '2rem', background: '#818cf8', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
