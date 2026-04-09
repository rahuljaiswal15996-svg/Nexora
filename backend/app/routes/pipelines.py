from fastapi import APIRouter, Body, Depends, HTTPException, Request
from typing import Any
from app.core.authz import require_editor, require_viewer
from app.services.pipeline_authoring import list_node_types, validate_pipeline_dag
from app.services.project_service import ProjectService
from app.services.pipeline_runner import (
    assign_pipeline_scope,
    backfill_pipeline_scope_columns,
    create_pipeline,
    create_remote_run,
    get_pipeline,
    get_run_status,
    list_pipelines,
    list_pipeline_runs,
    list_unscoped_pipelines,
    list_run_node_executions,
    list_run_node_logs,
    start_pipeline_run,
    update_pipeline,
)

router = APIRouter()
project_service = ProjectService()


def _tenant_for_request(request: Request, principal: dict) -> str:
    return str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))


def _telemetry_links(run_id: str) -> dict[str, str]:
    return {
        "run": f"/pipelines/runs/{run_id}",
        "nodes": f"/pipelines/runs/{run_id}/nodes",
        "logs": f"/pipelines/runs/{run_id}/logs",
    }


def _get_run_or_404(run_id: str, tenant_id: str) -> dict[str, Any]:
    run = get_run_status(run_id)
    if not run or str(run.get("tenant_id") or "") != tenant_id:
        raise HTTPException(status_code=404, detail="run not found")
    run["telemetry"] = _telemetry_links(run_id)
    return run


def _validated_dag_or_400(dag: Any) -> dict[str, Any]:
    validation = validate_pipeline_dag(dag)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "pipeline dag validation failed",
                "validation": validation,
            },
        )
    return validation

@router.post("/pipelines")
async def create(payload: dict = Body(...), principal: dict = Depends(require_editor)):
    tenant = principal.get("tenant_id") or "default"
    name = payload.get("name") or "unnamed"
    dag = payload.get("dag") or payload.get("dag_json") or {}
    validation = _validated_dag_or_400(dag)
    created = create_pipeline(tenant, name, validation["normalized_dag"])
    return {
        "status": "ok",
        "pipeline_id": created["id"],
        "created_at": created["created_at"],
        "validation": validation,
    }


@router.put("/pipelines/{pipeline_id}")
async def update(
    pipeline_id: str,
    payload: dict = Body(...),
    principal: dict = Depends(require_editor),
):
    tenant = str(principal.get("tenant_id") or "default")
    existing = get_pipeline(pipeline_id)
    if not existing:
        raise HTTPException(status_code=404, detail="pipeline not found")

    name = payload.get("name") or existing.get("name") or "unnamed"
    dag = payload.get("dag") or payload.get("dag_json") or existing.get("dag_json") or {}
    validation = _validated_dag_or_400(dag)
    updated = update_pipeline(pipeline_id, tenant, validation["normalized_dag"], name=name)
    if not updated:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return {
        "status": "ok",
        "pipeline_id": pipeline_id,
        "updated_at": updated.get("updated_at") or updated.get("created_at"),
        "validation": validation,
        "pipeline": updated,
    }


@router.get("/pipelines")
async def list_pipeline_inventory(
    request: Request,
    project_id: str | None = None,
    workspace_id: str | None = None,
    principal: dict = Depends(require_viewer),
):
    tenant = _tenant_for_request(request, principal)
    return {
        "items": list_pipelines(
            tenant,
            project_id=(project_id or "").strip() or None,
            workspace_id=(workspace_id or "").strip() or None,
        )
    }


@router.post("/pipelines/backfill-scope")
async def backfill_pipeline_inventory_scope(
    request: Request,
    include_existing: bool = False,
    principal: dict = Depends(require_editor),
):
    tenant = _tenant_for_request(request, principal)
    result = backfill_pipeline_scope_columns(tenant_id=tenant, include_existing=include_existing)
    return {"status": "ok", **result}


@router.get("/pipelines/scope-gaps")
async def get_pipeline_scope_gap_report(
    request: Request,
    limit: int = 100,
    principal: dict = Depends(require_viewer),
):
    tenant = _tenant_for_request(request, principal)
    return list_unscoped_pipelines(tenant, limit=limit)


