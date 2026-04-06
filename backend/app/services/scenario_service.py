from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.comparison import compare_code
from app.services.db import get_connection
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


class ScenarioService:
    def create_scenario(
        self,
        tenant_id: str,
        name: str,
        description: str = "",
        project_id: str | None = None,
        base_uir_id: str | None = None,
    ) -> Dict[str, Any]:
        scenario_id = str(uuid4())
        timestamp = now_iso()
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO scenarios (id, tenant_id, project_id, name, description, base_uir_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (scenario_id, tenant_id, project_id, name, description, base_uir_id, "draft", timestamp, timestamp),
            )
            conn.commit()
        return self.get_scenario(scenario_id, tenant_id) or {}

    def list_scenarios(self, tenant_id: str, project_id: str | None = None) -> List[Dict[str, Any]]:
        if project_id:
            return fetch_all(
                "SELECT * FROM scenarios WHERE tenant_id = ? AND project_id = ? ORDER BY updated_at DESC",
                (tenant_id, project_id),
            )
        return fetch_all("SELECT * FROM scenarios WHERE tenant_id = ? ORDER BY updated_at DESC", (tenant_id,))

    def get_scenario(self, scenario_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        scenario = fetch_one("SELECT * FROM scenarios WHERE id = ? AND tenant_id = ?", (scenario_id, tenant_id))
        if not scenario:
            return None
        scenario["versions"] = fetch_all(
            "SELECT * FROM scenario_versions WHERE scenario_id = ? AND tenant_id = ? ORDER BY created_at DESC",
            (scenario_id, tenant_id),
        )
        for version in scenario["versions"]:
            version["metadata"] = json_loads(version.pop("metadata_json", None), {})
        return scenario

    def create_version(
        self,
        tenant_id: str,
        scenario_id: str,
        version: str,
        created_by: str,
        uir_id: str | None = None,
        converted_code: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "scenario_id": scenario_id,
            "tenant_id": tenant_id,
            "version": version,
            "uir_id": uir_id,
            "converted_code": converted_code,
            "metadata_json": json_dumps(metadata or {}),
            "created_by": created_by,
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO scenario_versions (id, scenario_id, tenant_id, version, uir_id, converted_code, metadata_json, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["scenario_id"],
                    record["tenant_id"],
                    record["version"],
                    record["uir_id"],
                    record["converted_code"],
                    record["metadata_json"],
                    record["created_by"],
                    record["created_at"],
                ),
            )
            conn.execute(
                "UPDATE scenarios SET updated_at = ? WHERE id = ? AND tenant_id = ?",
                (record["created_at"], scenario_id, tenant_id),
            )
            conn.commit()
        result = dict(record)
        result["metadata"] = json_loads(result.pop("metadata_json"), {})
        return result

    def compare_versions(self, tenant_id: str, version_a_id: str, version_b_id: str) -> Dict[str, Any]:
        version_a = fetch_one(
            "SELECT * FROM scenario_versions WHERE id = ? AND tenant_id = ?",
            (version_a_id, tenant_id),
        )
        version_b = fetch_one(
            "SELECT * FROM scenario_versions WHERE id = ? AND tenant_id = ?",
            (version_b_id, tenant_id),
        )
        if not version_a or not version_b:
            raise ValueError("Scenario version not found")

        comparison = compare_code(version_a.get("converted_code") or "", version_b.get("converted_code") or "")
        comparison_record = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "scenario_version_a": version_a_id,
            "scenario_version_b": version_b_id,
            "similarity_score": comparison.get("similarity_ratio", 0),
            "diff_json": json_dumps(comparison),
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO scenario_comparisons (id, tenant_id, scenario_version_a, scenario_version_b, similarity_score, diff_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comparison_record["id"],
                    comparison_record["tenant_id"],
                    comparison_record["scenario_version_a"],
                    comparison_record["scenario_version_b"],
                    comparison_record["similarity_score"],
                    comparison_record["diff_json"],
                    comparison_record["created_at"],
                ),
            )
            conn.commit()
        return {
            "comparison_id": comparison_record["id"],
            "version_a": version_a,
            "version_b": version_b,
            "comparison": comparison,
        }