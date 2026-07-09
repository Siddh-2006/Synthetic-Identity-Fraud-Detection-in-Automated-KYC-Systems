import os
import cv2
import numpy as np
import re

ULTRALYTICS_AVAILABLE = False
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
    print("[Detector] Ultralytics YOLO loaded successfully.")
except ImportError:
    print("[Detector] Ultralytics not available. Using heuristic layout parser fallback.")

class LayoutDetector:
    def __init__(self, model_dir: str = "weights"):
        self.model_path = os.path.join(model_dir, "best.pt")
        self.model = None
        self.is_real_model = False

        if ULTRALYTICS_AVAILABLE:
            try:
                # Check if custom model exists
                if os.path.exists(self.model_path):
                    print(f"[Detector] Loading custom YOLOv8 model from {self.model_path}")
                    self.model = YOLO(self.model_path)
                    self.is_real_model = True
                else:
                    print("[Detector] Custom model weights not found. Initializing generic yolov8n.pt")
                    self.model = YOLO("yolov8n.pt")
                    self.is_real_model = True
            except Exception as e:
                print(f"[Detector] Error initializing YOLO model: {str(e)}. Falling back to heuristics.")
                self.model = None
                self.is_real_model = False

    def detect_layout(self, image: np.ndarray) -> tuple:
        """
        Detects document type and crops semantic field regions.
        Returns:
            doc_type (str): "aadhaar", "pan", or "unknown"
            detections (list): list of dicts containing 'class', 'bbox' [xmin, ymin, xmax, ymax], and 'confidence'
        """
        h, w, _ = image.shape
        
        if self.is_real_model and self.model is not None:
            try:
                results = self.model(image, verbose=False)
                detections = []
                doc_type_counts = {"aadhaar": 0, "pan": 0}
                
                # YOLO classes map from custom training or default yolov8
                # We assume a standard labeling or map classes based on standard names
                # For this application, if custom weights are loaded:
                # Aadhaar classes: photo, name, dob, gender, aadhaar_number, address, qr_code
                # PAN classes: photo, name, father_name, dob, pan_number, signature
                for box in results[0].boxes:
                    cls_id = int(box.cls[0])
                    label = self.model.names[cls_id].lower()
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    bbox = [int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])]
                    
                    detections.append({
                        "class": label,
                        "bbox": bbox,
                        "confidence": conf
                    })
                    
                    # Count indicators of document type
                    if label in ["aadhaar_number", "qr_code"]:
                        doc_type_counts["aadhaar"] += 1
                    elif label in ["pan_number", "signature", "father_name"]:
                        doc_type_counts["pan"] += 1
                
                # Deduce document type
                if doc_type_counts["aadhaar"] > doc_type_counts["pan"]:
                    doc_type = "aadhaar"
                elif doc_type_counts["pan"] > doc_type_counts["aadhaar"]:
                    doc_type = "pan"
                else:
                    doc_type = "unknown"
                    
                return doc_type, detections
            except Exception as e:
                print(f"[Detector] YOLO inference failed: {str(e)}. Falling back to heuristics.")

        # Heuristic layout detection fallback
        return self._detect_heuristically(image)

    def _detect_heuristically(self, image: np.ndarray) -> tuple:
        """
        Fallback parser that performs document type analysis and outputs heuristic layouts.
        """
        # We will determine the document type inside the main pipeline after doing a full-image OCR pass,
        # but here we generate default boxes representing standard locations on a generic card layout.
        h, w, _ = image.shape
        
        # Standard relative box layouts for IDs:
        # Aadhaar: photo on top-left, name/dob in the center, UID at the bottom
        # PAN: photo on mid-left, signature on bottom-left, names on top/middle, PAN number in the center
        
        # We will return list of hypothetical bounding boxes which will be mapped during OCR phase.
        # This acts as scaffolding coordinates to keep the pipeline executing.
        
        # We'll default to "unknown" here and let the main app OCR pass refine the document type.
        # Once doc type is refined, standard bounding boxes are applied.
        detections = []
        
        # Generic Photo box (usually top-right or top-left, let's assume left side 15% to 45% width, 20% to 65% height)
        detections.append({
            "class": "photo",
            "bbox": [int(w * 0.08), int(h * 0.18), int(w * 0.40), int(h * 0.65)],
            "confidence": 0.95
        })
        
        return "unknown", detections
