import crypto from 'crypto';

export class KycSessionContext {
    constructor() {
        this.session_id = crypto.randomUUID();

        // Layer 1: Intake
        this.raw_inputs = {
            documents: [], // Array of file buffers or paths
            media: [],     // Array of audio/video buffers or paths
            fields: {}     // User-entered identity fields
        };
        this.intake_metadata = {
            timestamps: {
                submission: new Date().toISOString()
            },
            quality_indicators: {},
            file_references: []
        };

        // Layer 2: Preprocessing
        this.processed_artifacts = {
            cleaned_documents: [],
            document_region_masks: [],
            preprocessing_scores: []
        };

        // Layer 3: Field Extraction
        this.extracted_identity_fields = {
            name: null,
            date_of_birth: null,
            id_number: null,
            address: null,
            document_type: null,
            confidence_scores: {}
        };

        // Layer 4: Authenticity
        this.authenticity_analysis = {
            forgery_score: null,
            authenticity_flags: [],
            layout_consistency_score: null,
            artifact_indicators: []
        };

        // Layer 5: Template Validation
        this.template_validation = {
            identity_record_match_score: null,
            field_mismatch_flags: [],
            template_match_score: null
        };

        // Layer 6: Biometric
        this.biometric_analysis = {
            biometric_match_score: null,
            liveness_score: null,
            spoof_indicators: [],
            biometric_quality_score: null,
            extracted_face: null, // Cropped face image
        };

        // Layer 7: Behavioral
        this.behavioral_analysis = {
            behavior_anomaly_score: null,
            device_risk_indicators: [],
            session_pattern_flags: []
        };

        // Layer 8: Correlation
        this.correlation_engine = {
            identity_consistency_score: null,
            correlation_flags: [],
            composite_feature_vector: []
        };

        // Layer 9: Risk Scoring
        this.risk_assessment = {
            fraud_probability: null,
            risk_level: null,
            decision_label: null
        };

        // Layer 10: Explainability
        this.explainability = {
            top_risk_factors: [],
            explanation_text: null,
            feature_contributions: {}
        };

        // Layer 11: Robustness
        this.robustness_evaluation = {
            robustness_scores: {},
            sensitivity_flags: []
        };

        // Layer 12: Reporting
        this.pipeline_metadata = {
            processing_timestamps: {
                start: new Date().toISOString(),
                end: null
            },
            layer_execution_status: {} // To track successes/failures per layer
        };
    }

    addLog(layerName, status, error = null) {
        this.pipeline_metadata.layer_execution_status[layerName] = {
            status,
            error: error ? error.message : null,
            timestamp: new Date().toISOString()
        };
    }

    finalize() {
        this.pipeline_metadata.processing_timestamps.end = new Date().toISOString();
    }
}
