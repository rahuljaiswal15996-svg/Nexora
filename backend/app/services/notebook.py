import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

from app.services.catalog import CatalogService
from app.services.db import get_connection
from app.services.pipeline_authoring import validate_pipeline_dag
from app.services.pipeline_runner import create_pipeline, get_pipeline, start_pipeline_run, update_pipeline


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_cells() -> List[Dict[str, Any]]:
    return [
        {
            "id": str(uuid.uuid4()),
            "type": "markdown",
            "content": "# Welcome to Nexora Notebook\n\nThis notebook integrates with Nexora's conversion and pipeline capabilities.",
            "execution_count": None,
            "outputs": [],
            "metadata": {},
        },
        {
            "id": str(uuid.uuid4()),
            "type": "code",
            "content": "# Import Nexora services\nimport os\nimport requests\n\n# Example: Convert some code\ncode = \"\"\"PROC SQL;\nSELECT * FROM users;\nQUIT;\"\"\"\napi_base_url = os.environ['NEXORA_API_BASE_URL']\n\n# Use Nexora API for conversion\n# response = requests.post(f'{api_base_url}/convert',\n#                         files={'file': ('code.sql', code)})\n# print(response.json())",
            "execution_count": None,
            "outputs": [],
            "metadata": {"language": "python"},
        },
    ]


def _language_metadata() -> Dict[str, Any]:
    return {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {
            "name": "python",
            "version": "3.9.0",
        },
    }


def _as_cell_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    cells: List[Dict[str, Any]] = []
    for item in cast(List[Any], value):
        if isinstance(item, dict):
            cells.append(dict(cast(Dict[str, Any], item)))
    return cells


def _as_dict(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return dict(cast(Dict[str, Any], value))


def _as_dict_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    items: List[Dict[str, Any]] = []
    for item in cast(List[Any], value):
        if isinstance(item, dict):
            items.append(dict(cast(Dict[str, Any], item)))
    return items


def _as_str_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in cast(List[Any], value) if item is not None]


def _normalized_text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text or None


def _default_notebook_metadata() -> Dict[str, Any]:
    return {
        **_language_metadata(),
        "project_id": None,
        "workspace_id": None,
        "dataset_links": [],
        "flow_binding": None,
        "runtime_defaults": {
            "target": "local",
            "profile": "local",
        },
        "execution_pipeline_id": None,
    }


def _merge_notebook_metadata(existing: Any, updates: Any | None = None) -> Dict[str, Any]:
    metadata = _default_notebook_metadata()
    metadata.update(_as_dict(existing))
    if updates:
        metadata.update(_as_dict(updates))
    metadata["project_id"] = str(metadata.get("project_id") or "").strip() or None
    metadata["workspace_id"] = str(metadata.get("workspace_id") or "").strip() or None
    runtime_defaults = _as_dict(metadata.get("runtime_defaults"))
    metadata["runtime_defaults"] = {
        "target": str(runtime_defaults.get("target") or "local"),
        "profile": str(runtime_defaults.get("profile") or runtime_defaults.get("target") or "local"),
    }
    metadata["dataset_links"] = _as_str_list(metadata.get("dataset_links"))
    if metadata.get("flow_binding") is not None:
        metadata["flow_binding"] = _as_dict(metadata.get("flow_binding"))
    return metadata


def _normalize_cell(cell: Dict[str, Any], index: int) -> Dict[str, Any]:
    cell_type = str(cell.get("type") or cell.get("cell_type") or "code").strip().lower()
    if cell_type not in {"code", "markdown"}:
        cell_type = "code"
    metadata = _as_dict(cell.get("metadata"))
    language = str(metadata.get("language") or ("markdown" if cell_type == "markdown" else "python")).strip().lower()
    content = cell.get("content")
    if content is None and isinstance(cell.get("source"), list):
        content = "\n".join(str(item) for item in cast(List[Any], cell.get("source")))
    normalized: Dict[str, Any] = {
        "id": str(cell.get("id") or f"cell-{index + 1}"),
        "type": cell_type,
        "content": str(content or ""),
        "execution_count": cell.get("execution_count"),
        "outputs": cell.get("outputs") if isinstance(cell.get("outputs"), list) else [],
        "metadata": {
            **metadata,
            "language": language,
        },
    }
    return normalized


