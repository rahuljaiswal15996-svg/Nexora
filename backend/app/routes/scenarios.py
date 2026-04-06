from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_editor, require_viewer
from app.services.governance import GovernanceService
from app.services.scenario_service import ScenarioService


router = APIRouter(prefix="/scenarios", tags=["scenarios"])
scenario_service = ScenarioService()
governance_service = GovernanceService()


@router.get("")
async def list_scenarios(
    request: Request,
    project_id: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": scenario_service.list_scenarios(tenant_id, project_id)}


@router.post("")
async def create_scenario(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    scenario = scenario_service.create_scenario(
        tenant_id=tenant_id,
        name=name,
        description=(payload.get("description") or "").strip(),
        project_id=payload.get("project_id"),
        base_uir_id=payload.get("base_uir_id"),
    )
    governance_service.log_action(tenant_id, user_id, "create", "scenario", scenario["id"], None, scenario)
    return scenario


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    scenario = scenario_service.get_scenario(scenario_id, tenant_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.post("/{scenario_id}/versions")
async def create_scenario_version(
    scenario_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    version = (payload.get("version") or "").strip()
    if not version:
        raise HTTPException(status_code=400, detail="version is required")
    scenario_version = scenario_service.create_version(
        tenant_id=tenant_id,
        scenario_id=scenario_id,
        version=version,
        created_by=user_id,
        uir_id=payload.get("uir_id"),
        converted_code=payload.get("converted_code") or "",
        metadata=payload.get("metadata") or {},
    )
    governance_service.log_action(tenant_id, user_id, "version", "scenario", scenario_id, None, scenario_version)
    return scenario_version


@router.post("/compare")
async def compare_scenario_versions(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    version_a = payload.get("version_a")
    version_b = payload.get("version_b")
    if not version_a or not version_b:
        raise HTTPException(status_code=400, detail="version_a and version_b are required")
    try:
        return scenario_service.compare_versions(tenant_id, str(version_a), str(version_b))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc