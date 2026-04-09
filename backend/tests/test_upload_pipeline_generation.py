from pathlib import Path
from uuid import uuid4
import sys

from fastapi.testclient import TestClient

# Ensure backend package is importable when running tests from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.db import init_db


def setup_module():
    init_db()


def _headers(tenant_id: str) -> dict[str, str]:
    return {
        "X-Tenant-Id": tenant_id,
        "X-User-Id": "migration-tester",
        "X-User-Role": "admin",
    }


def test_parse_creates_source_pipeline_preview_and_record():
    client = TestClient(app)
    tenant_id = f"tenant-parse-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    response = client.post(
        "/parse",
        headers=headers,
        data={"source_language": "sas"},
        files={
            "file": (
                "orders.sas",
                b"PROC SQL; SELECT customer_id, order_total FROM orders; QUIT;",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_language"] == "sas"
    assert payload["source_pipeline"]["pipeline_id"]
    assert payload["source_pipeline"]["summary"]["operation_count"] >= 1
    assert payload["source_pipeline"]["summary"]["output_count"] >= 1
    assert "orders" in [value.lower() for value in payload["source_pipeline"]["summary"]["inputs"]]

    pipeline_id = payload["source_pipeline"]["pipeline_id"]
    pipeline_response = client.get(f"/pipelines/{pipeline_id}", headers=headers)
    assert pipeline_response.status_code == 200
    pipeline_payload = pipeline_response.json()
    assert pipeline_payload["name"].endswith("Source Flow")
    assert len(pipeline_payload["dag_json"]["nodes"]) >= 3


def test_convert_returns_source_and_converted_flows_and_persists_target_pipeline():
    client = TestClient(app)
    tenant_id = f"tenant-convert-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    response = client.post(
        "/convert",
        headers=headers,
        data={"source_language": "sas", "target_language": "python"},
        files={
            "file": (
                "customer_extract.sas",
                b"PROC SQL; SELECT customer_id, customer_name FROM customers; QUIT;",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_pipeline"]["summary"]["operation_count"] >= 1
    assert payload["source_pipeline"]["pipeline_id"]
    assert payload["converted_pipeline"]["pipeline_id"]
    assert payload["converted_pipeline"]["summary"]["operation_count"] >= 1
    assert payload["converted_pipeline"]["summary"]["output_count"] >= 1
    assert payload["meta"]["migration_summary"]["target_language"] == "python"
    assert "customers" in [value.lower() for value in payload["meta"]["migration_summary"]["shared_inputs"]]
    assert payload["migration_program"]["project"]["id"]
    assert len(payload["migration_program"]["workspaces"]) >= 4
    assert len(payload["migration_program"]["catalog"]["source_datasets"]) >= 1
    assert len(payload["migration_program"]["catalog"]["target_datasets"]) >= 1
    assert len(payload["migration_program"]["catalog"]["lineage"]) >= 1
    assert payload["migration_program"]["catalog"]["quality_check"]["id"]
    assert payload["migration_program"]["notebook"]["id"]
    assert payload["migration_program"]["execution_plan"]["runtime"] == "python-batch"
    assert payload["migration_program"]["deployment_handoff"]["mode"] == "queued"
    assert payload["migration_program"]["deployment_handoff"]["deployment"]["id"]

    pipeline_id = payload["converted_pipeline"]["pipeline_id"]
    pipeline_response = client.get(f"/pipelines/{pipeline_id}", headers=headers)
    assert pipeline_response.status_code == 200
    pipeline_payload = pipeline_response.json()
    assert pipeline_payload["name"].endswith("Converted Flow")
    assert len(pipeline_payload["dag_json"]["nodes"]) >= 3
    assert pipeline_payload["dag_json"]["metadata"]["execution_plan"]["runtime"] == "python-batch"
    assert pipeline_payload["dag_json"]["metadata"]["catalog"]["lineage_ids"]

    project_id = payload["migration_program"]["project"]["id"]
    project_response = client.get(f"/projects/{project_id}", headers=headers)
    assert project_response.status_code == 200
    project_payload = project_response.json()
    assert project_payload["name"].endswith("Migration Program")

    notebook_id = payload["migration_program"]["notebook"]["id"]
    notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert notebook_response.status_code == 200
    notebook_payload = notebook_response.json()
    assert notebook_payload["metadata"]["migration_context"]["project_id"] == project_id
    assert len(notebook_payload["cells"]) >= 4

    target_dataset_id = payload["migration_program"]["catalog"]["target_datasets"][0]["id"]
    lineage_response = client.get(f"/catalog/datasets/{target_dataset_id}/lineage", headers=headers)
    assert lineage_response.status_code == 200
    assert len(lineage_response.json()["items"]) >= 1

    deployment_id = payload["migration_program"]["deployment_handoff"]["deployment"]["id"]
    deployment_response = client.get(f"/deployments/{deployment_id}", headers=headers)
    assert deployment_response.status_code == 200
    assert deployment_response.json()["status"] == "queued"


def test_convert_reuses_active_project_and_workspace_context():
    client = TestClient(app)
    tenant_id = f"tenant-convert-reuse-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    project_response = client.post(
        "/projects",
        headers=headers,
        json={
            "name": "Retail Modernization",
            "description": "Existing migration program context",
        },
    )

    assert project_response.status_code == 200
    project_payload = project_response.json()
    project_id = project_payload["id"]

    workspace_response = client.post(
        f"/projects/{project_id}/workspaces",
        headers=headers,
        json={
            "name": "Conversion Studio",
            "description": "Primary conversion workspace",
        },
    )

    assert workspace_response.status_code == 200
    workspace_payload = workspace_response.json()
    workspace_id = workspace_payload["id"]

    response = client.post(
        "/convert",
        headers=headers,
        data={
            "source_language": "sas",
            "target_language": "python",
            "project_id": project_id,
            "workspace_id": workspace_id,
        },
        files={
            "file": (
                "revenue_extract.sas",
                b"PROC SQL; SELECT store_id, revenue FROM store_revenue; QUIT;",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["migration_program"]["project"]["id"] == project_id
    assert payload["migration_program"]["project_context"]["mode"] == "reused"
    assert payload["migration_program"]["project_context"]["active_workspace_id"] == workspace_id
    assert payload["meta"]["migration_summary"]["project_id"] == project_id
    assert payload["meta"]["migration_summary"]["workspace_id"] == workspace_id

    notebook_id = payload["migration_program"]["notebook"]["id"]
    notebook_response = client.get(f"/notebooks/{notebook_id}", headers=headers)
    assert notebook_response.status_code == 200
    notebook_payload = notebook_response.json()
    assert notebook_payload["metadata"]["project_id"] == project_id
    assert notebook_payload["metadata"]["workspace_id"] == workspace_id
    assert notebook_payload["metadata"]["migration_context"]["workspace_id"] == workspace_id

    converted_pipeline_id = payload["converted_pipeline"]["pipeline_id"]
    converted_pipeline_response = client.get(f"/pipelines/{converted_pipeline_id}", headers=headers)
    assert converted_pipeline_response.status_code == 200
    converted_pipeline_payload = converted_pipeline_response.json()
    assert converted_pipeline_payload["dag_json"]["metadata"]["project_id"] == project_id
    assert converted_pipeline_payload["dag_json"]["metadata"]["workspace_id"] == workspace_id
    assert converted_pipeline_payload["dag_json"]["metadata"]["workspace"]["id"] == workspace_id