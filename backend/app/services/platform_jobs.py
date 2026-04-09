import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.catalog import CatalogService
from app.services.broker_observability import (
    record_broker_claim,
    record_broker_processed,
    record_broker_recovery,
    record_broker_recovery_failed,
    record_broker_requeue_loop_detected,
    record_broker_requeue,
    record_broker_retry,
)
from app.services.db import get_connection
from app.services.deployer import DeployerService
from app.services.ml_lifecycle import MLLifecycleService
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso
from app.services.work_broker import (
    PLATFORM_JOB_QUEUE,
    broker_metadata_updates,
    broker_state_from_metadata,
    broker_visibility_timeout_seconds,
    build_platform_job_message,
    make_dead_letter_message,
    next_requeue_message,
    publish_dead_letter_message,
    publish_platform_job_message,
)


logger = logging.getLogger("nexora.platform-jobs")

catalog_service = CatalogService()
deployer_service = DeployerService()
ml_service = MLLifecycleService()

DEFAULT_LEASE_SECONDS = int(os.getenv("NEXORA_REMOTE_JOB_LEASE_SECONDS", "90"))
DEFAULT_MAX_ATTEMPTS = int(os.getenv("NEXORA_REMOTE_JOB_MAX_ATTEMPTS", "3"))
VALID_RUN_MODES = {"local", "remote"}
TERMINAL_JOB_STATUSES = {"success", "failed", "cancelled"}
CANCELABLE_JOB_STATUSES = {"queued", "running"}


def normalize_run_mode(run_mode: str | None) -> str:
    candidate = (run_mode or "local").strip().lower()
    return candidate if candidate in VALID_RUN_MODES else "local"


def _normalize_agent_id(agent_id: str | None) -> str:
    candidate = (agent_id or "anonymous-agent").strip()
    return candidate or "anonymous-agent"


