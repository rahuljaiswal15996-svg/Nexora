import logging

from fastapi import APIRouter, Header, HTTPException, Body
from typing import Any
from app.services.pipeline_runner import (
    claim_remote_run,
    dead_letter_remote_run,
    heartbeat_remote_run,
    mark_run_result,
    report_remote_run_node_event,
    requeue_remote_run_message,
)
from app.services.platform_jobs import (
    claim_job,
    dead_letter_job,
    heartbeat_job,
    report_job,
    requeue_remote_job_message,
)
from app.services.agent_fleet import list_agent_fleet
from app.services.work_broker import (
    PIPELINE_RUN_QUEUE,
    PLATFORM_JOB_QUEUE,
    broker_message_dead_letter_reason,
    consume_work_message,
)

router = APIRouter()
logger = logging.getLogger("nexora.agent-control")


@router.get("/agent/fleet")
async def fleet(x_tenant_id: str | None = Header(None)):
    return {"items": list_agent_fleet(x_tenant_id)}


@router.get("/agent/poll")
async def poll(x_tenant_id: str | None = Header(None), x_agent_id: str | None = Header(None)):
    """Legacy HTTP poll path backed by the broker queue for remote runs."""
    for _ in range(8):
        message = consume_work_message([PIPELINE_RUN_QUEUE], timeout_seconds=1)
        if not message:
            break
        dead_letter_reason = broker_message_dead_letter_reason(message)
        if dead_letter_reason:
            dead_letter_remote_run(
                str(message.get("run_id") or ""),
                str(message.get("pipeline_id") or ""),
                str(message.get("tenant_id") or "default"),
                dead_letter_reason,
                source="agent_poll",
                broker_message=message,
            )
            continue
        if x_tenant_id and str(message.get("tenant_id") or "") != x_tenant_id:
            action = requeue_remote_run_message(
                str(message.get("run_id") or ""),
                str(message.get("pipeline_id") or ""),
                str(message.get("tenant_id") or "default"),
                reason="tenant_mismatch",
                source="agent_poll",
                broker_message=message,
            )
            if action == "requeued":
                logger.warning(
                    "Requeued remote pipeline run after tenant mismatch during poll",
                    extra={
                        "requested_tenant_id": x_tenant_id,
                        "message_tenant_id": message.get("tenant_id"),
                        "run_id": message.get("run_id"),
                    },
                )
            continue
        run = claim_remote_run(str(message.get("run_id") or ""), x_agent_id, claim_source="broker_poll")
        if not run:
            continue
        return {
            "status": "claimed",
            "run_id": run.get("id"),
            "pipeline": run.get("pipeline") or {},
            "run_metadata": run.get("run_metadata"),
            "tenant_id": run.get("tenant_id"),
            "attempt_count": run.get("attempt_count"),
            "claimed_by": run.get("claimed_by"),
            "lease_expires_at": run.get("lease_expires_at"),
        }
    return {"status": "idle"}


