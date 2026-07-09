from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

class DocumentTypeInfo(BaseModel):
    value: str
    confidence: float

class ImageQualityInfo(BaseModel):
    overall_quality: float
    brightness: float
    blur: float
    contrast: float

class FieldDetails(BaseModel):
    value: str
    normalized_value: str
    ocr_confidence: float
    detection_confidence: float
    overall_confidence: float
    validation: str  # valid, invalid, warning, missing, low_confidence
    bbox: Optional[List[int]] = None
    source: str

class FaceDetails(BaseModel):
    cloudinary_url: str
    public_id: str
    embedding_dimension: int = 512
    embedding_model: str = "ArcFace"
    embedding: Optional[List[float]] = None

class ModelsInfo(BaseModel):
    layout_detector: str
    ocr: str
    embedding: str

class ProcessingTimeInfo(BaseModel):
    total_ms: int

class DocumentIntelligenceReport(BaseModel):
    document_type: DocumentTypeInfo
    image_quality: ImageQualityInfo
    fields: Dict[str, FieldDetails]
    face: FaceDetails
    models: ModelsInfo
    processing_time: ProcessingTimeInfo
