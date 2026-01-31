import React, { useState } from 'react';
import axios from 'axios';
import { useBehaviorTracker } from './hooks/useBehaviorTracker';
import { Activity, ShieldCheck, ShieldAlert, MousePointer2, Clock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = "http://localhost:5001";

function App() {
    const { isTracking, events, startTracking, stopTracking } = useBehaviorTracker();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleEndSession = async () => {
        const sessionData = stopTracking();
        setLoading(true);
        setError(null);

        try {
            const resp = await axios.post(`${API_BASE}/predict`, sessionData);
            setResult(resp.data);
        } catch (err) {
            console.error(err);
            setError("Prediction failed. Make sure the backend is running on port 5001.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (label) => {
        if (label === 'human') return 'text-green-400 border-green-400';
        if (label === 'moderate_bot') return 'text-yellow-400 border-yellow-400';
        return 'text-red-400 border-red-400';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8">
            <header className="max-w-4xl mx-auto mb-12 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        Behavioral Bot Detection
                    </h1>
                    <p className="text-slate-400 mt-2">Stage 4: Real-Time Inference Demo</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
                    <Activity className={`w-4 h-4 ${isTracking ? 'text-emerald-500 animate-pulse' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">{isTracking ? 'Live Tracking' : 'Idle'}</span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Interaction Panel */}
                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <MousePointer2 className="w-5 h-5 text-blue-400" />
                        interaction Playground
                    </h2>

                    <div className="space-y-6">
                        <div className="h-48 bg-slate-950 rounded-xl border border-slate-800 border-dashed flex items-center justify-center p-4 text-center">
                            {isTracking ? (
                                <p className="text-slate-400 animate-bounce">Move your mouse, click, and scroll around here!</p>
                            ) : (
                                <p className="text-slate-500 italic">Click "Start Session" to begin behavioral collection</p>
                            )}
                        </div>

                        <div className="flex gap-4">
                            {!isTracking ? (
                                <button
                                    id="start-session-btn"
                                    onClick={startTracking}
                                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl font-bold text-lg shadow-lg shadow-blue-900/20"
                                >
                                    Start Session
                                </button>
                            ) : (
                                <button
                                    id="end-session-btn"
                                    onClick={handleEndSession}
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20"
                                >
                                    End Session & Predict
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">Events: {events.length}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <BarChart3 className="w-4 h-4" />
                                <span className="text-sm">Active: {isTracking ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl min-h-[400px]">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        Detection Result
                    </h2>

                    <AnimatePresence mode='wait'>
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center h-64 gap-4"
                            >
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-slate-400">Running inference engine...</p>
                            </motion.div>
                        ) : error ? (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="p-4 bg-red-900/20 border border-red-900/30 rounded-lg text-red-400 text-sm"
                            >
                                {error}
                            </motion.div>
                        ) : result ? (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className={`p-6 rounded-2xl border-2 text-center ${getStatusColor(result.prediction)} bg-slate-950`}>
                                    <p className="text-xs uppercase tracking-widest font-bold opacity-70 mb-1">Final Classification</p>
                                    <p className="text-4xl font-black capitalize mb-2">{result.prediction.replace('_', ' ')}</p>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-current text-sm">
                                        {Math.round(result.confidence * 100)}% Confidence
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4 tracking-wider">Analysis breakdown</h3>
                                    <div className="space-y-3">
                                        {Object.entries(result.class_probabilities).map(([label, prob]) => (
                                            <div key={label} className="space-y-1">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="capitalize">{label.replace('_', ' ')}</span>
                                                    <span>{Math.round(prob * 100)}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }} animate={{ width: `${prob * 100}%` }}
                                                        className={`h-full ${label === result.prediction ? 'bg-blue-500' : 'bg-slate-700'}`}
                                                    ></motion.div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Based on {events.length} behavioral events. Feature vector successfully mapped to
                                        "{result.prediction}" using trained XGBoost model.
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-4">
                                <ShieldAlert className="w-12 h-12 opacity-20" />
                                <p className="text-center italic">No prediction available.<br />Complete a session to see results.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <footer className="max-w-4xl mx-auto mt-16 text-center text-slate-600 text-xs border-t border-slate-900 pt-8">
                <p>This demo uses real-time feature engineering linked to a static XGBoost classifier.</p>
                <p className="mt-2 text-emerald-900/40 uppercase tracking-[0.2em]">Project SportsHub - Bot Detection Pipeline</p>
            </footer>
        </div>
    );
}

export default App;