@router.put("/pipelines/{pipeline_id}/scope")
async def update_pipeline_scope(
    pipeline_id: str,
    request: Request,
    payload: dict = Body(...),
    principal: dict = Depends(require_editor),
):
    tenant = _tenant_for_request(request, principal)
    project_id = str(payload.get("project_id") or "").strip()
    workspace_id = str(payload.get("workspace_id") or "").strip()
    if not project_id or not workspace_id:
        raise HTTPException(status_code=400, detail="project_id and workspace_id are required")

    project = project_service.get_project(project_id, tenant)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    workspace = next(
        (item for item in project_service.list_workspaces(project_id, tenant) if str(item.get("id") or "") == workspace_id),
        None,
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="workspace not found")

    updated = assign_pipeline_scope(
        pipeline_id,
        tenant,
        project_id=project_id,
        workspace_id=workspace_id,
        project_name=str(project.get("name") or "").strip() or None,
        workspace_name=str(workspace.get("name") or "").strip() or None,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return {"status": "ok", "pipeline": updated}


@router.get("/pipelines/node-catalog")
async def get_node_catalog(_principal: dict = Depends(require_viewer)):
    return {"items": list_node_types()}


@router.post("/pipelines/validate")
async def validate(payload: dict = Body(...), _principal: dict = Depends(require_editor)):
    dag = payload.get("dag") or payload.get("dag_json") or payload
    return validate_pipeline_dag(dag)


@router.get("/pipelines/runs")
async def list_runs(
    request: Request,
    status: str | None = None,
    pipeline_id: str | None = None,
    principal: dict = Depends(require_viewer),
):
    tenant = _tenant_for_request(request, principal)
    return {"items": list_pipeline_runs(tenant, status=status, pipeline_id=pipeline_id)}

@router.get("/pipelines/{pipeline_id}")
async def fetch(pipeline_id: str, _principal: dict = Depends(require_viewer)):
    p = get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return p

@router.post("/pipelines/{pipeline_id}/runs")
async def run_pipeline(
    pipeline_id: str,
    payload: dict = Body(...),
    run_mode: str | None = None,
    principal: dict = Depends(require_editor),
):
    """Start a pipeline run.

    If `run_mode` is set to `remote`, the run will be queued for data-plane agents
    and not executed locally. Default behavior is to run locally.
    """
    tenant = str(principal.get("tenant_id") or "default")
    run_config = payload.get("run_config") or {}
    if not get_pipeline(pipeline_id):
        raise HTTPException(status_code=404, detail="pipeline not found")

    try:
        if run_mode == "remote":
            started = create_remote_run(pipeline_id, tenant, run_config)
            return {
                "status": "queued_remote",
                "run_id": started["run_id"],
                "created_at": started["created_at"],
                "telemetry": _telemetry_links(started["run_id"]),
            }

        started = start_pipeline_run(pipeline_id, tenant, run_config)
        return {
            "status": "queued",
            "run_id": started["run_id"],
            "created_at": started["created_at"],
            "telemetry": _telemetry_links(started["run_id"]),
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@router.get("/pipelines/runs/{run_id}")
async def get_run(run_id: str, request: Request, principal: dict = Depends(require_viewer)):
    tenant = _tenant_for_request(request, principal)
    return _get_run_or_404(run_id, tenant)


@router.get("/pipelines/runs/{run_id}/nodes")
async def get_run_nodes(run_id: str, request: Request, principal: dict = Depends(require_viewer)):
    tenant = _tenant_for_request(request, principal)
    _get_run_or_404(run_id, tenant)
    return {"items": list_run_node_executions(run_id, tenant)}


@router.get("/pipelines/runs/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    request: Request,
    node_id: str | None = None,
    after_id: int = 0,
    limit: int = 200,
    principal: dict = Depends(require_viewer),
):
    tenant = _tenant_for_request(request, principal)
    _get_run_or_404(run_id, tenant)
    return list_run_node_logs(run_id, tenant, node_id=node_id, after_id=after_id, limit=limit)