def _lease_expiration_iso(seconds: int) -> str:
    ttl = max(1, int(seconds or DEFAULT_LEASE_SECONDS))
    return (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat()


def _hydrate_job(job: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not job:
        return None
    hydrated = dict(job)
    hydrated["payload"] = json_loads(hydrated.pop("payload_json", None), {})
    hydrated["result"] = json_loads(hydrated.pop("result_json", None), {})
    return hydrated


def create_job(
    tenant_id: str,
    job_type: str,
    resource_type: str,
    created_by: str,
    payload: Optional[Dict[str, Any]] = None,
    resource_id: str | None = None,
    execution_mode: str = "local",
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> Dict[str, Any]:
    timestamp = now_iso()
    job = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "job_type": job_type,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "execution_mode": normalize_run_mode(execution_mode),
        "attempt_count": 0,
        "max_attempts": max(1, int(max_attempts or DEFAULT_MAX_ATTEMPTS)),
        "claimed_by": None,
        "claimed_at": None,
        "heartbeat_at": None,
        "lease_expires_at": None,
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
                id, tenant_id, job_type, resource_type, resource_id, execution_mode,
                attempt_count, max_attempts, claimed_by, claimed_at, heartbeat_at, lease_expires_at, status,
                payload_json, result_json, error_text, created_by, created_at,
                started_at, finished_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["id"],
                job["tenant_id"],
                job["job_type"],
                job["resource_type"],
                job["resource_id"],
                job["execution_mode"],
                job["attempt_count"],
                job["max_attempts"],
                job["claimed_by"],
                job["claimed_at"],
                job["heartbeat_at"],
                job["lease_expires_at"],
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
    if job["execution_mode"] == "remote":
        broker_message = build_platform_job_message(job["id"], tenant_id, job_type)
        _update_job_broker_metadata(
            job["id"],
            tenant_id,
            broker_metadata_updates(broker_message, queue_label="platform_job"),
        )
        publish_platform_job_message(job["id"], tenant_id, job_type, broker_message=broker_message)
    return get_job(job["id"], tenant_id) or {}


def get_job(job_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    return _hydrate_job(fetch_one("SELECT * FROM platform_jobs WHERE id = ? AND tenant_id = ?", (job_id, tenant_id)))


def _update_job_broker_metadata(job_id: str, tenant_id: str, broker_updates: Dict[str, Any]) -> bool:
    timestamp = now_iso()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT result_json FROM platform_jobs WHERE id = ? AND tenant_id = ?",
            (job_id, tenant_id),
        ).fetchone()
        if not row:
            return False
        current_result = json_loads(row[0], {})
        next_result = {**current_result, **broker_updates}
        cursor = conn.execute(
            "UPDATE platform_jobs SET result_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
            (json_dumps(next_result), timestamp, job_id, tenant_id),
        )
        conn.commit()
    return bool(cursor.rowcount)


def dead_letter_job(
    job_id: str,
    tenant_id: str,
    reason: str,
    *,
    source: str,
    broker_message: Dict[str, Any] | None = None,
) -> Optional[Dict[str, Any]]:
    job = get_job(job_id, tenant_id)
    if not job or job.get("execution_mode") != "remote":
        return None
    if str(job.get("status") or "").strip().lower() not in {"queued", "running"}:
        return None

    message = build_platform_job_message(
        job_id,
        job["tenant_id"],
        job["job_type"],
        broker_message=broker_message or broker_state_from_metadata(job.get("result") or {}),
    )
    dlq_message = make_dead_letter_message(message, reason=reason, source=source)
    error_text = f"Broker message moved to DLQ: {reason}"

    result_payload = dict(job.get("result") or {})
    result_payload.update(
        broker_metadata_updates(
            dlq_message,
            queue_label="platform_job",
            requeue_reason=str(dlq_message.get("last_requeue_reason") or reason),
            dead_letter_reason=reason,
            dead_letter_source=source,
        )
    )
    result_payload["broker_dead_letter_reason"] = reason
    result_payload["broker_dead_letter_source"] = source

    if job["job_type"] == "quality_check":
        next_result = _finalize_quality_check(job, "failed", result_payload, error_text)
    elif job["job_type"] in {"deployment", "deployment_rollback"}:
        next_result = _finalize_deployment(job, "failed", "failed", result_payload, error_text)
    elif job["job_type"] == "experiment_run":
        next_result = _finalize_experiment_run(job, "failed", result_payload, error_text)
    else:
        next_result = result_payload

    updated_job = _update_job(
        job_id,
        tenant_id,
        "failed",
        result=next_result,
        error_text=error_text,
        clear_claim=True,
    )
    publish_dead_letter_message(PLATFORM_JOB_QUEUE, dlq_message, reason=reason, source=source)
    record_broker_processed(
        "platform_job",
        "failed",
        started_at=job.get("started_at"),
        claimed_at=job.get("claimed_at"),
        finished_at=(updated_job or {}).get("finished_at"),
    )
    return updated_job


def requeue_remote_job_message(
    job_id: str,
    tenant_id: str,
    job_type: str,
    *,
    reason: str,
    source: str,
    broker_message: Dict[str, Any] | None = None,
) -> str:
    next_message, evaluation = next_requeue_message(
        build_platform_job_message(job_id, tenant_id, job_type, broker_message=broker_message),
        reason=reason,
    )
    if evaluation["emit_loop_metric"]:
        record_broker_requeue_loop_detected(PLATFORM_JOB_QUEUE, reason, source)
        logger.warning(
            "Detected repeated broker requeue loop for remote platform job",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "job_type": job_type,
                "reason": reason,
                "retry_count": next_message.get("retry_count"),
                "max_retries": next_message.get("max_retries"),
            },
        )

    dead_letter_reason = None
    if evaluation["retry_limit_exceeded"]:
        dead_letter_reason = "retry_limit_exceeded"
    elif evaluation["ttl_expired"]:
        dead_letter_reason = "ttl_expired"

    if dead_letter_reason:
        return "dead_lettered" if dead_letter_job(
            job_id,
            tenant_id,
            dead_letter_reason,
            source=source,
            broker_message=next_message,
        ) else "skipped"

    if not _update_job_broker_metadata(
        job_id,
        tenant_id,
        broker_metadata_updates(next_message, queue_label="platform_job", requeue_reason=reason),
    ):
        return "skipped"

    publish_platform_job_message(job_id, tenant_id, job_type, broker_message=next_message)
    record_broker_requeue(PLATFORM_JOB_QUEUE, reason, source)
    record_broker_retry(PLATFORM_JOB_QUEUE, reason, source)
    return "requeued"


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
    hydrated_jobs = [_hydrate_job(job) for job in jobs]
    return [job for job in hydrated_jobs if job is not None]


def _job_reference_result(job: Dict[str, Any]) -> Dict[str, Any]:
    if job["job_type"] == "quality_check":
        return {"quality_check_id": job.get("resource_id")}
    if job["job_type"] == "deployment":
        return {"deployment_id": job.get("resource_id")}
    if job["job_type"] == "deployment_rollback":
        return {"deployment_id": job.get("resource_id"), "mode": "rollback"}
    if job["job_type"] == "experiment_run":
        return {"run_id": job.get("resource_id")}
    return {}


def _update_job(
    job_id: str,
    tenant_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_text: str | None = None,
    clear_claim: bool = False,
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
                finished_at = CASE WHEN ? IN ('success', 'failed', 'cancelled') THEN ? ELSE finished_at END,
                updated_at = ?,
                claimed_by = CASE WHEN ? THEN NULL ELSE claimed_by END,
                claimed_at = CASE WHEN ? THEN NULL ELSE claimed_at END,
                heartbeat_at = CASE WHEN ? THEN NULL ELSE heartbeat_at END,
                lease_expires_at = CASE WHEN ? THEN NULL ELSE lease_expires_at END
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
                1 if clear_claim else 0,
                1 if clear_claim else 0,
                1 if clear_claim else 0,
                1 if clear_claim else 0,
                job_id,
                tenant_id,
            ),
        )
        conn.commit()
    return get_job(job_id, tenant_id)


def _apply_running_state(job: Dict[str, Any]) -> None:
    payload = job.get("payload", {})
    tenant_id = job["tenant_id"]
    resource_id = job.get("resource_id")
    if not resource_id:
        return

    if job["job_type"] == "quality_check":
        catalog_service.update_quality_check(resource_id, tenant_id, "running", payload.get("metrics", {}))
        return

    if job["job_type"] in {"deployment", "deployment_rollback"}:
        stage = "rolling_back" if job["job_type"] == "deployment_rollback" else "executing"
        deployer_service.update_deployment_status(
            resource_id,
            tenant_id,
            status="rolling_back" if job["job_type"] == "deployment_rollback" else "running",
            run_status="running",
            status_details={
                "stage": stage,
                "target_platform": payload.get("target_platform"),
            },
            run_id=job["id"],
        )
        return

    if job["job_type"] == "experiment_run":
        ml_service.update_run(
            tenant_id,
            resource_id,
            status="running",
            params=payload.get("params", {}),
            metrics=payload.get("metrics", {}),
            artifacts=payload.get("artifacts", {}),
        )


def _ensure_job_claim(job: Dict[str, Any], agent_id: str | None) -> None:
    if job.get("execution_mode") != "remote":
        return
    claimed_by = (job.get("claimed_by") or "").strip()
    normalized_agent = _normalize_agent_id(agent_id)
    if claimed_by and claimed_by != normalized_agent:
        raise PermissionError(f"Job is currently claimed by {claimed_by}")


def claim_job(
    job_id: str,
    tenant_id: str,
    agent_id: str | None = None,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
    claim_source: str = "claim_api",
) -> Optional[Dict[str, Any]]:
    timestamp = now_iso()
    lease_expires_at = _lease_expiration_iso(lease_seconds)
    normalized_agent = _normalize_agent_id(agent_id)

    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE platform_jobs
            SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?,
                claimed_by = ?, claimed_at = ?, heartbeat_at = ?, lease_expires_at = ?,
                attempt_count = attempt_count + 1
            WHERE id = ? AND tenant_id = ? AND execution_mode = 'remote' AND attempt_count < max_attempts
              AND (status = 'queued' OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?))
            """,
            (
                "running",
                timestamp,
                timestamp,
                normalized_agent,
                timestamp,
                timestamp,
                lease_expires_at,
                job_id,
                tenant_id,
                timestamp,
            ),
        )
        conn.commit()
    if not cursor.rowcount:
        return None

    claimed = get_job(job_id, tenant_id)
    if not claimed:
        return None
    _apply_running_state(claimed)
    updated_job = _update_job(
        claimed["id"],
        claimed["tenant_id"],
        "running",
        result=_job_reference_result(claimed),
    )
    record_broker_claim("platform_job", claim_source)
    return updated_job


def heartbeat_job(
    job_id: str,
    tenant_id: str,
    agent_id: str,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
) -> Optional[Dict[str, Any]]:
    timestamp = now_iso()
    lease_expires_at = _lease_expiration_iso(lease_seconds)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE platform_jobs
            SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ? AND execution_mode = 'remote' AND status = 'running' AND claimed_by = ?
            """,
            (
                timestamp,
                lease_expires_at,
                timestamp,
                job_id,
                tenant_id,
                _normalize_agent_id(agent_id),
            ),
        )
        conn.commit()
    if not cursor.rowcount:
        return None
    return get_job(job_id, tenant_id)


