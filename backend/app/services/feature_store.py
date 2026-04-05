import json
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List

from . import db


def create_feature(tenant_id: str, name: str, definition: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    fid = str(uuid4())
    def_json = json.dumps(definition or {})
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO features (id, tenant_id, name, definition_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (fid, tenant_id, name, def_json, now),
        )
        conn.commit()
    return {"id": fid, "tenant_id": tenant_id, "name": name, "definition": definition or {}, "created_at": now}


def get_feature(tenant_id: str, feature_id: str) -> Optional[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM features WHERE id = ? AND tenant_id = ?", (feature_id, tenant_id)))
    if not rows:
        return None
    row = dict(rows[0])
    if row.get("definition_json"):
        try:
            row["definition_json"] = json.loads(row["definition_json"]) or {}
        except Exception:
            row["definition_json"] = {}
    return row


def list_features(tenant_id: str) -> List[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM features WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,)))
    out = []
    for r in rows:
        row = dict(r)
        if row.get("definition_json"):
            try:
                row["definition_json"] = json.loads(row["definition_json"]) or {}
            except Exception:
                row["definition_json"] = {}
        out.append(row)
    return out
