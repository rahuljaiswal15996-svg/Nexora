from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.db import get_connection
from app.services.platform_store import fetch_all, fetch_one, json_dumps, json_loads, now_iso


class ProjectService:
    def create_project(
        self,
        tenant_id: str,
        name: str,
        owner_id: str,
        description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        project_id = str(uuid4())
        timestamp = now_iso()
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO projects (id, tenant_id, name, description, owner_id, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (project_id, tenant_id, name, description, owner_id, json_dumps(metadata or {}), timestamp, timestamp),
            )
            conn.execute(
                """
                INSERT INTO project_members (id, project_id, tenant_id, user_id, role, added_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), project_id, tenant_id, owner_id, "admin", timestamp),
            )
            conn.execute(
                """
                INSERT INTO workspaces (id, project_id, tenant_id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid4()), project_id, tenant_id, "Default Workspace", "Auto-created project workspace", timestamp, timestamp),
            )
            conn.commit()
        return self.get_project(project_id, tenant_id) or {}

    def list_projects(self, tenant_id: str) -> List[Dict[str, Any]]:
        projects = fetch_all(
            "SELECT * FROM projects WHERE tenant_id = ? ORDER BY updated_at DESC",
            (tenant_id,),
        )
        for project in projects:
            project["metadata"] = json_loads(project.pop("metadata_json", None), {})
        return projects

    def get_project(self, project_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        project = fetch_one(
            "SELECT * FROM projects WHERE id = ? AND tenant_id = ?",
            (project_id, tenant_id),
        )
        if not project:
            return None
        project["metadata"] = json_loads(project.pop("metadata_json", None), {})
        project["members"] = fetch_all(
            "SELECT user_id, role, added_at FROM project_members WHERE project_id = ? AND tenant_id = ? ORDER BY added_at ASC",
            (project_id, tenant_id),
        )
        project["workspaces"] = fetch_all(
            "SELECT id, name, description, created_at, updated_at FROM workspaces WHERE project_id = ? AND tenant_id = ? ORDER BY updated_at DESC",
            (project_id, tenant_id),
        )
        return project

    def add_member(self, project_id: str, tenant_id: str, user_id: str, role: str) -> Dict[str, Any]:
        timestamp = now_iso()
        member = {
            "id": str(uuid4()),
            "project_id": project_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "role": role,
            "added_at": timestamp,
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO project_members (id, project_id, tenant_id, user_id, role, added_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (member["id"], member["project_id"], member["tenant_id"], member["user_id"], member["role"], member["added_at"]),
            )
            conn.commit()
        return member

    def create_workspace(self, project_id: str, tenant_id: str, name: str, description: str = "") -> Dict[str, Any]:
        workspace = {
            "id": str(uuid4()),
            "project_id": project_id,
            "tenant_id": tenant_id,
            "name": name,
            "description": description,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO workspaces (id, project_id, tenant_id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    workspace["id"],
                    workspace["project_id"],
                    workspace["tenant_id"],
                    workspace["name"],
                    workspace["description"],
                    workspace["created_at"],
                    workspace["updated_at"],
                ),
            )
            conn.commit()
        return workspace

    def ensure_workspace(self, project_id: str, tenant_id: str, name: str, description: str = "") -> Dict[str, Any]:
        normalized_name = name.strip().lower()
        for workspace in self.list_workspaces(project_id, tenant_id):
            if str(workspace.get("name") or "").strip().lower() == normalized_name:
                return workspace
        return self.create_workspace(project_id, tenant_id, name, description)

    def list_workspaces(self, project_id: str, tenant_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT id, name, description, created_at, updated_at FROM workspaces WHERE project_id = ? AND tenant_id = ? ORDER BY updated_at DESC",
            (project_id, tenant_id),
        )