def requeue_remote_jobs(*, tenant_id: str | None = None, job_id: str | None = None) -> int:
    timestamp = now_iso()
    recovered = 0
    visibility_cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=broker_visibility_timeout_seconds())
    ).isoformat()
    stale_filters = [
        "execution_mode = 'remote'",
        "status = 'running'",
        "lease_expires_at IS NOT NULL",
        "lease_expires_at <= ?",
    ]
    stale_params: List[Any] = [timestamp]
    queued_filters = [
        "execution_mode = 'remote'",
        "status = 'queued'",
    ]
    queued_params: List[Any] = []
    if tenant_id:
        stale_filters.append("tenant_id = ?")
        stale_params.append(tenant_id)
        queued_filters.append("tenant_id = ?")
        queued_params.append(tenant_id)
    if job_id:
        stale_filters.append("id = ?")
        stale_params.append(job_id)
        queued_filters.append("id = ?")
        queued_params.append(job_id)

    with get_connection() as conn:
        stale_rows = conn.execute(
            f"""
            SELECT id, tenant_id, job_type, result_json
            FROM platform_jobs
            WHERE {' AND '.join(stale_filters)}
            """,
            tuple(stale_params),
        ).fetchall()
        stale_job_keys: set[tuple[str, str]] = set()
        for row in stale_rows:
            stale_job_keys.add((str(row[0]), str(row[1])))
            conn.execute(
                """
                UPDATE platform_jobs
                SET status = 'queued', updated_at = ?,
                    claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL, lease_expires_at = NULL
                WHERE id = ? AND tenant_id = ?
                """,
                (timestamp, row[0], row[1]),
            )

        queued_rows = conn.execute(
            f"""
            SELECT id, tenant_id, job_type, result_json
            FROM platform_jobs
            WHERE {' AND '.join(queued_filters)}
            """
            ,
            tuple(queued_params),
        ).fetchall()
        for row in queued_rows:
            result_payload = json_loads(row[3], {})
            last_enqueued_at = str(result_payload.get("broker_last_enqueued_at") or "")
            if last_enqueued_at and last_enqueued_at > visibility_cutoff:
                continue

        conn.commit()

    for row in stale_rows:
        job_id = str(row[0])
        tenant_id = str(row[1])
        job_type = str(row[2] or "platform_job")
        reason = "expired_lease"
        try:
            action = requeue_remote_job_message(
                job_id,
                tenant_id,
                job_type,
                reason=reason,
                source="maintenance",
                broker_message=broker_state_from_metadata(json_loads(row[3], {})),
            )
        except Exception:
            record_broker_recovery_failed("platform_job", reason, "maintenance")
            logger.exception(
                "Broker recovery failed for remote platform job",
                extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "job_type": job_type,
                    "reason": reason,
                },
            )
            continue
        record_broker_recovery("platform_job", reason, action, "maintenance")
        logger.info(
            "Broker recovery decision recorded for remote platform job",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "job_type": job_type,
                "reason": reason,
                "action": action,
            },
        )
        if action == "requeued":
            recovered += 1

    for row in queued_rows:
        job_key = (str(row[0]), str(row[1]))
        if job_key in stale_job_keys:
            continue
        result_payload = json_loads(row[3], {})
        last_enqueued_at = str(result_payload.get("broker_last_enqueued_at") or "")
        if last_enqueued_at and last_enqueued_at > visibility_cutoff:
            continue
        reason = "queued_visibility_refresh"
        job_id = str(row[0])
        tenant_id = str(row[1])
        job_type = str(row[2] or "platform_job")
        try:
            action = requeue_remote_job_message(
                job_id,
                tenant_id,
                job_type,
                reason=reason,
                source="maintenance",
                broker_message=broker_state_from_metadata(result_payload),
            )
        except Exception:
            record_broker_recovery_failed("platform_job", reason, "maintenance")
            logger.exception(
                "Broker recovery failed for queued remote platform job",
                extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "job_type": job_type,
                    "reason": reason,
                },
            )
            continue
        record_broker_recovery("platform_job", reason, action, "maintenance")
        logger.info(
            "Broker recovery decision recorded for queued remote platform job",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "job_type": job_type,
                "reason": reason,
                "action": action,
            },
        )
        if action == "requeued":
            recovered += 1

    return recovered


