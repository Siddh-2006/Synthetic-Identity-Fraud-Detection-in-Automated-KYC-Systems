import cv2
import numpy as np

PADDLE_AVAILABLE = False
try:
    import logging
    # Suppress verbose paddleocr logs since show_log=False is deprecated in newer versions
    logging.getLogger("ppocr").setLevel(logging.WARNING)
    import os
    # Disable oneDNN to avoid NotImplementedError on CPU in PaddlePaddle 3.x
    os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
    from paddleocr import PaddleOCR
    import paddle
    if paddle.__version__.startswith("3."):
        print("[OCR] PaddlePaddle 3.x detected on CPU. Disabling PaddleOCR to prevent oneDNN NotImplementedError crashes. Falling back to EasyOCR.")
        PADDLE_AVAILABLE = False
    else:
        PADDLE_AVAILABLE = True
        print("[OCR] PaddleOCR libraries imported successfully.")
except Exception:
    print("[OCR] PaddleOCR not available. Falling back to EasyOCR.")

# We will verify and load easyocr
import easyocr

class OCREngine:
    def __init__(self):
        self.paddle_ocr = None
        self.easy_ocr = None
        
        # Lazy load standard engines on first OCR call to optimize startup time
        self._initialized = False

    def _lazy_init(self):
        if self._initialized:
            return
            
        if PADDLE_AVAILABLE:
            try:
                print("[OCR] Initializing PaddleOCR Mobile...")
                self.paddle_ocr = PaddleOCR(lang='en', use_textline_orientation=True)
            except Exception as e:
                print(f"[OCR] Failed to initialize PaddleOCR: {str(e)}. Using EasyOCR.")
                self.paddle_ocr = None
                
        if self.paddle_ocr is None:
            try:
                print("[OCR] Initializing EasyOCR Reader (English)...")
                self.easy_ocr = easyocr.Reader(['en'], gpu=False)
            except Exception as e:
                print(f"[OCR] Failed to initialize EasyOCR Reader: {str(e)}")
                
        self._initialized = True

    def ocr_roi(self, roi_image: np.ndarray) -> tuple:
        """
        Extracts text and confidence from a cropped ROI region.
        Returns:
            text (str): extracted string
            confidence (float): confidence value in [0, 1]
        """
        self._lazy_init()
        
        if roi_image is None or roi_image.size == 0:
            return "", 0.0

        # Run PaddleOCR if loaded
        if self.paddle_ocr is not None:
            try:
                result = self.paddle_ocr.ocr(roi_image)
                if result and result[0]:
                    page_result = result[0]
                    texts = page_result.get('rec_texts', [])
                    confs = page_result.get('rec_scores', [])
                    full_text = " ".join(texts).strip()
                    avg_conf = float(np.mean(confs)) if confs else 0.0
                    return full_text, avg_conf
            except Exception as e:
                print(f"[OCR] PaddleOCR inference error: {str(e)}. Falling back to EasyOCR.")

        # Run EasyOCR
        if self.easy_ocr is not None:
            try:
                # detail=0 returns just strings, detail=1 returns (bbox, text, conf)
                results = self.easy_ocr.readtext(roi_image)
                if results:
                    texts = [res[1] for res in results]
                    confs = [res[2] for res in results]
                    full_text = " ".join(texts).strip()
                    avg_conf = float(np.mean(confs)) if confs else 0.0
                    return full_text, avg_conf
            except Exception as e:
                print(f"[OCR] EasyOCR inference error: {str(e)}")

        return "", 0.0

    def ocr_full_image(self, image: np.ndarray) -> list:
        """
        Performs OCR on the entire image and returns all detected text lines.
        Useful for fallback classification and heuristic details.
        """
        self._lazy_init()
        lines = []
        
        if image is None or image.size == 0:
            return lines

        if self.paddle_ocr is not None:
            try:
                result = self.paddle_ocr.ocr(image)
                if result and result[0]:
                    page_result = result[0]
                    lines = page_result.get('rec_texts', [])
                    return lines
            except Exception as e:
                print(f"[OCR] Full image PaddleOCR error: {str(e)}")

        if self.easy_ocr is not None:
            try:
                results = self.easy_ocr.readtext(image)
                for res in results:
                    lines.append(res[1])
                return lines
            except Exception as e:
                print(f"[OCR] Full image EasyOCR error: {str(e)}")

        return lines
