from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


class CatalogService:
    def register_dataset(
        self,
        tenant_id: str,
        name: str,
        source_path: str,
        project_id: str | None = None,
        connection_id: str | None = None,
        schema: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        row_count: Optional[int] = None,
        size_bytes: Optional[int] = None,
        quality_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        dataset_id = str(uuid4())
        timestamp = now_iso()
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO datasets (
                    id, tenant_id, project_id, connection_id, source_path, name,
                    schema_json, metadata_json, tags_json, row_count, size_bytes,
                    quality_score, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dataset_id,
                    tenant_id,
                    project_id,
                    connection_id,
                    source_path,
                    name,
                    json_dumps(schema or []),
                    json_dumps(metadata or {}),
                    json_dumps(tags or []),
                    row_count,
                    size_bytes,
                    quality_score,
                    timestamp,
                    timestamp,
                ),
            )
            conn.commit()
        return self.get_dataset(dataset_id, tenant_id) or {}

    def list_datasets(self, tenant_id: str, query: str | None = None, project_id: str | None = None) -> List[Dict[str, Any]]:
        filters = ["tenant_id = ?"]
        params: List[Any] = [tenant_id]
        if project_id:
            filters.append("project_id = ?")
            params.append(project_id)
        if query:
            filters.append("(name LIKE ? OR source_path LIKE ?)")
            like = f"%{query}%"
            params.extend([like, like])

        datasets = fetch_all(
            f"SELECT * FROM datasets WHERE {' AND '.join(filters)} ORDER BY updated_at DESC",
            tuple(params),
        )
        for dataset in datasets:
            dataset["schema"] = json_loads(dataset.pop("schema_json", None), [])
            dataset["metadata"] = json_loads(dataset.pop("metadata_json", None), {})
            dataset["tags"] = json_loads(dataset.pop("tags_json", None), [])
        return datasets

    def get_dataset(self, dataset_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        dataset = fetch_one("SELECT * FROM datasets WHERE id = ? AND tenant_id = ?", (dataset_id, tenant_id))
        if not dataset:
            return None
        dataset["schema"] = json_loads(dataset.pop("schema_json", None), [])
        dataset["metadata"] = json_loads(dataset.pop("metadata_json", None), {})
        dataset["tags"] = json_loads(dataset.pop("tags_json", None), [])
        dataset["lineage"] = self.get_lineage(dataset_id, tenant_id)
        dataset["quality_checks"] = self.get_quality_checks(dataset_id, tenant_id)
        return dataset

    def add_lineage(self, tenant_id: str, source_dataset_id: str, target_dataset_id: str, transform_id: str | None = None) -> Dict[str, Any]:
        lineage = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "source_dataset_id": source_dataset_id,
            "target_dataset_id": target_dataset_id,
            "transform_id": transform_id,
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO dataset_lineage (id, tenant_id, source_dataset_id, target_dataset_id, transform_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    lineage["id"],
                    lineage["tenant_id"],
                    lineage["source_dataset_id"],
                    lineage["target_dataset_id"],
                    lineage["transform_id"],
                    lineage["created_at"],
                ),
            )
            conn.commit()
        return lineage

    def add_quality_check(
        self,
        tenant_id: str,
        dataset_id: str,
        check_name: str,
        status: str,
        metrics: Optional[Dict[str, Any]] = None,
        frequency: str = "manual",
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "dataset_id": dataset_id,
            "tenant_id": tenant_id,
            "check_name": check_name,
            "status": status,
            "metrics_json": json_dumps(metrics or {}),
            "last_run": now_iso(),
            "frequency": frequency,
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO dataset_quality_checks (id, dataset_id, tenant_id, check_name, status, metrics_json, last_run, frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["dataset_id"],
                    record["tenant_id"],
                    record["check_name"],
                    record["status"],
                    record["metrics_json"],
                    record["last_run"],
                    record["frequency"],
                ),
            )
            conn.commit()
        result = dict(record)
        result["metrics"] = json_loads(result.pop("metrics_json"), {})
        return result

    def get_quality_check(self, check_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        check = fetch_one(
            "SELECT * FROM dataset_quality_checks WHERE id = ? AND tenant_id = ?",
            (check_id, tenant_id),
        )
        if not check:
            return None
        check["metrics"] = json_loads(check.pop("metrics_json", None), {})
        return check

    def update_quality_check(
        self,
        check_id: str,
        tenant_id: str,
        status: str,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        timestamp = now_iso()
        existing = self.get_quality_check(check_id, tenant_id)
        if not existing:
            return None
        next_metrics = metrics if metrics is not None else existing.get("metrics", {})
        with get_connection() as conn:
            conn.execute(
                """
                UPDATE dataset_quality_checks
                SET status = ?, metrics_json = ?, last_run = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (status, json_dumps(next_metrics), timestamp, check_id, tenant_id),
            )
            conn.commit()
        return self.get_quality_check(check_id, tenant_id)

    def get_lineage(self, dataset_id: str, tenant_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            """
            SELECT * FROM dataset_lineage
            WHERE tenant_id = ? AND (source_dataset_id = ? OR target_dataset_id = ?)
            ORDER BY created_at DESC
            """,
            (tenant_id, dataset_id, dataset_id),
        )

    def get_quality_checks(self, dataset_id: str, tenant_id: str) -> List[Dict[str, Any]]:
        checks = fetch_all(
            "SELECT * FROM dataset_quality_checks WHERE dataset_id = ? AND tenant_id = ? ORDER BY last_run DESC",
            (dataset_id, tenant_id),
        )
        for check in checks:
            check["metrics"] = json_loads(check.pop("metrics_json", None), {})
        return checks