def _finalize_quality_check(
    job: Dict[str, Any],
    final_status: str,
    result: Dict[str, Any],
    error_text: str | None,
) -> Dict[str, Any]:
    payload = job.get("payload", {})
    metrics = result.get("metrics") if "metrics" in result else payload.get("metrics", {})
    if error_text:
        metrics = {**(metrics or {}), "error_text": error_text}
    record = catalog_service.update_quality_check(
        job["resource_id"],
        job["tenant_id"],
        final_status,
        metrics or {},
    )
    next_result = dict(result)
    next_result.update(
        {
            "quality_check_id": job.get("resource_id"),
            "quality_check": record or {"id": job.get("resource_id")},
        }
    )
    return next_result


def _finalize_deployment(
    job: Dict[str, Any],
    final_status: str,
    run_status: str,
    result: Dict[str, Any],
    error_text: str | None,
) -> Dict[str, Any]:
    payload = job.get("payload", {})
    status_details = dict(result.get("status_details") or {})
    status_details.setdefault("stage", "completed" if run_status == "success" else "failed")
    status_details.setdefault("target_platform", payload.get("target_platform"))
    if error_text:
        status_details["error_text"] = error_text
    deployment = deployer_service.update_deployment_status(
        job["resource_id"],
        job["tenant_id"],
        status=final_status,
        run_status=run_status,
        status_details=status_details,
        run_id=job["id"],
    )
    next_result = dict(result)
    next_result.update(
        {
            "deployment_id": job.get("resource_id"),
            "deployment": deployment or {"id": job.get("resource_id")},
            "status_details": status_details,
        }
    )
    return next_result


