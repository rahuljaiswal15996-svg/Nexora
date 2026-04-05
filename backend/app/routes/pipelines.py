from fastapi import APIRouter, HTTPException, Body, Header
from typing import Any
from app.services.pipeline_runner import (
    create_pipeline,
    get_pipeline,
    start_pipeline_run,
    get_run_status,
    create_remote_run,
)

router = APIRouter()

@router.post("/pipelines")
async def create(tenant_id: str | None = Header(None), payload: dict = Body(...)):
    tenant = tenant_id or "default"
    name = payload.get("name") or "unnamed"
    dag = payload.get("dag") or payload.get("dag_json") or {}
    created = create_pipeline(tenant, name, dag)
    return {"status": "ok", "pipeline_id": created["id"], "created_at": created["created_at"]}

@router.get("/pipelines/{pipeline_id}")
async def fetch(pipeline_id: str):
    p = get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return p

@router.post("/pipelines/{pipeline_id}/runs")
async def run_pipeline(pipeline_id: str, payload: dict = Body(...), tenant_id: str | None = Header(None), run_mode: str | None = None):
    """Start a pipeline run.

    If `run_mode` is set to `remote`, the run will be queued for data-plane agents
    and not executed locally. Default behavior is to run locally.
    """
    tenant = tenant_id or "default"
    run_config = payload.get("run_config") or {}
    if run_mode == "remote":
        started = create_remote_run(pipeline_id, tenant, run_config)
        return {"status": "queued_remote", "run_id": started["run_id"]}

    started = start_pipeline_run(pipeline_id, tenant, run_config)
    return {"status": "queued", "run_id": started["run_id"]}

@router.get("/pipelines/runs/{run_id}")
async def get_run(run_id: str):
    s = get_run_status(run_id)
    if not s:
        raise HTTPException(status_code=404, detail="run not found")
    return s
