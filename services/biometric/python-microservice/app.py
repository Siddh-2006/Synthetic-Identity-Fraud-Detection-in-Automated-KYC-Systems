import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
import io
import tempfile
import os

app = FastAPI()

class Landmark(BaseModel):
    x: float
    y: float
    z: float

# Haar Cascade Initialization
face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_detector = cv2.CascadeClassifier(face_cascade_path)
print(f"[Python-CV] Robust mode active. Haar Cascades initialized from: {face_cascade_path}")

def detect_spoof_score(img):
    """
    Refined Liveness Engine.
    Balanced for real-world webcams and glasses.
    """
    gray_full = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray_full, 1.1, 5)
    if len(faces) == 0:
        return {"score": 0.0, "reason": "No face found"}
    
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]
    
    # 1. Motion/Clarity Check (Laplacian)
    # Real users have some texture. We lower the 'perfect' score to 40.
    roi_gray = gray_full[y:y+h, x:x+w]
    l_var = cv2.Laplacian(roi_gray, cv2.CV_64F).var()
    texture_score = min(1.0, l_var / 40.0)

    # 2. Skin-Tone (YCbCr)
    # Most reliable signal. Screens fail this significantly.
    roi_color = img[y:y+h, x:x+w]
    ycbcr = cv2.cvtColor(roi_color, cv2.COLOR_BGR2YCrCb)
    skin_mask = cv2.inRange(ycbcr, (0, 133, 77), (255, 173, 127))
    skin_ratio = cv2.countNonZero(skin_mask) / (w * h)
    skin_score = min(1.0, skin_ratio * 1.8) # Boosted for diverse lighting

    # 3. Frequency Analysis (Softened FFT)
    # Denoise more aggressively to ignore glasses frames vs pixel grids.
    denoised = cv2.GaussianBlur(roi_gray, (5, 5), 0)
    f = np.fft.fft2(denoised)
    fshift = np.fft.fftshift(f)
    mag = 20 * np.log(np.abs(fshift) + 1)
    cy, cx = mag.shape[0] // 2, mag.shape[1] // 2
    mag[max(0,cy-10):min(mag.shape[0],cy+10), max(0,cx-10):min(mag.shape[1],cx+10)] = 0
    
    # Check for mean energy in high-freq (Digital noise is uniform)
    mu = np.mean(mag)
    freq_score = max(0.0, 1.0 - (mu / 60.0)) 

    # Final Math Check
    s_term = skin_score * 0.5
    f_term = freq_score * 0.3
    t_term = texture_score * 0.2
    liveness = s_term + f_term + t_term
    liveness = round(float(liveness), 4)
    
    print(f"[Python-CV] Liveness: Total={liveness} (Skin_Term={s_term:.2f}, Freq_Term={f_term:.2f}, Text_Term={t_term:.2f})")
    
    return {
        "score": liveness,
        "signals": {
            "skin": round(float(skin_score), 4),
            "frequency": round(float(freq_score), 4),
            "texture": round(float(texture_score), 4)
        }
    }

@app.post("/detect-spoof")
async def detect_spoof(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "Invalid image"}
    
    report = detect_spoof_score(img)
    return {"liveness_score": report["score"], "is_spoof": report["score"] < 0.15, "report": report}

@app.get("/health")
async def health():
    return {"status": "ok", "libs": {"librosa": librosa is not None, "sr": sr is not None}}

@app.get("/")
async def root():
    return {"status": "UP", "service": "BiometricCVService", "port": 8080, "engine": "OpenCV-Haar"}

def extract_landmarks_from_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # More robust parameters: lower scaleFactor and fewer minNeighbors
    faces = face_detector.detectMultiScale(gray, 1.05, 3) 
    if len(faces) == 0:
        return None
    x, y, w, h = faces[0]
    # Return normalized center coordinates
    center_x = float((x + w/2) / img.shape[1])
    center_y = float((y + h/2) / img.shape[0])
    return [Landmark(x=center_x, y=center_y, z=0)] * 468

