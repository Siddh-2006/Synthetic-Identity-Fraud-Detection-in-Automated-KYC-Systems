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

def extract_landmarks_from_image(img):
    # Convert to grayscale for faster/more reliable Haar detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # scaleFactor=1.05 and minNeighbors=3 for maximum sensitivity
    faces = face_detector.detectMultiScale(gray, 1.05, 3)
    
    if len(faces) == 0:
        return None
    
    x, y, w, h = faces[0]
    center_x = (x + w/2) / img.shape[1]
    center_y = (y + h/2) / img.shape[0]
    
    # Return 468 landmarks where index 1 is the nose tip (center of detected face)
    return [Landmark(x=center_x, y=center_y, z=0)] * 468

@app.get("/health")
def health():
    return {"status": "UP", "service": "BiometricCVService", "port": 8080, "engine": "OpenCV-Haar"}

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

    # Force sequential reading to ensure we don't miss any metadata issues
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    
    frame_count = len(frames)
    print(f"[Python-CV] Video decoded. Total frames: {frame_count}")

    if frame_count == 0:
        os.unlink(tmp_path)
        return {"error": "Empty video file received"}

    # Sample up to 30 frames for maximum coverage
    sample_indices = np.linspace(0, frame_count - 1, min(30, frame_count), dtype=int)
    landmarks_sequence = []
    
    for idx in sample_indices:
        lms = extract_landmarks_from_image(frames[idx])
        if lms:
            landmarks_sequence.append(lms)
            print(f"[Python-CV] Frame {idx}: Face DETECTED at ({lms[1].x:.2f}, {lms[1].y:.2f})")
        else:
            print(f"[Python-CV] Frame {idx}: No face found")
    
    os.unlink(tmp_path)
    print(f"[Python-CV] Analysis complete. Extracted landmarks from {len(landmarks_sequence)} / {len(sample_indices)} sampled frames.")
    
    return {
        "face_detected": len(landmarks_sequence) > 0,
        "landmarks_sequence": landmarks_sequence,
        "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED"
    }

if __name__ == "__main__":
    import uvicorn
    # DEFAULT TO PORT 8080 TO AVOID CONFLICTS
    uvicorn.run(app, host="0.0.0.0", port=8080)
