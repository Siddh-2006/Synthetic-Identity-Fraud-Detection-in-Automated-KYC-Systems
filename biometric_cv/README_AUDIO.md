# Audio Liveness & Verification Module

This module provides independent audio verification with liveness checks, anti-spoofing, and content matching.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install numpy scipy librosa SpeechRecognition starlette
    ```
    *(Note: `pydub` or `ffmpeg` might be needed for some system configurations, but `librosa` usually handles loading via soundfile/audioread)*.

2.  **Run**:
    ```bash
    python app.py
    ```

3.  **Test**:
    Open [http://localhost:8000/static/index.html](http://localhost:8000/static/index.html).

## Logic Overview

-   **Challenge**: Server generates a random word/digits + token.
-   **Structure**:
    -   `audio_liveness.py`: Logic for ASR (Google Web Speech), basic signal analysis (librosa), and scoring.
    -   `static/index.html`: Client-side recording and submission.
-   **Checks**:
    -   **Replay**: Audio hash check.
    -   **Liveness**: MFCC variance & silence ratio heuristics.
    -   **Content**: Fuzzy match of transcript vs challenge.
    -   **Timing**: Reaction time analysis.

## Customization

To switch from Google ASR to Whisper:
1.  Install `faster-whisper`.
2.  Edit `VerificationResult` in `audio_liveness.py` to use `WhisperModel`.
