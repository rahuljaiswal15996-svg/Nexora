from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from prometheus_client import Counter, Gauge, Histogram


logger = logging.getLogger("nexora.broker-observability")

BROKER_QUEUE_DEPTH = Gauge(
    "nexora_broker_queue_depth",
    "Current queue depth for each broker work queue.",
    ["queue_kind"],
)
BROKER_PUBLISH_TOTAL = Counter(
    "nexora_broker_publish_total",
    "Total broker messages published by queue.",
    ["queue_kind"],
)
BROKER_CLAIM_TOTAL = Counter(
    "nexora_broker_claim_total",
    "Total remote work claims handled by the control plane.",
    ["workload_kind", "source"],
)
BROKER_PROCESSED_TOTAL = Counter(
    "nexora_broker_processed_total",
    "Total remote work completions reported through the control plane.",
    ["workload_kind", "status"],
)
BROKER_PROCESSING_DURATION_SECONDS = Histogram(
    "nexora_broker_processing_duration_seconds",
    "Duration between remote work claim/start and final report.",
    ["workload_kind", "status"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600),
)
BROKER_REQUEUE_TOTAL = Counter(
    "nexora_broker_requeue_total",
    "Total broker requeues triggered by maintenance or routing safeguards.",
    ["queue_kind", "reason", "source"],
)
BROKER_RETRY_TOTAL = Counter(
    "nexora_broker_retry_total",
    "Total broker retry attempts triggered for work items.",
    ["queue_kind", "reason", "source"],
)
BROKER_DLQ_TOTAL = Counter(
    "nexora_broker_dlq_total",
    "Total broker work items moved to the dead letter queue.",
    ["queue_kind", "reason", "source"],
)
BROKER_REQUEUE_LOOP_DETECTED_TOTAL = Counter(
    "nexora_broker_requeue_loop_detected_total",
    "Total broker requeue loops detected before dead-lettering work items.",
    ["queue_kind", "reason", "source"],
)
BROKER_RECOVERY_TOTAL = Counter(
    "nexora_broker_recovery_total",
    "Total broker recovery decisions recorded by workload, reason, and outcome.",
    ["workload_kind", "reason", "outcome", "source"],
)
BROKER_RECOVERY_FAILED_TOTAL = Counter(
    "nexora_broker_recovery_failed_total",
    "Total broker recovery attempts that failed before a decision could be recorded.",
    ["workload_kind", "reason", "source"],
)
BROKER_STALE_WORK_TOTAL = Gauge(
    "nexora_broker_stale_work_total",
    "Current count of remote work that is stale and needs broker recovery.",
    ["workload_kind", "state"],
)
BROKER_FAILED_WORK_TOTAL = Gauge(
    "nexora_broker_failed_work_total",
    "Current count of failed remote work records in the database.",
    ["workload_kind"],
)
BROKER_DB_FALLBACK_ENABLED = Gauge(
    "nexora_broker_db_fallback_enabled",
    "Deprecated compatibility gauge for DB fallback claiming on legacy agent poll endpoints.",
)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        candidate = value
        return candidate if candidate.tzinfo else candidate.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None
    try:
        candidate = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        return None
    return candidate if candidate.tzinfo else candidate.replace(tzinfo=timezone.utc)


def _duration_seconds(started_at: Any, finished_at: Any) -> float | None:
    started = _parse_datetime(started_at)
    finished = _parse_datetime(finished_at) or datetime.now(timezone.utc)
    if not started or finished < started:
        return None
    return (finished - started).total_seconds()


def _load_json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return dict(parsed) if isinstance(parsed, dict) else {}


def record_broker_queue_depth(queue_kind: str, depth: int) -> None:
    BROKER_QUEUE_DEPTH.labels(queue_kind=str(queue_kind)).set(max(0, int(depth)))


def record_broker_publish(queue_kind: str, depth: int | None = None) -> None:
    BROKER_PUBLISH_TOTAL.labels(queue_kind=str(queue_kind)).inc()
    if depth is not None:
        record_broker_queue_depth(queue_kind, depth)


def record_broker_claim(workload_kind: str, source: str) -> None:
    BROKER_CLAIM_TOTAL.labels(workload_kind=str(workload_kind), source=str(source)).inc()


