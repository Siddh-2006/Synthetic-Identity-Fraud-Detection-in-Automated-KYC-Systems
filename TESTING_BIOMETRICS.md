# Biometrics Service: End-to-End Real-Time Testing

This document provides the steps to perform a live "Biometric Scan" and trace the logs through the entire system.

## 1. Environment Preparation

Ensure you have three terminal windows open:

### Terminal 1: Backend
```powershell
cd d:/Echelon/services/biometric/backend
npm start
```
*Look for: `[Challenge]`, `[FaceSubmit]`, `[VoiceSubmit]`*

### Terminal 2: Python CV Microservice
```powershell
cd d:/Echelon/services/biometric/python-microservice
python app.py
```
*Look for: `[Python-CV] Received detection request`*

### Terminal 3: Frontend
```powershell
cd d:/Echelon/services/biometric/frontend
npm run dev
```

## 2. Testing Flow (Real-Time)

1.  **Open Browser**: Navigate to the local URL (typically `http://localhost:5173`).
2.  **Grant Permissions**: Accept Camera and Microphone access.
3.  **Start Challenge**:
    -   Click **"Start Verification"**.
    -   Observe the red dot. **Follow it with your face/gaze.**
    -   Say the phrase displayed on screen clearly.
4.  **Wait for Processing**:
    -   The frontend will record for 5 seconds and then upload.
    -   **Trace Terminal 1**: You should see frame extraction logs.
    -   **Trace Terminal 2**: You should see 10 detection calls.
5.  **View Results**:
    -   Check the Developer Console (F12) in your browser for the final JSON payload.
    -   Or call `GET http://localhost:5000/biometric/result/sample-session-123` manually.

## 3. Logs to Look For

| Stage | Log Message |
| :--- | :--- |
| **Initiation** | `[Challenge] Initiating challenge for session...` |
| **Upload** | `[FaceSubmit] Received video... size: XXX bytes` |
| **Processing** | `[FaceSubmit] Requesting video analysis from Python CV service...` |
| **CV Detection** | `[Python-CV] Analyzing video from URL...` |
| **Completion** | `[FaceSubmit] Face analysis completed` |

## 4. Debugging

-   **No Face Detected**: Ensure you are in a well-lit area.
-   **ffmpeg Error**: Ensure `ffmpeg` is installed and in your system PATH.
-   **Connection Refused**: Ensure the Python service is running on Port 8000.