def _finalize_experiment_run(
    job: Dict[str, Any],
    final_status: str,
    result: Dict[str, Any],
    error_text: str | None,
) -> Dict[str, Any]:
    payload = job.get("payload", {})
    params = result["params"] if "params" in result else payload.get("params", {})
    metrics = result["metrics"] if "metrics" in result else payload.get("metrics", {})
    artifacts = result["artifacts"] if "artifacts" in result else payload.get("artifacts", {})
    if error_text:
        metrics = {**(metrics or {}), "error_text": error_text}
    run = ml_service.update_run(
        job["tenant_id"],
        job["resource_id"],
        status=final_status,
        params=params or {},
        metrics=metrics or {},
        artifacts=artifacts or {},
    )
    next_result = dict(result)
    next_result.update(
        {
            "run_id": job.get("resource_id"),
            "experiment_run": run or {"id": job.get("resource_id")},
        }
    )
    return next_result


def report_job(
    job_id: str,
    tenant_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_text: str | None = None,
    agent_id: str | None = None,
) -> Optional[Dict[str, Any]]:
    normalized_status = (status or "").strip().lower()
    if normalized_status not in {"running", *TERMINAL_JOB_STATUSES}:
        raise ValueError(f"Unsupported job status: {status}")

    job = get_job(job_id, tenant_id)
    if not job:
        return None

    if str(job.get("status") or "").lower() == "cancelled":
        return job

    _ensure_job_claim(job, agent_id)

    if normalized_status == "running":
        _apply_running_state(job)
        if job.get("execution_mode") == "remote" and agent_id:
            heartbeat_job(job_id, tenant_id, agent_id)
        return _update_job(job_id, tenant_id, "running", result=_job_reference_result(job))

    payload = job.get("payload", {})
    result_payload = dict(result or {})

    if job["job_type"] == "quality_check":
        final_status = result_payload.get("final_status") or (
            payload.get("final_status", "passed") if normalized_status == "success" else "failed"
        )
        next_result = _finalize_quality_check(job, final_status, result_payload, error_text)
    elif job["job_type"] in {"deployment", "deployment_rollback"}:
        final_status = result_payload.get("deployment_status") or (
            "rolled_back" if job["job_type"] == "deployment_rollback" and normalized_status == "success" else "deployed" if normalized_status == "success" else "failed"
        )
        next_result = _finalize_deployment(job, final_status, normalized_status, result_payload, error_text)
    elif job["job_type"] == "experiment_run":
        final_status = result_payload.get("final_status") or (
            payload.get("final_status", "completed") if normalized_status == "success" else "failed"
        )
        next_result = _finalize_experiment_run(job, final_status, result_payload, error_text)
    else:
        next_result = result_payload

    updated_job = _update_job(
        job_id,
        tenant_id,
        normalized_status,
        result=next_result,
        error_text=error_text,
        clear_claim=job.get("execution_mode") == "remote",
    )
    if job.get("execution_mode") == "remote" and normalized_status in TERMINAL_JOB_STATUSES:
        record_broker_processed(
            "platform_job",
            normalized_status,
            started_at=job.get("started_at"),
            claimed_at=job.get("claimed_at"),
            finished_at=(updated_job or {}).get("finished_at"),
        )
    return updated_job


