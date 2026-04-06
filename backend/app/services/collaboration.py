from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, json_dumps, json_loads, now_iso


class CollaborationService:
    def add_comment(self, tenant_id: str, resource_type: str, resource_id: str, user_id: str, text: str) -> Dict[str, Any]:
        timestamp = now_iso()
        comment = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "text": text,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO comments (id, tenant_id, resource_type, resource_id, user_id, text, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comment["id"],
                    comment["tenant_id"],
                    comment["resource_type"],
                    comment["resource_id"],
                    comment["user_id"],
                    comment["text"],
                    comment["created_at"],
                    comment["updated_at"],
                ),
            )
            conn.commit()
        return comment

    def list_comments(self, tenant_id: str, resource_type: str, resource_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT * FROM comments WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? ORDER BY created_at ASC",
            (tenant_id, resource_type, resource_id),
        )

    def create_review_request(
        self,
        tenant_id: str,
        resource_type: str,
        resource_id: str,
        requested_by: str,
        assigned_to: str | None = None,
        comments: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        review = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "requested_by": requested_by,
            "assigned_to": assigned_to,
            "status": "open",
            "comments_json": json_dumps(comments or []),
            "created_at": now_iso(),
            "resolved_at": None,
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO review_requests (id, tenant_id, resource_type, resource_id, requested_by, assigned_to, status, comments_json, created_at, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review["id"],
                    review["tenant_id"],
                    review["resource_type"],
                    review["resource_id"],
                    review["requested_by"],
                    review["assigned_to"],
                    review["status"],
                    review["comments_json"],
                    review["created_at"],
                    review["resolved_at"],
                ),
            )
            conn.commit()
        result = dict(review)
        result["comments"] = json_loads(result.pop("comments_json"), [])
        return result

    def list_review_requests(
        self,
        tenant_id: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> List[Dict[str, Any]]:
        filters = ["tenant_id = ?"]
        params: List[Any] = [tenant_id]
        if resource_type:
            filters.append("resource_type = ?")
            params.append(resource_type)
        if resource_id:
            filters.append("resource_id = ?")
            params.append(resource_id)

        reviews = fetch_all(
            f"SELECT * FROM review_requests WHERE {' AND '.join(filters)} ORDER BY created_at DESC",
            tuple(params),
        )
        for review in reviews:
            review["comments"] = json_loads(review.pop("comments_json", None), [])
        return reviews

    def resolve_review_request(self, tenant_id: str, review_id: str, status: str, comment: str | None = None) -> Optional[Dict[str, Any]]:
        timestamp = now_iso()
        reviews = fetch_all(
            "SELECT * FROM review_requests WHERE id = ? AND tenant_id = ?",
            (review_id, tenant_id),
        )
        if not reviews:
            return None
        comments = json_loads(reviews[0].get("comments_json"), [])
        if comment:
            comments.append(comment)
        with get_connection() as conn:
            conn.execute(
                "UPDATE review_requests SET status = ?, comments_json = ?, resolved_at = ? WHERE id = ? AND tenant_id = ?",
                (status, json_dumps(comments), timestamp, review_id, tenant_id),
            )
            conn.commit()
        resolved = fetch_all(
            "SELECT * FROM review_requests WHERE id = ? AND tenant_id = ?",
            (review_id, tenant_id),
        )[0]
        resolved["comments"] = json_loads(resolved.pop("comments_json"), [])
        return resolved