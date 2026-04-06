from fastapi import APIRouter, Body, Depends, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_admin, require_viewer
from app.services.finops import FinOpsService
from app.services.governance import GovernanceService


router = APIRouter(prefix="/finops", tags=["finops"])
finops_service = FinOpsService()
governance_service = GovernanceService()


@router.get("/quotas")
async def list_quotas(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": finops_service.list_quotas(tenant_id)}


@router.post("/quotas")
async def upsert_quota(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    quota = finops_service.upsert_quota(
        tenant_id=tenant_id,
        resource_type=(payload.get("resource_type") or "pipelines").strip(),
        limit_value=float(payload.get("limit_value") or 0),
        unit=payload.get("unit"),
    )
    governance_service.log_action(tenant_id, user_id, "upsert", "tenant_quota", quota["id"], None, quota)
    return quota


@router.get("/costs")
async def get_cost_summary(
    request: Request,
    period: str | None = Query(None),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    return finops_service.get_cost_summary(tenant_id, period)


@router.post("/costs")
async def record_cost(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    record = finops_service.record_cost(
        tenant_id=tenant_id,
        period=(payload.get("period") or "current").strip(),
        service_type=(payload.get("service_type") or "compute").strip(),
        quantity=float(payload.get("quantity") or 0),
        cost=float(payload.get("cost") or 0),
        metadata=payload.get("metadata") or {},
    )
    governance_service.log_action(tenant_id, user_id, "record", "cost", record["id"], None, record)
    return record