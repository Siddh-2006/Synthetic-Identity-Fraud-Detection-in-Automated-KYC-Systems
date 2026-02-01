import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const FASTAPI_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

const extractAadhaar = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const response = await axios.post(`${FASTAPI_URL}/api/ocr/aadhaar`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

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

    const response = await axios.post(`${FASTAPI_URL}/api/ocr/pan`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

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

    const response = await axios.post(`${FASTAPI_URL}/api/extraction/face`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      responseType: 'arraybuffer', // Get image buffer
    });

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

export { extractAadhaar, extractPan, extractFace };
