from fastapi import APIRouter, Header, HTTPException, Body
from typing import Any
from app.services.pipeline_runner import claim_next_remote_run, mark_run_result

router = APIRouter()


@router.get("/agent/poll")
async def poll(tenant_id: str | None = Header(None)):
    """Agent polls for the next available remote run. Returns 204 if none."""
    run = claim_next_remote_run(tenant_id)
    if not run:
        return {"status": "idle"}

    # Return run details for the agent to execute
    return {
        "status": "claimed",
        "run_id": run.get("id"),
        "pipeline": run.get("pipeline") or {},
        "run_metadata": run.get("run_metadata"),
        "tenant_id": run.get("tenant_id"),
    }


@router.post("/agent/report")
async def report(payload: dict = Body(...)):
    """Agent reports result for a run: {run_id, status, run_metadata} """
    run_id = payload.get("run_id")
    status = payload.get("status")
    run_metadata = payload.get("run_metadata")
    if not run_id or not status:
        raise HTTPException(status_code=400, detail="run_id and status are required")

    mark_run_result(run_id, status, run_metadata)
    return {"status": "ok", "run_id": run_id}
