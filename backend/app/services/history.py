from typing import Any
from uuid import uuid4

from . import db
from .comparison import compare_code


def load_history() -> list[dict[str, Any]]:
    query = "SELECT * FROM history ORDER BY timestamp DESC"
    return [dict(row) for row in db.iter_rows(query)]


def save_history(record: dict[str, Any]) -> dict[str, Any]:
    insert_sql = """
    INSERT OR REPLACE INTO history (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    with db.get_connection() as conn:
        conn.execute(
            insert_sql,
            (
                record["id"],
                record["timestamp"],
                record["filename"],
                record["summary"],
                record["original_length"],
                record["converted_length"],
                record["similarity_ratio"],
                record["diff_count"],
                record["original_preview"],
                record["converted_preview"],
            ),
        )
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
