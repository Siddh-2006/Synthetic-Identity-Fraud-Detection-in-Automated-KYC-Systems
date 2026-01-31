from flask import Flask, request, jsonify
from flask_cors import CORS
from inference_engine import RealTimeInferenceEngine
import os

app = Flask(__name__)
CORS(app) # Enable CORS for React frontend

# Initialize Inference Engine
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
engine = RealTimeInferenceEngine(ARTIFACTS_DIR)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ready", "model": "loaded"})

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'events' not in data:
        return jsonify({"error": "No behavior events provided"}), 400
    
    events = data.get('events', [])
    metadata = data.get('metadata', {})
    
    try:
        result = engine.predict(events, metadata)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Running on 5001 to avoid conflict with other services if any
    app.run(host='0.0.0.0', port=5001, debug=True)
