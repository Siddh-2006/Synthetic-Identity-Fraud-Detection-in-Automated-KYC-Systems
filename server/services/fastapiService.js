import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const FASTAPI_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

const extractAadhaar = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const start = Date.now();
    const response = await axios.post(`${FASTAPI_URL}/api/ocr/aadhaar`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    console.log(`📡 [FastAPI] Aadhaar OCR took ${Date.now() - start}ms`);

    return response.data;
  } catch (error) {
    console.error('FastAPI Aadhaar Error:', error.message);
    throw new Error('Failed to extract Aadhaar data');
  }
};

const extractPan = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const start = Date.now();
    const response = await axios.post(`${FASTAPI_URL}/api/ocr/pan`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    console.log(`📡 [FastAPI] PAN OCR took ${Date.now() - start}ms`);

    return response.data;
  } catch (error) {
    console.error('FastAPI PAN Error:', error.message);
    throw new Error('Failed to extract PAN data');
  }
};

const extractFace = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const start = Date.now();
    const response = await axios.post(`${FASTAPI_URL}/api/extraction/face`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      responseType: 'arraybuffer', // Get image buffer
    });
    console.log(`📡 [FastAPI] Face Extraction took ${Date.now() - start}ms`);

    return response.data; // This is the image buffer
  } catch (error) {
    console.error('FastAPI Face Extraction Error:', error.message);
    // If it's a 4xx/5xx, try to read the error message from buffer
    if (error.response && error.response.data) {
      try {
        const errJson = JSON.parse(error.response.data.toString());
        console.error('FastAPI Detailed Error:', errJson);
      } catch (e) {
        // ignore
      }
    }
    throw new Error('Failed to extract face');
  }
};

const FRAUD_DETECTION_URL = 'http://127.0.0.1:8001';
const FACE_VERIFICATION_URL = 'http://127.0.0.1:8002';

const detectFraud = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const start = Date.now();
    const response = await axios.post(`${FRAUD_DETECTION_URL}/predict`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    console.log(`📡 [FastAPI] Forgery Detection took ${Date.now() - start}ms`);

    return response.data;
  } catch (error) {
    console.error('Fraud Detection Error:', error.message);
    if (error.response && error.response.data) {
        console.error('Fraud Detection Detailed Error:', error.response.data);
    }
    // Return a default error object or null so the flow doesn't crash?
    // User wants it stored, so maybe throwing is better to handle it in controller
    return { verdict: "Error", confidence: "0%", raw_score: 0.0 };
  }
};

const verifyFace = async (aadhaarFaceBuffer, panFaceBuffer) => {
  try {
    const formData = new FormData();
    // Append buffers with filenames so FormData knows they are files
    formData.append('img1', aadhaarFaceBuffer, { filename: 'aadhaar_face.jpg' });
    formData.append('img2', panFaceBuffer, { filename: 'pan_face.jpg' });

    // Note: User said endpoint is /verify-face. 
    // Usually deepface/models expect 'img1_path', 'img2_path' or files.
    // Assuming 'files' or specific key names. 
    // Standard fastapi FileUpload usually takes 'file' or specific names.
    // User request: "call this endpoint and give that both images"
    // I'll assume standard keys 'file1' and 'file2' or 'image1', 'image2'?
    // Let's guess 'file1' and 'file2' or check if I can infer.
    // Actually, looking at previous context or standard practices...
    // Let's try appending as 'file1' and 'file2' for now? 
    // User didn't specify the key names.
    // Let's use 'file1' and 'file2' as a safe bet for a custom endpoint, 
    // or maybe the user meant the endpoint accepts a list of files?
    // "give that both images"
    
    // Let's try to match the variable names in the user prompt: "two user image"
    // I will use 'img1' and 'img2' as they are common for comparison tools
    
    const start = Date.now();
    const response = await axios.post(`${FACE_VERIFICATION_URL}/verify-face`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    console.log(`📡 [FastAPI] Face Match took ${Date.now() - start}ms`);

    return response.data;
  } catch (error) {
    console.error('Face Verification Error:', error.message);
    if (error.response && error.response.data) {
        console.error('Verification Detailed Error:', error.response.data);
    }
    return { verified: false, distance: 0, error: "Verification failed" };
  }
};

export { extractAadhaar, extractPan, extractFace, detectFraud, verifyFace };
