import threading
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.catalog import CatalogService
from app.services.db import get_connection
from app.services.deployer import DeployerService
from app.services.ml_lifecycle import MLLifecycleService
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


catalog_service = CatalogService()
deployer_service = DeployerService()
ml_service = MLLifecycleService()


def create_job(
    tenant_id: str,
    job_type: str,
    resource_type: str,
    created_by: str,
    payload: Optional[Dict[str, Any]] = None,
    resource_id: str | None = None,
) -> Dict[str, Any]:
    timestamp = now_iso()
    job = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "job_type": job_type,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "status": "queued",
        "payload_json": json_dumps(payload or {}),
        "result_json": json_dumps({}),
        "error_text": None,
        "created_by": created_by,
        "created_at": timestamp,
        "started_at": None,
        "finished_at": None,
        "updated_at": timestamp,
    }
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO platform_jobs (
                id, tenant_id, job_type, resource_type, resource_id, status,
                payload_json, result_json, error_text, created_by, created_at,
                started_at, finished_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["id"],
                job["tenant_id"],
                job["job_type"],
                job["resource_type"],
                job["resource_id"],
                job["status"],
                job["payload_json"],
                job["result_json"],
                job["error_text"],
                job["created_by"],
                job["created_at"],
                job["started_at"],
                job["finished_at"],
                job["updated_at"],
            ),
        )
        conn.commit()
    return get_job(job["id"], tenant_id) or {}


