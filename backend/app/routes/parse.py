from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from datetime import datetime
from app.services.parser import parse_to_uir
from app.services.uir_service import save_uir

router = APIRouter()

@router.post("/parse")
async def parse(file: UploadFile = File(...), x_tenant_id: str | None = Header(None)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    code = content.decode(errors="ignore")
    language = None
    if file.filename and file.filename.lower().endswith((".py", ".sql", ".sas")):
        if file.filename.lower().endswith('.py'):
            language = 'python'
        else:
            language = 'sql'

    uir = parse_to_uir(code, language)
    # attach filename
    uir['source_filename'] = file.filename

    tenant_id = x_tenant_id or 'default'
    saved = save_uir(tenant_id, uir)

    return {"status": "ok", "uir_id": saved["id"], "created_at": saved["created_at"]}
