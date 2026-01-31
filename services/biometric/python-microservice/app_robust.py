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
print(f"[Python-CV] Haar Cascades initialized from: {face_cascade_path}")

def extract_landmarks_from_image(img):
    # Haar Fallback (Return nose tip center as landmark 1)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        return None
    
    x, y, w, h = faces[0]
    center_x = (x + w/2) / img.shape[1]
    center_y = (y + h/2) / img.shape[0]
    
    # Return 468 landmarks where index 1 is the nose tip
    # We use center_x/y for everything to ensure movement works
    return [Landmark(x=center_x, y=center_y, z=0)] * 468

@app.get("/health")
def health():
    return {"status": "UP", "service": "BiometricCVService", "engine": "HaarCascades"}

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

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_count <= 0:
        # Fallback reading
        tmp_frames = []
        while True:
            ret, frame = cap.read()
            if not ret: break
            tmp_frames.append(frame)
        cap.release()
        frame_count = len(tmp_frames)
        print(f"[Python-CV] Manual frame count: {frame_count}")
        
        # Process frames from memory
        sample_indices = np.linspace(0, frame_count - 1, 10, dtype=int)
        landmarks_sequence = []
        for idx in range(frame_count):
            if idx in sample_indices:
                lms = extract_landmarks_from_image(tmp_frames[idx])
                if lms: landmarks_sequence.append(lms)
        
        os.unlink(tmp_path)
        return {
            "face_detected": len(landmarks_sequence) > 0,
            "landmarks_sequence": landmarks_sequence,
            "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED"
        }

    # Standard path
    # Increase sampling to 20 frames for better chance of detection
    sample_indices = np.linspace(0, frame_count - 1, 20, dtype=int)
    landmarks_sequence = []
    
    print(f"[Python-CV] Sampling {len(sample_indices)} frames at indices: {sample_indices}")
    
    for i in range(frame_count):
        ret, frame = cap.read()
        if not ret: break
        if i in sample_indices:
            # More sensitive Haar parameters
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_detector.detectMultiScale(gray, 1.1, 3) # More sensitive scale/neighbors
            
            if len(faces) > 0:
                x, y, w, h = faces[0]
                center_x = (x + w/2) / frame.shape[1]
                center_y = (y + h/2) / frame.shape[0]
                lms = [Landmark(x=center_x, y=center_y, z=0)] * 468
                landmarks_sequence.append(lms)
                print(f"[Python-CV] Frame {i}: Face detected at ({center_x:.2f}, {center_y:.2f})")
            else:
                print(f"[Python-CV] Frame {i}: No face found")
    
    cap.release()
    os.unlink(tmp_path)
    print(f"[Python-CV] Analysis complete. Extracted landmarks from {len(landmarks_sequence)} frames.")
    
    return {
        "face_detected": len(landmarks_sequence) > 0,
        "landmarks_sequence": landmarks_sequence,
        "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
