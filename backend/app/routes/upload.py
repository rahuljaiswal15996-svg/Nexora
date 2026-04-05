from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, UploadFile

from app.core.authz import require_editor
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


def _detect_source_language(filename: str | None, requested: str | None) -> str | None:
    if requested and requested.lower() != "auto":
        return requested.lower()
    if not filename:
        return None

    lower_name = filename.lower()
    suffix_map = {
        ".py": "python",
        ".sql": "sql",
        ".sas": "sas",
        ".r": "r",
        ".scala": "scala",
        ".sh": "shell",
        ".ps1": "powershell",
    }
    for suffix, language in suffix_map.items():
        if lower_name.endswith(suffix):
            return language
    return None

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _principal: dict = Depends(require_editor),
):
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
    source_language: str | None = Form(None),
    target_language: str = Form("python"),
    x_tenant_id: str | None = Header(None),
    x_idempotency_key: str | None = Header(None),
    principal: dict = Depends(require_editor),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    tenant_id = principal.get("tenant_id") or x_tenant_id or "default"
    detected_source_language = _detect_source_language(file.filename, source_language)
    requested_target_language = (target_language or "python").lower()

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
    result = convert_code(
        code,
        language=detected_source_language,
        target_language=requested_target_language,
        tenant_id=tenant_id,
        request_id=x_idempotency_key,
    )

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
            "summary": (
                f"{result.get('source_language') or 'auto'} to {result.get('target_language') or requested_target_language}"
            ),
            "original_content": result["original"],
            "converted_content": result["converted"],
        }
    )
    save_history(history_entry)

    return result
