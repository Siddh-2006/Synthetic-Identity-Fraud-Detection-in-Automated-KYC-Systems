import requests
import sys
import json

URL = "https://synthetic-identity-fraud-detection-in-uk7i.onrender.com/predict"
IMAGE_PATH = r"D:\KYC\Synthetic-Identity-Fraud-Detection-in-Automated-KYC-Systems\server\uploads\1781435034327-pan.jpeg"

print(f"Testing Doc Preprocessing (Fraud Detection) Endpoint: {URL}")
print(f"Uploading Image: {IMAGE_PATH}")

try:
    with open(IMAGE_PATH, "rb") as f:
        files = {"file": f}
        # Render free tier might take a minute to wake up, adding timeout
        response = requests.post(URL, files=files, timeout=120)
        
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
