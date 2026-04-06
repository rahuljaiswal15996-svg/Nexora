from fastapi import APIRouter, Body, Depends, HTTPException, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_admin, require_editor, require_viewer
from app.services.governance import GovernanceService
from app.services.project_service import ProjectService


router = APIRouter(prefix="/projects", tags=["projects"])
project_service = ProjectService()
governance_service = GovernanceService()


@router.get("")
async def list_projects(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": project_service.list_projects(tenant_id)}


@router.post("")
async def create_project(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    project = project_service.create_project(
        tenant_id=tenant_id,
        name=name,
        owner_id=user_id,
        description=(payload.get("description") or "").strip(),
        metadata=payload.get("metadata") or {},
    )
    governance_service.log_action(tenant_id, user_id, "create", "project", project["id"], None, project)
    return project


@router.get("/{project_id}")
async def get_project(project_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    project = project_service.get_project(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/{project_id}/members")
async def add_project_member(
    project_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    member_user_id = (payload.get("user_id") or "").strip()
    member_role = (payload.get("role") or "viewer").strip().lower()
    if not member_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    member = project_service.add_member(project_id, tenant_id, member_user_id, member_role)
    governance_service.log_action(tenant_id, user_id, "grant", "project_member", member["id"], None, member)
    return member


@router.get("/{project_id}/workspaces")
async def list_project_workspaces(project_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": project_service.list_workspaces(project_id, tenant_id)}


@router.post("/{project_id}/workspaces")
async def create_workspace(
    project_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    workspace = project_service.create_workspace(project_id, tenant_id, name, (payload.get("description") or "").strip())
    governance_service.log_action(tenant_id, user_id, "create", "workspace", workspace["id"], None, workspace)
    return workspace