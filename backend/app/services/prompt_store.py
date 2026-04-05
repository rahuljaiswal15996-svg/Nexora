import json
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List

from . import db


def create_prompt(tenant_id: str, name: str, template: str, version: str = "v1", metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    pid = str(uuid4())
    meta_json = json.dumps(metadata or {})
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO prompts (id, tenant_id, name, version, template, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (pid, tenant_id, name, version, template, meta_json, now),
        )
        conn.commit()
    return {"id": pid, "tenant_id": tenant_id, "name": name, "version": version, "template": template, "metadata": metadata or {}, "created_at": now}


def get_prompt(tenant_id: str, name: str, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if version:
        rows = list(db.iter_rows("SELECT * FROM prompts WHERE tenant_id = ? AND name = ? AND version = ? ORDER BY created_at DESC LIMIT 1", (tenant_id, name, version)))
    else:
        rows = list(db.iter_rows("SELECT * FROM prompts WHERE tenant_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1", (tenant_id, name)))
    if not rows:
        return None
    row = dict(rows[0])
    if row.get("metadata_json"):
        try:
            row["metadata_json"] = json.loads(row["metadata_json"]) or {}
        except Exception:
            row["metadata_json"] = {}
    return row


def list_prompts(tenant_id: str) -> List[Dict[str, Any]]:
    rows = list(db.iter_rows("SELECT * FROM prompts WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,)))
    out = []
    for r in rows:
        row = dict(r)
        if row.get("metadata_json"):
            try:
                row["metadata_json"] = json.loads(row["metadata_json"]) or {}
            except Exception:
                row["metadata_json"] = {}
        out.append(row)
    return out
