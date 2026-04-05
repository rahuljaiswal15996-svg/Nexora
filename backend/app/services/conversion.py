def convert_code(code: str) -> str:
    """Basic conversion engine for MVP."""
    converted = code.replace("PROC SQL", "SELECT")
    converted = converted.replace("proc sql", "select")
    return converted
