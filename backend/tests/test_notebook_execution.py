from pathlib import Path
import json
from uuid import uuid4
import sys
import time

from fastapi.testclient import TestClient

# Ensure backend package is importable when running tests from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.db import get_connection, init_db


def setup_module():
    init_db()


def _headers(tenant_id: str) -> dict[str, str]:
    return {
        "X-Tenant-Id": tenant_id,
        "X-User-Id": "notebook-execution-tester",
        "X-User-Role": "admin",
    }


def test_execute_notebook_cell_mode_sets_execution_count_for_fresh_code_cells():
    client = TestClient(app)
    tenant_id = f"tenant-notebook-exec-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    create_response = client.post(
        "/notebooks",
        json={"title": "Execution Count Notebook"},
        headers=headers,
    )
    assert create_response.status_code == 200
    notebook = create_response.json()["notebook"]

    code_cell = next(cell for cell in notebook["cells"] if cell["type"] == "code")
    notebook_id = notebook["id"]
    cell_id = code_cell["id"]

    update_response = client.put(
        f"/notebooks/{notebook_id}/cells/{cell_id}",
        json={"content": "1 + 1", "metadata": {"language": "python"}},
        headers=headers,
    )
    assert update_response.status_code == 200

    execute_response = client.post(
        f"/notebooks/{notebook_id}/executions",
        json={"mode": "cell", "cell_id": cell_id, "runtime_target": "local"},
        headers=headers,
    )
    assert execute_response.status_code == 200
    payload = execute_response.json()
    assert payload["status"] == "queued"
    assert payload["selected_cell_ids"] == [cell_id]
    execution_cells = {cell["id"]: cell for cell in payload["notebook"]["cells"]}
    assert execution_cells[cell_id]["execution_count"] == 1
    assert execution_cells[cell_id]["outputs"][0]["output_type"] == "execute_result"
    assert execution_cells[cell_id]["outputs"][0]["data"]["text/plain"] == "2"

    notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert notebook_response.status_code == 200
    refreshed_code_cell = next(cell for cell in notebook_response.json()["cells"] if cell["id"] == cell_id)
    assert refreshed_code_cell["execution_count"] == 1


def test_execute_notebook_uses_shared_pipeline_runtime_and_persists_outputs():
    client = TestClient(app)
    tenant_id = f"tenant-notebook-runtime-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    create_response = client.post(
        "/notebooks",
        json={"title": "Shared Runtime Notebook"},
        headers=headers,
    )
    assert create_response.status_code == 200
    notebook = create_response.json()["notebook"]
    notebook_id = notebook["id"]

    primary_code_cell = next(cell for cell in notebook["cells"] if cell["type"] == "code")
    primary_cell_id = primary_code_cell["id"]
    update_primary_response = client.put(
        f"/notebooks/{notebook_id}/cells/{primary_cell_id}",
        json={"content": "1 + 1", "metadata": {"language": "python"}},
        headers=headers,
    )
    assert update_primary_response.status_code == 200

    add_secondary_response = client.post(
        f"/notebooks/{notebook_id}/cells",
        params={"cell_type": "code", "content": "3 + 4"},
        headers=headers,
    )
    assert add_secondary_response.status_code == 200
    secondary_cell_id = add_secondary_response.json()["cell"]["id"]

    execute_response = client.post(
        f"/notebooks/{notebook_id}/executions",
        json={"mode": "all", "runtime_target": "local"},
        headers=headers,
    )
    assert execute_response.status_code == 200
    execution_payload = execute_response.json()
    assert execution_payload["status"] == "queued"
    assert execution_payload["run_id"]
    assert execution_payload["pipeline_id"]
    assert execution_payload["selected_cell_ids"] == [primary_cell_id, secondary_cell_id]

    execution_notebook = execution_payload["notebook"]
    execution_cells = {cell["id"]: cell for cell in execution_notebook["cells"]}
    assert execution_notebook["metadata"]["execution_pipeline_id"] == execution_payload["pipeline_id"]
    assert execution_cells[primary_cell_id]["execution_count"] == 1
    assert execution_cells[secondary_cell_id]["execution_count"] == 1
    assert execution_cells[primary_cell_id]["outputs"][0]["data"]["text/plain"] == "2"
    assert execution_cells[secondary_cell_id]["outputs"][0]["data"]["text/plain"] == "7"

    run_payload = None
    for _ in range(40):
        run_response = client.get(f"/pipelines/runs/{execution_payload['run_id']}", headers=headers)
        assert run_response.status_code == 200
        run_payload = run_response.json()
        if run_payload["status"] not in {"queued", "running", "queued_remote", "running_remote"}:
            break
        time.sleep(0.2)

    assert run_payload is not None
    assert run_payload["status"] == "success"

    node_response = client.get(f"/pipelines/runs/{execution_payload['run_id']}/nodes", headers=headers)
    assert node_response.status_code == 200
    node_items = node_response.json()["items"]
    assert [item["status"] for item in node_items] == ["success", "success"]
    assert node_items[0]["metadata"]["notebook_cell_id"] == primary_cell_id
    assert node_items[1]["metadata"]["notebook_cell_id"] == secondary_cell_id
    assert node_items[0]["metadata"]["source_ref"]["cell_id"] == primary_cell_id
    assert node_items[1]["metadata"]["source_ref"]["cell_id"] == secondary_cell_id
    assert node_items[0]["metadata"]["jupyter_outputs"][0]["data"]["text/plain"] == "2"
    assert node_items[1]["metadata"]["jupyter_outputs"][0]["data"]["text/plain"] == "7"

    log_response = client.get(f"/pipelines/runs/{execution_payload['run_id']}/logs", headers=headers)
    assert log_response.status_code == 200
    log_payload = log_response.json()
    assert len(log_payload["items"]) >= 3
    assert log_payload["cursor"] >= log_payload["items"][-1]["id"]

    refreshed_notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert refreshed_notebook_response.status_code == 200
    refreshed_notebook = refreshed_notebook_response.json()
    refreshed_cells = {cell["id"]: cell for cell in refreshed_notebook["cells"]}
    assert refreshed_notebook["metadata"]["execution_pipeline_id"] == execution_payload["pipeline_id"]
    assert refreshed_notebook["metadata"]["last_execution"]["run_id"] == execution_payload["run_id"]
    assert refreshed_cells[primary_cell_id]["execution_count"] == 1
    assert refreshed_cells[secondary_cell_id]["execution_count"] == 1
    assert refreshed_cells[primary_cell_id]["outputs"][0]["data"]["text/plain"] == "2"
    assert refreshed_cells[secondary_cell_id]["outputs"][0]["data"]["text/plain"] == "7"


