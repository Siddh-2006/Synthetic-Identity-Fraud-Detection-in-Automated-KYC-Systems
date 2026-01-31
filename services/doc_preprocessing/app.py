from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
import cv2
import numpy as np
import io
from PIL import Image
from .utils import preprocess_main
import tempfile
import os

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "UP", "service": "DocumentPreprocessing"}

@app.post("/preprocess")
async def preprocess_document(file: UploadFile = File(...)):
    print(f"[DocPreprocess] Received image: {file.filename}")
    
    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
        
    try:
        processed_img, status = preprocess_main(tmp_path)
        
        if processed_img is None:
            return {"error": "Processing failed", "status": status}
            
        # Convert processed CV2 image back to bytes
        _, encoded_img = cv2.imencode('.png', processed_img)
        img_bytes = encoded_img.tobytes()
        
        print(f"[DocPreprocess] Processing complete. Status: {status}")
        
        return Response(content=img_bytes, media_type="image/png", headers={
            "X-Processing-Status": status
        })
        
    except Exception as e:
        print(f"[DocPreprocess] Error: {str(e)}")
        return {"error": str(e), "status": "ERROR"}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
