from fastapi import APIRouter, Body, Depends, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_editor, require_viewer
from app.services.collaboration import CollaborationService
from app.services.governance import GovernanceService


router = APIRouter(prefix="/collaboration", tags=["collaboration"])
collaboration_service = CollaborationService()
governance_service = GovernanceService()


@router.get("/comments")
async def list_comments(
    request: Request,
    resource_type: str = Query(...),
    resource_id: str = Query(...),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": collaboration_service.list_comments(tenant_id, resource_type, resource_id)}


@router.post("/comments")
async def add_comment(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    comment = collaboration_service.add_comment(
        tenant_id=tenant_id,
        resource_type=(payload.get("resource_type") or "dataset").strip(),
        resource_id=str(payload.get("resource_id") or ""),
        user_id=user_id,
        text=(payload.get("text") or "").strip(),
    )
    governance_service.log_action(tenant_id, user_id, "comment", comment["resource_type"], comment["resource_id"], None, comment)
    return comment


@router.get("/reviews")
async def list_reviews(
    request: Request,
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": collaboration_service.list_review_requests(tenant_id, resource_type, resource_id)}


@router.post("/reviews")
async def create_review(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    review = collaboration_service.create_review_request(
        tenant_id=tenant_id,
        resource_type=(payload.get("resource_type") or "pipeline").strip(),
        resource_id=str(payload.get("resource_id") or ""),
        requested_by=user_id,
        assigned_to=payload.get("assigned_to"),
        comments=payload.get("comments") or [],
    )
    governance_service.log_action(tenant_id, user_id, "review_request", review["resource_type"], review["resource_id"], None, review)
    return review


@router.post("/reviews/{review_id}/resolve")
async def resolve_review(
    review_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    review = collaboration_service.resolve_review_request(
        tenant_id=tenant_id,
        review_id=review_id,
        status=(payload.get("status") or "resolved").strip(),
        comment=payload.get("comment"),
    )
    if review:
        governance_service.log_action(tenant_id, user_id, "resolve", "review_request", review_id, None, review)
    return review or {"detail": "Review request not found"}