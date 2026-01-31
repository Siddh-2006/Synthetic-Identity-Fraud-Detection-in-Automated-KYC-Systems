import os
import json
import joblib
import pandas as pd
import numpy as np
from feature_builder import MouseFeatureEngineer, WebLogFeatureEngineer

class RealTimeInferenceEngine:
    def __init__(self, artifacts_dir):
        # Load artifacts
        self.model = joblib.load(os.path.join(artifacts_dir, "xgb_model.pkl"))
        self.scalers = joblib.load(os.path.join(artifacts_dir, "scaler_pipeline.pkl"))
        
        with open(os.path.join(artifacts_dir, "selected_features.json"), "r") as f:
            self.selected_features = json.load(f)
            
        with open(os.path.join(artifacts_dir, "label_encoder.json"), "r") as f:
            self.label_map = json.load(f)
            self.reverse_label_map = {v: k for k, v in self.label_map.items()}

        self.mouse_engineer = MouseFeatureEngineer()
        self.log_engineer = WebLogFeatureEngineer()

    def _reconstruct_features(self, events, metadata):
        """
        Processes raw event list into the exact feature vector used in training.
        """
        # Separate events
        mouse_events = []
        log_entries = []
        
        # Live events come in a slightly different format than Stage 1 raw files
        # We need to map them to the format MouseFeatureEngineer/WebLogFeatureEngineer expect.
        for e in events:
            if e['type'] in ['move', 'click']:
                # MouseFeatureEngineer expects: {'type': 'move'|'click_l', 'x', 'y', 't'}
                event_type = e['type']
                if event_type == 'click':
                    event_type = f"click_{e.get('button', 'l')}"
                
                mouse_events.append({
                    'type': event_type,
                    'x': e.get('x'),
                    'y': e.get('y'),
                    't': e.get('timestamp') / 1000.0 # Convert ms to s
                })
            elif e['type'] in ['navigation', 'load', 'scroll']:
                # WebLogFeatureEngineer expects entries with:
                # timestamp (string), url, status, size, referer, user_agent
                # Note: For our live demo, we might only have url and timestamp
                log_entries.append({
                    'timestamp': pd.to_datetime(e['timestamp'], unit='ms').strftime('%d/%b/%Y:%H:%M:%S'),
                    'url': e.get('url', '/'),
                    'status': '200',
                    'size': '0',
                    'referer': metadata.get('referer', '-'),
                    'user_agent': metadata.get('user_agent', 'unknown')
                })

        # Compute Features
        mouse_features = self.mouse_engineer.compute_features(mouse_events)
        log_features = self.log_engineer.compute_features(log_entries)
        
        # Flatten and Prefix (naming must match training exactly!)
        combined = {}
        for k, v in mouse_features.items():
            combined[f"mouse_{k}"] = v
        for k, v in log_features.items():
            combined[f"log_{k}"] = v
            
        return combined

    def _to_json_serializable(self, val):
        if isinstance(val, dict):
            return {k: self._to_json_serializable(v) for k, v in val.items()}
        if isinstance(val, list):
            return [self._to_json_serializable(v) for v in val]
        if isinstance(val, (np.int64, np.int32)):
            return int(val)
        if isinstance(val, (np.float64, np.float32)):
            return float(val)
        return val

    def predict(self, events, metadata):
        # 1. Feature Extraction
        raw_features = self._reconstruct_features(events, metadata)
        
        # 2. Build ordered feature vector
        X_df = pd.DataFrame([np.zeros(len(self.selected_features))], columns=self.selected_features)
        for feat in self.selected_features:
            if feat in raw_features:
                X_df.at[0, feat] = raw_features[feat]
        
        # 3. Apply Scaling
        X_scaled_df = X_df.copy()
        for col, scaler in self.scalers.items():
            if col in X_scaled_df.columns:
                X_scaled_df[col] = scaler.transform(X_scaled_df[[col]])
        
        # 4. Inference
        probs = self.model.predict_proba(X_scaled_df)[0]
        pred_idx = np.argmax(probs)
        label = self.reverse_label_map[pred_idx]
        
        result = {
            'prediction': label,
            'confidence': float(probs[pred_idx]),
            'class_probabilities': {self.reverse_label_map[i]: float(p) for i, p in enumerate(probs)},
            'features_extracted': raw_features
        }
        
        return self._to_json_serializable(result)
