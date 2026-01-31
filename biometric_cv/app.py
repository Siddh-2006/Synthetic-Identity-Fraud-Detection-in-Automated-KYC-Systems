import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
import io
import tempfile
import os
import requests

app = FastAPI()

# MediaPipe Setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

class Landmark(BaseModel):
    x: float
    y: float
    z: float

class FaceResult(BaseModel):
    landmarks: List[Landmark] = []
    face_detected: bool = False

def extract_landmarks_from_image(img):
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(img_rgb)

    if not results.multi_face_landmarks:
        return None

    landmarks = []
    for face_landmarks in results.multi_face_landmarks:
        for lm in face_landmarks.landmark:
            landmarks.append(Landmark(x=lm.x, y=lm.y, z=lm.z))
    return landmarks

@app.get("/health")
def health():
    return {"status": "UP", "service": "BiometricCVService"}

@app.post("/analyze-video")
async def analyze_video(url: str = Form(...)):
    print(f"[Python-CV] Analyzing video from URL: {url}")
    
    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        print(f"[Python-CV] Error: Could not open video URL")
        return {"error": "Could not open video URL"}

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"[Python-CV] Video info: {frame_count} frames, {fps} FPS")

    # Sample 10 frames evenly
    sample_indices = np.linspace(0, frame_count - 1, 10, dtype=int)
    landmarks_sequence = []
    
    for i in range(frame_count):
        ret, frame = cap.read()
        if not ret:
            break
        
        if i in sample_indices:
            print(f"[Python-CV] Processing frame {i}...")
            landmarks = extract_landmarks_from_image(frame)
            if landmarks:
                landmarks_sequence.append(landmarks)
    
    cap.release()
    print(f"[Python-CV] Analysis complete. Extracted landmarks from {len(landmarks_sequence)} frames.")
    
    return {
        "face_detected": len(landmarks_sequence) > 0,
        "landmarks_sequence": landmarks_sequence,
        "status": "SUCCESS" if len(landmarks_sequence) > 0 else "NO_FACE_DETECTED"
    }

if __name__ == "__main__":
    import uvicorn
    print("[Python-CV] Starting Biometrics CV Service on Port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
