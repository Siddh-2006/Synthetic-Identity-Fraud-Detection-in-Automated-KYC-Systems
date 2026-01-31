import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

@dataclass
class KycSessionContext:
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    # Layer 1: Intake
    raw_inputs: Dict[str, Any] = field(default_factory=lambda: {
        "documents": [],  # List of file paths
        "media": [],      # List of video/audio paths
        "fields": {}      # User-submitted identity fields
    })
    intake_metadata: Dict[str, Any] = field(default_factory=lambda: {
        "timestamps": {"submission": None},
        "quality_indicators": {},
        "file_references": []
    })

    # Layer 2: Preprocessing
    processed_artifacts: Dict[str, Any] = field(default_factory=lambda: {
        "cleaned_documents": [],
        "document_region_masks": [],
        "preprocessing_scores": []
    })

    # Layer 3: Field Extraction
    extracted_identity_fields: Dict[str, Any] = field(default_factory=lambda: {
        "name": None,
        "date_of_birth": None,
        "id_number": None,
        "address": None,
        "document_type": None,
        "confidence_scores": {}
    })

    # Layer 4: Authenticity
    authenticity_analysis: Dict[str, Any] = field(default_factory=lambda: {
        "forgery_score": None,
        "authenticity_flags": [],
        "layout_consistency_score": None,
        "artifact_indicators": []
    })

    # Layer 5: Template Validation
    template_validation: Dict[str, Any] = field(default_factory=lambda: {
        "identity_record_match_score": None,
        "field_mismatch_flags": [],
        "template_match_score": None
    })

    # Layer 6: Biometric
    biometric_analysis: Dict[str, Any] = field(default_factory=lambda: {
        "biometric_match_score": None,
        "liveness_score": None,
        "spoof_indicators": [],
        "biometric_quality_score": None,
        "extracted_face": None,
    })

    # Layer 7: Behavioral
    behavioral_analysis: Dict[str, Any] = field(default_factory=lambda: {
        "behavior_anomaly_score": None,
        "device_risk_indicators": [],
        "session_pattern_flags": []
    })

    # Layer 8: Correlation
    correlation_engine: Dict[str, Any] = field(default_factory=lambda: {
        "identity_consistency_score": None,
        "correlation_flags": [],
        "composite_feature_vector": []
    })

    # Layer 9: Risk Scoring
    risk_assessment: Dict[str, Any] = field(default_factory=lambda: {
        "fraud_probability": None,
        "risk_level": None,
        "decision_label": None
    })

    # Layer 10: Explainability
    explainability: Dict[str, Any] = field(default_factory=lambda: {
        "top_risk_factors": [],
        "explanation_text": None,
        "feature_contributions": {}
    })

    # Layer 11: Robustness
    robustness_evaluation: Dict[str, Any] = field(default_factory=lambda: {
        "robustness_scores": {},
        "sensitivity_flags": []
    })

    # Processing metadata
    processing_timestamps: Dict[str, str] = field(default_factory=lambda: {
        "start": datetime.now().isoformat(),
        "end": None
    })
    layer_execution_status: Dict[str, Dict] = field(default_factory=dict)

    def update_layer_status(self, layer_name: str, status: str, error: Optional[str] = None):
        self.layer_execution_status[layer_name] = {
            "status": status,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }

    def finalize(self):
        self.processing_timestamps["end"] = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__
