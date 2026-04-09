import json
from datetime import datetime, timezone
from typing import Dict, Any
from uuid import uuid4

from . import db


def save_uir(tenant_id: str, uir: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    uid = uir.get("id") or str(uuid4())
    with db.get_connection() as conn:
        db.upsert_row(
            "uir",
            {
                "id": uid,
                "tenant_id": tenant_id,
                "source_filename": uir.get("source_filename"),
                "language": uir.get("language"),
                "uir_json": json.dumps(uir),
                "created_at": now,
            },
            connection=conn,
        )
        conn.commit()

    return {"id": uid, "created_at": now}


def get_uir(uir_id: str) -> Dict[str, Any] | None:
    rows = list(db.iter_rows("SELECT * FROM uir WHERE id = ?", (uir_id,)))
    if not rows:
        return None
    row = rows[0]
    return dict(row)
