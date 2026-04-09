from pathlib import Path
from uuid import uuid4
import sys

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
        "X-User-Id": "pipeline-authoring-tester",
        "X-User-Role": "admin",
    }


def test_pipeline_authoring_catalog_and_validation_contract():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-authoring-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    catalog_response = client.get("/pipelines/node-catalog", headers=headers)
    assert catalog_response.status_code == 200
    catalog_payload = catalog_response.json()
    assert {item["kind"] for item in catalog_payload["items"]} == {
        "dataset",
        "recipe",
        "notebook",
        "model",
        "validation",
        "deploy",
    }

    validate_response = client.post(
        "/pipelines/validate",
        json={
            "dag": {
                "nodes": [
                    {
                        "id": "source",
                        "kind": "dataset",
                        "label": "Source Orders",
                        "config": {"dataset_name": "orders_raw"},
                    },
                    {
                        "id": "transform",
                        "kind": "recipe",
                        "label": "Normalize Orders",
                        "config": {
                            "language": "sql",
                            "expression": "SELECT * FROM source_orders",
                            "output_dataset_name": "orders_curated",
                        },
                    },
                    {
                        "id": "ship",
                        "kind": "deploy",
                        "label": "Publish API",
                        "config": {"target_platform": "api", "target_name": "orders-service"},
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "source", "target": "transform"},
                    {"id": "e2", "source": "transform", "target": "ship"},
                ],
            }
        },
        headers=headers,
    )
    assert validate_response.status_code == 200
    validation_payload = validate_response.json()
    assert validation_payload["valid"] is True
    assert validation_payload["graph"]["terminal_node_ids"] == ["ship"]
    node_results = {item["node_id"]: item for item in validation_payload["node_results"]}
    assert node_results["transform"]["execution_binding"]["executor"] == "transform.sql"
    assert node_results["ship"]["execution_binding"]["executor"] == "deploy.api"
    assert validation_payload["normalized_dag"]["nodes"][0]["config"]["dataset_mode"] == "source"


def test_pipeline_update_rejects_invalid_cycles():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-authoring-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    create_response = client.post(
        "/pipelines",
        json={
            "name": "authoring-update-smoke",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Source", "config": {"dataset_name": "orders_raw"}},
                    {
                        "id": "transform",
                        "kind": "recipe",
                        "label": "Transform",
                        "config": {
                            "language": "sql",
                            "expression": "SELECT * FROM source_table",
                            "output_dataset_name": "orders_curated",
                        },
                    },
                ],
                "edges": [{"id": "e1", "source": "source", "target": "transform"}],
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    pipeline_id = create_response.json()["pipeline_id"]

    update_response = client.put(
        f"/pipelines/{pipeline_id}",
        json={
            "name": "authoring-update-smoke",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Source", "config": {"dataset_name": "orders_raw"}},
                    {
                        "id": "transform",
                        "kind": "recipe",
                        "label": "Transform",
                        "config": {
                            "language": "sql",
                            "expression": "SELECT * FROM source_table",
                            "output_dataset_name": "orders_curated",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "source", "target": "transform"},
                    {"id": "e2", "source": "transform", "target": "source"},
                ],
            },
        },
        headers=headers,
    )
    assert update_response.status_code == 400
    detail = update_response.json()["detail"]
    assert detail["message"] == "pipeline dag validation failed"
    assert any("cycle" in item["message"].lower() for item in detail["validation"]["errors"])


def test_pipeline_inventory_filters_by_project_and_workspace_context():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-inventory-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)
    project_id = f"project-{uuid4().hex[:6]}"
    workspace_id = f"workspace-{uuid4().hex[:6]}"

    matching_response = client.post(
        "/pipelines",
        json={
            "name": "project-scoped-notebook-flow",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}},
                    {
                        "id": "analysis",
                        "kind": "notebook",
                        "label": "Notebook Analysis",
                        "config": {"notebook_id": "nb-orders", "runtime_profile": "local"},
                    },
                ],
                "edges": [{"id": "e1", "source": "source", "target": "analysis"}],
                "metadata": {
                    "project": {"id": project_id, "name": "Retail Modernization"},
                    "workspace": {"id": workspace_id, "name": "Conversion Studio"},
                },
            },
        },
        headers=headers,
    )
    assert matching_response.status_code == 200
    matching_pipeline_id = matching_response.json()["pipeline_id"]

    other_response = client.post(
        "/pipelines",
        json={
            "name": "other-workspace-flow",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}},
                    {
                        "id": "transform",
                        "kind": "recipe",
                        "label": "Transform",
                        "config": {
                            "language": "sql",
                            "expression": "SELECT * FROM source_orders",
                            "output_dataset_name": "orders_curated",
                        },
                    },
                ],
                "edges": [{"id": "e1", "source": "source", "target": "transform"}],
                "metadata": {
                    "project": {"id": project_id, "name": "Retail Modernization"},
                    "workspace": {"id": f"workspace-{uuid4().hex[:6]}", "name": "Sandbox"},
                },
            },
        },
        headers=headers,
    )
    assert other_response.status_code == 200

    list_response = client.get(
        f"/pipelines?project_id={project_id}&workspace_id={workspace_id}",
        headers=headers,
    )

    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "project-scoped-notebook-flow"
    assert items[0]["project_id"] == project_id
    assert items[0]["workspace_id"] == workspace_id
    assert items[0]["node_count"] == 2
    assert items[0]["notebook_node_count"] == 1
    assert items[0]["nodes"][1]["kind"] == "notebook"
    assert items[0]["nodes"][1]["notebook_id"] == "nb-orders"

    pipeline_response = client.get(f"/pipelines/{matching_pipeline_id}", headers=headers)
    assert pipeline_response.status_code == 200
    pipeline_payload = pipeline_response.json()
    assert pipeline_payload["project_id"] == project_id
    assert pipeline_payload["workspace_id"] == workspace_id
    assert pipeline_payload["updated_at"]


