import os
import time
import random
import hashlib
import json
import numpy as np
import tempfile
from dataclasses import dataclass
from typing import Tuple, Dict, Any

# Libraries for audio processing
# Ensure these are installed: pip install numpy librosa SpeechRecognition scipy
try:
    import librosa
except ImportError:
    librosa = None
    print("Warning: librosa not found. Audio analysis will be limited.")

try:
    import speech_recognition as sr
except ImportError:
    sr = None
    print("Warning: SpeechRecognition not found. ASR will be disabled.")

try:
    from scipy.spatial.distance import cosine
except ImportError:
    cosine = None

@dataclass
class VerificationResult:
    is_live: bool
    score: float
    details: Dict[str, Any]
    error: str = None

class AudioVerifier:
    def __init__(self):
        # In-memory storage for reuse detection (for hackathon/demo purposes)
        # In production, use Redis or a database.
        self.seen_audio_hashes = set()
        
        # In-memory challenge store: token -> {word, timestamp}
        self.active_challenges = {}
        
        self.recognizer = sr.Recognizer() if sr else None

    def generate_challenge(self) -> Tuple[str, Dict[str, str]]:
        """
        Generates a random challenge word with pronunciations.
        """
        # Simple, non-technical phrases with phonetic guides
        corpus = [
            {
                "text": "my voice is safe",
                "hindi": "माय वोइस इज़ सेफ", 
                "gujarati": "માય વોઇસ ઇઝ સેફ"
            },
            {
                "text": "verify my login",
                "hindi": "वेरीफाई माय लोगिन",
                "gujarati": "વેરીફાય માય લોગિન"
            },
            {
                "text": "i am a real person",
                "hindi": "आई एम अ रियल पर्सन",
                "gujarati": "આઈ એમ અ રિયલ પર્સન"
            },
            {
                "text": "check my identity",
                "hindi": "चेक माय आइडेंटिटी",
                "gujarati": "ચેક માય આઈડેન્ટિટી"
            },
            {
                "text": "open my account",
                "hindi": "ओपन माय अकाउंट",
                "gujarati": "ઓપન માય એકાઉન્ટ"
            }
        ]
        
        selection = random.choice(corpus)
        challenge_text = selection["text"]
        
        # Generate a token
        timestamp = time.time()
        raw_token = f"{challenge_text}_{timestamp}_{random.randint(1000,9999)}"
        token = hashlib.sha256(raw_token.encode()).hexdigest()
        
        self.active_challenges[token] = {
            "text": challenge_text,
            "timestamp": timestamp
        }
        
        return token, selection

    def verify_session(self, token: str, audio_data: bytes) -> VerificationResult:
        """
        Verifies the audio against the challenge token.
        Checks: Replay, Timing, Content (ASR), and Liveness heuristics.
        """
        # 1. Validate Token
        if token not in self.active_challenges:
            return VerificationResult(False, 0.0, {}, "Invalid or expired token.")
        
        challenge_info = self.active_challenges.pop(token) # One-time use
        expected_text = challenge_info["text"]
        challenge_time = challenge_info["timestamp"]
        
        # 2. Check Replay (Audio Fingerprint - Simple Hash)
        # In a real system, use acoustic fingerprinting (Chromaprint/AcoustID)
        audio_hash = hashlib.md5(audio_data).hexdigest()
        if audio_hash in self.seen_audio_hashes:
            return VerificationResult(False, 0.0, {"replay_detected": True}, "Replay attack detected (duplicate audio).")
        self.seen_audio_hashes.add(audio_hash)

        # Save to temp file for processing
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            tmp_file.write(audio_data)
            tmp_path = tmp_file.name

        try:
            # 3. Load Audio
            # We use librosa to load robustly (handles webm, ogg, etc.)
            # and then save to a pristine WAV for SpeechRecognition
            y = None
            sr_rate = 16000
            
            if librosa:
                try:
                    y, sr_rate = librosa.load(tmp_path, sr=sr_rate)
                except Exception as e:
                    print(f"Librosa load failed: {e}")
                    # Fallback or fail?
            
            duration = librosa.get_duration(y=y, sr=sr_rate) if (librosa and y is not None) else 0.0
            
            # If we successfully loaded with librosa, export as WAV for ASR
            # This fixes issues where browser sends WebM but SR needs WAV
            clean_wav_path = tmp_path
            if y is not None:
                clean_wav_path = tmp_path + "_clean.wav"
                # Convert to int16 for maximum compatibility
                y_int16 = (y * 32767).astype(np.int16)
                import scipy.io.wavfile as wavfile
                wavfile.write(clean_wav_path, sr_rate, y_int16)
            
            # 4. Timing Analysis
            # Check if speaking starts reasonably after recording (reaction time)
            # We look for the first moment energy exceeds a threshold
            timing_score = 1.0
            reaction_time = 0.0
            if librosa and y is not None:
                # Simple energy based VAD
                rms = librosa.feature.rms(y=y)[0]
                # Normalize
                if np.max(rms) > 0:
                    rms = (rms - np.min(rms)) / (np.max(rms) - np.min(rms))
                
                # Find start
                speech_threshold = 0.15
                speech_frames = np.where(rms > speech_threshold)[0]
                if len(speech_frames) > 0:
                    start_frame = speech_frames[0]
                    reaction_time = librosa.frames_to_time(start_frame, sr=sr_rate)
                    
                    # Heuristic: Reaction time < 0.1s is suspicious (pre-recorded?)
                    # Reaction time > 3s is suspicious (too slow?)
                    if reaction_time < 0.1 or reaction_time > 3.0:
                        timing_score = 0.5 
                    else:
                        timing_score = 1.0
                else:
                    timing_score = 0.0 # No speech detected
            
            # 5. Content Verification (ASR)
            content_score = 0.0
            recognized_text = ""
            if self.recognizer and (y is not None or not librosa):
                # Use clean path if librosa converted it, else original (hope it's wav)
                target_path = clean_wav_path if y is not None else tmp_path
                
                try:
                    with sr.AudioFile(target_path) as source:
                        audio_content = self.recognizer.record(source)
                    # Uses Google Web Speech API (default key) - Hackathon friendly
                    recognized_text = self.recognizer.recognize_google(audio_content)
                    
                    # Simple fuzzy match
                    ratio = self._fuzzy_match(expected_text.lower(), recognized_text.lower())
                    content_score = ratio
                except Exception as e: # Catch SR errors
                     print(f"ASR Error: {e}")
                     recognized_text = f"[ASR Error]"
                     content_score = 0.0
            else:
                recognized_text = "[ASR Disabled/Failed]"
                content_score = 1.0 if not self.recognizer else 0.0

            # 6. Anti-Spoofing Heuristics (Liveness)
            # Without a deep learning model, we use signal heuristics.
            # Real speech usually has:
            # - Rich harmonic structure (check MFCC correlation?)
            # - Natural spectral rolloff
            spoof_score = 0.5
            explanations = []
            
            if librosa and y is not None:
                # Feature 1: Spectral Flatness (White noise is 1.0, Tonal is 0.0)
                # Synthetic speech can sometimes be too flat or too tonal.
                flatness = np.mean(librosa.feature.spectral_flatness(y=y))
                
                # Feature 2: MFCC stats
                mfccs = librosa.feature.mfcc(y=y, sr=sr_rate, n_mfcc=13)
                mfcc_var = np.mean(np.var(mfccs, axis=1))
                
                # Heuristic:
                # extremely low variance -> synthetic/robotic
                # extremely high flatness -> noise
                
                liveness_indicators = 0
                total_indicators = 0
                
                # Check 1: Dynamic Range (Variance)
                total_indicators += 1
                if mfcc_var > 30: # Relaxed threshold
                    liveness_indicators += 1
                else:
                    explanations.append(f"Low voice complexity ({int(mfcc_var)})")

                # Check 2: Silence Ratio
                # Natural speech has pauses. Continuous sound is suspicious.
                total_indicators += 1
                non_silent_intervals = librosa.effects.split(y, top_db=20)
                non_silent_duration = sum([ (end-start)/sr_rate for start, end in non_silent_intervals ])
                
                silence_ratio = 1.0 - (non_silent_duration / duration) if duration > 0 else 0
                
                if 0.05 < silence_ratio < 0.7:
                    liveness_indicators += 1
                else:
                    explanations.append(f"Unnatural silence ratio ({int(silence_ratio*100)}%)")
                
                spoof_score = liveness_indicators / total_indicators
            else:
                spoof_score = 0.5 # Neutral if analysis failed

            # 7. Fuse Signals
            # Weighted average
            # Weights: Content=40%, Timing=20%, Spoof=40%
            final_score = (content_score * 0.4) + (timing_score * 0.2) + (spoof_score * 0.4)
            
            # HARD FAIL: If content match is too low (wrong words), fail even if live.
            if content_score < 0.5:
                is_verified = False
                explanations.insert(0, f"Incorrect phrase spoken (Match: {int(content_score*100)}%)")
            else:
                is_verified = final_score > 0.65
            
            details = {
                "transcript": recognized_text,
                "expected": expected_text,
                "scores": {
                    "content": round(content_score, 2),
                    "timing": round(timing_score, 2),
                    "spoof_heuristic": round(spoof_score, 2),
                    "reaction_time": round(reaction_time, 2)
                },
                "issues": explanations
            }
            
            return VerificationResult(is_verified, round(final_score, 2), details)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return VerificationResult(False, 0.0, {}, f"Analysis failed: {str(e)}")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            if 'clean_wav_path' in locals() and os.path.exists(clean_wav_path) and clean_wav_path != tmp_path:
                os.unlink(clean_wav_path)

    def _fuzzy_match(self, s1, s2):
        """
        Computes a similarity score between 0.0 and 1.0 using Levenshtein distance.
        """
        if not s1 or not s2:
            return 0.0
            
        # Basic exact match
        if s1 == s2:
            return 1.0
            
        # Levenshtein distance implementation
        len1, len2 = len(s1), len(s2)
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]

        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if s1[i - 1] == s2[j - 1] else 1
                matrix[i][j] = min(
                    matrix[i - 1][j] + 1,      # deletion
                    matrix[i][j - 1] + 1,      # insertion
                    matrix[i - 1][j - 1] + cost # substitution
                )
        
        distance = matrix[len1][len2]
        max_len = max(len1, len2)
        
        if max_len == 0:
            return 1.0
            
        similarity = 1.0 - (distance / max_len)
        return similarity