def _quality_worker(job_id: str, tenant_id: str, check_id: str) -> None:
    job = report_job(job_id, tenant_id, "running")
    if not job:
        return
    payload = job.get("payload", {})
    metrics = payload.get("metrics", {})
    time.sleep(1.0)
    computed_metrics = {
        **metrics,
        "evaluated_rows": metrics.get("row_count", 0) or 18231,
        "null_ratio": metrics.get("null_ratio", 0.0),
        "freshness_minutes": 12,
    }
    report_job(
        job_id,
        tenant_id,
        "success",
        result={
            "quality_check_id": check_id,
            "metrics": computed_metrics,
            "final_status": payload.get("final_status", "passed"),
        },
    )


def _deployment_worker(job_id: str, tenant_id: str, deployment_id: str) -> None:
    job = report_job(job_id, tenant_id, "running")
    if not job:
        return
    payload = job.get("payload", {})
    time.sleep(1.5)
    report_job(
        job_id,
        tenant_id,
        "success",
        result={
            "deployment_id": deployment_id,
            "deployment_status": "deployed",
            "status_details": {
                "stage": "completed",
                "target_platform": payload.get("target_platform"),
            },
        },
    )


def _deployment_rollback_worker(job_id: str, tenant_id: str, deployment_id: str) -> None:
    job = report_job(job_id, tenant_id, "running")
    if not job:
        return
    payload = job.get("payload", {})
    time.sleep(1.1)
    report_job(
        job_id,
        tenant_id,
        "success",
        result={
            "deployment_id": deployment_id,
            "deployment_status": "rolled_back",
            "status_details": {
                "stage": "rolled_back",
                "target_platform": payload.get("target_platform"),
                "rollback_source_deployment_id": deployment_id,
            },
        },
    )


