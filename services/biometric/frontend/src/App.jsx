import React from 'react';
import BiometricChallenge from './components/BiometricChallenge';
import './App.css';

function App() {
    const sessionId = "sample-session-123"; // In a real app, this comes from URL/Orchestrator
    console.log(`[App] Initializing Biometric App for Session: ${sessionId}`);

    const handleComplete = (result) => {
        console.log('[App] Received results from Biometric Layer:', result);
        if (result.status === 'success') {
            console.log('%c[App] VERIFICATION PASSED ✅', 'color: green; font-weight: bold; font-size: 16px;');
        } else {
            console.warn('%c[App] VERIFICATION FAILED ❌', 'color: red; font-weight: bold; font-size: 16px;');
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>KYC Identity Platform</h1>
            </header>
            <main>
                <BiometricChallenge sessionId={sessionId} onComplete={handleComplete} />
            </main>
        </div>
    );
}

export default App;