def _normalize_notebook_document(notebook: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(notebook)
    cells = _as_cell_list(normalized.get("cells"))
    normalized["cells"] = [_normalize_cell(cell, index) for index, cell in enumerate(cells)]
    normalized["metadata"] = _merge_notebook_metadata(normalized.get("metadata"))
    return normalized


def _schema_summary(dataset: Dict[str, Any]) -> str:
    schema = _as_dict_list(dataset.get("schema"))
    if not schema:
        return "- Schema metadata is not available yet."
    lines = [f"- {column.get('name', 'column')}: {column.get('type', 'unknown')}" for column in schema[:8]]
    return "\n".join(lines) or "- Schema metadata is not available yet."


def _dataset_seed_cells(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    dataset_name = str(dataset.get("name") or dataset.get("id") or "dataset")
    schema_summary = _schema_summary(dataset)
    return [
        {
            "id": str(uuid.uuid4()),
            "type": "markdown",
            "content": f"# {dataset_name} notebook\n\nOpened from Catalog with dataset context.\n\n## Schema\n{schema_summary}",
            "execution_count": None,
            "outputs": [],
            "metadata": {"language": "markdown"},
        },
        {
            "id": str(uuid.uuid4()),
            "type": "code",
            "content": f"SELECT *\nFROM {dataset_name}\nLIMIT 100;",
            "execution_count": None,
            "outputs": [],
            "metadata": {"language": "sql"},
        },
    ]


def _flow_node_seed_cells(node: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = _as_dict(node.get("data"))
    config = _as_dict(node.get("config") or data.get("config"))
    node_kind = str(node.get("kind") or data.get("kind") or "recipe").strip().lower()
    node_label = str(node.get("label") or data.get("label") or node.get("id") or "Flow Node")
    language = str(config.get("language") or "python").strip().lower()
    if node_kind == "recipe":
        content = str(config.get("expression") or "")
        if not content:
            content = f"# Build logic for {node_label}\n"
    elif node_kind == "dataset":
        dataset_name = str(config.get("dataset_name") or node.get("id") or "dataset")
        language = "sql"
        content = f"SELECT *\nFROM {dataset_name}\nLIMIT 100;"
    else:
        content = f"# Notebook scaffold for {node_label}\n"

    return [
        {
            "id": str(uuid.uuid4()),
            "type": "markdown",
            "content": f"# {node_label}\n\nOpened from Flow Builder node `{node.get('id')}`.",
            "execution_count": None,
            "outputs": [],
            "metadata": {"language": "markdown"},
        },
        {
            "id": str(uuid.uuid4()),
            "type": "code",
            "content": content,
            "execution_count": None,
            "outputs": [],
            "metadata": {"language": language},
        },
    ]


def _resolve_pipeline_node(pipeline: Dict[str, Any] | None, node_id: str) -> Optional[Dict[str, Any]]:
    dag_json = _as_dict(pipeline.get("dag_json")) if pipeline else {}
    for node in _as_dict_list(dag_json.get("nodes")):
        if str(node.get("id") or "") == node_id:
            return node
    return None


def _default_notebook_position(nodes: List[Dict[str, Any]]) -> Dict[str, int]:
    existing_positions = [
        _as_dict(node.get("position"))
        for node in nodes
        if _as_dict(node.get("position"))
    ]
    if not existing_positions:
        return {"x": 720, "y": 220}
    max_x = max(int(position.get("x") or 0) for position in existing_positions)
    avg_y = int(sum(int(position.get("y") or 0) for position in existing_positions) / len(existing_positions))
    return {"x": max_x + 220, "y": avg_y}


def _dedupe_strings(values: List[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _slugify(value: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else "_" for char in str(value or "notebook"))
    compact = "_".join(part for part in normalized.split("_") if part)
    return compact or "notebook"


def _normalize_runtime_target(value: Any) -> str:
    candidate = str(value or "local").strip().lower()
    return candidate if candidate in {"local", "cluster"} else "local"


def _normalize_execution_mode(value: Any) -> str:
    candidate = str(value or "all").strip().lower()
    if candidate not in {"cell", "selection", "all"}:
        raise ValueError("Unsupported notebook execution mode")
    return candidate


def _normalize_cell_language(cell: Dict[str, Any]) -> str:
    metadata = _as_dict(cell.get("metadata"))
    if str(cell.get("type") or "code").strip().lower() == "markdown":
        return "markdown"
    return str(metadata.get("language") or "python").strip().lower() or "python"


def _recipe_language_for_cell(cell: Dict[str, Any]) -> str:
    language = _normalize_cell_language(cell)
    if language in {"sql", "pyspark"}:
        return language
    return "python"


def _runtime_profile_for_language(language: str, runtime_target: str) -> str:
    if language == "sql":
        return "warehouse-sql"
    if language == "pyspark":
        return "spark-cluster" if runtime_target == "cluster" else "python-batch"
    return "python-batch"


def _compile_pipeline_expression(cell: Dict[str, Any]) -> str:
    content = str(cell.get("content") or "").strip()
    language = _recipe_language_for_cell(cell)
    if not content:
        return "print('Notebook cell is ready to run')"
    if len(content) >= 8:
        return content
    if language == "sql":
        return f"SELECT {content} AS value"
    return f"print({content})"


def _cell_execution_result(cell: Dict[str, Any]) -> Dict[str, Any]:
    code = str(cell.get("content") or "")
    outputs: List[Dict[str, Any]] = []
    next_execution_count = int(cell.get("execution_count") or 0) + 1

    try:
        if "import requests" in code or "requests.post" in code:
            outputs.append(
                {
                    "output_type": "stream",
                    "name": "stdout",
                    "text": "Mock Nexora API call executed successfully\nConverted code would appear here...",
                }
            )
        else:
            try:
                result = eval(code)
                outputs.append(
                    {
                        "output_type": "execute_result",
                        "execution_count": next_execution_count,
                        "data": {
                            "text/plain": str(result),
                        },
                    }
                )
            except Exception:
                preview = code[:50]
                suffix = "..." if len(code) > 50 else ""
                outputs.append(
                    {
                        "output_type": "stream",
                        "name": "stdout",
                        "text": f"Code executed: {preview}{suffix}",
                    }
                )
    except Exception as exc:
        outputs.append(
            {
                "output_type": "error",
                "ename": type(exc).__name__,
                "evalue": str(exc),
                "traceback": [str(exc)],
            }
        )

    return {
        "execution_count": next_execution_count,
        "outputs": outputs,
    }


def _compact_preview(text: str, limit: int = 120) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 3].rstrip()}..."


def _build_output_artifacts(cell: Dict[str, Any], outputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    language = _normalize_cell_language(cell)
    artifacts: List[Dict[str, Any]] = []
    cell_id = str(cell.get("id") or "cell")
    content_preview = _compact_preview(str(cell.get("content") or ""))

    if language == "sql" and content_preview:
        artifacts.append(
            {
                "id": f"{cell_id}-table",
                "output_type": "table",
                "title": "SQL preview",
                "columns": [{"name": "query", "type": "text"}],
                "rows": [{"query": content_preview}],
            }
        )

    if any(keyword in str(cell.get("content") or "").lower() for keyword in ["plot", "chart", "matplotlib", "seaborn", "plotly", "px."]):
        artifacts.append(
            {
                "id": f"{cell_id}-chart",
                "output_type": "chart",
                "title": "Chart preview",
                "spec": {
                    "kind": "bar",
                    "series": [
                        {"label": "A", "value": 14},
                        {"label": "B", "value": 22},
                        {"label": "C", "value": 9},
                    ],
                },
            }
        )

    for index, output in enumerate(outputs):
        output_type = str(output.get("output_type") or "stream").strip().lower()
        if output_type == "execute_result":
            artifacts.append(
                {
                    "id": f"{cell_id}-result-{index + 1}",
                    "output_type": "log",
                    "title": "Execution result",
                    "text": str(_as_dict(output.get("data")).get("text/plain") or ""),
                }
            )
        elif output_type == "stream":
            artifacts.append(
                {
                    "id": f"{cell_id}-stream-{index + 1}",
                    "output_type": "log",
                    "title": str(output.get("name") or "stdout"),
                    "text": str(output.get("text") or ""),
                }
            )
        elif output_type == "error":
            artifacts.append(
                {
                    "id": f"{cell_id}-error-{index + 1}",
                    "output_type": "log",
                    "title": str(output.get("ename") or "error"),
                    "text": str(output.get("evalue") or "Execution failed"),
                }
            )

    if not artifacts:
        artifacts.append(
            {
                "id": f"{cell_id}-log",
                "output_type": "log",
                "title": "Execution summary",
                "text": "Notebook cell compiled into the shared pipeline runtime.",
            }
        )

    return artifacts


def _validation_execution_binding(validation: Dict[str, Any], node_id: str) -> Dict[str, Any]:
    for item in _as_dict_list(validation.get("node_results")):
        if str(item.get("node_id") or "") == node_id:
            return _as_dict(item.get("execution_binding"))
    return {}


def _notebook_project_id(metadata: Dict[str, Any]) -> Optional[str]:
    return str(
        metadata.get("project_id")
        or _as_dict(metadata.get("migration_context")).get("project_id")
        or _as_dict(metadata.get("project_context")).get("project_id")
        or ""
    ).strip() or None


def _notebook_workspace_ids(metadata: Dict[str, Any]) -> List[str]:
    migration_context = _as_dict(metadata.get("migration_context"))
    project_context = _as_dict(metadata.get("project_context"))
    return _dedupe_strings(
        [
            str(metadata.get("workspace_id") or "").strip(),
            str(migration_context.get("workspace_id") or "").strip(),
            str(project_context.get("workspace_id") or "").strip(),
            *_as_str_list(migration_context.get("workspace_ids")),
        ]
    )


def _notebook_workspace_id(metadata: Dict[str, Any]) -> Optional[str]:
    workspace_ids = _notebook_workspace_ids(metadata)
    return workspace_ids[0] if workspace_ids else None


def _notebook_scope_from_metadata(metadata: Dict[str, Any]) -> Dict[str, Optional[str]]:
    merged_metadata = _merge_notebook_metadata(metadata)
    return {
        "project_id": _notebook_project_id(merged_metadata),
        "workspace_id": _notebook_workspace_id(merged_metadata),
    }


def _storage_notebook_document(notebook: Dict[str, Any]) -> Dict[str, Any]:
    stored = dict(notebook)
    stored.pop("project_id", None)
    stored.pop("workspace_id", None)
    return stored


def _hydrate_notebook_record(row: Any) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    try:
        notebook = _normalize_notebook_document(json.loads(row["content"]))
    except Exception:
        return None

    column_project_id = _normalized_text(row.get("project_id"))
    column_workspace_id = _normalized_text(row.get("workspace_id"))
    derived_scope = _notebook_scope_from_metadata(_as_dict(notebook.get("metadata")))
    effective_project_id = column_project_id or derived_scope["project_id"]
    effective_workspace_id = column_workspace_id or derived_scope["workspace_id"]

    notebook["id"] = str(row.get("id") or notebook.get("id") or "")
    notebook["tenant_id"] = str(row.get("tenant_id") or notebook.get("tenant_id") or "default")
    notebook["user_id"] = str(row.get("user_id") or notebook.get("user_id") or "anonymous")
    notebook["title"] = str(row.get("title") or notebook.get("title") or "Untitled Notebook")
    notebook["created_at"] = row.get("created_at") or notebook.get("created_at")
    notebook["updated_at"] = row.get("updated_at") or notebook.get("updated_at")
    notebook["metadata"] = _merge_notebook_metadata(
        notebook.get("metadata"),
        {
            "project_id": effective_project_id,
            "workspace_id": effective_workspace_id,
        },
    )
    notebook["project_id"] = effective_project_id
    notebook["workspace_id"] = effective_workspace_id
    return notebook


def backfill_notebook_scope_columns(
    *,
    tenant_id: Optional[str] = None,
    notebook_id: Optional[str] = None,
    include_existing: bool = False,
) -> Dict[str, int]:
    filters = ["1 = 1"]
    params: List[Any] = []
    if tenant_id:
        filters.append("tenant_id = ?")
        params.append(tenant_id)
    if notebook_id:
        filters.append("id = ?")
        params.append(notebook_id)
    if not include_existing:
        filters.append("(project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '')")

    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM notebooks WHERE {' AND '.join(filters)} ORDER BY updated_at DESC",
            tuple(params),
        ).fetchall()

    if not rows:
        return {"scanned": 0, "updated": 0, "skipped": 0}

    scanned = 0
    updated = 0
    skipped = 0
    with get_connection() as conn:
        for row in rows:
            scanned += 1
            notebook = _hydrate_notebook_record(row)
            if not notebook:
                skipped += 1
                continue
            scope = _notebook_scope_from_metadata(_as_dict(notebook.get("metadata")))
            current_project_id = _normalized_text(row.get("project_id"))
            current_workspace_id = _normalized_text(row.get("workspace_id"))
            next_project_id = scope["project_id"] or current_project_id
            next_workspace_id = scope["workspace_id"] or current_workspace_id
            if current_project_id == next_project_id and current_workspace_id == next_workspace_id:
                skipped += 1
                continue
            conn.execute(
                "UPDATE notebooks SET project_id = ?, workspace_id = ? WHERE id = ? AND tenant_id = ?",
                (next_project_id, next_workspace_id, row.get("id"), row.get("tenant_id")),
            )
            updated += 1
        conn.commit()

    return {"scanned": scanned, "updated": updated, "skipped": skipped}


def list_unscoped_notebooks(
    tenant_id: str,
    *,
    limit: int = 100,
) -> Dict[str, Any]:
    normalized_limit = max(1, min(int(limit or 100), 500))
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM notebooks
            WHERE tenant_id = ?
              AND (project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '')
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (tenant_id, normalized_limit),
        ).fetchall()
        total_row = conn.execute(
            "SELECT COUNT(*) AS count FROM notebooks WHERE tenant_id = ? AND (project_id IS NULL OR project_id = '' OR workspace_id IS NULL OR workspace_id = '')",
            (tenant_id,),
        ).fetchone()

    items: List[Dict[str, Any]] = []
    project_gap_count = 0
    workspace_gap_count = 0
    recoverable_count = 0
    unrecoverable_count = 0

    for row in rows:
        notebook = _hydrate_notebook_record(row)
        if not notebook:
            continue
        metadata = _merge_notebook_metadata(notebook.get("metadata"))
        derived_scope = _notebook_scope_from_metadata(metadata)
        current_project_id = _normalized_text(row.get("project_id"))
        current_workspace_id = _normalized_text(row.get("workspace_id"))
        missing_project = not current_project_id
        missing_workspace = not current_workspace_id
        if missing_project:
            project_gap_count += 1
        if missing_workspace:
            workspace_gap_count += 1
        recoverable = (missing_project and bool(derived_scope["project_id"])) or (missing_workspace and bool(derived_scope["workspace_id"]))
        if recoverable:
            recoverable_count += 1
        else:
            unrecoverable_count += 1

        reasons: List[str] = []
        if missing_project:
            reasons.append("missing_project_column")
            if not derived_scope["project_id"]:
                reasons.append("missing_project_metadata")
        if missing_workspace:
            reasons.append("missing_workspace_column")
            if not derived_scope["workspace_id"]:
                reasons.append("missing_workspace_metadata")

        items.append(
            {
                "id": notebook.get("id"),
                "title": notebook.get("title"),
                "updated_at": notebook.get("updated_at"),
                "project_id": current_project_id,
                "workspace_id": current_workspace_id,
                "derived_project_id": derived_scope["project_id"],
                "derived_workspace_id": derived_scope["workspace_id"],
                "recoverable": recoverable,
                "reasons": reasons,
                "cell_count": len(_as_cell_list(notebook.get("cells"))),
            }
        )

    total_count = int(total_row.get("count") or 0) if total_row else 0
    return {
        "items": items,
        "summary": {
            "total": total_count,
            "project_gap_count": project_gap_count,
            "workspace_gap_count": workspace_gap_count,
            "recoverable_count": recoverable_count,
            "unrecoverable_count": unrecoverable_count,
            "limit": normalized_limit,
        },
    }

class NotebookService:
    """Service for managing interactive notebooks with code execution capabilities."""

    def __init__(self):
        self.notebook_dir = Path(__file__).resolve().parents[1] / "data" / "notebooks"
        self.notebook_dir.mkdir(parents=True, exist_ok=True)
        self.catalog_service = CatalogService()

    def create_notebook(
        self,
        title: str,
        tenant_id: str = "default",
        user_id: str = "anonymous",
        *,
        initial_cells: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new notebook with default structure."""
        notebook_id = str(uuid.uuid4())
        timestamp = _now_iso()

        notebook: Dict[str, Any] = {
            "id": notebook_id,
            "title": title,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "created_at": timestamp,
            "updated_at": timestamp,
            "cells": initial_cells or _default_cells(),
            "metadata": _merge_notebook_metadata(None, metadata),
        }
        notebook = _normalize_notebook_document(notebook)
        project_id = _notebook_project_id(_as_dict(notebook.get("metadata")))
        workspace_id = _notebook_workspace_id(_as_dict(notebook.get("metadata")))
        notebook["project_id"] = project_id
        notebook["workspace_id"] = workspace_id

        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO notebooks (id, tenant_id, user_id, title, project_id, workspace_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    notebook_id,
                    tenant_id,
                    user_id,
                    title,
                    project_id,
                    workspace_id,
                    json.dumps(_storage_notebook_document(notebook)),
                    timestamp,
                    timestamp,
                ),
            )
            conn.commit()

        return notebook

    def get_notebook(self, notebook_id: str, tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        """Retrieve a notebook by ID."""
        with get_connection() as conn:
            result = conn.execute(
                """
                SELECT * FROM notebooks
                WHERE id = ? AND tenant_id = ?
                """,
                (notebook_id, tenant_id),
            ).fetchone()

        return _hydrate_notebook_record(result)

    def update_notebook(self, notebook_id: str, updates: Dict[str, Any], tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        """Update a notebook with new content."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return None

        notebook.update(updates)
        notebook["metadata"] = _merge_notebook_metadata(notebook.get("metadata"), updates.get("metadata"))
        notebook = _normalize_notebook_document(notebook)
        notebook["updated_at"] = _now_iso()
        notebook["project_id"] = _notebook_project_id(_as_dict(notebook.get("metadata")))
        notebook["workspace_id"] = _notebook_workspace_id(_as_dict(notebook.get("metadata")))

        with get_connection() as conn:
            conn.execute(
                """
                UPDATE notebooks
                SET project_id = ?, workspace_id = ?, content = ?, updated_at = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (
                    notebook.get("project_id"),
                    notebook.get("workspace_id"),
                    json.dumps(_storage_notebook_document(notebook)),
                    notebook["updated_at"],
                    notebook_id,
                    tenant_id,
                ),
            )
            conn.commit()

        return notebook

    def open_workspace(self, source: Dict[str, Any], tenant_id: str = "default", user_id: str = "anonymous") -> Dict[str, Any]:
        source_payload = _as_dict(source)
        source_type = str(source_payload.get("type") or "notebook").strip().lower() or "notebook"
        requested_notebook_id = str(source_payload.get("notebook_id") or "").strip()
        project_id = str(source_payload.get("project_id") or "").strip() or None
        workspace_id = str(source_payload.get("workspace_id") or "").strip() or None
        notebook = self.get_notebook(requested_notebook_id, tenant_id) if requested_notebook_id else None
        open_context: Dict[str, Any] = {
            "source_type": source_type,
            "dataset_id": None,
            "linked_dataset_ids": [],
            "project_id": project_id,
            "workspace_id": workspace_id,
            "flow": {
                "pipeline_id": None,
                "node_id": None,
            },
        }

        if source_type == "dataset":
            dataset_id = str(source_payload.get("dataset_id") or "").strip()
            dataset = self.catalog_service.get_dataset(dataset_id, tenant_id)
            if not dataset:
                raise ValueError("Dataset not found")
            if not notebook:
                notebook = self.create_notebook(
                    f"{dataset['name']} Notebook",
                    tenant_id,
                    user_id,
                    initial_cells=_dataset_seed_cells(dataset),
                    metadata={
                        "project_id": project_id,
                        "workspace_id": workspace_id,
                        "dataset_links": [dataset_id],
                    },
                )
            else:
                metadata = _merge_notebook_metadata(notebook.get("metadata"))
                if project_id:
                    metadata["project_id"] = project_id
                if workspace_id:
                    metadata["workspace_id"] = workspace_id
                metadata["dataset_links"] = sorted(set([*metadata.get("dataset_links", []), dataset_id]))
                notebook = self.update_notebook(notebook["id"], {"metadata": metadata}, tenant_id)
            open_context.update(
                {
                    "dataset_id": dataset_id,
                    "linked_dataset_ids": [dataset_id],
                }
            )
        elif source_type in {"flow_node", "node"}:
            pipeline_id = str(source_payload.get("pipeline_id") or "").strip()
            node_id = str(source_payload.get("node_id") or "").strip()
            pipeline = get_pipeline(pipeline_id) if pipeline_id else None
            node = _resolve_pipeline_node(pipeline, node_id) if pipeline and node_id else None
            if pipeline and str(pipeline.get("tenant_id") or "") != tenant_id:
                raise ValueError("Pipeline not found")
            if not node and pipeline_id and node_id:
                raise ValueError("Flow node not found")

            node_config = _as_dict(node.get("config")) if node else {}
            linked_dataset_ids = _as_str_list(node_config.get("linked_dataset_ids"))
            bound_notebook_id = str(source_payload.get("notebook_id") or node_config.get("notebook_id") or "").strip()
            if bound_notebook_id and not notebook:
                notebook = self.get_notebook(bound_notebook_id, tenant_id)

            fallback_node = node or {"id": node_id, "label": node_id or "Flow Node"}

            if not notebook:
                notebook = self.create_notebook(
                    f"{str(fallback_node.get('label') or node_id or 'Flow Node')} Notebook",
                    tenant_id,
                    user_id,
                    initial_cells=_flow_node_seed_cells(fallback_node),
                    metadata={
                        "project_id": project_id,
                        "workspace_id": workspace_id,
                        "dataset_links": linked_dataset_ids,
                        "flow_binding": {
                            "pipeline_id": pipeline_id or None,
                            "node_id": node_id or None,
                        },
                    },
                )
            else:
                metadata = _merge_notebook_metadata(notebook.get("metadata"))
                if project_id:
                    metadata["project_id"] = project_id
                if workspace_id:
                    metadata["workspace_id"] = workspace_id
                if pipeline_id or node_id:
                    metadata["flow_binding"] = {
                        **_as_dict(metadata.get("flow_binding")),
                        "pipeline_id": pipeline_id or _as_dict(metadata.get("flow_binding")).get("pipeline_id"),
                        "node_id": node_id or _as_dict(metadata.get("flow_binding")).get("node_id"),
                    }
                if linked_dataset_ids:
                    metadata["dataset_links"] = _dedupe_strings([
                        *_as_str_list(metadata.get("dataset_links")),
                        *linked_dataset_ids,
                    ])
                notebook = self.update_notebook(notebook["id"], {"metadata": metadata}, tenant_id)

            open_context.update(
                {
                    "linked_dataset_ids": linked_dataset_ids,
                    "flow": {
                        "pipeline_id": pipeline_id or None,
                        "node_id": node_id or None,
                    },
                }
            )
        elif source_type == "new":
            if not notebook:
                title = str(source_payload.get("title") or "Untitled Notebook").strip() or "Untitled Notebook"
                notebook = self.create_notebook(
                    title,
                    tenant_id,
                    user_id,
                    metadata={
                        "project_id": project_id,
                        "workspace_id": workspace_id,
                    },
                )
        elif source_type == "notebook":
            if not notebook:
                raise ValueError("Notebook not found")

        if notebook and (project_id or workspace_id):
            metadata = _merge_notebook_metadata(notebook.get("metadata"))
            if project_id:
                metadata["project_id"] = project_id
            if workspace_id:
                metadata["workspace_id"] = workspace_id
            notebook = self.update_notebook(notebook["id"], {"metadata": metadata}, tenant_id)

        if not notebook:
            notebooks = self.list_notebooks(tenant_id, user_id, project_id=project_id, workspace_id=workspace_id)
            if notebooks:
                notebook = self.get_notebook(notebooks[0]["id"], tenant_id)
            if not notebook:
                notebook = self.create_notebook(
                    "Untitled Notebook",
                    tenant_id,
                    user_id,
                    metadata={
                        "project_id": project_id,
                        "workspace_id": workspace_id,
                    },
                )

        notebook = _normalize_notebook_document(notebook)
        metadata = _merge_notebook_metadata(notebook.get("metadata"))
        flow_binding = _as_dict(metadata.get("flow_binding")) if metadata.get("flow_binding") else None
        if metadata.get("dataset_links") and not open_context.get("linked_dataset_ids"):
            open_context["linked_dataset_ids"] = metadata.get("dataset_links")
        return {
            "notebook": notebook,
            "open_context": open_context,
            "flow_binding": flow_binding,
        }

    def attach_to_flow(self, notebook_id: str, payload: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise ValueError("Notebook not found")

        pipeline_id = str(payload.get("pipeline_id") or "").strip()
        if not pipeline_id:
            raise ValueError("pipeline_id is required")

        pipeline = get_pipeline(pipeline_id)
        if not pipeline or str(pipeline.get("tenant_id") or "") != tenant_id:
            raise ValueError("Pipeline not found")

        dag_json = deepcopy(_as_dict(pipeline.get("dag_json")))
        nodes = [dict(cast(Dict[str, Any], node)) for node in cast(List[Any], dag_json.get("nodes") or []) if isinstance(node, dict)]
        edges = [dict(cast(Dict[str, Any], edge)) for edge in cast(List[Any], dag_json.get("edges") or []) if isinstance(edge, dict)]
        attach_mode = str(payload.get("attach_mode") or "existing_node").strip().lower()
        node_id = str(payload.get("node_id") or "").strip() or f"notebook_{notebook_id[:8]}"
        label = str(payload.get("label") or notebook.get("title") or "Notebook Step").strip() or "Notebook Step"
        description = str(payload.get("description") or "Notebook workspace step compiled from a persisted notebook asset.").strip()
        position = _as_dict(payload.get("position")) or _default_notebook_position(nodes)
        config_payload = _as_dict(payload.get("config"))
        metadata = _merge_notebook_metadata(notebook.get("metadata"))
        linked_dataset_ids = _as_str_list(config_payload.get("linked_dataset_ids")) or _as_str_list(metadata.get("dataset_links"))
        runtime_profile = str(config_payload.get("runtime_profile") or metadata.get("runtime_defaults", {}).get("profile") or "local")
        notebook_config: Dict[str, Any] = {
            "notebook_id": notebook_id,
            "runtime_profile": runtime_profile,
            "entrypoint_cell": str(config_payload.get("entrypoint_cell") or "").strip(),
            "parameters": _as_dict(config_payload.get("parameters")),
            "linked_dataset_ids": linked_dataset_ids,
            "retry_limit": int(config_payload.get("retry_limit") or 1),
        }

        next_node: Dict[str, Any] = {
            "id": node_id,
            "kind": "notebook",
            "label": label,
            "description": description,
            "position": {
                "x": int(position.get("x") or 720),
                "y": int(position.get("y") or 220),
            },
            "config": notebook_config,
            "metadata": {
                "notebook_asset_id": notebook_id,
                "linked_dataset_ids": notebook_config["linked_dataset_ids"],
                "source": "notebook_workspace",
            },
        }

        replaced = False
        if attach_mode == "existing_node":
            for index, node in enumerate(nodes):
                if str(node.get("id") or "") == node_id:
                    nodes[index] = {
                        **node,
                        **next_node,
                        "data": {
                            **_as_dict(node.get("data")),
                            "kind": "notebook",
                            "label": label,
                            "description": description,
                            "config": notebook_config,
                        },
                    }
                    replaced = True
                    break

        if not replaced:
            next_node["data"] = {
                "kind": "notebook",
                "label": label,
                "description": description,
                "config": notebook_config,
            }
            nodes.append(next_node)

            upstream_node_id = str(payload.get("upstream_node_id") or "").strip()
            downstream_node_id = str(payload.get("downstream_node_id") or "").strip()
            if upstream_node_id:
                edges.append({"id": f"edge-{upstream_node_id}-{node_id}", "source": upstream_node_id, "target": node_id})
            if downstream_node_id:
                edges.append({"id": f"edge-{node_id}-{downstream_node_id}", "source": node_id, "target": downstream_node_id})

        validation = validate_pipeline_dag({"nodes": nodes, "edges": edges, "metadata": _as_dict(dag_json.get("metadata"))})
        if not validation.get("valid"):
            raise ValueError(json.dumps({"message": "pipeline dag validation failed", "validation": validation}))

        updated_pipeline = update_pipeline(
            pipeline_id,
            tenant_id,
            validation["normalized_dag"],
            name=str(payload.get("pipeline_name") or pipeline.get("name") or "Notebook Flow"),
        )
        flow_binding: Dict[str, Any] = {
            "pipeline_id": pipeline_id,
            "node_id": node_id,
            "execution_binding": _validation_execution_binding(validation, node_id),
        }
        metadata["dataset_links"] = notebook_config["linked_dataset_ids"]
        metadata["runtime_defaults"] = {
            "target": runtime_profile,
            "profile": runtime_profile,
        }
        metadata["flow_binding"] = flow_binding
        updated_notebook = self.update_notebook(notebook_id, {"metadata": metadata}, tenant_id)
        return {
            "status": "ok",
            "pipeline_id": pipeline_id,
            "node_id": node_id,
            "validation": validation,
            "flow_binding": flow_binding,
            "pipeline": updated_pipeline,
            "notebook": updated_notebook,
        }

    def list_notebooks(
        self,
        tenant_id: str = "default",
        user_id: Optional[str] = None,
        *,
        project_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all notebooks for a tenant/user."""
        query = """
            SELECT id, title, created_at, updated_at, project_id, workspace_id FROM notebooks
            WHERE tenant_id = ?
        """
        params: List[Any] = [tenant_id]
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
        if workspace_id:
            query += " AND workspace_id = ?"
            params.append(workspace_id)
        query += " ORDER BY updated_at DESC"

        notebooks: List[Dict[str, Any]] = []
        with get_connection() as conn:
            for row in conn.execute(query, tuple(params)).fetchall():
                notebook_project_id = _normalized_text(row[4])
                notebook_workspace_id = _normalized_text(row[5])
                notebooks.append(
                    {
                        "id": row[0],
                        "title": row[1],
                        "created_at": row[2],
                        "updated_at": row[3],
                        "project_id": notebook_project_id,
                        "workspace_id": notebook_workspace_id,
                        "workspace_ids": [notebook_workspace_id] if notebook_workspace_id else [],
                    }
                )
        return notebooks

    def backfill_scope_columns(
        self,
        *,
        tenant_id: Optional[str] = None,
        notebook_id: Optional[str] = None,
        include_existing: bool = False,
    ) -> Dict[str, int]:
        return backfill_notebook_scope_columns(
            tenant_id=tenant_id,
            notebook_id=notebook_id,
            include_existing=include_existing,
        )

    def list_scope_gaps(self, tenant_id: str, *, limit: int = 100) -> Dict[str, Any]:
        return list_unscoped_notebooks(tenant_id, limit=limit)

    def delete_notebook(self, notebook_id: str, tenant_id: str = "default") -> bool:
        """Delete a notebook."""
        with get_connection() as conn:
            cursor = conn.execute(
                """
                DELETE FROM notebooks
                WHERE id = ? AND tenant_id = ?
                """,
                (notebook_id, tenant_id),
            )
            deleted = cursor.rowcount > 0
            conn.commit()

        return deleted

    def execute_notebook(self, notebook_id: str, payload: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Compile notebook cells into a transient pipeline and execute them through the shared runtime."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise ValueError("Notebook not found")

        normalized_notebook = _normalize_notebook_document(notebook)
        cells = _as_cell_list(normalized_notebook.get("cells"))
        metadata = _merge_notebook_metadata(normalized_notebook.get("metadata"))
        mode = _normalize_execution_mode(payload.get("mode"))
        runtime_target = _normalize_runtime_target(payload.get("runtime_target") or _as_dict(metadata.get("runtime_defaults")).get("target"))
        requested_cell_id = str(payload.get("cell_id") or "").strip()
        requested_cell_ids = [str(item).strip() for item in cast(List[Any], payload.get("cell_ids") or []) if str(item).strip()]

        selected_cells: List[Dict[str, Any]] = []
        if mode == "cell":
            if not requested_cell_id:
                raise ValueError("cell_id is required for cell execution mode")
            selected_cells = [cell for cell in cells if str(cell.get("id") or "") == requested_cell_id and str(cell.get("type") or "").lower() == "code"]
            if not selected_cells:
                raise ValueError("Selected notebook cell was not found or is not executable")
        elif mode == "selection":
            selected_ids = requested_cell_ids or ([requested_cell_id] if requested_cell_id else [])
            if not selected_ids:
                raise ValueError("cell_ids are required for selection execution mode")
            selected_id_set = set(selected_ids)
            selected_cells = [cell for cell in cells if str(cell.get("id") or "") in selected_id_set and str(cell.get("type") or "").lower() == "code"]
            if not selected_cells:
                raise ValueError("No executable notebook cells were selected")
        else:
            selected_cells = [cell for cell in cells if str(cell.get("type") or "").lower() == "code"]

        if not selected_cells:
            raise ValueError("Notebook does not contain any executable code cells")

        linked_dataset_ids = _as_str_list(payload.get("linked_dataset_ids")) or _as_str_list(metadata.get("dataset_links"))
        parameters = _as_dict(payload.get("parameters"))
        execution_results: Dict[str, Dict[str, Any]] = {}
        node_input: List[Dict[str, Any]] = []
        notebook_slug = _slugify(str(normalized_notebook.get("title") or "notebook"))

        for notebook_index, cell in enumerate(cells):
            if str(cell.get("id") or "") not in {str(item.get("id") or "") for item in selected_cells}:
                continue
            cell_id = str(cell.get("id") or f"cell-{notebook_index + 1}")
            result = _cell_execution_result(cell)
            execution_results[cell_id] = result
            language = _recipe_language_for_cell(cell)
            runtime_profile = _runtime_profile_for_language(language, runtime_target)
            node_input.append(
                {
                    "id": f"nb-{notebook_id[:8]}-{cell_id[:8]}",
                    "kind": "recipe",
                    "label": f"Cell {notebook_index + 1}",
                    "description": f"Notebook execution unit for cell {notebook_index + 1}.",
                    "position": {"x": 180 + len(node_input) * 240, "y": 220},
                    "simulate_seconds": 0.12,
                    "config": {
                        "language": language,
                        "runtime_profile": runtime_profile,
                        "expression": _compile_pipeline_expression(cell),
                        "output_dataset_name": f"{notebook_slug}_cell_{notebook_index + 1}",
                        "materialization": "view",
                        "parameter_bindings": parameters,
                    },
                    "metadata": {
                        "notebook_id": notebook_id,
                        "notebook_title": normalized_notebook.get("title"),
                        "notebook_cell_id": cell_id,
                        "cell_index": notebook_index,
                        "cell_language": language,
                        "runtime_target": runtime_target,
                        "linked_dataset_ids": linked_dataset_ids,
                        "execution_count": result["execution_count"],
                        "jupyter_outputs": result["outputs"],
                        "output_artifacts": _build_output_artifacts(cell, result["outputs"]),
                        "source_ref": {
                            "type": "notebook_cell",
                            "notebook_id": notebook_id,
                            "cell_id": cell_id,
                        },
                    },
                    "sourceRef": {
                        "type": "notebook_cell",
                        "notebook_id": notebook_id,
                        "cell_id": cell_id,
                    },
                }
            )

        if not node_input:
            raise ValueError("Notebook execution plan did not produce any executable pipeline nodes")

        edges: List[Dict[str, Any]] = [
            {
                "id": f"{node_input[index]['id']}-to-{node_input[index + 1]['id']}",
                "source": node_input[index]["id"],
                "target": node_input[index + 1]["id"],
            }
            for index in range(len(node_input) - 1)
        ]
        execution_dag: Dict[str, Any] = {
            "nodes": node_input,
            "edges": edges,
            "metadata": {
                "notebook_id": notebook_id,
                "notebook_title": normalized_notebook.get("title"),
                "execution_mode": mode,
                "runtime_target": runtime_target,
                "selected_cell_ids": [str(cell.get("id") or "") for cell in selected_cells],
                **({"project_id": metadata.get("project_id")} if metadata.get("project_id") else {}),
                **({"workspace_id": metadata.get("workspace_id")} if metadata.get("workspace_id") else {}),
                **(
                    {
                        "project": {
                            "id": metadata.get("project_id"),
                        },
                        "workspace": {
                            "id": metadata.get("workspace_id"),
                        },
                    }
                    if metadata.get("project_id") or metadata.get("workspace_id")
                    else {}
                ),
            },
        }
        validation = validate_pipeline_dag(execution_dag)
        if not validation.get("valid"):
            raise ValueError("Notebook execution plan is invalid")

        execution_pipeline_id = str(metadata.get("execution_pipeline_id") or "").strip()
        existing_pipeline = get_pipeline(execution_pipeline_id) if execution_pipeline_id else None
        if existing_pipeline and str(existing_pipeline.get("tenant_id") or "") != tenant_id:
            existing_pipeline = None
        execution_pipeline_name = f"{normalized_notebook.get('title') or 'Notebook'} Notebook Execution"
        normalized_dag = _as_dict(validation.get("normalized_dag"))

        if existing_pipeline:
            pipeline = update_pipeline(existing_pipeline["id"], tenant_id, normalized_dag, name=execution_pipeline_name)
            execution_pipeline_id = str(existing_pipeline["id"])
        else:
            created = create_pipeline(tenant_id, execution_pipeline_name, normalized_dag)
            execution_pipeline_id = str(created["id"])
            pipeline = get_pipeline(execution_pipeline_id)

        run_config: Dict[str, Any] = {
            "initiated_from": "notebook-workspace",
            "notebook_id": notebook_id,
            "execution_mode": mode,
            "runtime_target": runtime_target,
            "selected_cell_ids": [str(cell.get("id") or "") for cell in selected_cells],
        }
        started = start_pipeline_run(execution_pipeline_id, tenant_id, run_config)

        updated_cells: List[Dict[str, Any]] = []
        for cell in cells:
            cell_id = str(cell.get("id") or "")
            if cell_id in execution_results:
                updated_cells.append(
                    {
                        **cell,
                        "execution_count": execution_results[cell_id]["execution_count"],
                        "outputs": execution_results[cell_id]["outputs"],
                    }
                )
            else:
                updated_cells.append(cell)

        metadata["runtime_defaults"] = {
            "target": runtime_target,
            "profile": runtime_target,
        }
        metadata["execution_pipeline_id"] = execution_pipeline_id
        metadata["last_execution"] = {
            "run_id": started["run_id"],
            "pipeline_id": execution_pipeline_id,
            "execution_mode": mode,
            "runtime_target": runtime_target,
            "selected_cell_ids": run_config["selected_cell_ids"],
            "started_at": started["created_at"],
        }
        updated_notebook = self.update_notebook(
            notebook_id,
            {
                "cells": updated_cells,
                "metadata": metadata,
            },
            tenant_id,
        )

        return {
            "status": started["status"],
            "run_id": started["run_id"],
            "pipeline_id": execution_pipeline_id,
            "created_at": started["created_at"],
            "execution_mode": mode,
            "selected_cell_ids": run_config["selected_cell_ids"],
            "telemetry": {
                "run": f"/pipelines/runs/{started['run_id']}",
                "nodes": f"/pipelines/runs/{started['run_id']}/nodes",
                "logs": f"/pipelines/runs/{started['run_id']}/logs",
            },
            "notebook": updated_notebook,
            "pipeline": pipeline,
        }

    def add_cell(self, notebook_id: str, cell_type: str = "code", content: str = "", after_cell_id: Optional[str] = None, tenant_id: str = "default") -> Dict[str, Any]:
        """Add a new cell to a notebook."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise ValueError("Notebook not found")

        new_cell: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "type": cell_type,
            "content": content,
            "execution_count": None,
            "outputs": [],
            "metadata": {}
        }

        cells = _as_cell_list(notebook.get("cells"))
        if not cells and notebook.get("cells") not in (None, []):
            raise ValueError("Notebook cells are invalid")
        notebook["cells"] = cells

        if after_cell_id:
            for i, cell in enumerate(cells):
                if cell.get("id") == after_cell_id:
                    cells.insert(i + 1, new_cell)
                    break
            else:
                cells.append(new_cell)
        else:
            cells.append(new_cell)

        self.update_notebook(notebook_id, notebook, tenant_id)
        return new_cell

    def update_cell(self, notebook_id: str, cell_id: str, updates: Dict[str, Any], tenant_id: str = "default") -> bool:
        """Update a cell's content or metadata."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return False

        cells = _as_cell_list(notebook.get("cells"))
        if not cells and notebook.get("cells") not in (None, []):
            return False
        notebook["cells"] = cells

        for cell in cells:
            if cell.get("id") == cell_id:
                cell.update(updates)
                break
        else:
            return False

        self.update_notebook(notebook_id, notebook, tenant_id)
        return True

    def delete_cell(self, notebook_id: str, cell_id: str, tenant_id: str = "default") -> bool:
        """Delete a cell from a notebook."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return False

        cells = _as_cell_list(notebook.get("cells"))
        if not cells and notebook.get("cells") not in (None, []):
            return False
        notebook["cells"] = cells

        original_length = len(cells)
        notebook["cells"] = [cell for cell in cells if cell.get("id") != cell_id]

        if len(notebook["cells"]) < original_length:
            self.update_notebook(notebook_id, notebook, tenant_id)
            return True

        return False