def record_broker_processed(
    workload_kind: str,
    status: str,
    *,
    started_at: Any = None,
    claimed_at: Any = None,
    finished_at: Any = None,
) -> None:
    normalized_status = str(status or "unknown").strip().lower() or "unknown"
    BROKER_PROCESSED_TOTAL.labels(workload_kind=str(workload_kind), status=normalized_status).inc()
    duration_seconds = _duration_seconds(started_at or claimed_at, finished_at)
    if duration_seconds is not None:
        BROKER_PROCESSING_DURATION_SECONDS.labels(
            workload_kind=str(workload_kind),
            status=normalized_status,
        ).observe(duration_seconds)


def record_broker_requeue(queue_kind: str, reason: str, source: str) -> None:
    BROKER_REQUEUE_TOTAL.labels(
        queue_kind=str(queue_kind),
        reason=str(reason),
        source=str(source),
    ).inc()


def record_broker_retry(queue_kind: str, reason: str, source: str) -> None:
    BROKER_RETRY_TOTAL.labels(
        queue_kind=str(queue_kind),
        reason=str(reason),
        source=str(source),
    ).inc()


def record_broker_dlq(queue_kind: str, reason: str, source: str) -> None:
    BROKER_DLQ_TOTAL.labels(
        queue_kind=str(queue_kind),
        reason=str(reason),
        source=str(source),
    ).inc()


def record_broker_requeue_loop_detected(queue_kind: str, reason: str, source: str) -> None:
    BROKER_REQUEUE_LOOP_DETECTED_TOTAL.labels(
        queue_kind=str(queue_kind),
        reason=str(reason),
        source=str(source),
    ).inc()


def record_broker_recovery(workload_kind: str, reason: str, outcome: str, source: str) -> None:
    BROKER_RECOVERY_TOTAL.labels(
        workload_kind=str(workload_kind),
        reason=str(reason),
        outcome=str(outcome),
        source=str(source),
    ).inc()


def record_broker_recovery_failed(workload_kind: str, reason: str, source: str) -> None:
    BROKER_RECOVERY_FAILED_TOTAL.labels(
        workload_kind=str(workload_kind),
        reason=str(reason),
        source=str(source),
    ).inc()


def _visibility_refresh_due(last_enqueued_at: Any, cutoff: datetime) -> bool:
    parsed = _parse_datetime(last_enqueued_at)
    if parsed is None:
        return True
    return parsed <= cutoff


