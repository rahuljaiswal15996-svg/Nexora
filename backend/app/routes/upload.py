from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Header

from app.models.schemas import ConversionResponse
from app.services.comparison import compare_code
from app.services.conversion_engine import convert_code
from app.services.idempotency import (
    get_conversion_by_request_id,
    create_conversion_record,
    store_conversion_result,
)
from app.services.history import create_history_entry, save_history

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return {
        "filename": file.filename,
        "size": len(content),
    }

@router.post("/convert", response_model=ConversionResponse)
async def convert(
    file: UploadFile = File(...),
    x_tenant_id: str | None = Header(None),
    x_idempotency_key: str | None = Header(None),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    tenant_id = x_tenant_id or "default"

    # Idempotency: return existing successful conversion if present
    if x_idempotency_key:
        existing = get_conversion_by_request_id(x_idempotency_key)
        if existing and existing.get("status") == "success" and existing.get("result_json"):
            return existing.get("result_json")

    code = content.decode(errors="ignore")

    # Create a conversion record when the client provided an idempotency key
    conversion_id = None
    if x_idempotency_key:
        conversion_id = create_conversion_record(x_idempotency_key, tenant_id)

    # Perform conversion (rule-based then LLM fallback)
    result = convert_code(code, language=None, tenant_id=tenant_id, request_id=x_idempotency_key)

    # Persist conversion result for idempotency/audit
    if conversion_id:
        try:
            store_conversion_result(conversion_id, result, metrics=result.get("comparison"))
        except Exception:
            pass

    # Persist a user-friendly history entry
    history_entry = create_history_entry(
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "filename": file.filename,
            "summary": "Changed" if result["comparison"]["changed"] else "No change",
            "original_content": result["original"],
            "converted_content": result["converted"],
        }
    )
    save_history(history_entry)

    return result
