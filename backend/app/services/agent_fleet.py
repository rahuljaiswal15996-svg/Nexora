from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.platform_store import fetch_all


def _safe_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _new_agent_record(agent_id: str, tenant_id: str) -> Dict[str, Any]:
    return {
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "status": "idle",
        "version": "unreported",
        "observed_capacity": 0,
        "active_jobs": 0,
        "active_runs": 0,
        "workloads": [],
        "last_heartbeat_at": None,
        "lease_expires_at": None,
    }


def _merge_timestamp(current_value: Optional[str], candidate: Optional[str]) -> Optional[str]:
    current_dt = _safe_iso(current_value)
    candidate_dt = _safe_iso(candidate)
    if current_dt and candidate_dt:
        return candidate if candidate_dt >= current_dt else current_value
    return candidate or current_value


def list_agent_fleet(tenant_id: str | None = None) -> List[Dict[str, Any]]:
    filters = ["execution_mode = 'remote'", "claimed_by IS NOT NULL", "TRIM(claimed_by) <> ''"]
    params: List[Any] = []
    if tenant_id:
        filters.append("tenant_id = ?")
        params.append(tenant_id)
    where_clause = " AND ".join(filters)

    job_rows = fetch_all(
        f"""
        SELECT tenant_id, claimed_by AS agent_id, heartbeat_at, lease_expires_at, status, job_type, id AS workload_id
        FROM platform_jobs
        WHERE {where_clause}
        ORDER BY updated_at DESC
        """,
        tuple(params),
    )
    run_rows = fetch_all(
        f"""
        SELECT tenant_id, claimed_by AS agent_id, heartbeat_at, lease_expires_at, status, 'pipeline_run' AS workload_type, id AS workload_id
        FROM pipeline_runs
        WHERE {where_clause}
        ORDER BY updated_at DESC
        """,
        tuple(params),
    )

    agents: Dict[tuple[str, str], Dict[str, Any]] = {}
    now = datetime.now(timezone.utc)

    for row in [*job_rows, *run_rows]:
        agent_id = (row.get("agent_id") or "").strip()
        tenant = str(row.get("tenant_id") or tenant_id or "default")
        if not agent_id:
            continue
        key = (tenant, agent_id)
        record = agents.setdefault(key, _new_agent_record(agent_id, tenant))
        record["observed_capacity"] += 1
        record["last_heartbeat_at"] = _merge_timestamp(record.get("last_heartbeat_at"), row.get("heartbeat_at"))
        record["lease_expires_at"] = _merge_timestamp(record.get("lease_expires_at"), row.get("lease_expires_at"))

        workload = {
            "type": row.get("job_type") or row.get("workload_type") or "unknown",
            "id": row.get("workload_id"),
            "status": row.get("status") or "unknown",
        }
        record["workloads"].append(workload)

        if workload["type"] == "pipeline_run":
            record["active_runs"] += 1
        else:
            record["active_jobs"] += 1

    for record in agents.values():
        lease_expires_at = _safe_iso(record.get("lease_expires_at"))
        if lease_expires_at and lease_expires_at >= now:
            record["status"] = "active"
        elif record["workloads"]:
            record["status"] = "stale"
        record["workloads"] = record["workloads"][:6]

    return sorted(agents.values(), key=lambda agent: (agent["status"] != "active", agent["agent_id"]))