def _experiment_worker(job_id: str, tenant_id: str, run_id: str) -> None:
    job = report_job(job_id, tenant_id, "running")
    if not job:
        return
    payload = job.get("payload", {})
    time.sleep(1.2)
    final_metrics = {
        **payload.get("metrics", {}),
        "duration_seconds": 73,
        "status_reason": "Local background worker completed the queued experiment run",
    }
    report_job(
        job_id,
        tenant_id,
        "success",
        result={
            "run_id": run_id,
            "params": payload.get("params", {}),
            "metrics": final_metrics,
            "artifacts": payload.get("artifacts", {}),
            "final_status": payload.get("final_status", "completed"),
        },
    )


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
    run_mode: str = "local",
) -> Dict[str, Any]:
    execution_mode = normalize_run_mode(run_mode)
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
        execution_mode=execution_mode,
    )
    if execution_mode == "local":
        _start_worker(_quality_worker, job["id"], tenant_id, record["id"])
    return {"job": job, "quality_check": record}


def queue_deployment(
    tenant_id: str,
    pipeline_id: str,
    target_platform: str,
    created_by: str,
    target_id: str | None = None,
    target_config: Optional[Dict[str, Any]] = None,
    run_mode: str = "local",
) -> Dict[str, Any]:
    execution_mode = normalize_run_mode(run_mode)
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
        payload={"pipeline_id": pipeline_id, "target_platform": target_platform, "target_id": target_id, "target_config": target_config or {}},
        resource_id=deployment["id"],
        execution_mode=execution_mode,
    )
    if execution_mode == "local":
        _start_worker(_deployment_worker, job["id"], tenant_id, deployment["id"])
    return {"job": job, "deployment": deployment}


def queue_deployment_rollback(
    tenant_id: str,
    deployment_id: str,
    created_by: str,
    run_mode: str = "local",
) -> Dict[str, Any]:
    execution_mode = normalize_run_mode(run_mode)
    deployment = deployer_service.get_deployment(deployment_id, tenant_id)
    if not deployment:
        raise ValueError(f"Deployment {deployment_id} not found")

    deployer_service.append_deployment_run(
        deployment_id,
        tenant_id,
        "queued",
        status_details={
            "stage": "rollback_queued",
            "target_platform": deployment.get("target_platform"),
        },
    )
    deployer_service.update_deployment_status(
        deployment_id,
        tenant_id,
        status="rollback_queued",
        run_status="queued",
        status_details={
            "stage": "rollback_queued",
            "target_platform": deployment.get("target_platform"),
        },
    )
    job = create_job(
        tenant_id=tenant_id,
        job_type="deployment_rollback",
        resource_type="deployment",
        created_by=created_by,
        payload={
            "pipeline_id": deployment.get("pipeline_id"),
            "target_platform": deployment.get("target_platform"),
            "target_id": deployment.get("target_id"),
            "rollback_source_deployment_id": deployment_id,
        },
        resource_id=deployment_id,
        execution_mode=execution_mode,
    )
    if execution_mode == "local":
        _start_worker(_deployment_rollback_worker, job["id"], tenant_id, deployment_id)
    return {"job": job, "deployment": deployer_service.get_deployment(deployment_id, tenant_id) or deployment}


