from collections.abc import Mapping
import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, cast
from uuid import uuid4

from . import db
from .broker_observability import (
    record_broker_claim,
    record_broker_processed,
    record_broker_recovery,
    record_broker_recovery_failed,
    record_broker_requeue_loop_detected,
    record_broker_requeue,
    record_broker_retry,
)
from .execution_engine import (
    execute_node,
    node_error_is_retryable,
    node_execution_error_details,
    resolve_executor,
)
from .work_broker import (
    PIPELINE_RUN_QUEUE,
    broker_metadata_updates,
    broker_state_from_metadata,
    broker_visibility_timeout_seconds,
    build_pipeline_run_message,
    make_dead_letter_message,
    next_requeue_message,
    publish_dead_letter_message,
    publish_pipeline_run_message,
)

logger = logging.getLogger("nexora.pipeline")

DEFAULT_REMOTE_LEASE_SECONDS = int(os.getenv("NEXORA_REMOTE_RUN_LEASE_SECONDS", "90"))
DEFAULT_REMOTE_MAX_ATTEMPTS = int(os.getenv("NEXORA_REMOTE_RUN_MAX_ATTEMPTS", "3"))
DEFAULT_LOG_PAGE_SIZE = int(os.getenv("NEXORA_PIPELINE_LOG_PAGE_SIZE", "200"))

