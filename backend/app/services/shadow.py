import os
import json
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List

from . import db
from app.services.conversion_engine import convert_code, _engine
from app.services.comparison import compute_diff_metrics


HITL_THRESHOLD = float(os.getenv("NEXORA_HITL_THRESHOLD", "0.85"))


def create_shadow_run(tenant_id: str, input_type: str, input_blob: str, threshold: Optional[float] = None) -> Dict[str, Any]:
    """Create a shadow execution comparing legacy vs converted outputs.

    - `threshold` overrides env `NEXORA_HITL_THRESHOLD` to decide if HITL review is needed.
    """
    now = datetime.utcnow().isoformat() + "Z"
    sid = str(uuid4())
    threshold = float(threshold) if threshold is not None else HITL_THRESHOLD

    # Simulate legacy output using rule-based conversion as a proxy
    try:
        legacy_output = _engine.rule_based_convert(input_blob)
    except Exception:
        legacy_output = input_blob

    # Run conversion (may use LLM adapter)
    result = convert_code(input_blob, language=None, tenant_id=tenant_id)
    converted = result.get("converted") or ""
    comparison = result.get("comparison") or {}

    # Confidence heuristic: adapter-reported or similarity ratio
    adapter_meta = result.get("meta", {}).get("adapter") or {}
    confidence = float(adapter_meta.get("confidence") if adapter_meta.get("confidence") is not None else comparison.get("similarity_ratio", 0.0))

    status = "manual_review" if confidence < threshold else "auto_approved"

    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO shadow_runs (id, tenant_id, input_type, input_blob, legacy_output, converted_output, comparison_json, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, tenant_id, input_type, input_blob, legacy_output, converted, json.dumps(comparison), confidence, status, now),
        )
        conn.commit()

    return {"id": sid, "tenant_id": tenant_id, "status": status, "confidence": confidence, "created_at": now}


def get_shadow_run(shadow_id: str) -> Optional[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM shadow_runs WHERE id = ?", (shadow_id,)))
    if not rows:
        return None
    row = dict(rows[0])
    if row.get("comparison_json"):
        try:
            row["comparison_json"] = json.loads(row["comparison_json"]) or {}
        except Exception:
            row["comparison_json"] = {}
    return row


def list_shadow_runs(tenant_id: Optional[str] = None, status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    query = "SELECT * FROM shadow_runs"
    params: List[Any] = []
    where = []
    if tenant_id:
        where.append("tenant_id = ?")
        params.append(tenant_id)
    if status:
        where.append("status = ?")
        params.append(status)
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = list(db.iter_rows(query, tuple(params)))
    out = []
    for r in rows:
        row = dict(r)
        if row.get("comparison_json"):
            try:
                row["comparison_json"] = json.loads(row["comparison_json"]) or {}
            except Exception:
                row["comparison_json"] = {}
        out.append(row)
    return out


def set_shadow_review(shadow_id: str, reviewer_id: str, action: str, comment: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Record a human review action for a shadow run.

    `action` should be one of: 'approve', 'reject', 'needs-fix'.
    """
    now = datetime.utcnow().isoformat() + "Z"
    review_action = action
    status = "reviewed_approved" if action == "approve" else ("reviewed_rejected" if action == "reject" else "reviewed_needs_fix")
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE shadow_runs SET reviewer_id = ?, review_action = ?, review_comment = ?, reviewed_at = ?, status = ? WHERE id = ?",
            (reviewer_id, review_action, comment or "", now, status, shadow_id),
        )
        conn.commit()

    return get_shadow_run(shadow_id)
