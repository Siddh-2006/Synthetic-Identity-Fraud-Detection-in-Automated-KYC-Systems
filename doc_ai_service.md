# DOCUMENT_AI_SERVICE_SPEC.md

# DeepKYC -- Document AI Microservice Specification (CPU Optimized)

> Version: 1.0 Target: Hackathon MVP + Production-ready architecture
> Service: Document AI

## 1. Objective

Build a lightweight, CPU-first Document AI microservice that: - Accepts
Aadhaar/PAN (image or PDF) - Detects document type - Detects semantic
fields using YOLOv8n - Extracts text using PaddleOCR Mobile - Validates
extracted fields - Extracts the document face - Generates ArcFace
embeddings - Uploads cropped face to Cloudinary - Returns a structured
Document Intelligence Report

This service **does not** perform: - Face matching - Liveness - Voice
verification - Bot detection - Final trust scoring

Those belong to separate microservices.

------------------------------------------------------------------------

# 2. Architecture

``` text
React
   │
Node.js API Gateway
   │
Document AI (FastAPI)
   │
MongoDB
   │
Cloudinary
```

Node.js orchestrates requests only.

------------------------------------------------------------------------

# 3. Technology Stack

  Component          Choice
  ------------------ -----------------------
  API                FastAPI
  Detection          YOLOv8n
  OCR                PaddleOCR Mobile
  Image Processing   OpenCV
  PDF                PyMuPDF
  Face Embedding     InsightFace (ArcFace)
  Storage            Cloudinary
  Config             Pydantic
  Deployment         Docker

Why these? - CPU friendly - Small models - Easy deployment - Modular -
Replaceable later

------------------------------------------------------------------------

# 4. Folder Structure

``` text
services/document-ai/
│
├── app/
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── config/
│   ├── schemas/
│   └── utils/
│
├── preprocessing/
├── detector/
├── ocr/
├── validation/
├── face/
├── cloudinary/
├── models/
├── weights/
├── Dockerfile
└── requirements.txt
```

Single Responsibility Principle: - preprocessing = image enhancement -
detector = YOLO only - ocr = OCR only - validation = validation only -
face = extraction + embedding only - cloudinary = uploads only

------------------------------------------------------------------------

# 5. Pipeline

``` text
Upload
 ↓
Validate File
 ↓
PDF → Image
 ↓
Quality Assessment
 ↓
OpenCV Preprocessing
 ↓
Document Type Detection
 ↓
YOLOv8n Layout Detection
 ↓
Crop ROIs
 ↓
PaddleOCR Mobile
 ↓
Validation Engine
 ↓
Face Extraction
 ↓
ArcFace Embedding
 ↓
Cloudinary Upload
 ↓
Document Intelligence Report
```

------------------------------------------------------------------------

# 6. YOLO Classes

## Aadhaar

-   photo
-   name
-   dob
-   gender
-   aadhaar_number
-   address
-   qr_code

## PAN

-   photo
-   name
-   father_name
-   dob
-   pan_number
-   signature

YOLO detects semantic fields---not generic text.

------------------------------------------------------------------------

# 7. OCR

Use PaddleOCR Mobile.

Each cropped ROI is processed independently.

Return: - text - OCR confidence

Never guess missing values.

------------------------------------------------------------------------

# 8. Validation

Normalize: - whitespace - unicode - dates - gender

Validate: - PAN regex - Aadhaar format - required fields

Statuses: - valid - invalid - warning - missing - low_confidence

------------------------------------------------------------------------

# 9. Face Pipeline

YOLO photo ROI → optional alignment with InsightFace detector → ArcFace
embedding (512-D) → Upload aligned crop to Cloudinary

Store: - URL - embedding - embedding model - embedding dimension

------------------------------------------------------------------------

# 10. Confidence Engine

Overall confidence:

overall = 0.40 × detection_confidence + 0.40 × ocr_confidence + 0.20 ×
validation_score

Return for every field.

------------------------------------------------------------------------

# 11. JSON Response

``` json
{
  "document_type":{
    "value":"aadhaar",
    "confidence":0.99
  },
  "image_quality":{
    "overall_quality":0.95,
    "brightness":0.91,
    "blur":0.04,
    "contrast":0.88
  },
  "fields":{
    "name":{
      "value":"Rahul Sharma",
      "normalized_value":"Rahul Sharma",
      "ocr_confidence":0.98,
      "detection_confidence":0.99,
      "overall_confidence":0.986,
      "validation":"valid",
      "bbox":[120,220,510,260],
      "source":"YOLOv8n + PaddleOCR"
    }
  },
  "face":{
    "cloudinary_url":"",
    "public_id":"",
    "embedding_dimension":512,
    "embedding_model":"ArcFace"
  },
  "models":{
    "layout_detector":"YOLOv8n",
    "ocr":"PaddleOCR Mobile",
    "embedding":"ArcFace"
  },
  "processing_time":{
    "total_ms":1200
  }
}
```

------------------------------------------------------------------------

# 12. API

## POST /api/document/process

Input: - jpg - jpeg - png - pdf

Output: Document Intelligence Report

## GET /health

Returns service status.

## GET /ready

Returns model readiness.

------------------------------------------------------------------------

# 13. Performance Targets

-   CPU only
-   YOLO loaded once
-   PaddleOCR loaded once
-   ArcFace loaded once
-   No repeated initialization
-   Inference target: 1--2 s/document

------------------------------------------------------------------------

# 14. Docker

-   Slim Python base image
-   Mount model weights
-   Environment variables
-   Health check
-   Expose FastAPI port

------------------------------------------------------------------------

# 15. Future Extensions

Add support for: - Passport - Driving License - Voter ID - Utility Bills

without changing pipeline.

------------------------------------------------------------------------

# 16. Microservice Boundaries

Document AI: - preprocessing - layout - OCR - validation - face
extraction - embedding

Biometric AI: - live selfie - liveness - face comparison - voice
verification

Bot Detection: - mouse dynamics - typing dynamics - XGBoost

------------------------------------------------------------------------

# 17. Coding Standards

-   SOLID principles
-   Dependency injection
-   Type hints
-   Async FastAPI
-   Structured logging
-   No duplicated logic
-   One responsibility per module
-   Configuration via environment variables
