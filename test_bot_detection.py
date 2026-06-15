import requests
import json

URL = "https://synthetic-identity-fraud-detection-in-5owb.onrender.com/predict"

payload = {
    "events": [
        {"type": "mousemove", "x": 100, "y": 200, "timestamp": 1234567890},
        {"type": "click", "x": 105, "y": 205, "timestamp": 1234567900}
    ],
    "metadata": {
        "userAgent": "Mozilla/5.0"
    }
}

print(f"Testing Bot Detection Endpoint: {URL}")

try:
    response = requests.post(URL, json=payload, timeout=60)
    print(f"\nStatus Code: {response.status_code}")
    
    try:
        data = response.json()
        print("Response JSON:")
        print(json.dumps(data, indent=4))
    except Exception:
        print("Response Text (Not JSON):")
        print(response.text)
except Exception as e:
    print(f"Error: {e}")
