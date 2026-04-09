from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_editor, require_viewer
from app.services.catalog import CatalogService
from app.services.governance import GovernanceService
from app.services.platform_jobs import queue_quality_check


router = APIRouter(prefix="/catalog", tags=["catalog"])
catalog_service = CatalogService()
governance_service = GovernanceService()


@router.get("/datasets")
async def list_datasets(
    request: Request,
    q: str | None = Query(None),
    project_id: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": catalog_service.list_datasets(tenant_id, q, project_id)}


@router.post("/datasets")
async def register_dataset(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    name = (payload.get("name") or "").strip()
    source_path = (payload.get("source_path") or "").strip()
    if not name or not source_path:
        raise HTTPException(status_code=400, detail="name and source_path are required")
    dataset = catalog_service.register_dataset(
        tenant_id=tenant_id,
        name=name,
        source_path=source_path,
        project_id=payload.get("project_id"),
        connection_id=payload.get("connection_id"),
        schema=payload.get("schema") or [],
        metadata=payload.get("metadata") or {},
        tags=payload.get("tags") or [],
        row_count=payload.get("row_count"),
        size_bytes=payload.get("size_bytes"),
        quality_score=payload.get("quality_score"),
    )
    governance_service.log_action(tenant_id, user_id, "register", "dataset", dataset["id"], None, dataset)
    return dataset


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    dataset = catalog_service.get_dataset(dataset_id, tenant_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/datasets/{dataset_id}/lineage")
async def get_dataset_lineage(dataset_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": catalog_service.get_lineage(dataset_id, tenant_id)}


@router.post("/datasets/{dataset_id}/lineage")
async def add_dataset_lineage(
    dataset_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    source_dataset_id = payload.get("source_dataset_id")
    if not source_dataset_id:
        raise HTTPException(status_code=400, detail="source_dataset_id is required")
    lineage = catalog_service.add_lineage(tenant_id, str(source_dataset_id), dataset_id, payload.get("transform_id"))
    governance_service.log_action(tenant_id, user_id, "link", "dataset_lineage", lineage["id"], None, lineage)
    return lineage


@router.get("/datasets/{dataset_id}/quality")
async def get_dataset_quality(dataset_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": catalog_service.get_quality_checks(dataset_id, tenant_id)}


@router.post("/datasets/{dataset_id}/quality-checks")
async def add_quality_check(
    dataset_id: str,
    request: Request,
    payload: dict = Body(...),
    run_mode: str | None = Query(None),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    check_name = (payload.get("check_name") or "").strip()
    if not check_name:
        raise HTTPException(status_code=400, detail="check_name is required")
    execution_mode = (run_mode or payload.get("run_mode") or "local").strip().lower()
    if execution_mode not in {"local", "remote"}:
        raise HTTPException(status_code=400, detail="run_mode must be 'local' or 'remote'")
    queued = queue_quality_check(
        tenant_id=tenant_id,
        dataset_id=dataset_id,
        check_name=check_name,
        created_by=user_id,
        metrics=payload.get("metrics") or {},
        frequency=(payload.get("frequency") or "manual").strip(),
        final_status=(payload.get("status") or "passed").strip(),
        run_mode=execution_mode,
    )
    record = queued["quality_check"]
    governance_service.log_action(tenant_id, user_id, "check", "dataset_quality", record["id"], None, record)
    return {
        "status": "queued_remote" if execution_mode == "remote" else "queued",
        "job": queued["job"],
        "quality_check": record,
    }