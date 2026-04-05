import json
import logging
import threading
import time
from datetime import datetime
from typing import Any, Dict
from uuid import uuid4

from . import db

logger = logging.getLogger("nexora.pipeline")


def create_pipeline(tenant_id: str, name: str, dag_json: Any) -> Dict[str, Any]:
    pid = str(uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    dag_text = json.dumps(dag_json) if not isinstance(dag_json, str) else dag_json
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO pipelines (id, tenant_id, name, dag_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (pid, tenant_id, name, dag_text, now),
        )
        conn.commit()
    return {"id": pid, "created_at": now}


def get_pipeline(pipeline_id: str) -> Dict[str, Any] | None:
    rows = list(db.iter_rows("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)))
    if not rows:
        return None
    row = dict(rows[0])
    try:
        row["dag_json"] = json.loads(row.get("dag_json") or "{}")
    except Exception:
        row["dag_json"] = {}
    return row


def _update_run_status(run_id: str, status: str, extra: Dict[str, Any] | None = None) -> None:
    now = datetime.utcnow().isoformat() + "Z"
    with db.get_connection() as conn:
        if status == "running":
            conn.execute("UPDATE pipeline_runs SET status = ?, started_at = ? WHERE id = ?", (status, now, run_id))
        elif status in ("success", "failed"):
            conn.execute("UPDATE pipeline_runs SET status = ?, finished_at = ? WHERE id = ?", (status, now, run_id))
        else:
            conn.execute("UPDATE pipeline_runs SET status = ? WHERE id = ?", (status, run_id))
        conn.commit()


def _execute_pipeline(run_id: str, pipeline: Dict[str, Any], run_config: Dict[str, Any] | None) -> None:
    logger.info("Starting pipeline run %s", run_id)
    try:
        _update_run_status(run_id, "running")
        nodes = pipeline.get("dag_json", {}).get("nodes", []) if pipeline.get("dag_json") else []
        # Simple sequential execution simulation for MVP
        for node in nodes:
            nid = node.get("id") or str(uuid4())
            ntype = node.get("type", "task")
            logger.info("Executing node %s (%s)", nid, ntype)
            # Simulate work
            time.sleep(max(0.1, min(0.5, node.get("simulate_seconds", 0.2))))
        # mark success
        _update_run_status(run_id, "success", extra={"nodes_executed": len(nodes)})
        logger.info("Pipeline run %s completed", run_id)
    except Exception as exc:
        logger.exception("Pipeline run failed: %s", exc)
        _update_run_status(run_id, "failed", extra={"error": str(exc)})


def start_pipeline_run(pipeline_id: str, tenant_id: str, run_config: Dict[str, Any] | None = None) -> Dict[str, Any]:
    run_id = str(uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO pipeline_runs (id, pipeline_id, tenant_id, status, run_metadata, started_at) VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, pipeline_id, tenant_id, "queued", json.dumps(run_config or {}), now),
        )
        conn.commit()

    pipeline = get_pipeline(pipeline_id)
    # spawn background thread to execute
    t = threading.Thread(target=_execute_pipeline, args=(run_id, pipeline or {}, run_config), daemon=True)
    t.start()
    return {"run_id": run_id, "status": "queued", "created_at": now}


def get_run_status(run_id: str) -> Dict[str, Any] | None:
    rows = list(db.iter_rows("SELECT * FROM pipeline_runs WHERE id = ?", (run_id,)))
    if not rows:
        return None
    return dict(rows[0])


def create_remote_run(pipeline_id: str, tenant_id: str, run_config: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Create a pipeline_run intended for remote (data-plane) execution.

    The run is inserted with status 'queued_remote' and will not be executed
    by the local runner. Data-plane agents should poll for these runs.
    """
    run_id = str(uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO pipeline_runs (id, pipeline_id, tenant_id, status, run_metadata, started_at) VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, pipeline_id, tenant_id, "queued_remote", json.dumps(run_config or {}), now),
        )
        conn.commit()
    return {"run_id": run_id, "status": "queued_remote", "created_at": now}


def claim_next_remote_run(tenant_id: str | None = None) -> Dict[str, Any] | None:
    """Atomically claim the next queued_remote run for the tenant (or any tenant if None).

    Returns the run row (dict) with pipeline details attached, or None if none available.
    """
    now = datetime.utcnow().isoformat() + "Z"
    # select next run
    if tenant_id:
        rows = list(db.iter_rows("SELECT * FROM pipeline_runs WHERE status = 'queued_remote' AND tenant_id = ? ORDER BY started_at ASC LIMIT 1", (tenant_id,)))
    else:
        rows = list(db.iter_rows("SELECT * FROM pipeline_runs WHERE status = 'queued_remote' ORDER BY started_at ASC LIMIT 1", ()))

    if not rows:
        return None

    run = dict(rows[0])
    run_id = run.get("id")
    # attempt to claim by setting status to 'running' (best-effort)
    with db.get_connection() as conn:
        conn.execute("UPDATE pipeline_runs SET status = ?, started_at = ? WHERE id = ? AND status = 'queued_remote'", ("running", now, run_id))
        conn.commit()

    # reload run
    rows2 = list(db.iter_rows("SELECT * FROM pipeline_runs WHERE id = ?", (run_id,)))
    if not rows2:
        return None
    run2 = dict(rows2[0])
    # attach pipeline spec
    pipeline = get_pipeline(run2.get("pipeline_id"))
    run2["pipeline"] = pipeline
    return run2


def mark_run_result(run_id: str, status: str, run_metadata: Dict[str, Any] | None = None) -> None:
    """Set final status for a run and update run_metadata."""
    now = datetime.utcnow().isoformat() + "Z"
    meta_text = json.dumps(run_metadata or {})
    with db.get_connection() as conn:
        if status == "running":
            conn.execute("UPDATE pipeline_runs SET status = ?, started_at = ? WHERE id = ?", (status, now, run_id))
        elif status in ("success", "failed"):
            conn.execute("UPDATE pipeline_runs SET status = ?, finished_at = ?, run_metadata = ? WHERE id = ?", (status, now, meta_text, run_id))
        else:
            conn.execute("UPDATE pipeline_runs SET status = ?, run_metadata = ? WHERE id = ?", (status, meta_text, run_id))
        conn.commit()
