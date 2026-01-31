import re

def validate_id_format(id_value: str, pattern: str) -> bool:
    if not id_value:
        return False
    return bool(re.match(pattern, id_value))

def validate_date_format(date_str: str) -> bool:
    # Simplified regex for ISO date
    pattern = r'^\d{4}-\d{2}-\d{2}$'
    return bool(re.match(pattern, date_str))
