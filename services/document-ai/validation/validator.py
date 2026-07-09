import re
import unicodedata
from datetime import datetime

class FieldValidator:
    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Cleans whitespace, normalizes unicode characters.
        """
        if not text:
            return ""
        # Normalize unicode (NFKC)
        normalized = unicodedata.normalize("NFKC", text)
        # Strip outer whitespace and compress inner whitespace
        cleaned = " ".join(normalized.split())
        return cleaned

    @staticmethod
    def normalize_gender(text: str) -> str:
        """
        Standardizes gender strings.
        """
        if not text:
            return ""
        clean = text.strip().upper()
        if "FEMALE" in clean or clean == "F":
            return "Female"
        if "MALE" in clean or clean == "M":
            return "Male"
        if "TRANS" in clean or "OTHER" in clean or clean == "T" or clean == "O":
            return "Other"
        return text

    @staticmethod
    def normalize_date(text: str) -> str:
        """
        Normalizes dates into a standard DD-MM-YYYY or DD/MM/YYYY format.
        """
        if not text:
            return ""
        
        clean = text.strip()
        # Find all date matches using regular expressions
        # Formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
        match = re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', clean)
        if match:
            # Already in DD-MM-YYYY or DD/MM/YYYY format
            day, month, year = match.groups()
            return f"{day}-{month}-{year}"
            
        match_reverse = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', clean)
        if match_reverse:
            # YYYY-MM-DD format
            year, month, day = match_reverse.groups()
            return f"{day}-{month}-{year}"
            
        return clean

    @classmethod
    def validate_aadhaar_number(cls, number: str) -> tuple:
        """
        Validates the Aadhaar number format.
        Returns:
            status (str): "valid" or "invalid"
            score (float): 1.0 or 0.0
        """
        if not number:
            return "missing", 0.0
        
        clean = number.strip().replace(" ", "")
        # Aadhaar is 12 digits
        if len(clean) == 12 and clean.isdigit():
            return "valid", 1.0
        return "invalid", 0.0

    @classmethod
    def validate_pan_number(cls, number: str) -> tuple:
        """
        Validates PAN number format.
        Returns:
            status (str): "valid" or "invalid"
            score (float): 1.0 or 0.0
        """
        if not number:
            return "missing", 0.0
            
        clean = number.strip().upper().replace(" ", "")
        # PAN pattern: 5 letters, 4 digits, 1 letter
        pan_pattern = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')
        if pan_pattern.match(clean):
            return "valid", 1.0
        return "invalid", 0.0

    @classmethod
    def validate_field(cls, field_name: str, value: str) -> tuple:
        """
        Validates individual fields.
        Returns:
            validation_status (str): "valid", "invalid", "warning", "missing", "low_confidence"
            validation_score (float): score [0.0 - 1.0]
        """
        if not value:
            return "missing", 0.0
            
        normalized = cls.normalize_text(value)
        if not normalized:
            return "missing", 0.0

        if field_name == "aadhaar_number" or field_name == "uid":
            return cls.validate_aadhaar_number(normalized)
            
        if field_name == "pan_number":
            return cls.validate_pan_number(normalized)

        if field_name == "dob" or field_name == "date_of_birth":
            # Check if looks like a date (contains digits and hyphens/slashes)
            if re.search(r'\d', normalized) and any(char in normalized for char in ['-', '/']):
                return "valid", 1.0
            return "warning", 0.5

        if field_name == "gender":
            norm_g = cls.normalize_gender(normalized)
            if norm_g in ["Male", "Female", "Other"]:
                return "valid", 1.0
            return "warning", 0.5

        if field_name == "name" or field_name == "father_name":
            # Should not contain digits or many special characters
            if re.search(r'\d', normalized):
                return "invalid", 0.0
            if len(normalized) < 3:
                return "warning", 0.5
            return "valid", 1.0

        # Default for generic fields
        return "valid", 1.0
