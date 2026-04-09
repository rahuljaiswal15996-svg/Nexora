from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_editor, require_viewer
from app.services.broker_observability import broker_dlq_snapshot, broker_observability_snapshot
from app.services.platform_jobs import cancel_job, get_job, list_jobs, retry_job

router = APIRouter()

@router.get("/status")
async def status():
    return {
        "status": "ok",
        "service": "Nexora MVP",
        "detail": "FastAPI backend is running",
        "broker": broker_observability_snapshot(),
    }


@router.get("/status/broker/dlq")
async def broker_dlq(
    queue_kind: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    return broker_dlq_snapshot(queue_kind, limit=limit)


@router.get("/jobs")
async def get_jobs(
    request: Request,
    status: str | None = Query(None),
    job_type: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": list_jobs(tenant_id, status, job_type)}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    job = get_job(job_id, tenant_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_job_status(job_id: str, request: Request, principal: Principal = Depends(require_editor)):
    tenant_id = principal_tenant(request, principal)
    try:
        job = cancel_job(job_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "ok", "job": job}


@router.post("/jobs/{job_id}/retry")
async def retry_job_status(job_id: str, request: Request, principal: Principal = Depends(require_editor)):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    try:
        queued = retry_job(job_id, tenant_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not queued:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "ok", **queued}
