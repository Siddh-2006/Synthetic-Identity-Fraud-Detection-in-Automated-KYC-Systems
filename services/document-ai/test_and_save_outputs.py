import os
import sys
import cv2
import json
import numpy as np

# Ensure services/document-ai is on search path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from preprocessing.quality import assess_image_quality
from preprocessing.transformer import pdf_to_image, get_document_corners, four_point_transform, enhance_image
from detector.layout import LayoutDetector
from ocr.engine import OCREngine
from face.pipeline import FacePipeline
from validation.validator import FieldValidator
from app.config.settings import settings
from app.routers.document import parse_fields_from_full_text, classify_document_type

def run_pipeline_offline(file_path):
    print(f"Running pipeline on: {file_path}")
    
    # 1. Read file bytes
    with open(file_path, "rb") as f:
        contents = f.read()
        
    filename = os.path.basename(file_path).lower()
    
    # 2. PDF to image conversion
    if filename.endswith(".pdf"):
        contents = pdf_to_image(contents)
            
    # Decode image
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image file format")
        
    # 3. Quality Assessment
    quality_report = assess_image_quality(image)
    
    # 4. Warp Perspective
    corners = get_document_corners(image)
    processed_image = image
    if corners is not None:
        try:
            processed_image = four_point_transform(image, corners.reshape(4, 2))
            print("  [Pipeline] Perspective warp applied successfully.")
        except Exception as e:
            print(f"  [Pipeline] Perspective warp failed: {str(e)}")
            
    # 5. Extract Full Image Text
    ocr_engine = OCREngine()
    full_text_lines = ocr_engine.ocr_full_image(processed_image)
    
    # 6. Document Type Detection
    detector = LayoutDetector(model_dir=settings.model_dir)
    yolo_doc_type, yolo_detections = detector.detect_layout(processed_image)
    doc_type = classify_document_type(full_text_lines, yolo_doc_type)
    
    # 7. Field Layout Detection and Text Extraction
    fields_report = {}
    parsed_heuristics = parse_fields_from_full_text(full_text_lines, doc_type)
    
    field_keys = []
    if doc_type == "aadhaar":
        field_keys = ["photo", "name", "dob", "gender", "aadhaar_number", "address", "qr_code"]
    elif doc_type == "pan":
        field_keys = ["photo", "name", "father_name", "dob", "pan_number", "signature"]
        
    mapped_detections = {det["class"]: det for det in yolo_detections}
    photo_bbox = None
    if "photo" in mapped_detections:
        photo_bbox = mapped_detections["photo"]["bbox"]
    elif "person" in mapped_detections:
        photo_bbox = mapped_detections["person"]["bbox"]
        
    for field in field_keys:
        if field == "photo":
            continue
            
        value = ""
        ocr_conf = 0.0
        det_conf = 0.0
        bbox = None
        source = "Heuristic regex matching"
        
        if field in mapped_detections:
            bbox = mapped_detections[field]["bbox"]
            det_conf = mapped_detections[field]["confidence"]
            xmin, ymin, xmax, ymax = bbox
            if xmax > xmin and ymax > ymin:
                crop = processed_image[ymin:ymax, xmin:xmax]
                crop_enhanced = enhance_image(crop, for_ocr=True)
                val, conf = ocr_engine.ocr_roi(crop_enhanced)
                if val:
                    value = val
                    ocr_conf = conf
                    source = "YOLOv8n + PaddleOCR"

        if not value and field in parsed_heuristics:
            value = parsed_heuristics[field]
            ocr_conf = 0.85
            det_conf = 0.50
            source = "Heuristic Text Parser"

        normalized = FieldValidator.normalize_text(value)
        if field == "gender":
            normalized = FieldValidator.normalize_gender(normalized)
        elif field == "dob":
            normalized = FieldValidator.normalize_date(normalized)
            
        val_status, val_score = FieldValidator.validate_field(field, normalized)
        overall_conf = (0.40 * det_conf) + (0.40 * ocr_conf) + (0.20 * val_score)
        
        if not value:
            val_status = "missing"
            overall_conf = 0.0
            
        fields_report[field] = {
            "value": value,
            "normalized_value": normalized,
            "ocr_confidence": round(ocr_conf, 4),
            "detection_confidence": round(det_conf, 4),
            "overall_confidence": round(overall_conf, 4),
            "validation": val_status,
            "bbox": bbox,
            "source": source
        }
        
    # 8. Face Pipeline
    face_pipeline = FacePipeline()
    face_crop = face_pipeline.crop_face(processed_image, photo_bbox)
    
    # Save face crop locally
    face_filename = f"{os.path.splitext(filename)[0]}_face.jpg"
    
    embedding, emb_model, emb_dim = face_pipeline.get_embedding(face_crop)
    
    report = {
        "document_type": {
            "value": doc_type,
            "confidence": 0.99 if doc_type != "unknown" else 0.0
        },
        "image_quality": {
            "overall_quality": quality_report["overall_quality"],
            "brightness": quality_report["brightness"],
            "blur": quality_report["blur"],
            "contrast": quality_report["contrast"]
        },
        "fields": fields_report,
        "face": {
            "local_face_file": face_filename,
            "embedding_dimension": emb_dim,
            "embedding_model": emb_model,
            "embedding": embedding
        }
    }
    
    return report, face_crop

if __name__ == "__main__":
    test_dir = os.path.join(os.path.dirname(__file__), "test")
    outputs_dir = os.path.join(test_dir, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)
    
    for fname in ["sample_aadhar.pdf", "sample_pan.jpeg"]:
        file_path = os.path.join(test_dir, fname)
        if not os.path.exists(file_path):
            print(f"Skipping {fname} (not found)")
            continue
            
        try:
            report, face_crop = run_pipeline_offline(file_path)
            
            # Save JSON report
            out_json = os.path.join(outputs_dir, f"{os.path.splitext(fname)[0]}_output.json")
            with open(out_json, "w") as f:
                json.dump(report, f, indent=4)
            print(f"  [SUCCESS] Saved JSON report to: {out_json}")
            
            # Save face crop image
            if face_crop is not None:
                out_face = os.path.join(outputs_dir, report["face"]["local_face_file"])
                cv2.imwrite(out_face, face_crop)
                print(f"  [SUCCESS] Saved face crop to: {out_face}")
        except Exception as e:
            print(f"  [ERROR] Failed to process {fname}: {str(e)}")
