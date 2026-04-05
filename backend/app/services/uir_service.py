from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from . import db


def save_uir(tenant_id: str, uir: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    uid = uir.get("id") or str(uuid4())
    with db.get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO uir (id, tenant_id, source_filename, language, uir_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                uid,
                tenant_id,
                uir.get("source_filename"),
                uir.get("language"),
                str(uir),
                now,
            ),
        )
        conn.commit()

    return {"id": uid, "created_at": now}


def get_uir(uir_id: str) -> Dict[str, Any] | None:
    rows = list(db.iter_rows("SELECT * FROM uir WHERE id = ?", (uir_id,)))
    if not rows:
        return None
    row = rows[0]
    return dict(row)
