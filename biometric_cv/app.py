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
# MediaPipe Setup (Optional - Fail Soft)
try:
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )
    FACE_MESH_AVAILABLE = True
except Exception as e:
    print(f"Warning: MediaPipe FaceMesh could not be initialized: {e}")
    face_mesh = None
    FACE_MESH_AVAILABLE = False

class Landmark(BaseModel):
    x: float
    y: float
    z: float

class FaceResult(BaseModel):
    landmarks: List[Landmark] = []
    face_detected: bool = False

def extract_landmarks_from_image(img):
    if not FACE_MESH_AVAILABLE or face_mesh is None:
        return None

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

# Audio Verification Module
from audio_liveness import AudioVerifier
from fastapi.staticfiles import StaticFiles

# Initialize Audio Verifier
audio_verifier = AudioVerifier()

# Mount static for frontend demo
# Point to: services/biometric/frontend/audio_verification (relative to biometric_cv/app.py)
# structure:
# d:/Echelon-1/.../biometric_cv/app.py
# d:/Echelon-1/.../services/biometric/frontend/audio_verification/index.html
# Relative path from app.py is ../services/biometric/frontend/audio_verification (if they share parent root, which they don't exactly)
# app.py is in .../KYC-Systems/biometric_cv
# services is in .../KYC-Systems/services
# So we go up one level from biometric_cv to KYC-Systems, then down to services/...

base_dir = os.path.dirname(os.path.abspath(__file__)) # .../biometric_cv
project_root = os.path.dirname(base_dir) # .../KYC-Systems
static_dir = os.path.join(project_root, "services", "biometric", "frontend", "audio_verification")

print(f"[Python-CV] Static Directory Resolved to: {static_dir}")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir, html=True), name="static")
    print("[Python-CV] Static mount successful.")
else:
    print(f"[Python-CV] ERROR: Static directory not found at {static_dir}")

@app.get("/audio/challenge")
def get_audio_challenge():
    token, challenge_data = audio_verifier.generate_challenge()
    return {
        "token": token,
        "challenge": challenge_data["text"],
        "pronunciation": {
            "hindi": challenge_data["hindi"],
            "gujarati": challenge_data["gujarati"]
        },
        "instruction": f"Please say: '{challenge_data['text']}'"
    }

from starlette.concurrency import run_in_threadpool

@app.post("/audio/verify")
async def verify_audio(token: str = Form(...), audio: UploadFile = File(...)):
    print(f"[Audio-Verify] Received audio for token: {token}")
    
    # Read audio bytes asynchronously
    audio_bytes = await audio.read()
    
    # Audio verification is CPU bound (DSP), run in threadpool
    result = await run_in_threadpool(audio_verifier.verify_session, token, audio_bytes)
    
    return {
        "verified": result.is_live,
        "confidence": result.score,
        "details": result.details,
        "error": result.error
    }


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
    print("[Python-CV] Starting Biometrics CV + Audio Service on Port 8000...")
    # Open browser for user convenience (hackathon friendly)
    print("Frontend available at: http://localhost:8000/static/index.html")
    uvicorn.run(app, host="0.0.0.0", port=8000)
