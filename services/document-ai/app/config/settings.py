import os
from dotenv import load_dotenv

# Load environmental variables
load_dotenv()

try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except ImportError:
        # Fallback to simple python class if Pydantic settings are not installed
        class BaseSettings:
            pass

class Settings(BaseSettings):
    cloudinary_cloud_name: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    cloudinary_api_key: str = os.getenv("CLOUDINARY_API_KEY", "")
    cloudinary_api_secret: str = os.getenv("CLOUDINARY_API_SECRET", "")
    
    model_dir: str = os.getenv("MODEL_DIR", "weights")
    upload_dir: str = os.getenv("UPLOAD_DIR", "temp_uploads")

settings = Settings()
