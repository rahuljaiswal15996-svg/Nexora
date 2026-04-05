from fastapi import APIRouter
from app.services.validation import validate_all

router = APIRouter()


@router.post("/validate")
async def validate(payload: dict):
    """Expect JSON: {"reference": {...}, "target": {...}, "thresholds": {...}}"""
    ref = payload.get("reference") or {}
    tgt = payload.get("target") or {}
    thresholds = payload.get("thresholds")
    result = validate_all(ref, tgt, thresholds)
    return {"status": "ok", "result": result}
