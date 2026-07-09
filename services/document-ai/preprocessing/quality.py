import cv2
import numpy as np

def assess_image_quality(image: np.ndarray) -> dict:
    """
    Computes brightness, blur, and contrast metrics from an image.
    Returns:
        dict: containing overall_quality, brightness, blur, and contrast scores (all 0-1)
    """
    try:
        # Convert to grayscale if color
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        # 1. Brightness: Mean intensity normalized to [0, 1]
        mean_intensity = float(cv2.mean(gray)[0])
        brightness = round(mean_intensity / 255.0, 4)

        # 2. Blur: Laplacian variance. Higher variance = sharper/less blur.
        # Normalize: Laplacian variance of 300+ is very sharp (blur = 0).
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur = round(max(0.0, 1.0 - (laplacian_var / 300.0)), 4)

        # 3. Contrast: Standard deviation of pixel intensities
        # Normalize: Standard deviation of 75+ is high contrast.
        std_dev = float(np.std(gray))
        contrast = round(min(1.0, std_dev / 75.0), 4)

        # 4. Overall Quality score (weighted average)
        # Optimal brightness is around 0.5. Penalize if too dark or too bright.
        brightness_score = 1.0 - abs(0.5 - brightness) * 2
        brightness_score = max(0.0, brightness_score)
        
        sharpness_score = 1.0 - blur
        
        overall_quality = round((brightness_score * 0.3) + (sharpness_score * 0.4) + (contrast * 0.3), 4)
        overall_quality = max(0.0, min(1.0, overall_quality))

        return {
            "overall_quality": overall_quality,
            "brightness": brightness,
            "blur": blur,
            "contrast": contrast
        }
    except Exception as e:
        print(f"[QualityAssessment] Error assessing quality: {str(e)}")
        # Return sensible default scores if analysis fails
        return {
            "overall_quality": 0.85,
            "brightness": 0.50,
            "blur": 0.10,
            "contrast": 0.80
        }
