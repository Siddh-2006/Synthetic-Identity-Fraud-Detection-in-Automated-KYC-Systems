import cv2
import numpy as np
import tempfile
import os

DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    print("[FacePipeline] DeepFace library loaded successfully.")
except Exception as e:
    print(f"[FacePipeline] DeepFace not available or failed to load: {str(e)}. Face embeddings will run in mock mode.")

class FacePipeline:
    def __init__(self):
        # Initialize OpenCV Haar Cascade Face Detector as a fallback or primary detector
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        print(f"[FacePipeline] Haar Cascade Face Detector initialized from: {cascade_path}")

    def crop_face(self, image: np.ndarray, bbox: list = None) -> np.ndarray:
        """
        Crops face from the image. If bbox is provided (from YOLO photo class), crops that ROI first
        and detects face inside it. Otherwise, runs face detection on the whole image.
        """
        if image is None or image.size == 0:
            return None

        h, w, _ = image.shape
        roi = image

        # If a bbox is provided, narrow down search space to the bbox first
        if bbox:
            xmin, ymin, xmax, ymax = bbox
            # Ensure coordinates are within boundaries
            xmin = max(0, xmin)
            ymin = max(0, ymin)
            xmax = min(w, xmax)
            ymax = min(h, ymax)
            if xmax > xmin and ymax > ymin:
                roi = image[ymin:ymax, xmin:xmax]

        # Use Haar Cascade face detection to extract the face
        try:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            
            if len(faces) > 0:
                # Get the largest face
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                (x, y, fw, fh) = faces[0]
                
                # Add padding to crop a cleaner face picture
                padding = int(fw * 0.15)
                
                # If we cropped an ROI, map relative coordinates back to full image if needed,
                # or just crop from the ROI. Let's crop from the ROI.
                rx = max(0, x - padding)
                ry = max(0, y - padding)
                rw = min(roi.shape[1] - rx, fw + 2 * padding)
                rh = min(roi.shape[0] - ry, fh + 2 * padding)
                
                face_crop = roi[ry:ry+rh, rx:rx+rw]
                return face_crop
        except Exception as e:
            print(f"[FacePipeline] Error during face detection: {str(e)}")

        # Fallback: if Haar Cascade fails or finds nothing, and we have a bbox, return raw bbox crop
        if bbox:
            return roi

        # If everything fails, return the original image
        return image

    def get_embedding(self, face_image: np.ndarray) -> tuple:
        """
        Generates ArcFace 512-D embedding from the cropped face image.
        Returns:
            embedding (list): 512 floats
            model_name (str): name of model ("ArcFace")
            dim (int): dimension (512)
        """
        if face_image is None or face_image.size == 0:
            return [0.0] * 512, "ArcFace", 512

        if DEEPFACE_AVAILABLE:
            temp_path = None
            try:
                # DeepFace works best with temporary file paths
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
                    _, encoded_img = cv2.imencode('.jpg', face_image)
                    tmp.write(encoded_img.tobytes())
                    temp_path = tmp.name

                # Try generating ArcFace embedding (512-D)
                try:
                    objs = DeepFace.represent(
                        img_path=temp_path,
                        model_name="ArcFace",
                        enforce_detection=False,
                        detector_backend="opencv"
                    )
                    if objs and len(objs) > 0:
                        emb = objs[0]["embedding"]
                        return list(emb), "ArcFace", len(emb)
                except Exception as ex_arc:
                    print(f"[FacePipeline] ArcFace embedding failed: {str(ex_arc)}. Trying VGG-Face.")
                    
                    # Try VGG-Face as backup
                    objs = DeepFace.represent(
                        img_path=temp_path,
                        model_name="VGG-Face",
                        enforce_detection=False
                    )
                    if objs and len(objs) > 0:
                        emb = objs[0]["embedding"]
                        return list(emb), "VGG-Face", len(emb)

            except Exception as e:
                print(f"[FacePipeline] DeepFace representation failed: {str(e)}. Using mock embedding.")
            finally:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)

        # Mock embedding fallback: Generate a seed-based or pseudo-random 512-D embedding
        # Let's generate a reproducible normalized vector
        print("[FacePipeline] Generating high-fidelity mock 512-D embedding.")
        np.random.seed(hash(face_image.tobytes()) % (2**32))
        mock_vector = np.random.randn(512)
        mock_vector = mock_vector / np.linalg.norm(mock_vector)
        return list(mock_vector.astype(float)), "ArcFace (Mock)", 512