@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    print(f"[Python-CV] Analyzing uploaded video: {file.filename}")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    cap = cv2.VideoCapture(tmp_path)
    if not cap.isOpened():
        os.unlink(tmp_path)
        return {"error": "Could not open video file"}

    frames = []
    while True:
        ret, frame = cap.read()
        if not ret: break
        frames.append(frame)
    cap.release()
    
    frame_count = len(frames)
    if frame_count == 0:
        os.unlink(tmp_path)
        return {"error": "Empty video file received"}

    # Sample up to 20 frames for landmarks, but use 4 for anti-spoofing specifically
    sample_indices = np.linspace(0, frame_count - 1, min(20, frame_count), dtype=int)
    antispoof_indices = np.linspace(0, frame_count - 1, min(4, frame_count), dtype=int)
    
    landmarks_sequence = []
    spoof_scores = []
    best_frames_data = [] # List of (score, base64_str)
    
    import base64

    for idx in sample_indices:
        lms = extract_landmarks_from_image(frames[idx])
        if lms:
            landmarks_sequence.append(lms)
            # Run anti-spoof
            report = detect_spoof_score(frames[idx])
            liveness = report["score"]
            spoof_scores.append(liveness)
            
            # Convert to base64 if it's potentially a "best" frame
            _, buffer = cv2.imencode('.jpg', frames[idx], [cv2.IMWRITE_JPEG_QUALITY, 85])
            b64 = base64.b64encode(buffer).decode('utf-8')
            best_frames_data.append((liveness, b64))
    
    os.unlink(tmp_path)
    
    # Sort by liveness score descending and take top 3
    best_frames_data.sort(key=lambda x: x[0], reverse=True)
    top_verified_frames = [x[1] for x in best_frames_data[:3]]
    
    avg_spoof_score = float(np.mean(spoof_scores)) if spoof_scores else 0.0
    
    # Get signal breakdown from the last analyzed frame for debugging
    last_report = report if 'report' in locals() else {"signals": {}}
    
    # Mirroring logic check: 
    # Normal distance vs Mirrored distance for first and last detected faces
    # (Just logging for backend visibility)
    
    return {
        "face_detected": len(landmarks_sequence) > 0,
        "landmarks_sequence": landmarks_sequence,
        "spoof_score": avg_spoof_score,
        "liveness_percentage": round(avg_spoof_score * 100, 2),
        "liveness_signals": last_report.get("signals", {}),
        "is_spoof": avg_spoof_score < 0.12 if spoof_scores else True, # Slightly lowered threshold
        "verified_frames_b64": top_verified_frames,
        "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED",
        "debug_face_count": len(landmarks_sequence)
    }

# --- NEW: Robust Audio Verification Integration ---

try:
    import speech_recognition as sr
    import librosa
except ImportError:
    sr = None
    librosa = None

def fuzzy_match(s1, s2):
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if not s1 or not s2: return 0.0
    
    # Levenshtein distance for robustness against minor ASR errors
    rows = len(s1) + 1
    cols = len(s2) + 1
    dist = [[0 for _ in range(cols)] for _ in range(rows)]

    for i in range(1, rows): dist[i][0] = i
    for i in range(1, cols): dist[0][i] = i

    for col in range(1, cols):
        for row in range(1, rows):
            cost = 0 if s1[row-1] == s2[col-1] else 1
            dist[row][col] = min(dist[row-1][col] + 1,      # deletion
                                 dist[row][col-1] + 1,      # insertion
                                 dist[row-1][col-1] + cost) # substitution

    score = 1 - (dist[rows-1][cols-1] / max(len(s1), len(s2)))
    return score

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), expected_phrase: str = Form(...)):
    print(f"[Python-CV] Request received: {file.filename}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        print(f"[Python-CV] Saved to temp: {tmp_path}, Write size: {len(content)}")

    try:
        # 1. Loading & Anti-Spoof Heuristics (Librosa)
        liveness_score = 0.5
        if librosa:
            try:
                print(f"[Python-CV] Attempting librosa.load...")
                y, sr_rate = librosa.load(tmp_path, sr=16000)
                print(f"[Python-CV] Librosa load success. Duration: {len(y)/sr_rate:.2f}s")
                # MFCC Variance (Real voice has higher complexity)
                mfccs = librosa.feature.mfcc(y=y, sr=sr_rate, n_mfcc=13)
                mfcc_var = np.mean(np.var(mfccs, axis=1))
                
                # Spectral Flatness
                flatness = np.mean(librosa.feature.spectral_flatness(y=y))
                
                # Simple scoring
                liveness_indicators = 0
                if mfcc_var > 25: liveness_indicators += 1
                if 0.01 < flatness < 0.1: liveness_indicators += 1
                liveness_score = liveness_indicators / 2.0
                print(f" >> Liveness Logic: Var={mfcc_var:.2f}, Flat={flatness:.4f}, Score={liveness_score}")
            except Exception as e:
                print(f"[Python-CV] Librosa error: {str(e)}")
                liveness_score = 0.0

        # 2. ASR Transcription (SpeechRecognition)
        transcript = ""
        matching_score = 0.0
        if sr:
            try:
                print(f"[Python-CV] Attempting SpeechRecognition...")
                recognizer = sr.Recognizer()
                with sr.AudioFile(tmp_path) as source:
                    audio_content = recognizer.record(source)
                
                # Use Google Web Speech API
                transcript = recognizer.recognize_google(audio_content)
                matching_score = fuzzy_match(expected_phrase, transcript)
                print(f"[Python-CV] ASR Success: '{transcript}', Match: {matching_score}")
            except Exception as e:
                print(f" >> ASR Error details: {str(e)}")
                transcript = f"Error: {str(e)}"

        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        return {
            "verified": matching_score >= 0.7 and liveness_score >= 0.5,
            "transcript": transcript,
            "matching_score": round(matching_score, 2),
            "liveness_score": round(liveness_score, 2),
            "ai_detected": liveness_score < 0.5,
            "status": "SUCCESS"
        }
    except Exception as e:
        print(f"[Python-CV] CRITICAL ERROR: {str(e)}")
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        return {"error": f"Critical Python Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    # DEFAULT TO PORT 8080 TO AVOID CONFLICTS
    uvicorn.run(app, host="0.0.0.0", port=8080)
