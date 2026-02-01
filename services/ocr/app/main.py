import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, Response
import io

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "UP", "service": "OCR_Layer_1", "mode": "MOCKED_OCR"}

@app.post("/api/ocr/aadhaar")
async def extract_aadhaar(file: UploadFile = File(...)):
    print(f"[OCR] Processing Aadhaar for: {file.filename}")
    # Mock Response
    return {
        "data": {
            "Name": "Rahul Sharma",
            "UID": "4521 8932 7120",
            "DOB": "12-05-1995",
            "Gender": "Male",
            "Address": "123, Gandhi Road, Mumbai, Maharashtra"
        }
    }

@app.post("/api/ocr/pan")
async def extract_pan(file: UploadFile = File(...)):
    print(f"[OCR] Processing PAN for: {file.filename}")
    # Mock Response
    return {
        "data": {
            "Name": "Rahul Sharma",
            "PAN_Number": "ABCDE1234F",
            "Date_of_Birth": "12/05/1995",
            "Father_Name": "Ramesh Sharma"
        }
    }

@app.post("/api/extraction/face")
async def extract_face(file: UploadFile = File(...)):
    print(f"[OCR] Extracting Face from: {file.filename}")
    
    # Read Image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})

    # Face Detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    if len(faces) > 0:
        # Crop the first face
        (x, y, w, h) = faces[0]
        # Add some padding
        padding = 20
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(img.shape[1] - x, w + 2 * padding)
        h = min(img.shape[0] - y, h + 2 * padding)
        
        face_img = img[y:y+h, x:x+w]
        print("[OCR] Face detected and cropped.")
    else:
        # Fallback: Return original image if no face found
        print("[OCR] No face detected, returning full image.")
        face_img = img

    # Convert back to bytes
    _, encoded_img = cv2.imencode('.jpg', face_img)
    return Response(content=encoded_img.tobytes(), media_type="image/jpeg")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
