import json
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any

from . import db


def get_conversion_by_request_id(request_id: str) -> Optional[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM conversions WHERE request_id = ? ORDER BY created_at DESC LIMIT 1", (request_id,)))
    if not rows:
        return None
    row = dict(rows[0])
    # parse JSON blobs
    if row.get("result_json"):
        try:
            row["result_json"] = json.loads(row["result_json"])
        except Exception:
            pass
    if row.get("metrics_json"):
        try:
            row["metrics_json"] = json.loads(row["metrics_json"])
        except Exception:
            pass
    return row


def create_conversion_record(request_id: str, tenant_id: str, uir_id: str | None = None) -> str:
    now = datetime.utcnow().isoformat() + "Z"
    conv_id = str(uuid4())
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO conversions (id, tenant_id, uir_id, request_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (conv_id, tenant_id, uir_id, request_id, "pending", now),
        )
        conn.commit()
    return conv_id


def store_conversion_result(conversion_id: str, result: Dict[str, Any], metrics: Dict[str, Any] | None = None, status: str = "success") -> None:
    metrics_json = json.dumps(metrics or {})
    result_json = json.dumps(result or {})
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE conversions SET status = ?, result_json = ?, metrics_json = ? WHERE id = ?",
            (status, result_json, metrics_json, conversion_id),
        )
        conn.commit()


def get_conversion_result_by_id(conversion_id: str) -> Optional[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM conversions WHERE id = ?", (conversion_id,)))
    if not rows:
        return None
    row = dict(rows[0])
    if row.get("result_json"):
        try:
            row["result_json"] = json.loads(row["result_json"])
        except Exception:
            pass
    if row.get("metrics_json"):
        try:
            row["metrics_json"] = json.loads(row["metrics_json"])
        except Exception:
            pass
    return row
