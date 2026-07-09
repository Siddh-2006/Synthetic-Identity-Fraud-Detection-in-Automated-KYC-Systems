import os
import sys

# Ensure parent directory is in system path for clean imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import document

app = FastAPI(
    title="DeepKYC Document AI Microservice",
    description="CPU-Optimized Document AI Service for Layout Detection, OCR, Quality, and Face Embedding.",
    version="1.0"
)

# Enable CORS for cross-service calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include main processing router
app.include_router(document.router)

@app.on_event("startup")
async def startup_event():
    print("==================================================")
    print("[Startup] Starting Document AI Microservice...")
    print("[Models] Pre-loading models to CPU...")
    try:
        # Pre-initialize OCR reader
        document.ocr_engine._lazy_init()
        print("[OK] OCR Engine initialized.")
        
        # Pre-initialize Face detector
        _ = document.face_pipeline
        print("[OK] Face Pipeline initialized.")
        
        # Pre-initialize Layout detector
        _ = document.detector
        print("[OK] Layout Detector initialized.")
    except Exception as e:
        print(f"[Warning] Error pre-loading models: {str(e)}")
    print("==================================================")

@app.get("/")
def read_root():
    return {
        "status": "UP",
        "service": "Document_AI_Layer_1",
        "mode": "Optimized CPU",
        "framework": "FastAPI"
    }

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "models_loaded": document.ocr_engine._initialized
    }

@app.get("/ready")
def model_readiness():
    return {
        "ready": document.ocr_engine._initialized,
        "ocr_engine": "EasyOCR" if document.ocr_engine.easy_ocr is not None else ("PaddleOCR" if document.ocr_engine.paddle_ocr is not None else "None"),
        "layout_detector": "YOLOv8n" if document.detector.is_real_model else "Heuristics",
        "face_pipeline": "DeepFace" if document.face_pipeline is not None else "None"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
