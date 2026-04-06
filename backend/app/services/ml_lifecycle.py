from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


class MLLifecycleService:
    def create_experiment(
        self,
        tenant_id: str,
        name: str,
        created_by: str,
        project_id: str | None = None,
        description: str = "",
    ) -> Dict[str, Any]:
        experiment = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "project_id": project_id,
            "name": name,
            "description": description,
            "created_by": created_by,
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO experiments (id, tenant_id, project_id, name, description, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    experiment["id"],
                    experiment["tenant_id"],
                    experiment["project_id"],
                    experiment["name"],
                    experiment["description"],
                    experiment["created_by"],
                    experiment["created_at"],
                ),
            )
            conn.commit()
        return experiment

    def list_experiments(self, tenant_id: str, project_id: str | None = None) -> List[Dict[str, Any]]:
        if project_id:
            return fetch_all(
                "SELECT * FROM experiments WHERE tenant_id = ? AND project_id = ? ORDER BY created_at DESC",
                (tenant_id, project_id),
            )
        return fetch_all("SELECT * FROM experiments WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,))

    def log_run(
        self,
        tenant_id: str,
        experiment_id: str,
        status: str,
        model_id: str | None = None,
        params: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
        artifacts: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        run = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "experiment_id": experiment_id,
            "model_id": model_id,
            "status": status,
            "run_params_json": json_dumps(params or {}),
            "metrics_json": json_dumps(metrics or {}),
            "artifacts_json": json_dumps(artifacts or {}),
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO experiment_runs (id, tenant_id, experiment_id, model_id, status, run_params_json, metrics_json, artifacts_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run["id"],
                    run["tenant_id"],
                    run["experiment_id"],
                    run["model_id"],
                    run["status"],
                    run["run_params_json"],
                    run["metrics_json"],
                    run["artifacts_json"],
                    run["created_at"],
                ),
            )
            conn.commit()
        result = dict(run)
        result["params"] = json_loads(result.pop("run_params_json"), {})
        result["metrics"] = json_loads(result.pop("metrics_json"), {})
        result["artifacts"] = json_loads(result.pop("artifacts_json"), {})
        return result

    def list_runs(self, tenant_id: str, experiment_id: str) -> List[Dict[str, Any]]:
        runs = fetch_all(
            "SELECT * FROM experiment_runs WHERE tenant_id = ? AND experiment_id = ? ORDER BY created_at DESC",
            (tenant_id, experiment_id),
        )
        for run in runs:
            run["params"] = json_loads(run.pop("run_params_json", None), {})
            run["metrics"] = json_loads(run.pop("metrics_json", None), {})
            run["artifacts"] = json_loads(run.pop("artifacts_json", None), {})
        return runs

    def register_serving_endpoint(
        self,
        tenant_id: str,
        model_version_id: str,
        endpoint_url: str,
        status: str = "active",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "model_version_id": model_version_id,
            "endpoint_url": endpoint_url,
            "status": status,
            "metadata_json": json_dumps(metadata or {}),
            "deployed_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO model_serving (id, tenant_id, model_version_id, endpoint_url, status, metadata_json, deployed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["tenant_id"],
                    record["model_version_id"],
                    record["endpoint_url"],
                    record["status"],
                    record["metadata_json"],
                    record["deployed_at"],
                ),
            )
            conn.commit()
        result = dict(record)
        result["metadata"] = json_loads(result.pop("metadata_json"), {})
        return result

    def list_serving_endpoints(self, tenant_id: str) -> List[Dict[str, Any]]:
        endpoints = fetch_all(
            "SELECT * FROM model_serving WHERE tenant_id = ? ORDER BY deployed_at DESC",
            (tenant_id,),
        )
        for endpoint in endpoints:
            endpoint["metadata"] = json_loads(endpoint.pop("metadata_json", None), {})
        return endpoints

    def get_run(self, tenant_id: str, run_id: str) -> Optional[Dict[str, Any]]:
        run = fetch_one(
            "SELECT * FROM experiment_runs WHERE tenant_id = ? AND id = ?",
            (tenant_id, run_id),
        )
        if not run:
            return None
        run["params"] = json_loads(run.pop("run_params_json", None), {})
        run["metrics"] = json_loads(run.pop("metrics_json", None), {})
        run["artifacts"] = json_loads(run.pop("artifacts_json", None), {})
        return run

    def update_run(
        self,
        tenant_id: str,
        run_id: str,
        status: str,
        params: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
        artifacts: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        existing = self.get_run(tenant_id, run_id)
        if not existing:
            return None
        with get_connection() as conn:
            conn.execute(
                """
                UPDATE experiment_runs
                SET status = ?, run_params_json = ?, metrics_json = ?, artifacts_json = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (
                    status,
                    json_dumps(params if params is not None else existing.get("params", {})),
                    json_dumps(metrics if metrics is not None else existing.get("metrics", {})),
                    json_dumps(artifacts if artifacts is not None else existing.get("artifacts", {})),
                    run_id,
                    tenant_id,
                ),
            )
            conn.commit()
        return self.get_run(tenant_id, run_id)