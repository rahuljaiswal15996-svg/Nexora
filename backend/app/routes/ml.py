from fastapi import APIRouter, Body, Depends, Query, Request

from app.core.authz import Principal, principal_tenant, principal_user, require_editor, require_viewer
from app.services.governance import GovernanceService
from app.services.ml_lifecycle import MLLifecycleService
from app.services.platform_jobs import queue_experiment_run


router = APIRouter(prefix="/ml", tags=["ml"])
ml_service = MLLifecycleService()
governance_service = GovernanceService()


@router.get("/experiments")
async def list_experiments(
    request: Request,
    project_id: str | None = Query(None),
    principal: Principal = Depends(require_viewer),
):
    tenant_id = principal_tenant(request, principal)
    return {"items": ml_service.list_experiments(tenant_id, project_id)}


@router.post("/experiments")
async def create_experiment(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    experiment = ml_service.create_experiment(
        tenant_id=tenant_id,
        name=(payload.get("name") or "Untitled Experiment").strip(),
        created_by=user_id,
        project_id=payload.get("project_id"),
        description=(payload.get("description") or "").strip(),
    )
    governance_service.log_action(tenant_id, user_id, "create", "experiment", experiment["id"], None, experiment)
    return experiment


@router.get("/experiments/{experiment_id}/runs")
async def list_runs(experiment_id: str, request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": ml_service.list_runs(tenant_id, experiment_id)}


@router.post("/experiments/{experiment_id}/runs")
async def log_run(
    experiment_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    queued = queue_experiment_run(
        tenant_id=tenant_id,
        experiment_id=experiment_id,
        created_by=user_id,
        model_id=payload.get("model_id"),
        params=payload.get("params") or {},
        metrics=payload.get("metrics") or {},
        artifacts=payload.get("artifacts") or {},
        final_status=(payload.get("status") or "completed").strip(),
    )
    run = queued["run"]
    governance_service.log_action(tenant_id, user_id, "run", "experiment", experiment_id, None, run)
    return {
        "status": "queued",
        "job": queued["job"],
        "run": run,
    }


@router.get("/model-serving")
async def list_model_serving(request: Request, principal: Principal = Depends(require_viewer)):
    tenant_id = principal_tenant(request, principal)
    return {"items": ml_service.list_serving_endpoints(tenant_id)}


@router.post("/model-serving")
async def register_model_serving(
    request: Request,
    payload: dict = Body(...),
    principal: Principal = Depends(require_editor),
):
    tenant_id = principal_tenant(request, principal)
    user_id = principal_user(principal)
    serving = ml_service.register_serving_endpoint(
        tenant_id=tenant_id,
        model_version_id=str(payload.get("model_version_id") or "unknown"),
        endpoint_url=(payload.get("endpoint_url") or "").strip(),
        status=(payload.get("status") or "active").strip(),
        metadata=payload.get("metadata") or {},
    )
    governance_service.log_action(tenant_id, user_id, "deploy", "model_serving", serving["id"], None, serving)
    return serving