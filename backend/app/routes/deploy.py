from fastapi import APIRouter, Body, Depends, HTTPException, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_admin, require_viewer
from app.services.deployer import DeployerService
from app.services.finops import FinOpsService
from app.services.governance import GovernanceService
from app.services.history import create_history_entry, save_history
from app.services.platform_jobs import queue_deployment, queue_deployment_rollback


router = APIRouter(tags=["deploy"])
deployer_service = DeployerService()
governance_service = GovernanceService()
finops_service = FinOpsService()


@router.get("/deploy/targets")
async def list_targets(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": deployer_service.list_targets(tenant_id)}


@router.post("/deploy/targets")
async def create_target(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    name = (payload.get("name") or "").strip()
    platform_type = (payload.get("platform_type") or "").strip()
    if not name or not platform_type:
        raise HTTPException(status_code=400, detail="name and platform_type are required")

    target = deployer_service.create_target(
        tenant_id=tenant_id,
        name=name,
        platform_type=platform_type,
        endpoint_config=payload.get("endpoint_config") or {},
        credentials_id=payload.get("credentials_id"),
    )
    governance_service.log_action(tenant_id, user_id, "create", "deployment_target", target["id"], None, target)
    return target


@router.get("/deployments")
async def list_deployments(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": deployer_service.list_deployments(tenant_id)}


@router.get("/deployments/{deployment_id}")
async def get_deployment(deployment_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    deployment = deployer_service.get_deployment(deployment_id, tenant_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.post("/deploy")
async def deploy(
    request: Request,
    payload: dict = Body(...),
    run_mode: str | None = None,
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    pipeline_id = payload.get("pipeline_id") or payload.get("artifact_id")
    target_platform = (payload.get("target_platform") or payload.get("platform") or "container").strip()
    execution_mode = (run_mode or payload.get("run_mode") or "local").strip().lower()
    if not pipeline_id:
        raise HTTPException(status_code=400, detail="pipeline_id or artifact_id is required")
    if execution_mode not in {"local", "remote"}:
        raise HTTPException(status_code=400, detail="run_mode must be 'local' or 'remote'")

    queued = queue_deployment(
        tenant_id=tenant_id,
        pipeline_id=str(pipeline_id),
        target_platform=target_platform,
        created_by=user_id,
        target_id=payload.get("target_id"),
        target_config=payload.get("target_config") or {},
        run_mode=execution_mode,
    )
    deployment = queued["deployment"]

    now = deployment.get("deployed_at")
    entry = create_history_entry({
        "timestamp": now,
        "filename": str(pipeline_id),
        "summary": f"deployed: {payload.get('notes', '')}",
        "original_content": "",
        "converted_content": "",
    })
    save_history(entry)

    if payload.get("estimated_cost") is not None:
        finops_service.record_cost(
            tenant_id=tenant_id,
            period=payload.get("period") or now[:7],
            service_type="deployment",
            quantity=1,
            cost=float(payload.get("estimated_cost") or 0),
            metadata={"deployment_id": deployment["id"], "target_platform": target_platform},
        )

    governance_service.log_action(tenant_id, user_id, "deploy", "pipeline", str(pipeline_id), None, deployment)
    return {
        "status": "queued_remote" if execution_mode == "remote" else "queued",
        "tenant_id": tenant_id,
        "job": queued["job"],
        "deployment": deployment,
        "deployed_at": now,
    }


@router.post("/deployments/{deployment_id}/rollback")
async def rollback_deployment(
    deployment_id: str,
    request: Request,
    payload: dict = Body(default={}),
    principal: Principal = Depends(require_admin),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    execution_mode = (payload.get("run_mode") or "local").strip().lower()
    if execution_mode not in {"local", "remote"}:
        raise HTTPException(status_code=400, detail="run_mode must be 'local' or 'remote'")

    try:
        queued = queue_deployment_rollback(
            tenant_id=tenant_id,
            deployment_id=deployment_id,
            created_by=user_id,
            run_mode=execution_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    governance_service.log_action(tenant_id, user_id, "rollback", "deployment", deployment_id, None, queued["deployment"])
    return {
        "status": "queued_remote" if execution_mode == "remote" else "queued",
        "tenant_id": tenant_id,
        "job": queued["job"],
        "deployment": queued["deployment"],
    }