def test_pipeline_scope_backfill_promotes_legacy_metadata_into_columns():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-backfill-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)
    project_id = f"project-{uuid4().hex[:6]}"
    workspace_id = f"workspace-{uuid4().hex[:6]}"
    pipeline_id = f"pipeline-{uuid4().hex[:8]}"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO pipelines (id, tenant_id, name, project_id, workspace_id, dag_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pipeline_id,
                tenant_id,
                "legacy-project-flow",
                None,
                None,
                "{" 
                '"nodes": [{"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}}, '
                '{"id": "analysis", "kind": "notebook", "label": "Notebook Analysis", "config": {"notebook_id": "nb-legacy", "runtime_profile": "local"}}], '
                '"edges": [{"id": "e1", "source": "source", "target": "analysis"}], '
                f'"metadata": {{"project": {{"id": "{project_id}", "name": "Legacy Retail"}}, "workspace": {{"id": "{workspace_id}", "name": "Legacy Studio"}}}}'
                "}",
                "2026-01-01T00:00:00+00:00",
                None,
            ),
        )
        conn.commit()

    backfill_response = client.post("/pipelines/backfill-scope", headers=headers)
    assert backfill_response.status_code == 200
    backfill_payload = backfill_response.json()
    assert backfill_payload["updated"] >= 1

    list_response = client.get(
        f"/pipelines?project_id={project_id}&workspace_id={workspace_id}",
        headers=headers,
    )
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == pipeline_id

    pipeline_response = client.get(f"/pipelines/{pipeline_id}", headers=headers)
    assert pipeline_response.status_code == 200
    pipeline_payload = pipeline_response.json()
    assert pipeline_payload["project_id"] == project_id
    assert pipeline_payload["workspace_id"] == workspace_id
    assert pipeline_payload["updated_at"] == "2026-01-01T00:00:00+00:00"


def test_pipeline_scope_gap_report_lists_only_unscoped_records():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-gap-report-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    scoped_response = client.post(
        "/pipelines",
        json={
            "name": "fully-scoped-flow",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}},
                    {"id": "transform", "kind": "recipe", "label": "Transform", "config": {"language": "sql", "expression": "SELECT * FROM source_orders", "output_dataset_name": "orders_curated"}},
                ],
                "edges": [{"id": "e1", "source": "source", "target": "transform"}],
                "metadata": {
                    "project": {"id": "project-ok", "name": "Retail"},
                    "workspace": {"id": "workspace-ok", "name": "Studio"},
                },
            },
        },
        headers=headers,
    )
    assert scoped_response.status_code == 200

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO pipelines (id, tenant_id, name, project_id, workspace_id, dag_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"pipeline-gap-{uuid4().hex[:8]}",
                tenant_id,
                "unscoped-legacy-flow",
                None,
                None,
                '{"nodes": [{"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}}], "edges": [], "metadata": {}}',
                "2026-01-02T00:00:00+00:00",
                None,
            ),
        )
        conn.commit()

    report_response = client.get("/pipelines/scope-gaps?limit=25", headers=headers)
    assert report_response.status_code == 200
    payload = report_response.json()
    assert payload["summary"]["total"] == 1
    assert payload["summary"]["unrecoverable_count"] == 1
    assert payload["summary"]["recoverable_count"] == 0
    assert len(payload["items"]) == 1
    assert payload["items"][0]["name"] == "unscoped-legacy-flow"
    assert payload["items"][0]["recoverable"] is False
    assert "missing_project_metadata" in payload["items"][0]["reasons"]
    assert "missing_workspace_metadata" in payload["items"][0]["reasons"]


def test_pipeline_scope_can_be_assigned_manually_from_runtime_ops_path():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-assign-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    project_response = client.post(
        "/projects",
        headers=headers,
        json={
            "name": "Ops Recovery Project",
            "description": "Manual scope recovery target",
        },
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    workspace_response = client.post(
        f"/projects/{project_id}/workspaces",
        headers=headers,
        json={
            "name": "Recovered Flow Workspace",
            "description": "Manual flow reassignment workspace",
        },
    )
    assert workspace_response.status_code == 200
    workspace_id = workspace_response.json()["id"]

    pipeline_id = f"pipeline-{uuid4().hex[:8]}"
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO pipelines (id, tenant_id, name, project_id, workspace_id, dag_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pipeline_id,
                tenant_id,
                "manual-scope-recovery-flow",
                None,
                None,
                '{"nodes": [{"id": "source", "kind": "dataset", "label": "Orders", "config": {"dataset_name": "orders_raw"}}], "edges": [], "metadata": {}}',
                "2026-01-05T00:00:00+00:00",
                None,
            ),
        )
        conn.commit()

    assign_response = client.put(
        f"/pipelines/{pipeline_id}/scope",
        headers=headers,
        json={
            "project_id": project_id,
            "workspace_id": workspace_id,
        },
    )
    assert assign_response.status_code == 200

    pipeline_response = client.get(f"/pipelines/{pipeline_id}", headers=headers)
    assert pipeline_response.status_code == 200
    pipeline_payload = pipeline_response.json()
    assert pipeline_payload["project_id"] == project_id
    assert pipeline_payload["workspace_id"] == workspace_id
    assert pipeline_payload["dag_json"]["metadata"]["project"]["id"] == project_id
    assert pipeline_payload["dag_json"]["metadata"]["workspace"]["id"] == workspace_id

    report_response = client.get("/pipelines/scope-gaps?limit=25", headers=headers)
    assert report_response.status_code == 200
    report_payload = report_response.json()
    assert report_payload["summary"]["total"] == 0