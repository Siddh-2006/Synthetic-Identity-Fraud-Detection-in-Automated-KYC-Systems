# Biometrics Service Contract

## Base URL
`/services/biometric`

## Endpoints

### 1. Initiate Challenge
`POST /biometric/challenge/initiate`
- **Request Body**: `{ "session_id": "string" }`
- **Response**: 
  ```json
  {
    "challenge_id": "string",
    "face_challenge": {
      "type": "movement",
      "target_coords": { "x": "float", "y": "float" },
      "duration": 5
    },
    "voice_phrase": "string",
    "expires_at": "ISO8601"
  }
  ```

### 2. Submit Face Video
`POST /biometric/face/submit`
- **Request Body**: Multipart Form Data
  - `session_id`: string
  - `challenge_id`: string
  - `video_file`: File (webm/mp4)
- **Response**:
  ```json
  {
    "movement_score": "float",
    "movement_passed": "boolean",
    "blink_count": "int",
    "pose_delta": "float",
    "spoof_risk": "float",
    "media_url": "string"
  }
  ```

### 3. Submit Voice Audio
`POST /biometric/voice/submit`
- **Request Body**: Multipart Form Data
  - `session_id`: string
  - `challenge_id`: string
  - `audio_file`: File (wav/mp3)
- **Response**:
  ```json
  {
    "phrase_match": "boolean",
    "phrase_score": "float",
    "voice_spoof_risk": "float",
    "transcription": "string",
    "media_url": "string"
  }
  ```

### 4. Get Aggregate Result
`GET /biometric/result/:session_id`
- **Response**:
  ```json
  {
    "face": { ... },
    "voice": { ... },
    "combined_biometric_score": "float",
    "flags": ["string"],
    "media_urls": ["string"]
  }
  ```