def _cancel_related_resource(job: Dict[str, Any]) -> Dict[str, Any]:
    payload = job.get("payload", {})
    if job["job_type"] == "quality_check":
        metrics = dict(payload.get("metrics") or {})
        metrics["cancelled"] = True
        record = catalog_service.update_quality_check(job["resource_id"], job["tenant_id"], "cancelled", metrics)
        return {"quality_check": record or {"id": job.get("resource_id")}, "quality_check_id": job.get("resource_id")}
    if job["job_type"] in {"deployment", "deployment_rollback"}:
        stage = "rollback_cancelled" if job["job_type"] == "deployment_rollback" else "cancelled"
        deployment = deployer_service.update_deployment_status(
            job["resource_id"],
            job["tenant_id"],
            status="cancelled",
            run_status="cancelled",
            status_details={
                "stage": stage,
                "target_platform": payload.get("target_platform"),
            },
            run_id=job["id"],
        )
        return {"deployment": deployment or {"id": job.get("resource_id")}, "deployment_id": job.get("resource_id")}
    if job["job_type"] == "experiment_run":
        run = ml_service.update_run(
            job["tenant_id"],
            job["resource_id"],
            status="cancelled",
            params=payload.get("params", {}),
            metrics={**(payload.get("metrics") or {}), "cancelled": True},
            artifacts=payload.get("artifacts", {}),
        )
        return {"experiment_run": run or {"id": job.get("resource_id")}, "run_id": job.get("resource_id")}
    return {}


def cancel_job(job_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    job = get_job(job_id, tenant_id)
    if not job:
        return None

    status = str(job.get("status") or "").lower()
    if status not in CANCELABLE_JOB_STATUSES:
        raise ValueError("Only queued or running jobs can be cancelled")

    next_result = {**_job_reference_result(job), **_cancel_related_resource(job), "cancelled_at": now_iso()}
    return _update_job(job_id, tenant_id, "cancelled", result=next_result, error_text="Cancelled by operator", clear_claim=job.get("execution_mode") == "remote")


def retry_job(job_id: str, tenant_id: str, created_by: str) -> Optional[Dict[str, Any]]:
    job = get_job(job_id, tenant_id)
    if not job:
        return None

    status = str(job.get("status") or "").lower()
    if status in CANCELABLE_JOB_STATUSES:
        raise ValueError("Active jobs cannot be retried")

    payload = job.get("payload", {})
    execution_mode = normalize_run_mode(job.get("execution_mode"))

    if job["job_type"] == "quality_check":
        return queue_quality_check(
            tenant_id=tenant_id,
            dataset_id=str(payload.get("dataset_id") or ""),
            check_name=str(payload.get("check_name") or "Quality check"),
            created_by=created_by,
            metrics=payload.get("metrics") or {},
            final_status=str(payload.get("final_status") or "passed"),
            run_mode=execution_mode,
        )

    if job["job_type"] == "deployment":
        return queue_deployment(
            tenant_id=tenant_id,
            pipeline_id=str(payload.get("pipeline_id") or ""),
            target_platform=str(payload.get("target_platform") or "container"),
            created_by=created_by,
            target_id=payload.get("target_id"),
            target_config=payload.get("target_config") or {},
            run_mode=execution_mode,
        )

    if job["job_type"] == "deployment_rollback":
        return queue_deployment_rollback(
            tenant_id=tenant_id,
            deployment_id=str(job.get("resource_id") or ""),
            created_by=created_by,
            run_mode=execution_mode,
        )

    if job["job_type"] == "experiment_run":
        return queue_experiment_run(
            tenant_id=tenant_id,
            experiment_id=str(payload.get("experiment_id") or ""),
            created_by=created_by,
            model_id=payload.get("model_id"),
            params=payload.get("params") or {},
            metrics=payload.get("metrics") or {},
            artifacts=payload.get("artifacts") or {},
            final_status=str(payload.get("final_status") or "completed"),
            run_mode=execution_mode,
        )

    raise ValueError(f"Retry is not supported for job type {job['job_type']}")


def queue_experiment_run(
    tenant_id: str,
    experiment_id: str,
    created_by: str,
    model_id: str | None = None,
    params: Optional[Dict[str, Any]] = None,
    metrics: Optional[Dict[str, Any]] = None,
    artifacts: Optional[Dict[str, Any]] = None,
    final_status: str = "completed",
    run_mode: str = "local",
) -> Dict[str, Any]:
    execution_mode = normalize_run_mode(run_mode)
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
        execution_mode=execution_mode,
    )
    if execution_mode == "local":
        _start_worker(_experiment_worker, job["id"], tenant_id, run["id"])
    return {"job": job, "run": run}