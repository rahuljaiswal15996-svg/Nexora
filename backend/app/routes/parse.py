from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, UploadFile
from datetime import datetime
from app.core.authz import require_editor
from app.services.parser import parse_to_uir
from app.services.uir_service import save_uir

router = APIRouter()


def _detect_source_language(filename: str | None, requested: str | None) -> str | None:
    if requested and requested.lower() != "auto":
        return requested.lower()
    if not filename:
        return None
    lower_name = filename.lower()
    if lower_name.endswith(".py"):
        return "python"
    if lower_name.endswith(".sql"):
        return "sql"
    if lower_name.endswith(".sas"):
        return "sas"
    if lower_name.endswith(".r"):
        return "r"
    if lower_name.endswith(".scala"):
        return "scala"
    return None

@router.post("/parse")
async def parse(
    file: UploadFile = File(...),
    source_language: str | None = Form(None),
    x_tenant_id: str | None = Header(None),
    principal: dict = Depends(require_editor),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    code = content.decode(errors="ignore")
    language = _detect_source_language(file.filename, source_language)

    uir = parse_to_uir(code, language)
    uir["source_filename"] = file.filename

    tenant_id = principal.get("tenant_id") or x_tenant_id or "default"
    saved = save_uir(tenant_id, uir)

    return {
        "status": "ok",
        "uir_id": saved["id"],
        "created_at": saved["created_at"],
        "source_language": uir.get("language"),
        "uir": uir,
    }
