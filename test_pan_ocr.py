import requests
import sys
import json

URL = "https://synthetic-identity-fraud-detection-in.onrender.com/api/ocr/pan"
IMAGE_PATH = r"D:\KYC\Synthetic-Identity-Fraud-Detection-in-Automated-KYC-Systems\server\uploads\1781435034327-pan.jpeg"

print(f"Testing PAN OCR Endpoint: {URL}")
print(f"Uploading Image: {IMAGE_PATH}")

try:
    with open(IMAGE_PATH, "rb") as f:
        files = {"file": f}
        response = requests.post(URL, files=files)
        
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
