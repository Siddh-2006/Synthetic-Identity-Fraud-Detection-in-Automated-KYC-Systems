import os
import json
import joblib
import pandas as pd
import numpy as np

class BotSimulator:
    def __init__(self, processed_dir, model_path):
        self.processed_dir = processed_dir
        self.model_path = model_path
        
        # Load artifacts
        self.scaler_pipeline = joblib.load(os.path.join(processed_dir, "scaler_pipeline.pkl"))
        with open(os.path.join(processed_dir, "selected_features.json"), "r") as f:
            self.selected_features = json.load(f)
        with open(os.path.join(processed_dir, "label_encoder.json"), "r") as f:
            self.label_map = json.load(f)
            self.reverse_label_map = {v: k for k, v in self.label_map.items()}
            
        self.model = joblib.load(model_path)

    def predict_mock_behavior(self, behavior_dict):
        """
        Takes raw features, scales them, and returns prediction + confidence.
        """
        # 1. Create DataFrame with ordered features
        df_raw = pd.DataFrame([behavior_dict])
        
        # Ensure only selected features are used and in correct order
        # If any missing, fill with 0
        X_raw = pd.DataFrame(columns=self.selected_features)
        for col in self.selected_features:
            X_raw.at[0, col] = behavior_dict.get(col, 0)
        
        # 2. Apply scaling
        X_scaled_df = X_raw.copy()
        for col, scaler in self.scaler_pipeline.items():
            if col in X_scaled_df.columns:
                X_scaled_df[col] = scaler.transform(X_scaled_df[[col]])
        
        X_scaled = X_scaled_df.values
        
        # 3. Predict
        # XGBoost expect the same feature names if trained on DF, else just values
        # Let's use the DF to preserve feature names if needed
        probs = self.model.predict_proba(X_scaled_df)[0]
        prediction_idx = np.argmax(probs)
        confidence = probs[prediction_idx]
        label_name = self.reverse_label_map[prediction_idx]
        
        return {
            'label': label_name,
            'confidence': float(confidence),
            'probabilities': {self.reverse_label_map[i]: float(p) for i, p in enumerate(probs)}
        }

if __name__ == "__main__":
    PROCESSED_DIR = "c:\\Users\\shah siddh\\Downloads\\web_bot_detection_dataset\\processed_data"
    MODEL_PATH = "c:\\Users\\shah siddh\\Downloads\\web_bot_detection_dataset\\model_artifacts\\xgb_model.pkl"
    
    simulator = BotSimulator(PROCESSED_DIR, MODEL_PATH)
    
    # Define a Moderate Bot behavioral profile
    # Based on statistical analysis of the training set
    moderate_bot_behavior = {
        'mouse_path_length': 15800.0,
        'mouse_total_clicks': 14.0,
        'log_total_requests': 68.0,
        'log_unique_url_count': 13.5,
        'log_repeat_url_ratio': 0.80,
        'log_std_request_interval': 0.05, # Very consistent
        'log_html_ratio': 0.0,
        'log_image_ratio': 1.0
    }
    
    print("--- Simulating Moderate Bot Behavior ---")
    print(f"Mock Data Features: {moderate_bot_behavior}")
    
    result = simulator.predict_mock_behavior(moderate_bot_behavior)
    
    print(f"\nPrediction Results:")
    print(f"Detected Class: {result['label']}")
    print(f"Confidence Score: {result['confidence']:.4f}")
    print("\nFull Class Probabilities:")
    for label, prob in result['probabilities'].items():
        print(f" - {label}: {prob:.4f}")