SUCCESS_STATUSES = {"success", "completed", "succeeded"}
FAILURE_STATUSES = {"failed", "error"}
ACTIVE_STATUSES = {"queued", "queued_remote", "running", "running_remote"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _lease_expiration_iso(seconds: int) -> str:
    ttl = max(1, int(seconds or DEFAULT_REMOTE_LEASE_SECONDS))
    return (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat()


def _normalize_agent_id(agent_id: str | None) -> str:
    candidate = (agent_id or "anonymous-agent").strip()
    return candidate or "anonymous-agent"


def _as_dict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return dict(cast(dict[str, Any], value))


def _as_node_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    nodes: list[dict[str, Any]] = []
    for item in cast(list[Any], value):
        if isinstance(item, dict):
            nodes.append(dict(cast(dict[str, Any], item)))
    return nodes


def _as_edge_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    edges: list[dict[str, Any]] = []
    for item in cast(list[Any], value):
        if isinstance(item, dict):
            edges.append(dict(cast(dict[str, Any], item)))
    return edges


def _pipeline_metadata(dag_json: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(dag_json).get("metadata"))


def _pipeline_project_id(metadata: dict[str, Any]) -> str | None:
    project = _as_dict(metadata.get("project"))
    candidate = metadata.get("project_id") or project.get("id")
    project_id = str(candidate or "").strip()
    return project_id or None


def _pipeline_project_name(metadata: dict[str, Any]) -> str | None:
    project = _as_dict(metadata.get("project"))
    project_name = str(project.get("name") or metadata.get("project_name") or "").strip()
    return project_name or None


def _pipeline_workspace_id(metadata: dict[str, Any]) -> str | None:
    workspace = _as_dict(metadata.get("workspace"))
    project = _as_dict(metadata.get("project"))
    project_context = _as_dict(metadata.get("project_context"))
    candidate = (
        metadata.get("workspace_id")
        or workspace.get("id")
        or project.get("workspace_id")
        or project_context.get("active_workspace_id")
    )
    workspace_id = str(candidate or "").strip()
    return workspace_id or None


def _pipeline_workspace_name(metadata: dict[str, Any]) -> str | None:
    workspace = _as_dict(metadata.get("workspace"))
    workspace_name = str(workspace.get("name") or metadata.get("workspace_name") or "").strip()
    return workspace_name or None


def _normalized_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _pipeline_scope_from_dag(dag_json: Any) -> dict[str, str | None]:
    metadata = _pipeline_metadata(dag_json)
    return {
        "project_id": _pipeline_project_id(metadata),
        "project_name": _pipeline_project_name(metadata),
        "workspace_id": _pipeline_workspace_id(metadata),
        "workspace_name": _pipeline_workspace_name(metadata),
    }


def _effective_pipeline_scope(row: Mapping[str, Any], dag_json: Any) -> dict[str, str | None]:
    derived = _pipeline_scope_from_dag(dag_json)
    return {
        "project_id": _normalized_text(row.get("project_id")) or derived["project_id"],
        "project_name": derived["project_name"],
        "workspace_id": _normalized_text(row.get("workspace_id")) or derived["workspace_id"],
        "workspace_name": derived["workspace_name"],
    }


def _hydrate_pipeline(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    hydrated = dict(row)
    dag_json = _load_json_dict(hydrated.get("dag_json"))
    scope = _effective_pipeline_scope(hydrated, dag_json)
    hydrated["dag_json"] = dag_json
    hydrated["project_id"] = scope["project_id"]
    hydrated["workspace_id"] = scope["workspace_id"]
    hydrated["updated_at"] = _normalized_text(hydrated.get("updated_at")) or hydrated.get("created_at")
    return hydrated


def _summarize_pipeline_node(node: dict[str, Any], index: int) -> dict[str, Any]:
    data = _as_dict(node.get("data"))
    config = _as_dict(node.get("config"))
    metadata = _as_dict(node.get("metadata"))
    execution_binding = _as_dict(node.get("execution_binding") or data.get("execution_binding"))
    notebook_id = str(config.get("notebook_id") or metadata.get("notebook_asset_id") or "").strip()
    return {
        "id": _node_id(node, index),
        "kind": _node_kind(node),
        "label": _node_label(node, index),
        "executor": str(execution_binding.get("executor") or "").strip() or None,
        "notebook_id": notebook_id or None,
    }


def _summarize_pipeline(row: Mapping[str, Any]) -> dict[str, Any]:
    pipeline = _hydrate_pipeline(row) or {}
    dag_json = _load_json_dict(pipeline.get("dag_json"))
    scope = _effective_pipeline_scope(pipeline, dag_json)
    nodes = [
        _summarize_pipeline_node(node, index)
        for index, node in enumerate(_as_node_list(dag_json.get("nodes")))
    ]
    notebook_nodes = [node for node in nodes if node.get("kind") == "notebook"]
    return {
        "id": str(pipeline.get("id") or ""),
        "name": str(pipeline.get("name") or ""),
        "created_at": pipeline.get("created_at"),
        "updated_at": pipeline.get("updated_at") or pipeline.get("created_at"),
        "project_id": scope["project_id"],
        "project_name": scope["project_name"],
        "workspace_id": scope["workspace_id"],
        "workspace_name": scope["workspace_name"],
        "node_count": len(nodes),
        "notebook_node_count": len(notebook_nodes),
        "nodes": nodes,
    }


def _load_json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(cast(dict[str, Any], value))
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return dict(cast(dict[str, Any], parsed)) if isinstance(parsed, dict) else {}


def _merge_json_text(existing: Any, updates: dict[str, Any] | None = None) -> str:
    merged = _load_json_dict(existing)
    if updates:
        merged.update(updates)
    return json.dumps(merged)


def _fetch_rows(query: str, params: tuple[Any, ...] = ()) -> list[db.DBRow]:
    with db.get_connection() as conn:
        return conn.execute(query, params).fetchall()


def _hydrate_run(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    hydrated = dict(row)
    hydrated["run_metadata"] = _load_json_dict(hydrated.get("run_metadata"))
    return hydrated


def _hydrate_node_execution(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    hydrated = dict(row)
    hydrated["metadata"] = _load_json_dict(hydrated.get("metadata_json"))
    hydrated["execution_unit_id"] = hydrated.get("id")
    return hydrated


def _hydrate_log_entry(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    hydrated = dict(row)
    hydrated["metadata"] = _load_json_dict(hydrated.get("metadata_json"))
    hydrated["cursor"] = hydrated.get("id")
    return hydrated


def _node_id(node: dict[str, Any], index: int) -> str:
    candidate = node.get("id") or _as_dict(node.get("data")).get("id")
    return str(candidate or f"flow-node-{index + 1}")


def _node_kind(node: dict[str, Any]) -> str:
    data = _as_dict(node.get("data"))
    raw_kind = str(node.get("kind") or data.get("kind") or node.get("type") or data.get("type") or "recipe").strip().lower()
    aliases = {
        "transformation": "recipe",
        "transform": "recipe",
        "deployment": "deploy",
        "serving": "deploy",
        "model_training": "model",
    }
    return aliases.get(raw_kind, raw_kind or "recipe")


def _node_label(node: dict[str, Any], index: int) -> str:
    data = _as_dict(node.get("data"))
    candidate = node.get("label") or data.get("label") or node.get("name") or data.get("name")
    return str(candidate or _node_id(node, index))


def _node_max_attempts(node: dict[str, Any], run_config: dict[str, Any]) -> int:
    data = _as_dict(node.get("data"))
    config = _as_dict(node.get("config"))
    metadata = _as_dict(node.get("metadata"))
    candidates: list[Any] = [
        config.get("retry_limit"),
        metadata.get("retry_limit"),
        _as_dict(data.get("config")).get("retry_limit"),
        run_config.get("max_node_attempts"),
        DEFAULT_REMOTE_MAX_ATTEMPTS,
    ]
    for value in candidates:
        if value is None:
            continue
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            continue
    return max(1, DEFAULT_REMOTE_MAX_ATTEMPTS)


def _retry_backoff_seconds(node: dict[str, Any], attempt: int) -> float:
    config = _as_dict(node.get("config"))
    configured = config.get("retry_backoff_seconds")
    if configured is not None:
        try:
            return max(0.1, min(5.0, float(configured)))
        except (TypeError, ValueError):
            pass
    return min(5.0, max(0.1, 0.25 * attempt))


def _build_lineage_maps(edges: list[dict[str, Any]]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    upstream_by_node: dict[str, list[str]] = {}
    downstream_by_node: dict[str, list[str]] = {}
    for edge in edges:
        source = str(edge.get("source") or "").strip()
        target = str(edge.get("target") or "").strip()
        if not source or not target:
            continue
        downstream_by_node.setdefault(source, []).append(target)
        upstream_by_node.setdefault(target, []).append(source)
        upstream_by_node.setdefault(source, upstream_by_node.get(source, []))
        downstream_by_node.setdefault(target, downstream_by_node.get(target, []))
    return upstream_by_node, downstream_by_node


def _node_execution_metadata(
    node: dict[str, Any],
    run_config: dict[str, Any],
    upstream_node_ids: list[str],
    downstream_node_ids: list[str],
) -> dict[str, Any]:
    data = _as_dict(node.get("data"))
    metadata = _as_dict(node.get("metadata"))
    merged: dict[str, Any] = {
        **metadata,
        "upstream_node_ids": upstream_node_ids,
        "downstream_node_ids": downstream_node_ids,
        "view_mode": run_config.get("view_mode"),
        "overlay_mode": run_config.get("overlay_mode"),
        "source_ref": node.get("sourceRef") or metadata.get("source_ref") or data.get("sourceRef"),
        "flow_node_type": node.get("type") or data.get("type") or _node_kind(node),
        "config": node.get("config") or data.get("config") or {},
        "execution_binding": node.get("execution_binding") or data.get("execution_binding") or {},
    }
    if data:
        merged["data"] = data
    return merged


def _find_run_node(run_id: str, node_id: str) -> dict[str, Any] | None:
    rows = _fetch_rows(
        "SELECT * FROM pipeline_run_nodes WHERE run_id = ? AND node_id = ? LIMIT 1",
        (run_id, node_id),
    )
    if not rows:
        return None
    return _hydrate_node_execution(rows[0])


def _append_run_log(
    run_id: str,
    tenant_id: str,
    node_id: str | None,
    level: str,
    message: str,
    *,
    node_execution_id: str | None = None,
    stream: str = "stdout",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    now = _now_iso()
    with db.get_connection() as conn:
        row = conn.execute(
            """
            INSERT INTO pipeline_run_logs (
                run_id, tenant_id, node_execution_id, node_id, level, stream, message, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (
                run_id,
                tenant_id,
                node_execution_id,
                node_id,
                level,
                stream,
                message,
                json.dumps(metadata or {}),
                now,
            ),
        ).fetchone()
        conn.commit()
    return _hydrate_log_entry(row)


def _update_node_execution(
    run_id: str,
    node_id: str,
    status: str,
    *,
    metadata: dict[str, Any] | None = None,
    error_text: str | None = None,
) -> dict[str, Any] | None:
    now = _now_iso()
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM pipeline_run_nodes WHERE run_id = ? AND node_id = ? LIMIT 1",
            (run_id, node_id),
        ).fetchone()
        if not row:
            return None
        metadata_text = _merge_json_text(row["metadata_json"], metadata)
        if status == "running":
            conn.execute(
                """
                UPDATE pipeline_run_nodes
                SET status = ?, attempt_count = attempt_count + 1, started_at = COALESCE(started_at, ?),
                    finished_at = NULL, updated_at = ?, metadata_json = ?, error_text = NULL
                WHERE run_id = ? AND node_id = ?
                """,
                (status, now, now, metadata_text, run_id, node_id),
            )
        elif status in SUCCESS_STATUSES | FAILURE_STATUSES | {"skipped"}:
            conn.execute(
                """
                UPDATE pipeline_run_nodes
                SET status = ?, finished_at = ?, updated_at = ?, metadata_json = ?, error_text = ?
                WHERE run_id = ? AND node_id = ?
                """,
                (status, now, now, metadata_text, error_text, run_id, node_id),
            )
        else:
            conn.execute(
                """
                UPDATE pipeline_run_nodes
                SET status = ?, updated_at = ?, metadata_json = ?, error_text = ?
                WHERE run_id = ? AND node_id = ?
                """,
                (status, now, metadata_text, error_text, run_id, node_id),
            )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM pipeline_run_nodes WHERE run_id = ? AND node_id = ? LIMIT 1",
            (run_id, node_id),
        ).fetchone()
    return _hydrate_node_execution(updated)


def _summarize_run_nodes(run_id: str) -> dict[str, Any]:
    summary = {
        "total": 0,
        "queued": 0,
        "running": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0,
    }
    rows = _fetch_rows(
        "SELECT status, COUNT(*) AS count FROM pipeline_run_nodes WHERE run_id = ? GROUP BY status",
        (run_id,),
    )
    for row in rows:
        status = str(row["status"] or "").lower()
        count = int(row["count"] or 0)
        if status in summary:
            summary[status] = count
        summary["total"] += count
    return summary


def _initialize_run_nodes(
    run_id: str,
    pipeline_id: str,
    tenant_id: str,
    pipeline: dict[str, Any],
    run_config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    config = _as_dict(run_config)
    dag_json = _as_dict(pipeline.get("dag_json"))
    nodes = _as_node_list(dag_json.get("nodes"))
    edges = _as_edge_list(dag_json.get("edges"))
    retry_from_node = str(config.get("retry_from_node") or "").strip()
    retry_start_index = 0
    if retry_from_node:
        for index, node in enumerate(nodes):
            if _node_id(node, index) == retry_from_node:
                retry_start_index = index
                break
    upstream_by_node, downstream_by_node = _build_lineage_maps(edges)
    now = _now_iso()
    with db.get_connection() as conn:
        for index, node in enumerate(nodes):
            node_id = _node_id(node, index)
            queued_status = "queued"
            finished_at = None
            metadata = _node_execution_metadata(
                node,
                config,
                upstream_by_node.get(node_id, []),
                downstream_by_node.get(node_id, []),
            )
            max_attempts = _node_max_attempts(node, config)
            if retry_from_node and index < retry_start_index:
                queued_status = "skipped"
                finished_at = now
                metadata["reused_from_retry"] = True
            conn.execute(
                """
                INSERT INTO pipeline_run_nodes (
                    id, run_id, pipeline_id, tenant_id, node_id, node_label, node_kind, stage_index,
                    status, attempt_count, max_attempts, metadata_json, error_text, started_at, finished_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    run_id,
                    pipeline_id,
                    tenant_id,
                    node_id,
                    _node_label(node, index),
                    _node_kind(node),
                    index,
                    queued_status,
                    0,
                    max_attempts,
                    json.dumps(metadata),
                    None,
                    None,
                    finished_at,
                    now,
                ),
            )
        conn.commit()

    if retry_from_node and retry_start_index > 0:
        for index, node in enumerate(nodes[:retry_start_index]):
            node_id = _node_id(node, index)
            node_execution = _find_run_node(run_id, node_id)
            _append_run_log(
                run_id,
                tenant_id,
                node_id,
                "warn",
                f"Skipped because the run restarted from node {retry_from_node}.",
                node_execution_id=node_execution.get("execution_unit_id") if node_execution else None,
                metadata={"reused_from_retry": True, "retry_from_node": retry_from_node},
            )

    return list_run_node_executions(run_id, tenant_id)


def _update_run_status(run_id: str, status: str, extra: dict[str, Any] | None = None) -> None:
    now = _now_iso()
    with db.get_connection() as conn:
        row = conn.execute("SELECT run_metadata FROM pipeline_runs WHERE id = ?", (run_id,)).fetchone()
        metadata_text = _merge_json_text(row["run_metadata"] if row else None, extra)
        if status == "running":
            conn.execute(
                """
                UPDATE pipeline_runs
                SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?, run_metadata = ?
                WHERE id = ?
                """,
                (status, now, now, metadata_text, run_id),
            )
        elif status in SUCCESS_STATUSES | FAILURE_STATUSES:
            conn.execute(
                """
                UPDATE pipeline_runs
                SET status = ?, finished_at = ?, updated_at = ?, run_metadata = ?
                WHERE id = ?
                """,
                (status, now, now, metadata_text, run_id),
            )
        else:
            conn.execute(
                "UPDATE pipeline_runs SET status = ?, updated_at = ?, run_metadata = ? WHERE id = ?",
                (status, now, metadata_text, run_id),
            )
        conn.commit()


def _merge_output_artifacts(existing_metadata: dict[str, Any], execution_result: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing_metadata)
    if execution_result.get("output_artifacts"):
        merged["output_artifacts"] = execution_result["output_artifacts"]
    if execution_result.get("metadata"):
        merged.update(_as_dict(execution_result.get("metadata")))
    return merged


def _record_run_node_event(
    run_id: str,
    tenant_id: str,
    node_id: str,
    status: str,
    *,
    metadata: dict[str, Any] | None = None,
    error_text: str | None = None,
    logs: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    node_execution = _update_node_execution(run_id, node_id, status, metadata=metadata, error_text=error_text)
    if not node_execution:
        return None

    for log in logs or []:
        _append_run_log(
            run_id,
            tenant_id,
            node_id,
            str(log.get("level") or "info"),
            str(log.get("message") or ""),
            node_execution_id=node_execution.get("execution_unit_id"),
            stream=str(log.get("stream") or "stdout"),
            metadata=_as_dict(log.get("metadata")),
        )
    return node_execution


def _update_run_broker_metadata(run_id: str, broker_updates: dict[str, Any]) -> bool:
    with db.get_connection() as conn:
        row = conn.execute("SELECT run_metadata FROM pipeline_runs WHERE id = ?", (run_id,)).fetchone()
        if not row:
            return False
        cursor = conn.execute(
            "UPDATE pipeline_runs SET run_metadata = ?, updated_at = ? WHERE id = ?",
            (_merge_json_text(row[0], broker_updates), _now_iso(), run_id),
        )
        conn.commit()
    return bool(cursor.rowcount)


def dead_letter_remote_run(
    run_id: str,
    pipeline_id: str,
    tenant_id: str,
    reason: str,
    *,
    source: str,
    broker_message: dict[str, Any] | None = None,
) -> bool:
    now = _now_iso()
    error_message = f"Broker message moved to DLQ: {reason}"
    with db.get_connection() as conn:
        row = conn.execute(
            """
            SELECT pipeline_id, tenant_id, status, run_metadata, started_at, claimed_at
            FROM pipeline_runs
            WHERE id = ? AND execution_mode = 'remote'
            LIMIT 1
            """,
            (run_id,),
        ).fetchone()
        if not row:
            return False
        if str(row["status"] or "").strip().lower() not in {"queued_remote", "running"}:
            return False
        message = build_pipeline_run_message(
            run_id,
            str(row["tenant_id"] or tenant_id or "default"),
            str(row["pipeline_id"] or pipeline_id or ""),
            broker_message=broker_message or broker_state_from_metadata(_load_json_dict(row["run_metadata"])),
        )
        dlq_message = make_dead_letter_message(message, reason=reason, source=source)
        metadata_updates = broker_metadata_updates(
            dlq_message,
            queue_label="pipeline_run",
            requeue_reason=str(dlq_message.get("last_requeue_reason") or reason),
            dead_letter_reason=reason,
            dead_letter_source=source,
        )
        metadata_updates["error"] = error_message
        cursor = conn.execute(
            """
            UPDATE pipeline_runs
            SET status = 'failed', finished_at = ?, updated_at = ?, run_metadata = ?,
                claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL, lease_expires_at = NULL
            WHERE id = ? AND execution_mode = 'remote' AND status IN ('queued_remote', 'running')
            """,
            (now, now, _merge_json_text(row["run_metadata"], metadata_updates), run_id),
        )
        conn.commit()

    if not cursor.rowcount:
        return False

    publish_dead_letter_message(PIPELINE_RUN_QUEUE, dlq_message, reason=reason, source=source)
    record_broker_processed(
        "pipeline_run",
        "failed",
        started_at=row["started_at"],
        claimed_at=row["claimed_at"],
        finished_at=now,
    )
    _append_run_log(
        run_id,
        str(row["tenant_id"] or tenant_id or "default"),
        None,
        "error",
        error_message,
        stream="stderr",
        metadata={
            "broker_dead_letter_reason": reason,
            "broker_dead_letter_source": source,
            "retry_count": dlq_message.get("retry_count"),
            "max_retries": dlq_message.get("max_retries"),
        },
    )
    return True


def requeue_remote_run_message(
    run_id: str,
    pipeline_id: str,
    tenant_id: str,
    *,
    reason: str,
    source: str,
    broker_message: dict[str, Any] | None = None,
) -> str:
    next_message, evaluation = next_requeue_message(
        build_pipeline_run_message(run_id, tenant_id, pipeline_id, broker_message=broker_message),
        reason=reason,
    )
    if evaluation["emit_loop_metric"]:
        record_broker_requeue_loop_detected(PIPELINE_RUN_QUEUE, reason, source)
        logger.warning(
            "Detected repeated broker requeue loop for remote pipeline run",
            extra={
                "run_id": run_id,
                "pipeline_id": pipeline_id,
                "tenant_id": tenant_id,
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
        return "dead_lettered" if dead_letter_remote_run(
            run_id,
            pipeline_id,
            tenant_id,
            dead_letter_reason,
            source=source,
            broker_message=next_message,
        ) else "skipped"

    if not _update_run_broker_metadata(
        run_id,
        broker_metadata_updates(next_message, queue_label="pipeline_run", requeue_reason=reason),
    ):
        return "skipped"

    publish_pipeline_run_message(run_id, tenant_id, pipeline_id, broker_message=next_message)
    record_broker_requeue(PIPELINE_RUN_QUEUE, reason, source)
    record_broker_retry(PIPELINE_RUN_QUEUE, reason, source)
    return "requeued"


def _execute_pipeline(run_id: str, pipeline: dict[str, Any], run_config: dict[str, Any] | None) -> None:
    logger.info("Starting pipeline run %s", run_id)
    config = _as_dict(run_config)
    tenant_id = str(pipeline.get("tenant_id") or "default")
    dag_json = _as_dict(pipeline.get("dag_json"))
    nodes = _as_node_list(dag_json.get("nodes"))
    retry_from_node = str(config.get("retry_from_node") or "").strip()
    force_failure_node_id = str(config.get("force_failure_node_id") or config.get("fail_node_id") or "").strip()
    retry_start_index = 0
    current_node_id = ""
    current_node_label = ""
    upstream_results: dict[str, Any] = {}
    executed_node_count = 0

    if retry_from_node:
        for index, node in enumerate(nodes):
            if _node_id(node, index) == retry_from_node:
                retry_start_index = index
                break

    try:
        if not nodes:
            _append_run_log(
                run_id,
                tenant_id,
                None,
                "info",
                "No executable nodes were found in the pipeline DAG.",
                stream="system",
                metadata={"empty_dag": True},
            )
            _update_run_status(
                run_id,
                "success",
                extra={
                    "nodes_executed": 0,
                    "active_node_id": None,
                    "failed_node_id": None,
                    "retry_from_node": retry_from_node or None,
                },
            )
            return

        first_node_id = _node_id(nodes[retry_start_index], retry_start_index)
        _append_run_log(
            run_id,
            tenant_id,
            None,
            "info",
            f"Pipeline execution started with {len(nodes)} DAG nodes.",
            stream="system",
            metadata={"retry_from_node": retry_from_node or None},
        )
        _update_run_status(
            run_id,
            "running",
            extra={
                "active_node_id": first_node_id,
                "failed_node_id": None,
                "retry_from_node": retry_from_node or None,
            },
        )

        for index, node in enumerate(nodes):
            node_id = _node_id(node, index)
            node_label = _node_label(node, index)
            if retry_from_node and index < retry_start_index:
                continue

            current_node_id = node_id
            current_node_label = node_label
            node_execution = _find_run_node(run_id, node_id) or {}
            max_attempts = max(1, int(node_execution.get("max_attempts") or _node_max_attempts(node, config)))
            execution_binding = _as_dict(node.get("execution_binding") or _as_dict(node.get("data")).get("execution_binding"))
            executor_name = resolve_executor(node)

            for attempt in range(1, max_attempts + 1):
                node_execution = _record_run_node_event(
                    run_id,
                    tenant_id,
                    node_id,
                    "running",
                    metadata={
                        "active": True,
                        "current_label": node_label,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                    },
                    logs=[
                        {
                            "level": "info",
                            "message": f"Execution attempt {attempt} started for {node_label}.",
                            "metadata": {
                                "node_kind": _node_kind(node),
                                "stage_index": index,
                                "executor": executor_name,
                                "runtime_profile": execution_binding.get("runtime_profile"),
                                "engine_type": execution_binding.get("engine_type"),
                            },
                        }
                    ],
                ) or node_execution
                _update_run_status(
                    run_id,
                    "running",
                    extra={
                        "active_node_id": node_id,
                        "active_node_label": node_label,
                        "failed_node_id": None,
                    },
                )

                try:
                    if force_failure_node_id and node_id == force_failure_node_id:
                        raise RuntimeError(f"Forced failure on node {node_id}")

                    execution_result: dict[str, Any] = execute_node(
                        node,
                        {
                            "run_id": run_id,
                            "pipeline_id": pipeline.get("id"),
                            "tenant_id": tenant_id,
                            "run_config": config,
                            "parameters": config.get("parameters") or config.get("parameter_bindings") or {},
                            "upstream_results": upstream_results,
                            "_attempt": attempt,
                            "_max_attempts": max_attempts,
                        },
                    )
                    success_metadata = _merge_output_artifacts(_as_dict(node_execution.get("metadata")), execution_result)
                    success_metadata.update(
                        {
                            "active": False,
                            "completed_label": node_label,
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                        }
                    )
                    success_logs: list[dict[str, Any]] = list(cast(list[dict[str, Any]], execution_result.get("log_entries") or []))
                    success_logs.append(
                        {
                            "level": "success",
                            "message": f"Execution unit completed successfully for {node_label}.",
                            "metadata": {
                                "node_kind": _node_kind(node),
                                "stage_index": index,
                                "executor": executor_name,
                                "runtime_profile": execution_binding.get("runtime_profile"),
                                "engine_type": execution_binding.get("engine_type"),
                            },
                        }
                    )
                    _record_run_node_event(
                        run_id,
                        tenant_id,
                        node_id,
                        "success",
                        metadata=success_metadata,
                        logs=success_logs,
                    )
                    upstream_results[node_id] = {
                        "metadata": success_metadata,
                        "output_artifacts": execution_result.get("output_artifacts") or success_metadata.get("output_artifacts") or [],
                    }
                    executed_node_count += 1
                    break
                except Exception as exc:
                    error_details: dict[str, Any] = node_execution_error_details(exc, node=node)
                    error_message = str(error_details.get("error_message") or exc)
                    will_retry = attempt < max_attempts and node_error_is_retryable(exc)
                    failure_logs: list[dict[str, Any]] = [
                        {
                            "level": "error",
                            "message": f"Execution attempt {attempt} failed on {node_label}: {error_message}",
                            "stream": "stderr",
                            "metadata": {
                                "node_kind": _node_kind(node),
                                "stage_index": index,
                                "attempt": attempt,
                                **error_details,
                            },
                        }
                    ]
                    if will_retry:
                        failure_logs.append(
                            {
                                "level": "warn",
                                "message": f"Retrying {node_label} after attempt {attempt}.",
                                "metadata": {
                                    "retry_backoff_seconds": _retry_backoff_seconds(node, attempt),
                                    "executor": executor_name,
                                    "retryable": True,
                                    "error_code": error_details.get("error_code"),
                                },
                            }
                        )
                        _record_run_node_event(
                            run_id,
                            tenant_id,
                            node_id,
                            "queued",
                            metadata={
                                "active": False,
                                "attempt": attempt,
                                "max_attempts": max_attempts,
                                "last_error": error_message,
                                "waiting_retry": True,
                                "retryable": True,
                                "error_code": error_details.get("error_code"),
                            },
                            logs=failure_logs,
                        )
                        time.sleep(_retry_backoff_seconds(node, attempt))
                        continue

                    _record_run_node_event(
                        run_id,
                        tenant_id,
                        node_id,
                        "failed",
                        metadata={
                            "active": False,
                            "failed_label": node_label,
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                            "last_error": error_message,
                            "retryable": bool(error_details.get("retryable")),
                            "error_code": error_details.get("error_code"),
                        },
                        error_text=error_message,
                        logs=failure_logs,
                    )
                    _append_run_log(
                        run_id,
                        tenant_id,
                        None,
                        "error",
                        f"Pipeline execution failed on {node_label}: {error_message}",
                        stream="system",
                        metadata={"failed_node_id": node_id},
                    )
                    _update_run_status(
                        run_id,
                        "failed",
                        extra={
                            "error": error_message,
                            "error_code": error_details.get("error_code"),
                            "retryable": bool(error_details.get("retryable")),
                            "active_node_id": None,
                            "active_node_label": None,
                            "failed_node_id": node_id,
                            "failed_node_label": node_label,
                            "retry_from_node": retry_from_node or None,
                            "nodes_executed": executed_node_count,
                        },
                    )
                    return

        _update_run_status(
            run_id,
            "success",
            extra={
                "nodes_executed": executed_node_count,
                "active_node_id": None,
                "active_node_label": None,
                "failed_node_id": None,
                "retry_from_node": retry_from_node or None,
            },
        )
        _append_run_log(
            run_id,
            tenant_id,
            None,
            "success",
            "Pipeline execution completed successfully.",
            stream="system",
            metadata={"nodes_executed": executed_node_count},
        )
        logger.info("Pipeline run %s completed", run_id)
    except Exception as exc:
        logger.exception("Pipeline run failed: %s", exc)
        node_execution: dict[str, Any] | None = None
        if current_node_id:
            node_execution = _update_node_execution(
                run_id,
                current_node_id,
                "failed",
                metadata={"active": False, "failed_label": current_node_label},
                error_text=str(exc),
            )
            _append_run_log(
                run_id,
                tenant_id,
                current_node_id,
                "error",
                f"Execution unit failed on {current_node_label or current_node_id}: {exc}",
                node_execution_id=node_execution.get("execution_unit_id") if node_execution else None,
                stream="stderr",
                metadata={"error": str(exc)},
            )

        _append_run_log(
            run_id,
            tenant_id,
            None,
            "error",
            f"Pipeline execution failed: {exc}",
            stream="system",
            metadata={"failed_node_id": current_node_id or None},
        )
        _update_run_status(
            run_id,
            "failed",
            extra={
                "error": str(exc),
                "active_node_id": None,
                "active_node_label": None,
                "failed_node_id": current_node_id or None,
                "failed_node_label": current_node_label or None,
                "retry_from_node": retry_from_node or None,
            },
        )


def create_pipeline(tenant_id: str, name: str, dag_json: Any) -> dict[str, Any]:
    pid = str(uuid4())
    now = _now_iso()
    dag_payload = dag_json if not isinstance(dag_json, str) else _load_json_dict(dag_json)
    scope = _pipeline_scope_from_dag(dag_payload)
    dag_text = json.dumps(dag_payload) if not isinstance(dag_json, str) else dag_json
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO pipelines (id, tenant_id, name, project_id, workspace_id, dag_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (pid, tenant_id, name, scope["project_id"], scope["workspace_id"], dag_text, now, now),
        )
        conn.commit()
    return {"id": pid, "created_at": now}


def get_pipeline(pipeline_id: str) -> dict[str, Any] | None:
    rows = _fetch_rows("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,))
    if not rows:
        return None
    return _hydrate_pipeline(rows[0])


def backfill_pipeline_scope_columns(
    *,
    tenant_id: str | None = None,
    pipeline_id: str | None = None,
    include_existing: bool = False,
) -> dict[str, int]:
    filters = ["1 = 1"]
    params: list[Any] = []
    if tenant_id:
        filters.append("tenant_id = ?")
        params.append(tenant_id)
    if pipeline_id:
        filters.append("id = ?")
        params.append(pipeline_id)
    if not include_existing:
        filters.append("(project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '' OR updated_at IS NULL OR updated_at = '')")

    rows = _fetch_rows(
        f"SELECT * FROM pipelines WHERE {' AND '.join(filters)} ORDER BY created_at ASC",
        tuple(params),
    )
    if not rows:
        return {"scanned": 0, "updated": 0, "skipped": 0}

    scanned = 0
    updated = 0
    skipped = 0
    with db.get_connection() as conn:
        for row in rows:
            scanned += 1
            pipeline = dict(row)
            scope = _pipeline_scope_from_dag(_load_json_dict(pipeline.get("dag_json")))
            current_project_id = _normalized_text(pipeline.get("project_id"))
            current_workspace_id = _normalized_text(pipeline.get("workspace_id"))
            current_updated_at = _normalized_text(pipeline.get("updated_at"))
            next_project_id = scope["project_id"] or current_project_id
            next_workspace_id = scope["workspace_id"] or current_workspace_id
            next_updated_at = current_updated_at or _normalized_text(pipeline.get("created_at")) or _now_iso()

            if (
                current_project_id == next_project_id
                and current_workspace_id == next_workspace_id
                and current_updated_at == next_updated_at
            ):
                skipped += 1
                continue

            conn.execute(
                "UPDATE pipelines SET project_id = ?, workspace_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
                (next_project_id, next_workspace_id, next_updated_at, pipeline.get("id"), pipeline.get("tenant_id")),
            )
            updated += 1
        conn.commit()

    return {"scanned": scanned, "updated": updated, "skipped": skipped}


def list_unscoped_pipelines(
    tenant_id: str,
    *,
    limit: int = 100,
) -> dict[str, Any]:
    normalized_limit = max(1, min(int(limit or 100), 500))
    rows = _fetch_rows(
        """
        SELECT * FROM pipelines
        WHERE tenant_id = ?
          AND (project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '')
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT ?
        """,
        (tenant_id, normalized_limit),
    )

    items: list[dict[str, Any]] = []
    project_gap_count = 0
    workspace_gap_count = 0
    recoverable_count = 0
    unrecoverable_count = 0

    for row in rows:
        pipeline = _hydrate_pipeline(row) or {}
        dag_json = _load_json_dict(pipeline.get("dag_json"))
        derived_scope = _pipeline_scope_from_dag(dag_json)
        missing_project = not _normalized_text(pipeline.get("project_id"))
        missing_workspace = not _normalized_text(pipeline.get("workspace_id"))
        if missing_project:
            project_gap_count += 1
        if missing_workspace:
            workspace_gap_count += 1

        has_project_metadata = bool(derived_scope["project_id"])
        has_workspace_metadata = bool(derived_scope["workspace_id"])
        recoverable = (missing_project and has_project_metadata) or (missing_workspace and has_workspace_metadata)
        if recoverable:
            recoverable_count += 1
        else:
            unrecoverable_count += 1

        reasons: list[str] = []
        if missing_project:
            reasons.append("missing_project_column")
            if not has_project_metadata:
                reasons.append("missing_project_metadata")
        if missing_workspace:
            reasons.append("missing_workspace_column")
            if not has_workspace_metadata:
                reasons.append("missing_workspace_metadata")

        items.append(
            {
                "id": pipeline.get("id"),
                "name": pipeline.get("name"),
                "created_at": pipeline.get("created_at"),
                "updated_at": pipeline.get("updated_at") or pipeline.get("created_at"),
                "project_id": pipeline.get("project_id"),
                "workspace_id": pipeline.get("workspace_id"),
                "derived_project_id": derived_scope["project_id"],
                "derived_workspace_id": derived_scope["workspace_id"],
                "recoverable": recoverable,
                "reasons": reasons,
                "node_count": len(_as_node_list(dag_json.get("nodes"))),
            }
        )

    total = _fetch_rows(
        "SELECT COUNT(*) AS count FROM pipelines WHERE tenant_id = ? AND (project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '')",
        (tenant_id,),
    )
    total_count = int(total[0].get("count") or 0) if total else 0

    return {
        "items": items,
        "summary": {
            "total": total_count,
            "project_gap_count": project_gap_count,
            "workspace_gap_count": workspace_gap_count,
            "recoverable_count": recoverable_count,
            "unrecoverable_count": unrecoverable_count,
            "limit": normalized_limit,
        },
    }


def assign_pipeline_scope(
    pipeline_id: str,
    tenant_id: str,
    *,
    project_id: str,
    workspace_id: str,
    project_name: str | None = None,
    workspace_name: str | None = None,
) -> dict[str, Any] | None:
    pipeline = get_pipeline(pipeline_id)
    if not pipeline or str(pipeline.get("tenant_id") or "") != tenant_id:
        return None

    dag_json = _load_json_dict(pipeline.get("dag_json"))
    metadata = _pipeline_metadata(dag_json)
    metadata["project_id"] = project_id
    metadata["workspace_id"] = workspace_id
    metadata["project"] = {
        **_as_dict(metadata.get("project")),
        "id": project_id,
        **({"name": project_name} if project_name else {}),
    }
    metadata["workspace"] = {
        **_as_dict(metadata.get("workspace")),
        "id": workspace_id,
        **({"name": workspace_name} if workspace_name else {}),
    }
    dag_json["metadata"] = metadata

    return update_pipeline(
        pipeline_id,
        tenant_id,
        dag_json,
        name=str(pipeline.get("name") or "unnamed"),
    )


def list_pipelines(
    tenant_id: str,
    *,
    project_id: str | None = None,
    workspace_id: str | None = None,
) -> list[dict[str, Any]]:
    filters = ["tenant_id = ?"]
    params: list[Any] = [tenant_id]
    if project_id:
        filters.append("project_id = ?")
        params.append(project_id)
    if workspace_id:
        filters.append("workspace_id = ?")
        params.append(workspace_id)
    rows = _fetch_rows(
        f"SELECT * FROM pipelines WHERE {' AND '.join(filters)} ORDER BY COALESCE(updated_at, created_at) DESC",
        tuple(params),
    )
    return [_summarize_pipeline(row) for row in rows]


def update_pipeline(pipeline_id: str, tenant_id: str, dag_json: Any, name: str | None = None) -> dict[str, Any] | None:
    existing = get_pipeline(pipeline_id)
    if not existing or str(existing.get("tenant_id") or "") != tenant_id:
        return None
    dag_payload = dag_json if not isinstance(dag_json, str) else _load_json_dict(dag_json)
    derived_scope = _pipeline_scope_from_dag(dag_payload)
    project_id = derived_scope["project_id"] or _normalized_text(existing.get("project_id"))
    workspace_id = derived_scope["workspace_id"] or _normalized_text(existing.get("workspace_id"))
    updated_at = _now_iso()
    dag_text = json.dumps(dag_payload) if not isinstance(dag_json, str) else dag_json
    with db.get_connection() as conn:
        if name is not None:
            conn.execute(
                "UPDATE pipelines SET name = ?, project_id = ?, workspace_id = ?, dag_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
                (name, project_id, workspace_id, dag_text, updated_at, pipeline_id, tenant_id),
            )
        else:
            conn.execute(
                "UPDATE pipelines SET project_id = ?, workspace_id = ?, dag_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
                (project_id, workspace_id, dag_text, updated_at, pipeline_id, tenant_id),
            )
        conn.commit()
    return get_pipeline(pipeline_id)


def start_pipeline_run(pipeline_id: str, tenant_id: str, run_config: dict[str, Any] | None = None) -> dict[str, Any]:
    pipeline = get_pipeline(pipeline_id)
    if not pipeline:
        raise ValueError(f"Pipeline {pipeline_id} not found")

    run_id = str(uuid4())
    now = _now_iso()
    normalized_run_config = _as_dict(run_config)
    with db.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO pipeline_runs (
                id, pipeline_id, tenant_id, execution_mode, attempt_count, max_attempts,
                claimed_by, claimed_at, heartbeat_at, lease_expires_at,
                status, run_metadata, started_at, finished_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                pipeline_id,
                tenant_id,
                "local",
                0,
                max(1, DEFAULT_REMOTE_MAX_ATTEMPTS),
                None,
                None,
                None,
                None,
                "queued",
                json.dumps(normalized_run_config),
                now,
                None,
                now,
            ),
        )
        conn.commit()

    _initialize_run_nodes(run_id, pipeline_id, tenant_id, pipeline, normalized_run_config)
    thread = threading.Thread(target=_execute_pipeline, args=(run_id, pipeline, normalized_run_config), daemon=True)
    thread.start()
    return {"run_id": run_id, "status": "queued", "created_at": now}


def get_run_status(run_id: str) -> dict[str, Any] | None:
    rows = _fetch_rows("SELECT * FROM pipeline_runs WHERE id = ?", (run_id,))
    if not rows:
        return None
    run = _hydrate_run(rows[0])
    if not run:
        return None
    run["node_summary"] = _summarize_run_nodes(run_id)
    if not run["run_metadata"].get("active_node_id"):
        active_rows = _fetch_rows(
            "SELECT node_id FROM pipeline_run_nodes WHERE run_id = ? AND status = 'running' ORDER BY stage_index ASC LIMIT 1",
            (run_id,),
        )
        if active_rows:
            run["run_metadata"]["active_node_id"] = active_rows[0]["node_id"]
    if not run["run_metadata"].get("failed_node_id"):
        failed_rows = _fetch_rows(
            "SELECT node_id FROM pipeline_run_nodes WHERE run_id = ? AND status = 'failed' ORDER BY stage_index ASC LIMIT 1",
            (run_id,),
        )
        if failed_rows:
            run["run_metadata"]["failed_node_id"] = failed_rows[0]["node_id"]
    return run


def list_run_node_executions(run_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    filters = ["run_id = ?"]
    params: list[Any] = [run_id]
    if tenant_id:
        filters.append("tenant_id = ?")
        params.append(tenant_id)
    rows = _fetch_rows(
        f"SELECT * FROM pipeline_run_nodes WHERE {' AND '.join(filters)} ORDER BY stage_index ASC, updated_at ASC",
        tuple(params),
    )
    hydrated = [_hydrate_node_execution(row) for row in rows]
    return [row for row in hydrated if row is not None]


def list_run_node_logs(
    run_id: str,
    tenant_id: str | None = None,
    *,
    node_id: str | None = None,
    after_id: int = 0,
    limit: int = DEFAULT_LOG_PAGE_SIZE,
) -> dict[str, Any]:
    filters = ["run_id = ?"]
    params: list[Any] = [run_id]
    if tenant_id:
        filters.append("tenant_id = ?")
        params.append(tenant_id)
    if node_id:
        filters.append("node_id = ?")
        params.append(node_id)
    if after_id > 0:
        filters.append("id > ?")
        params.append(after_id)
    page_size = max(1, min(limit or DEFAULT_LOG_PAGE_SIZE, 500))
    params.append(page_size)
    rows = _fetch_rows(
        f"SELECT * FROM pipeline_run_logs WHERE {' AND '.join(filters)} ORDER BY id ASC LIMIT ?",
        tuple(params),
    )
    items = [item for item in (_hydrate_log_entry(row) for row in rows) if item is not None]
    cursor = items[-1]["cursor"] if items else after_id
    return {"items": items, "cursor": cursor}


def list_pipeline_runs(tenant_id: str, status: str | None = None, pipeline_id: str | None = None) -> list[dict[str, Any]]:
    filters = ["tenant_id = ?"]
    params: list[Any] = [tenant_id]
    if status:
        filters.append("status = ?")
        params.append(status)
    if pipeline_id:
        filters.append("pipeline_id = ?")
        params.append(pipeline_id)

    rows = _fetch_rows(
        f"SELECT * FROM pipeline_runs WHERE {' AND '.join(filters)} ORDER BY COALESCE(updated_at, started_at) DESC",
        tuple(params),
    )
    hydrated_runs = [_hydrate_run(row) for row in rows]
    return [run for run in hydrated_runs if run is not None]


def create_remote_run(pipeline_id: str, tenant_id: str, run_config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Create a pipeline_run intended for remote (data-plane) execution."""
    pipeline = get_pipeline(pipeline_id)
    if not pipeline:
        raise ValueError(f"Pipeline {pipeline_id} not found")

    run_id = str(uuid4())
    now = _now_iso()
    normalized_run_config = _as_dict(run_config)
    with db.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO pipeline_runs (
                id, pipeline_id, tenant_id, execution_mode, attempt_count, max_attempts,
                claimed_by, claimed_at, heartbeat_at, lease_expires_at,
                status, run_metadata, started_at, finished_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                pipeline_id,
                tenant_id,
                "remote",
                0,
                max(1, DEFAULT_REMOTE_MAX_ATTEMPTS),
                None,
                None,
                None,
                None,
                "queued_remote",
                json.dumps(normalized_run_config),
                now,
                None,
                now,
            ),
        )
        conn.commit()

    _initialize_run_nodes(run_id, pipeline_id, tenant_id, pipeline, normalized_run_config)
    broker_message = build_pipeline_run_message(run_id, tenant_id, pipeline_id)
    _update_run_broker_metadata(
        run_id,
        broker_metadata_updates(broker_message, queue_label="pipeline_run"),
    )
    publish_pipeline_run_message(run_id, tenant_id, pipeline_id, broker_message=broker_message)
    return {"run_id": run_id, "status": "queued_remote", "created_at": now}


def claim_remote_run(
    run_id: str,
    agent_id: str | None = None,
    lease_seconds: int = DEFAULT_REMOTE_LEASE_SECONDS,
    claim_source: str = "claim_api",
) -> dict[str, Any] | None:
    now = _now_iso()
    lease_expires_at = _lease_expiration_iso(lease_seconds)
    normalized_agent = _normalize_agent_id(agent_id)

    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE pipeline_runs
            SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?,
                claimed_by = ?, claimed_at = ?, heartbeat_at = ?, lease_expires_at = ?,
                attempt_count = attempt_count + 1
            WHERE id = ? AND execution_mode = 'remote' AND attempt_count < max_attempts
              AND (status = 'queued_remote' OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?))
            """,
            (
                "running",
                now,
                now,
                normalized_agent,
                now,
                now,
                lease_expires_at,
                run_id,
                now,
            ),
        )
        conn.commit()
    if not cursor.rowcount:
        return None

    run = get_run_status(run_id)
    if not run:
        return None
    run["pipeline"] = get_pipeline(str(run.get("pipeline_id") or ""))
    record_broker_claim("pipeline_run", claim_source)
    return run


def requeue_remote_runs(*, tenant_id: str | None = None, run_id: str | None = None) -> int:
    now = _now_iso()
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
    stale_params: list[Any] = [now]
    queued_filters = [
        "execution_mode = 'remote'",
        "status = 'queued_remote'",
    ]
    queued_params: list[Any] = []
    if tenant_id:
        stale_filters.append("tenant_id = ?")
        stale_params.append(tenant_id)
        queued_filters.append("tenant_id = ?")
        queued_params.append(tenant_id)
    if run_id:
        stale_filters.append("id = ?")
        stale_params.append(run_id)
        queued_filters.append("id = ?")
        queued_params.append(run_id)

    with db.get_connection() as conn:
        stale_rows = conn.execute(
            f"""
            SELECT id, pipeline_id, tenant_id, run_metadata
            FROM pipeline_runs
            WHERE {' AND '.join(stale_filters)}
            """,
            tuple(stale_params),
        ).fetchall()
        stale_run_ids: set[str] = set()
        for row in stale_rows:
            stale_run_ids.add(str(row[0]))
            conn.execute(
                """
                UPDATE pipeline_runs
                SET status = 'queued_remote', updated_at = ?,
                    claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL, lease_expires_at = NULL
                WHERE id = ?
                """,
                (now, row[0]),
            )

        queued_rows = conn.execute(
            f"""
            SELECT id, pipeline_id, tenant_id, run_metadata
            FROM pipeline_runs
            WHERE {' AND '.join(queued_filters)}
            """
            ,
            tuple(queued_params),
        ).fetchall()
        for row in queued_rows:
            metadata = _load_json_dict(row[3])
            last_enqueued_at = str(metadata.get("broker_last_enqueued_at") or "")
            if last_enqueued_at and last_enqueued_at > visibility_cutoff:
                continue

        conn.commit()

    for row in stale_rows:
        run_id = str(row[0])
        pipeline_id = str(row[1] or "")
        tenant_id = str(row[2] or "default")
        reason = "expired_lease"
        try:
            action = requeue_remote_run_message(
                run_id,
                pipeline_id,
                tenant_id,
                reason=reason,
                source="maintenance",
                broker_message=broker_state_from_metadata(_load_json_dict(row[3])),
            )
        except Exception:
            record_broker_recovery_failed("pipeline_run", reason, "maintenance")
            logger.exception(
                "Broker recovery failed for remote pipeline run",
                extra={
                    "run_id": run_id,
                    "pipeline_id": pipeline_id,
                    "tenant_id": tenant_id,
                    "reason": reason,
                },
            )
            continue
        record_broker_recovery("pipeline_run", reason, action, "maintenance")
        logger.info(
            "Broker recovery decision recorded for remote pipeline run",
            extra={
                "run_id": run_id,
                "pipeline_id": pipeline_id,
                "tenant_id": tenant_id,
                "reason": reason,
                "action": action,
            },
        )
        if action == "requeued":
            recovered += 1

    for row in queued_rows:
        run_id = str(row[0])
        if run_id in stale_run_ids:
            continue
        metadata = _load_json_dict(row[3])
        last_enqueued_at = str(metadata.get("broker_last_enqueued_at") or "")
        if last_enqueued_at and last_enqueued_at > visibility_cutoff:
            continue
        reason = "queued_visibility_refresh"
        pipeline_id = str(row[1] or "")
        tenant_id = str(row[2] or "default")
        try:
            action = requeue_remote_run_message(
                run_id,
                pipeline_id,
                tenant_id,
                reason=reason,
                source="maintenance",
                broker_message=broker_state_from_metadata(metadata),
            )
        except Exception:
            record_broker_recovery_failed("pipeline_run", reason, "maintenance")
            logger.exception(
                "Broker recovery failed for queued remote pipeline run",
                extra={
                    "run_id": run_id,
                    "pipeline_id": pipeline_id,
                    "tenant_id": tenant_id,
                    "reason": reason,
                },
            )
            continue
        record_broker_recovery("pipeline_run", reason, action, "maintenance")
        logger.info(
            "Broker recovery decision recorded for queued remote pipeline run",
            extra={
                "run_id": run_id,
                "pipeline_id": pipeline_id,
                "tenant_id": tenant_id,
                "reason": reason,
                "action": action,
            },
        )
        if action == "requeued":
            recovered += 1

    return recovered


def heartbeat_remote_run(
    run_id: str,
    agent_id: str,
    lease_seconds: int = DEFAULT_REMOTE_LEASE_SECONDS,
) -> dict[str, Any] | None:
    now = _now_iso()
    lease_expires_at = _lease_expiration_iso(lease_seconds)
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE pipeline_runs
            SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
            WHERE id = ? AND execution_mode = 'remote' AND status = 'running' AND claimed_by = ?
            """,
            (now, lease_expires_at, now, run_id, _normalize_agent_id(agent_id)),
        )
        conn.commit()
    if not cursor.rowcount:
        return None
    return get_run_status(run_id)


def report_remote_run_node_event(
    run_id: str,
    node_id: str,
    status: str,
    *,
    metadata: dict[str, Any] | None = None,
    error_text: str | None = None,
    logs: list[dict[str, Any]] | None = None,
    agent_id: str | None = None,
) -> dict[str, Any] | None:
    run = get_run_status(run_id)
    if not run:
        return None

    claimed_by = str(run.get("claimed_by") or "").strip()
    execution_mode = str(run.get("execution_mode") or "").strip().lower()
    normalized_agent = _normalize_agent_id(agent_id)
    if execution_mode == "remote" and claimed_by and claimed_by != normalized_agent:
        raise PermissionError(f"Run is currently claimed by {claimed_by}")

    node_execution = _record_run_node_event(
        run_id,
        str(run.get("tenant_id") or "default"),
        node_id,
        status,
        metadata=metadata,
        error_text=error_text,
        logs=logs,
    )
    if not node_execution:
        return None

    node_label = str(node_execution.get("node_label") or node_id)
    if status == "running":
        _update_run_status(
            run_id,
            "running",
            extra={
                "active_node_id": node_id,
                "active_node_label": node_label,
                "failed_node_id": None,
            },
        )
    elif status in FAILURE_STATUSES:
        _update_run_status(
            run_id,
            "running",
            extra={
                "active_node_id": None,
                "active_node_label": None,
                "failed_node_id": node_id,
                "failed_node_label": node_label,
                "error": error_text,
            },
        )
    return node_execution


def mark_run_result(
    run_id: str,
    status: str,
    run_metadata: dict[str, Any] | None = None,
    agent_id: str | None = None,
) -> None:
    """Set final status for a run and update run metadata."""
    now = _now_iso()
    updates = _as_dict(run_metadata)
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT execution_mode, claimed_by, run_metadata, started_at, claimed_at FROM pipeline_runs WHERE id = ?",
            (run_id,),
        ).fetchone()
        if not row:
            return
        execution_mode, claimed_by, existing_metadata, started_at, claimed_at = row[0], row[1], row[2], row[3], row[4]
        normalized_agent = _normalize_agent_id(agent_id)
        if execution_mode == "remote" and claimed_by and claimed_by != normalized_agent:
            raise PermissionError(f"Run is currently claimed by {claimed_by}")

        merged_metadata = _merge_json_text(existing_metadata, updates)
        if status == "running":
            conn.execute(
                "UPDATE pipeline_runs SET status = ?, started_at = ?, updated_at = ?, run_metadata = ? WHERE id = ?",
                (status, now, now, merged_metadata, run_id),
            )
        elif status in SUCCESS_STATUSES | FAILURE_STATUSES:
            conn.execute(
                """
                UPDATE pipeline_runs
                SET status = ?, finished_at = ?, run_metadata = ?, updated_at = ?,
                    claimed_by = CASE WHEN execution_mode = 'remote' THEN NULL ELSE claimed_by END,
                    claimed_at = CASE WHEN execution_mode = 'remote' THEN NULL ELSE claimed_at END,
                    heartbeat_at = CASE WHEN execution_mode = 'remote' THEN NULL ELSE heartbeat_at END,
                    lease_expires_at = CASE WHEN execution_mode = 'remote' THEN NULL ELSE lease_expires_at END
                WHERE id = ?
                """,
                (status, now, merged_metadata, now, run_id),
            )
        else:
            conn.execute(
                "UPDATE pipeline_runs SET status = ?, run_metadata = ?, updated_at = ? WHERE id = ?",
                (status, merged_metadata, now, run_id),
            )
        conn.commit()

    if execution_mode == "remote" and status in SUCCESS_STATUSES | FAILURE_STATUSES:
        record_broker_processed(
            "pipeline_run",
            status,
            started_at=started_at,
            claimed_at=claimed_at,
            finished_at=now,
        )

    failed_node_id = str(updates.get("failed_node_id") or "").strip()
    if status in FAILURE_STATUSES and failed_node_id:
        node_execution = _update_node_execution(run_id, failed_node_id, "failed", metadata=updates, error_text=str(updates.get("error") or "remote failure"))
        if node_execution:
            _append_run_log(
                run_id,
                str(node_execution.get("tenant_id") or "default"),
                failed_node_id,
                "error",
                str(updates.get("error") or "Remote execution reported a failure."),
                node_execution_id=node_execution.get("execution_unit_id"),
                stream="stderr",
                metadata=updates,
            )