@router.post("/agent/runs/claim")
async def claim_run(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    run_id = payload.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="run_id is required")
    run = claim_remote_run(str(run_id), x_agent_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or is not claimable")
    return {
        "status": "claimed",
        "run_id": run.get("id"),
        "pipeline": run.get("pipeline") or {},
        "run_metadata": run.get("run_metadata"),
        "tenant_id": run.get("tenant_id"),
        "attempt_count": run.get("attempt_count"),
        "claimed_by": run.get("claimed_by"),
        "lease_expires_at": run.get("lease_expires_at"),
    }


@router.post("/agent/heartbeat")
async def heartbeat(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    run_id = payload.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="run_id is required")
    if not x_agent_id:
        raise HTTPException(status_code=400, detail="X-Agent-Id header is required")

    run = heartbeat_remote_run(str(run_id), x_agent_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or lease not owned by agent")
    return {"status": "ok", "run": run}


@router.post("/agent/report")
async def report(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    """Agent reports result for a run: {run_id, status, run_metadata} """
    run_id = payload.get("run_id")
    status = payload.get("status")
    run_metadata = payload.get("run_metadata")
    if not run_id or not status:
        raise HTTPException(status_code=400, detail="run_id and status are required")

    try:
        mark_run_result(str(run_id), str(status), run_metadata, x_agent_id)
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"status": "ok", "run_id": run_id}


@router.post("/agent/runs/node-update")
async def report_run_node(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    run_id = payload.get("run_id")
    node_id = payload.get("node_id")
    status = payload.get("status")
    if not run_id or not node_id or not status:
        raise HTTPException(status_code=400, detail="run_id, node_id, and status are required")

    try:
        node_execution = report_remote_run_node_event(
            str(run_id),
            str(node_id),
            str(status),
            metadata=payload.get("metadata") or {},
            error_text=payload.get("error_text"),
            logs=payload.get("logs") or [],
            agent_id=x_agent_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not node_execution:
        raise HTTPException(status_code=404, detail="Run or node execution not found")
    return {"status": "ok", "node": node_execution}


@router.get("/agent/platform-jobs/poll")
async def poll_platform_jobs(job_type: str | None = None, x_tenant_id: str | None = Header(None), x_agent_id: str | None = Header(None)):
    """Legacy HTTP poll path backed by the broker queue for remote platform jobs."""
    for _ in range(12):
        message = consume_work_message([PLATFORM_JOB_QUEUE], timeout_seconds=1)
        if not message:
            break
        dead_letter_reason = broker_message_dead_letter_reason(message)
        if dead_letter_reason:
            dead_letter_job(
                str(message.get("job_id") or ""),
                str(message.get("tenant_id") or "default"),
                dead_letter_reason,
                source="agent_poll",
                broker_message=message,
            )
            continue
        if x_tenant_id and str(message.get("tenant_id") or "") != x_tenant_id:
            action = requeue_remote_job_message(
                str(message.get("job_id") or ""),
                str(message.get("tenant_id") or "default"),
                str(message.get("job_type") or "platform_job"),
                reason="tenant_mismatch",
                source="agent_poll",
                broker_message=message,
            )
            if action == "requeued":
                logger.warning(
                    "Requeued remote platform job after tenant mismatch during poll",
                    extra={
                        "requested_tenant_id": x_tenant_id,
                        "message_tenant_id": message.get("tenant_id"),
                        "job_id": message.get("job_id"),
                    },
                )
            continue
        if job_type and str(message.get("job_type") or "") != job_type:
            action = requeue_remote_job_message(
                str(message.get("job_id") or ""),
                str(message.get("tenant_id") or "default"),
                str(message.get("job_type") or "platform_job"),
                reason="job_type_mismatch",
                source="agent_poll",
                broker_message=message,
            )
            if action == "requeued":
                logger.warning(
                    "Requeued remote platform job after job_type mismatch during poll",
                    extra={
                        "requested_job_type": job_type,
                        "message_job_type": message.get("job_type"),
                        "job_id": message.get("job_id"),
                    },
                )
            continue
        job = claim_job(str(message.get("job_id") or ""), str(message.get("tenant_id") or "default"), x_agent_id, claim_source="broker_poll")
        if not job:
            continue
        return {
            "status": "claimed",
            "job": job,
        }
    return {"status": "idle"}


@router.post("/agent/platform-jobs/claim")
async def claim_platform_job(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    job_id = payload.get("job_id")
    tenant_id = payload.get("tenant_id")
    if not job_id or not tenant_id:
        raise HTTPException(status_code=400, detail="job_id and tenant_id are required")
    job = claim_job(str(job_id), str(tenant_id), x_agent_id, claim_source="claim_api")
    if not job:
        raise HTTPException(status_code=404, detail="Platform job not found or is not claimable")
    return {"status": "claimed", "job": job}


@router.post("/agent/platform-jobs/heartbeat")
async def heartbeat_platform_job(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    job_id = payload.get("job_id")
    tenant_id = payload.get("tenant_id")
    if not job_id or not tenant_id:
        raise HTTPException(status_code=400, detail="job_id and tenant_id are required")
    if not x_agent_id:
        raise HTTPException(status_code=400, detail="X-Agent-Id header is required")

    job = heartbeat_job(str(job_id), str(tenant_id), x_agent_id)
    if not job:
        raise HTTPException(status_code=404, detail="Platform job not found or lease not owned by agent")
    return {"status": "ok", "job": job}


@router.post("/agent/platform-jobs/report")
async def report_platform_job(payload: dict = Body(...), x_agent_id: str | None = Header(None)):
    """Agent reports result for a platform job: {job_id, tenant_id, status, result, error_text}."""
    job_id = payload.get("job_id")
    tenant_id = payload.get("tenant_id")
    status = payload.get("status")
    if not job_id or not tenant_id or not status:
        raise HTTPException(status_code=400, detail="job_id, tenant_id, and status are required")

    try:
        job = report_job(
            str(job_id),
            str(tenant_id),
            str(status),
            result=payload.get("result") or {},
            error_text=payload.get("error_text"),
            agent_id=x_agent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not job:
        raise HTTPException(status_code=404, detail="Platform job not found")

    return {"status": "ok", "job": job}