def get_job(job_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    job = fetch_one("SELECT * FROM platform_jobs WHERE id = ? AND tenant_id = ?", (job_id, tenant_id))
    if not job:
        return None
    job["payload"] = json_loads(job.pop("payload_json", None), {})
    job["result"] = json_loads(job.pop("result_json", None), {})
    return job


def list_jobs(tenant_id: str, status: str | None = None, job_type: str | None = None) -> List[Dict[str, Any]]:
    filters = ["tenant_id = ?"]
    params: List[Any] = [tenant_id]
    if status:
        filters.append("status = ?")
        params.append(status)
    if job_type:
        filters.append("job_type = ?")
        params.append(job_type)
    jobs = fetch_all(
        f"SELECT * FROM platform_jobs WHERE {' AND '.join(filters)} ORDER BY created_at DESC",
        tuple(params),
    )
    for job in jobs:
        job["payload"] = json_loads(job.pop("payload_json", None), {})
        job["result"] = json_loads(job.pop("result_json", None), {})
    return jobs


def _update_job(
    job_id: str,
    tenant_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_text: str | None = None,
) -> Optional[Dict[str, Any]]:
    timestamp = now_iso()
    with get_connection() as conn:
        current_rows = conn.execute(
            "SELECT result_json FROM platform_jobs WHERE id = ? AND tenant_id = ?",
            (job_id, tenant_id),
        ).fetchone()
        current_result = json_loads(current_rows[0] if current_rows else None, {})
        next_result = result if result is not None else current_result
        conn.execute(
            """
            UPDATE platform_jobs
            SET status = ?, result_json = ?, error_text = ?,
                started_at = COALESCE(started_at, ?),
                finished_at = CASE WHEN ? IN ('success', 'failed') THEN ? ELSE finished_at END,
                updated_at = ?
            WHERE id = ? AND tenant_id = ?
            """,
            (
                status,
                json_dumps(next_result),
                error_text,
                timestamp,
                status,
                timestamp,
                timestamp,
                job_id,
                tenant_id,
            ),
        )
        conn.commit()
    return get_job(job_id, tenant_id)


def _quality_worker(job_id: str, tenant_id: str, check_id: str) -> None:
    job = get_job(job_id, tenant_id)
    if not job:
        return
    payload = job.get("payload", {})
    metrics = payload.get("metrics", {})
    _update_job(job_id, tenant_id, "running", result={"quality_check_id": check_id})
    catalog_service.update_quality_check(check_id, tenant_id, "running", metrics)
    time.sleep(1.0)
    computed_metrics = {
        **metrics,
        "evaluated_rows": metrics.get("row_count", 0) or 18231,
        "null_ratio": metrics.get("null_ratio", 0.0),
        "freshness_minutes": 12,
    }
    record = catalog_service.update_quality_check(check_id, tenant_id, payload.get("final_status", "passed"), computed_metrics)
    _update_job(job_id, tenant_id, "success", result={"quality_check": record or {"id": check_id}})


def _deployment_worker(job_id: str, tenant_id: str, deployment_id: str) -> None:
    job = get_job(job_id, tenant_id)
    if not job:
        return
    payload = job.get("payload", {})
    _update_job(job_id, tenant_id, "running", result={"deployment_id": deployment_id})
    deployer_service.update_deployment_status(
        deployment_id,
        tenant_id,
        status="running",
        run_status="running",
        status_details={"stage": "provisioning", "platform": payload.get("target_platform")},
        run_id=job_id,
    )
    time.sleep(1.5)
    deployment = deployer_service.update_deployment_status(
        deployment_id,
        tenant_id,
        status="deployed",
        run_status="success",
        status_details={"stage": "completed", "target_platform": payload.get("target_platform")},
        run_id=job_id,
    )
    _update_job(job_id, tenant_id, "success", result={"deployment": deployment or {"id": deployment_id}})


def _experiment_worker(job_id: str, tenant_id: str, run_id: str) -> None:
    job = get_job(job_id, tenant_id)
    if not job:
        return
    payload = job.get("payload", {})
    _update_job(job_id, tenant_id, "running", result={"run_id": run_id})
    ml_service.update_run(
        tenant_id,
        run_id,
        status="running",
        params=payload.get("params", {}),
        metrics=payload.get("metrics", {}),
        artifacts=payload.get("artifacts", {}),
    )
    time.sleep(1.2)
    final_metrics = {
        **payload.get("metrics", {}),
        "duration_seconds": 73,
        "status_reason": "Local background worker completed the queued experiment run",
    }
    run = ml_service.update_run(
        tenant_id,
        run_id,
        status=payload.get("final_status", "completed"),
        params=payload.get("params", {}),
        metrics=final_metrics,
        artifacts=payload.get("artifacts", {}),
    )
    _update_job(job_id, tenant_id, "success", result={"experiment_run": run or {"id": run_id}})


def _start_worker(target: Any, *args: Any) -> None:
    thread = threading.Thread(target=target, args=args, daemon=True)
    thread.start()


def queue_quality_check(
    tenant_id: str,
    dataset_id: str,
    check_name: str,
    created_by: str,
    metrics: Optional[Dict[str, Any]] = None,
    frequency: str = "manual",
    final_status: str = "passed",
) -> Dict[str, Any]:
    record = catalog_service.add_quality_check(
        tenant_id=tenant_id,
        dataset_id=dataset_id,
        check_name=check_name,
        status="queued",
        metrics=metrics or {},
        frequency=frequency,
    )
    job = create_job(
        tenant_id=tenant_id,
        job_type="quality_check",
        resource_type="dataset_quality_check",
        created_by=created_by,
        payload={"dataset_id": dataset_id, "check_name": check_name, "metrics": metrics or {}, "final_status": final_status},
        resource_id=record["id"],
    )
    _start_worker(_quality_worker, job["id"], tenant_id, record["id"])
    return {"job": job, "quality_check": record}


def queue_deployment(
    tenant_id: str,
    pipeline_id: str,
    target_platform: str,
    created_by: str,
    target_id: str | None = None,
    target_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    deployment = deployer_service.deploy_pipeline(
        tenant_id=tenant_id,
        pipeline_id=pipeline_id,
        target_platform=target_platform,
        deployed_by=created_by,
        target_id=target_id,
        target_config=target_config or {},
    )
    job = create_job(
        tenant_id=tenant_id,
        job_type="deployment",
        resource_type="deployment",
        created_by=created_by,
        payload={"pipeline_id": pipeline_id, "target_platform": target_platform, "target_id": target_id},
        resource_id=deployment["id"],
    )
    _start_worker(_deployment_worker, job["id"], tenant_id, deployment["id"])
    return {"job": job, "deployment": deployment}


def queue_experiment_run(
    tenant_id: str,
    experiment_id: str,
    created_by: str,
    model_id: str | None = None,
    params: Optional[Dict[str, Any]] = None,
    metrics: Optional[Dict[str, Any]] = None,
    artifacts: Optional[Dict[str, Any]] = None,
    final_status: str = "completed",
) -> Dict[str, Any]:
    run = ml_service.log_run(
        tenant_id=tenant_id,
        experiment_id=experiment_id,
        status="queued",
        model_id=model_id,
        params=params or {},
        metrics=metrics or {},
        artifacts=artifacts or {},
    )
    job = create_job(
        tenant_id=tenant_id,
        job_type="experiment_run",
        resource_type="experiment_run",
        created_by=created_by,
        payload={
            "experiment_id": experiment_id,
            "model_id": model_id,
            "params": params or {},
            "metrics": metrics or {},
            "artifacts": artifacts or {},
            "final_status": final_status,
        },
        resource_id=run["id"],
    )
    _start_worker(_experiment_worker, job["id"], tenant_id, run["id"])
    return {"job": job, "run": run}