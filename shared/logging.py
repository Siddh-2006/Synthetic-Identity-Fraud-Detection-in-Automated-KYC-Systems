import logging
import json
from datetime import datetime

def get_logger(service_name: str):
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger

def log_structured_event(service_name, event_type, details):
    event = {
        "timestamp": datetime.now().isoformat(),
        "service": service_name,
        "event_type": event_type,
        "details": details
    }
    print(json.dumps(event))
