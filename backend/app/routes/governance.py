from fastapi import APIRouter, Body, Depends, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_admin, require_viewer
from app.services.governance import GovernanceService


router = APIRouter(prefix="/governance", tags=["governance"])
governance_service = GovernanceService()


@router.get("/audit-log")
async def get_audit_log(
    request: Request,
    resource_type: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": governance_service.list_audit_log(tenant_id, resource_type)}


@router.get("/policies")
async def list_policies(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": governance_service.list_policies(tenant_id)}


@router.post("/policies")
async def create_policy(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    policy = governance_service.create_policy(
        tenant_id=tenant_id,
        name=(payload.get("name") or "Untitled Policy").strip(),
        rule=payload.get("rule") or {},
        enforcement=(payload.get("enforcement") or "advisory").strip(),
    )
    governance_service.log_action(tenant_id, user_id, "create", "governance_policy", policy["id"], None, policy)
    return policy