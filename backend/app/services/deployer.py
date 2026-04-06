from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


class DeployerService:
    def list_targets(self, tenant_id: str) -> List[Dict[str, Any]]:
        targets = fetch_all(
            "SELECT * FROM deployment_targets WHERE tenant_id = ? ORDER BY updated_at DESC",
            (tenant_id,),
        )
        for target in targets:
            target["endpoint_config"] = json_loads(target.pop("endpoint_config_json", None), {})
        return targets

    def create_target(
        self,
        tenant_id: str,
        name: str,
        platform_type: str,
        endpoint_config: Optional[Dict[str, Any]] = None,
        credentials_id: str | None = None,
    ) -> Dict[str, Any]:
        target = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "name": name,
            "platform_type": platform_type,
            "endpoint_config_json": json_dumps(endpoint_config or {}),
            "credentials_id": credentials_id,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO deployment_targets (id, tenant_id, name, platform_type, endpoint_config_json, credentials_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    target["id"],
                    target["tenant_id"],
                    target["name"],
                    target["platform_type"],
                    target["endpoint_config_json"],
                    target["credentials_id"],
                    target["created_at"],
                    target["updated_at"],
                ),
            )
            conn.commit()
        result = dict(target)
        result["endpoint_config"] = json_loads(result.pop("endpoint_config_json"), {})
        return result

    def deploy_pipeline(
        self,
        tenant_id: str,
        pipeline_id: str,
        target_platform: str,
        deployed_by: str,
        target_id: str | None = None,
        target_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        deployment = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "pipeline_id": pipeline_id,
            "target_id": target_id,
            "target_platform": target_platform,
            "target_config_json": json_dumps(target_config or {}),
            "status": "queued",
            "deployed_at": now_iso(),
            "deployed_by": deployed_by,
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO deployments (id, tenant_id, pipeline_id, target_id, target_platform, target_config_json, status, deployed_at, deployed_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    deployment["id"],
                    deployment["tenant_id"],
                    deployment["pipeline_id"],
                    deployment["target_id"],
                    deployment["target_platform"],
                    deployment["target_config_json"],
                    deployment["status"],
                    deployment["deployed_at"],
                    deployment["deployed_by"],
                    deployment["created_at"],
                ),
            )
            conn.execute(
                """
                INSERT INTO deployment_runs (id, deployment_id, tenant_id, run_id, status, status_details, started_at, finished_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), deployment["id"], tenant_id, None, "queued", json_dumps({"platform": target_platform}), deployment["created_at"], None),
            )
            conn.commit()
        return self.get_deployment(deployment["id"], tenant_id) or {}

    def get_deployment(self, deployment_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        deployment = fetch_one("SELECT * FROM deployments WHERE id = ? AND tenant_id = ?", (deployment_id, tenant_id))
        if not deployment:
            return None
        deployment["target_config"] = json_loads(deployment.pop("target_config_json", None), {})
        deployment["runs"] = fetch_all(
            "SELECT * FROM deployment_runs WHERE deployment_id = ? AND tenant_id = ? ORDER BY started_at DESC",
            (deployment_id, tenant_id),
        )
        for run in deployment["runs"]:
            run["status_details"] = json_loads(run.get("status_details"), {})
        return deployment

    def list_deployments(self, tenant_id: str) -> List[Dict[str, Any]]:
        deployments = fetch_all(
            "SELECT * FROM deployments WHERE tenant_id = ? ORDER BY created_at DESC",
            (tenant_id,),
        )
        for deployment in deployments:
            deployment["target_config"] = json_loads(deployment.pop("target_config_json", None), {})
        return deployments

    def update_deployment_status(
        self,
        deployment_id: str,
        tenant_id: str,
        status: str,
        run_status: str | None = None,
        status_details: Optional[Dict[str, Any]] = None,
        run_id: str | None = None,
    ) -> Optional[Dict[str, Any]]:
        timestamp = now_iso()
        details = json_dumps(status_details or {})
        with get_connection() as conn:
            conn.execute(
                "UPDATE deployments SET status = ?, deployed_at = ? WHERE id = ? AND tenant_id = ?",
                (status, timestamp, deployment_id, tenant_id),
            )
            runs = conn.execute(
                "SELECT id FROM deployment_runs WHERE deployment_id = ? AND tenant_id = ? ORDER BY started_at DESC LIMIT 1",
                (deployment_id, tenant_id),
            ).fetchall()
            if runs:
                update_sql = "UPDATE deployment_runs SET status = ?, status_details = ?, run_id = ?"
                params: list[Any] = [run_status or status, details, run_id]
                if (run_status or status) == "running":
                    update_sql += ", started_at = ?"
                    params.append(timestamp)
                if (run_status or status) in {"success", "failed"}:
                    update_sql += ", finished_at = ?"
                    params.append(timestamp)
                update_sql += " WHERE id = ?"
                params.append(runs[0][0])
                conn.execute(update_sql, tuple(params))
            conn.commit()
        return self.get_deployment(deployment_id, tenant_id)