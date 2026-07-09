import cv2
import numpy as np
import tempfile
import os
import uuid

CLOUDINARY_AVAILABLE = False
try:
    import cloudinary
    import cloudinary.uploader
    CLOUDINARY_AVAILABLE = True
    print("[Cloudinary] Cloudinary SDK imported successfully.")
except ImportError:
    print("[Cloudinary] Cloudinary SDK not available. Using local/mock upload fallback.")

class CloudinaryUploader:
    def __init__(self, cloud_name: str = "", api_key: str = "", api_secret: str = ""):
        self.is_configured = False
        
        if CLOUDINARY_AVAILABLE and cloud_name and api_key and api_secret:
            try:
                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=api_key,
                    api_secret=api_secret,
                    secure=True
                )
                self.is_configured = True
                print("[Cloudinary] Cloudinary configured successfully.")
            except Exception as e:
                print(f"[Cloudinary] Configuration failed: {str(e)}")

    def upload_image(self, image: np.ndarray, folder: str = "deepkyc/faces") -> tuple:
        """
        Uploads the given image array to Cloudinary.
        Returns:
            url (str): secure URL of the uploaded image
            public_id (str): public ID of the uploaded asset
        """
        if image is None or image.size == 0:
            return "", ""

        if self.is_configured and CLOUDINARY_AVAILABLE:
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
                    _, encoded_img = cv2.imencode('.jpg', image)
                    tmp.write(encoded_img.tobytes())
                    temp_path = tmp.name

                print(f"[Cloudinary] Uploading cropped face to Cloudinary (folder: {folder})...")
                upload_result = cloudinary.uploader.upload(
                    temp_path,
                    folder=folder,
                    overwrite=True,
                    resource_type="image"
                )
                
                url = upload_result.get("secure_url", "")
                public_id = upload_result.get("public_id", "")
                print(f"[Cloudinary] Upload complete. URL: {url}")
                return url, public_id
                
            except Exception as e:
                print(f"[Cloudinary] Upload failed: {str(e)}. Falling back to mock URL.")
            finally:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)

        # Mock Upload Fallback
        mock_id = f"mock_face_{uuid.uuid4().hex[:8]}"
        mock_url = f"https://res.cloudinary.com/demo/image/upload/v1600000000/{mock_id}.jpg"
        print(f"[Cloudinary] Mock upload generated. URL: {mock_url}")
        return mock_url, mock_id
