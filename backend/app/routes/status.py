from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.authz import Principal, principal_tenant, require_viewer
from app.services.platform_jobs import get_job, list_jobs

router = APIRouter()

@router.get("/status")
async def status():
    return {
        "status": "ok",
        "service": "Nexora MVP",
        "detail": "FastAPI backend is running",
    }


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
