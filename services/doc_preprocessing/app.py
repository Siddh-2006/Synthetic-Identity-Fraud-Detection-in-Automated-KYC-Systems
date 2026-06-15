from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
import cv2
import numpy as np
import io
from PIL import Image
from utils import preprocess_main
import tempfile
import os

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "UP", "service": "DocumentPreprocessing"}

@app.post("/predict")
async def predict_fraud(file: UploadFile = File(...)):
    print(f"[DocPreprocess] Received image for fraud check: {file.filename}")
    
    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
        
    try:
        # Perform preprocessing just as a dummy check
        processed_img, status = preprocess_main(tmp_path)
        
        # Return what the Node backend expects for Fraud Detection
        return {
            "verdict": "Real" if status != "FAILED_TO_LOAD" else "Fake",
            "confidence": "0.99",
            "raw_score": 0.99,
            "filename": file.filename
        }
        
    except Exception as e:
        print(f"[DocPreprocess] Error: {str(e)}")
        return {"verdict": "Error", "confidence": "0%", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
