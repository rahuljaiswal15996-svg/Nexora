from datetime import datetime, timezone

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
from app.services.pipeline_blueprint import build_conversion_pipeline_artifacts, persist_pipeline_blueprint
from app.services.history import create_history_entry, save_history
from app.services.migration_program import MigrationProgramService

router = APIRouter()
migration_program_service = MigrationProgramService()


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
    project_id: str | None = Form(None),
    workspace_id: str | None = Form(None),
    x_tenant_id: str | None = Header(None),
    x_idempotency_key: str | None = Header(None),
    principal: dict = Depends(require_editor),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    tenant_id = principal.get("tenant_id") or x_tenant_id or "default"
    user_id = str(principal.get("user_id") or "anonymous")
    user_role = str(principal.get("role") or "editor")
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
    pipeline_artifacts = build_conversion_pipeline_artifacts(
        code,
        result["converted"],
        result.get("source_language") or detected_source_language,
        result.get("target_language") or requested_target_language,
        file.filename,
    )
    source_pipeline = persist_pipeline_blueprint(tenant_id, pipeline_artifacts["source_pipeline"])
    converted_pipeline = persist_pipeline_blueprint(tenant_id, pipeline_artifacts["converted_pipeline"])
    try:
        migration_program = migration_program_service.bootstrap_program(
            tenant_id=tenant_id,
            user_id=user_id,
            user_role=user_role,
            artifact_name=file.filename,
            original_code=code,
            converted_code=result["converted"],
            source_language=str(result.get("source_language") or detected_source_language or "auto"),
            target_language=str(result.get("target_language") or requested_target_language),
            comparison=result.get("comparison") or {},
            source_pipeline=source_pipeline,
            converted_pipeline=converted_pipeline,
            project_id=(project_id or "").strip() or None,
            workspace_id=(workspace_id or "").strip() or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result["source_pipeline"] = source_pipeline
    result["converted_pipeline"] = converted_pipeline
    result["migration_program"] = migration_program
    result.setdefault("meta", {})["migration_summary"] = {
        **pipeline_artifacts["migration_summary"],
        "project_id": migration_program["project"].get("id"),
        "workspace_id": migration_program.get("project_context", {}).get("active_workspace_id"),
        "notebook_id": migration_program["notebook"].get("id"),
        "target_dataset_ids": [dataset.get("id") for dataset in migration_program["catalog"].get("target_datasets", [])],
    }

    # Persist conversion result for idempotency/audit
    if conversion_id:
        try:
            store_conversion_result(conversion_id, result, metrics=result.get("comparison"))
        except Exception:
            pass

    # Persist a user-friendly history entry
    history_entry = create_history_entry(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
