class KycError(Exception):
    """Base class for all KYC platform errors."""
    def __init__(self, message, service_name=None):
        super().__init__(message)
        self.service_name = service_name

class ValidationError(KycError):
    """Raised when input validation fails."""
    pass

class ProcessingError(KycError):
    """Raised when a processing layer fails."""
    pass

class CorrelationError(KycError):
    """Raised when correlation fails."""
    pass
