from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, json_dumps, json_loads, now_iso


class FinOpsService:
    def upsert_quota(self, tenant_id: str, resource_type: str, limit_value: float, unit: str | None = None) -> Dict[str, Any]:
        timestamp = now_iso()
        existing = fetch_all(
            "SELECT id FROM tenant_quotas WHERE tenant_id = ? AND resource_type = ?",
            (tenant_id, resource_type),
        )
        quota_id = existing[0]["id"] if existing else str(uuid4())
        with get_connection() as conn:
            if existing:
                conn.execute(
                    "UPDATE tenant_quotas SET limit_value = ?, unit = ?, updated_at = ? WHERE id = ?",
                    (limit_value, unit, timestamp, quota_id),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO tenant_quotas (id, tenant_id, resource_type, limit_value, unit, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (quota_id, tenant_id, resource_type, limit_value, unit, timestamp, timestamp),
                )
            conn.commit()
        return {
            "id": quota_id,
            "tenant_id": tenant_id,
            "resource_type": resource_type,
            "limit_value": limit_value,
            "unit": unit,
            "updated_at": timestamp,
        }

    def list_quotas(self, tenant_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT * FROM tenant_quotas WHERE tenant_id = ? ORDER BY resource_type ASC",
            (tenant_id,),
        )

    def record_cost(
        self,
        tenant_id: str,
        period: str,
        service_type: str,
        quantity: float,
        cost: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "period": period,
            "service_type": service_type,
            "quantity": quantity,
            "cost": cost,
            "metadata_json": json_dumps(metadata or {}),
            "created_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO cost_tracking (id, tenant_id, period, service_type, quantity, cost, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["tenant_id"],
                    record["period"],
                    record["service_type"],
                    record["quantity"],
                    record["cost"],
                    record["metadata_json"],
                    record["created_at"],
                ),
            )
            conn.commit()
        result = dict(record)
        result["metadata"] = json_loads(result.pop("metadata_json"), {})
        return result

    def get_cost_summary(self, tenant_id: str, period: str | None = None) -> Dict[str, Any]:
        if period:
            rows = fetch_all(
                "SELECT * FROM cost_tracking WHERE tenant_id = ? AND period = ? ORDER BY created_at DESC",
                (tenant_id, period),
            )
        else:
            rows = fetch_all(
                "SELECT * FROM cost_tracking WHERE tenant_id = ? ORDER BY created_at DESC",
                (tenant_id,),
            )

        total_cost = 0.0
        by_service: Dict[str, float] = {}
        for row in rows:
            cost = float(row.get("cost") or 0)
            total_cost += cost
            service_type = row.get("service_type") or "unknown"
            by_service[service_type] = by_service.get(service_type, 0.0) + cost

        return {
            "tenant_id": tenant_id,
            "period": period,
            "total_cost": total_cost,
            "by_service": by_service,
            "records": rows,
        }