import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services import db


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    if value is None:
        return json.dumps({})
    return json.dumps(value)


def json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def fetch_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    rows = list(db.iter_rows(query, params))
    if not rows:
        return None
    return dict(rows[0])


def fetch_all(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    return [dict(row) for row in db.iter_rows(query, params)]