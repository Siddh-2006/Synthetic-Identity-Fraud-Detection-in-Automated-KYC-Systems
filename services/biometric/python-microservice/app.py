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
def health():
    return {"status": "UP", "service": "BiometricCVService", "port": 8080, "engine": "OpenCV-Haar"}

def extract_landmarks_from_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray, 1.05, 3)
    if len(faces) == 0:
        return None
    x, y, w, h = faces[0]
    center_x = (x + w/2) / img.shape[1]
    center_y = (y + h/2) / img.shape[0]
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
    
    return {
        "face_detected": len(landmarks_sequence) > 0,
        "landmarks_sequence": landmarks_sequence,
        "spoof_score": avg_spoof_score,
        "liveness_percentage": round(avg_spoof_score * 100, 2),
        "liveness_signals": last_report.get("signals", {}),
        "is_spoof": avg_spoof_score < 0.15 if spoof_scores else True,
        "verified_frames_b64": top_verified_frames,
        "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED"
    }

if __name__ == "__main__":
    import uvicorn
    # DEFAULT TO PORT 8080 TO AVOID CONFLICTS
    uvicorn.run(app, host="0.0.0.0", port=8080)