def test_notebook_scope_columns_are_persisted_and_filterable():
    client = TestClient(app)
    tenant_id = f"tenant-notebook-scope-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)
    project_id = f"project-{uuid4().hex[:6]}"
    workspace_id = f"workspace-{uuid4().hex[:6]}"

    create_response = client.post(
        "/notebooks",
        json={
            "title": "Scoped Notebook",
            "project_id": project_id,
            "workspace_id": workspace_id,
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    notebook = create_response.json()["notebook"]
    notebook_id = notebook["id"]
    assert notebook["project_id"] == project_id
    assert notebook["workspace_id"] == workspace_id

    with get_connection() as conn:
        row = conn.execute(
            "SELECT project_id, workspace_id FROM notebooks WHERE id = ? AND tenant_id = ?",
            (notebook_id, tenant_id),
        ).fetchone()

    assert row is not None
    assert row[0] == project_id
    assert row[1] == workspace_id

    list_response = client.get(
        f"/notebooks?project_id={project_id}&workspace_id={workspace_id}",
        headers=headers,
    )
    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["id"] == notebook_id
    assert items[0]["project_id"] == project_id
    assert items[0]["workspace_id"] == workspace_id

    notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert notebook_response.status_code == 200
    notebook_payload = notebook_response.json()
    assert notebook_payload["project_id"] == project_id
    assert notebook_payload["workspace_id"] == workspace_id
    assert notebook_payload["metadata"]["project_id"] == project_id
    assert notebook_payload["metadata"]["workspace_id"] == workspace_id


def test_notebook_scope_backfill_promotes_legacy_metadata_into_columns():
    client = TestClient(app)
    tenant_id = f"tenant-notebook-backfill-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)
    project_id = f"project-{uuid4().hex[:6]}"
    workspace_id = f"workspace-{uuid4().hex[:6]}"
    notebook_id = f"notebook-{uuid4().hex[:8]}"
    created_at = "2026-01-03T00:00:00+00:00"

    notebook_payload = {
        "id": notebook_id,
        "title": "Legacy Scoped Notebook",
        "tenant_id": tenant_id,
        "user_id": "notebook-execution-tester",
        "created_at": created_at,
        "updated_at": created_at,
        "cells": [],
        "metadata": {
            "project_id": project_id,
            "workspace_id": workspace_id,
            "runtime_defaults": {"target": "local", "profile": "local"},
        },
    }

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO notebooks (id, tenant_id, user_id, title, project_id, workspace_id, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                notebook_id,
                tenant_id,
                "notebook-execution-tester",
                "Legacy Scoped Notebook",
                None,
                None,
                json.dumps(notebook_payload),
                created_at,
                created_at,
            ),
        )
        conn.commit()

    backfill_response = client.post("/notebooks/backfill-scope", headers=headers)
    assert backfill_response.status_code == 200
    backfill_payload = backfill_response.json()
    assert backfill_payload["updated"] >= 1

    list_response = client.get(
        f"/notebooks?project_id={project_id}&workspace_id={workspace_id}",
        headers=headers,
    )
    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["id"] == notebook_id

    notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert notebook_response.status_code == 200
    refreshed_notebook = notebook_response.json()
    assert refreshed_notebook["project_id"] == project_id
    assert refreshed_notebook["workspace_id"] == workspace_id


def test_notebook_scope_gap_report_lists_only_unscoped_records():
    client = TestClient(app)
    tenant_id = f"tenant-notebook-gap-report-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO notebooks (id, tenant_id, user_id, title, project_id, workspace_id, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"notebook-gap-{uuid4().hex[:8]}",
                tenant_id,
                "notebook-execution-tester",
                "Unscoped Legacy Notebook",
                None,
                None,
                json.dumps(
                    {
                        "id": "legacy-gap",
                        "title": "Unscoped Legacy Notebook",
                        "tenant_id": tenant_id,
                        "user_id": "notebook-execution-tester",
                        "created_at": "2026-01-04T00:00:00+00:00",
                        "updated_at": "2026-01-04T00:00:00+00:00",
                        "cells": [],
                        "metadata": {},
                    }
                ),
                "2026-01-04T00:00:00+00:00",
                "2026-01-04T00:00:00+00:00",
            ),
        )
        conn.commit()

    report_response = client.get("/notebooks/scope-gaps?limit=25", headers=headers)
    assert report_response.status_code == 200
    payload = report_response.json()
    assert payload["summary"]["total"] == 1
    assert payload["summary"]["recoverable_count"] == 0
    assert payload["summary"]["unrecoverable_count"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["title"] == "Unscoped Legacy Notebook"
    assert payload["items"][0]["recoverable"] is False
    assert "missing_project_metadata" in payload["items"][0]["reasons"]
    assert "missing_workspace_metadata" in payload["items"][0]["reasons"]