def broker_observability_snapshot() -> dict[str, Any]:
    from app.services.db import get_connection
    from app.services.work_broker import (
        PIPELINE_RUN_QUEUE,
        PLATFORM_JOB_QUEUE,
        broker_backend,
        broker_db_fallback_enabled,
        broker_maintenance_interval_seconds,
        broker_message_max_retries,
        broker_message_ttl_seconds,
        broker_requeue_loop_detection_threshold,
        broker_visibility_timeout_seconds,
        dead_letter_queue_depth_snapshot,
        queue_depth_snapshot,
    )

    queue_depths = queue_depth_snapshot([PIPELINE_RUN_QUEUE, PLATFORM_JOB_QUEUE])
    for queue_kind, depth in queue_depths.items():
        record_broker_queue_depth(queue_kind, depth)
    dlq_queue_depths = dead_letter_queue_depth_snapshot([PIPELINE_RUN_QUEUE, PLATFORM_JOB_QUEUE])
    for queue_kind, depth in dlq_queue_depths.items():
        record_broker_queue_depth(f"dlq:{queue_kind}", depth)

    now = datetime.now(timezone.utc)
    visibility_cutoff = now - timedelta(seconds=broker_visibility_timeout_seconds())
    snapshot = {
        "generated_at": now.isoformat(),
        "backend": broker_backend(),
        "db_fallback_enabled": broker_db_fallback_enabled(),
        "visibility_timeout_seconds": broker_visibility_timeout_seconds(),
        "maintenance_interval_seconds": broker_maintenance_interval_seconds(),
        "message_max_retries": broker_message_max_retries(),
        "message_ttl_seconds": broker_message_ttl_seconds(),
        "requeue_loop_detection_threshold": broker_requeue_loop_detection_threshold(),
        "queue_depths": queue_depths,
        "stale_work": {
            "pipeline_run": {"expired_lease": 0, "visibility_refresh_due": 0},
            "platform_job": {"expired_lease": 0, "visibility_refresh_due": 0},
        },
        "failed_work": {
            "pipeline_run": 0,
            "platform_job": 0,
        },
        "dlq": {
            "queue_depths": dlq_queue_depths,
            "dead_lettered_work": {
                "pipeline_run": 0,
                "platform_job": 0,
            },
        },
    }

    with get_connection() as conn:
        snapshot["stale_work"]["pipeline_run"]["expired_lease"] = int(
            conn.execute(
                """
                SELECT COUNT(*)
                FROM pipeline_runs
                WHERE execution_mode = 'remote' AND status = 'running'
                  AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
                """,
                (now.isoformat(),),
            ).fetchone()[0]
            or 0
        )
        snapshot["stale_work"]["platform_job"]["expired_lease"] = int(
            conn.execute(
                """
                SELECT COUNT(*)
                FROM platform_jobs
                WHERE execution_mode = 'remote' AND status = 'running'
                  AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
                """,
                (now.isoformat(),),
            ).fetchone()[0]
            or 0
        )
        failed_run_rows = conn.execute(
            """
            SELECT run_metadata
            FROM pipeline_runs
            WHERE execution_mode = 'remote' AND status IN ('failed', 'error')
            """
        ).fetchall()
        failed_job_rows = conn.execute(
            """
            SELECT result_json
            FROM platform_jobs
            WHERE execution_mode = 'remote' AND status = 'failed'
            """
        ).fetchall()
        snapshot["failed_work"]["pipeline_run"] = len(failed_run_rows)
        snapshot["failed_work"]["platform_job"] = len(failed_job_rows)

        queued_run_rows = conn.execute(
            """
            SELECT run_metadata
            FROM pipeline_runs
            WHERE execution_mode = 'remote' AND status = 'queued_remote'
            """
        ).fetchall()
        queued_job_rows = conn.execute(
            """
            SELECT result_json
            FROM platform_jobs
            WHERE execution_mode = 'remote' AND status = 'queued'
            """
        ).fetchall()

    snapshot["stale_work"]["pipeline_run"]["visibility_refresh_due"] = sum(
        1
        for row in queued_run_rows
        if _visibility_refresh_due(_load_json_dict(row[0]).get("broker_last_enqueued_at"), visibility_cutoff)
    )
    snapshot["stale_work"]["platform_job"]["visibility_refresh_due"] = sum(
        1
        for row in queued_job_rows
        if _visibility_refresh_due(_load_json_dict(row[0]).get("broker_last_enqueued_at"), visibility_cutoff)
    )
    snapshot["dlq"]["dead_lettered_work"]["pipeline_run"] = sum(
        1
        for row in failed_run_rows
        if _load_json_dict(row[0]).get("broker_dead_lettered_at")
    )
    snapshot["dlq"]["dead_lettered_work"]["platform_job"] = sum(
        1
        for row in failed_job_rows
        if _load_json_dict(row[0]).get("broker_dead_lettered_at")
    )

    BROKER_DB_FALLBACK_ENABLED.set(1 if snapshot["db_fallback_enabled"] else 0)
    for workload_kind, states in snapshot["stale_work"].items():
        for state, count in states.items():
            BROKER_STALE_WORK_TOTAL.labels(workload_kind=workload_kind, state=state).set(int(count))
    for workload_kind, count in snapshot["failed_work"].items():
        BROKER_FAILED_WORK_TOTAL.labels(workload_kind=workload_kind).set(int(count))

    return snapshot


def broker_dlq_snapshot(queue_kind: str | None = None, *, limit: int = 20) -> dict[str, Any]:
    from app.services.work_broker import (
        PIPELINE_RUN_QUEUE,
        PLATFORM_JOB_QUEUE,
        dead_letter_queue_depth_snapshot,
        inspect_dead_letter_messages,
    )

    selected_queue_kinds = [queue_kind] if queue_kind else [PIPELINE_RUN_QUEUE, PLATFORM_JOB_QUEUE]
    queue_depths = dead_letter_queue_depth_snapshot(selected_queue_kinds)
    items = inspect_dead_letter_messages(selected_queue_kinds, limit=max(1, int(limit)))
    for candidate, depth in queue_depths.items():
        record_broker_queue_depth(f"dlq:{candidate}", depth)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "queue_depths": queue_depths,
        "items": items if queue_kind is None else items.get(queue_kind, []),
    }