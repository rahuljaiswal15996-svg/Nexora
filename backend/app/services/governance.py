from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, json_dumps, json_loads, now_iso


class GovernanceService:
    def log_action(
        self,
        tenant_id: str,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str | None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "old_value_json": json_dumps(old_value or {}),
            "new_value_json": json_dumps(new_value or {}),
            "timestamp": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, old_value_json, new_value_json, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["tenant_id"],
                    record["user_id"],
                    record["action"],
                    record["resource_type"],
                    record["resource_id"],
                    record["old_value_json"],
                    record["new_value_json"],
                    record["timestamp"],
                ),
            )
            conn.commit()
        result = dict(record)
        result["old_value"] = json_loads(result.pop("old_value_json"), {})
        result["new_value"] = json_loads(result.pop("new_value_json"), {})
        return result

    def create_policy(self, tenant_id: str, name: str, rule: Dict[str, Any], enforcement: str) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "name": name,
            "rule_json": json_dumps(rule),
            "enforcement": enforcement,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO governance_policies (id, tenant_id, name, rule_json, enforcement, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["tenant_id"],
                    record["name"],
                    record["rule_json"],
                    record["enforcement"],
                    record["created_at"],
                    record["updated_at"],
                ),
            )
            conn.commit()
        result = dict(record)
        result["rule"] = json_loads(result.pop("rule_json"), {})
        return result

    def list_policies(self, tenant_id: str) -> List[Dict[str, Any]]:
        policies = fetch_all(
            "SELECT * FROM governance_policies WHERE tenant_id = ? ORDER BY updated_at DESC",
            (tenant_id,),
        )
        for policy in policies:
            policy["rule"] = json_loads(policy.pop("rule_json", None), {})
        return policies

    def list_audit_log(self, tenant_id: str, resource_type: str | None = None) -> List[Dict[str, Any]]:
        if resource_type:
            audit = fetch_all(
                "SELECT * FROM audit_log WHERE tenant_id = ? AND resource_type = ? ORDER BY timestamp DESC",
                (tenant_id, resource_type),
            )
        else:
            audit = fetch_all(
                "SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC",
                (tenant_id,),
            )
        for record in audit:
            record["old_value"] = json_loads(record.pop("old_value_json", None), {})
            record["new_value"] = json_loads(record.pop("new_value_json", None), {})
        return audit