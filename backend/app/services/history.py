from typing import Any
from uuid import uuid4

from . import db
from .comparison import compare_code


def load_history() -> list[dict[str, Any]]:
    query = """
    SELECT
        id,
        timestamp,
        filename,
        summary,
        original_length,
        converted_length,
        similarity_ratio,
        diff_count,
        original_preview,
        converted_preview
    FROM history
    ORDER BY COALESCE(timestamp, created_at) DESC
    """
    return [dict(row) for row in db.iter_rows(query)]


def save_history(record: dict[str, Any]) -> dict[str, Any]:
    history_record = {
        "id": record["id"],
        "timestamp": record["timestamp"],
        "filename": record["filename"],
        "summary": record["summary"],
        "original_length": record["original_length"],
        "converted_length": record["converted_length"],
        "similarity_ratio": record["similarity_ratio"],
        "diff_count": record["diff_count"],
        "original_preview": record["original_preview"],
        "converted_preview": record["converted_preview"],
        "created_at": record["timestamp"],
    }
    with db.get_connection() as conn:
        db.upsert_row("history", history_record, connection=conn)
        conn.commit()

    return record


def clear_history() -> None:
    with db.get_connection() as conn:
        conn.execute("DELETE FROM history")
        conn.commit()


def create_history_entry(data: dict[str, Any]) -> dict[str, Any]:
    original_content = data.get("original_content", "")
    converted_content = data.get("converted_content", "")
    diff_result = compare_code(original_content, converted_content)

    return {
        "id": data.get("id") or str(uuid4()),
        "timestamp": data.get("timestamp"),
        "filename": data.get("filename"),
        "summary": data.get("summary"),
        "original_length": len(original_content),
        "converted_length": len(converted_content),
        "similarity_ratio": diff_result["similarity_ratio"],
        "diff_count": diff_result["diff_count"],
        "original_preview": original_content[:250],
        "converted_preview": converted_content[:250],
    }
