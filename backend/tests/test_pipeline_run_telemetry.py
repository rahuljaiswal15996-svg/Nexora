import time
from pathlib import Path
from uuid import uuid4
import sys

from fastapi.testclient import TestClient

# Ensure backend package is importable when running tests from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.db import init_db


def setup_module():
    init_db()


def _headers(tenant_id: str) -> dict[str, str]:
    return {
        "X-Tenant-Id": tenant_id,
        "X-User-Id": "pipeline-telemetry-tester",
        "X-User-Role": "admin",
    }


def test_pipeline_run_telemetry_endpoints_expose_nodes_and_logs():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-telemetry-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    create_response = client.post(
        "/pipelines",
        json={
            "name": "telemetry-contract-smoke",
            "dag": {
                "nodes": [
                    {"id": "source", "kind": "dataset", "label": "Source", "simulate_seconds": 0.1},
                    {"id": "transform", "kind": "recipe", "label": "Transform", "simulate_seconds": 0.1},
                    {"id": "validate", "kind": "validation", "label": "Validate", "simulate_seconds": 0.1},
                ],
                "edges": [
                    {"id": "e1", "source": "source", "target": "transform"},
                    {"id": "e2", "source": "transform", "target": "validate"},
                ],
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    pipeline_id = create_response.json()["pipeline_id"]

    start_response = client.post(
        f"/pipelines/{pipeline_id}/runs",
        json={"run_config": {"initiated_from": "pytest", "force_failure_node_id": "validate"}},
        headers=headers,
    )
    assert start_response.status_code == 200
    start_payload = start_response.json()
    run_id = start_payload["run_id"]
    assert sorted(start_payload["telemetry"].keys()) == ["logs", "nodes", "run"]

    run_payload = None
    for _ in range(40):
        response = client.get(f"/pipelines/runs/{run_id}", headers=headers)
        assert response.status_code == 200
        run_payload = response.json()
        if run_payload["status"] not in {"queued", "running", "queued_remote", "running_remote"}:
            break
        time.sleep(0.2)

    assert run_payload is not None
    assert run_payload["status"] == "failed"
    assert run_payload["run_metadata"]["failed_node_id"] == "validate"
    assert run_payload["node_summary"]["failed"] == 1

    node_response = client.get(f"/pipelines/runs/{run_id}/nodes", headers=headers)
    assert node_response.status_code == 200
    node_payload = node_response.json()
    assert [item["status"] for item in node_payload["items"]] == ["success", "success", "failed"]
    assert node_payload["items"][2]["node_id"] == "validate"
    assert node_payload["items"][2]["error_text"]

    log_response = client.get(
        f"/pipelines/runs/{run_id}/logs",
        params={"node_id": "validate"},
        headers=headers,
    )
    assert log_response.status_code == 200
    log_payload = log_response.json()
    assert len(log_payload["items"]) >= 2
    assert log_payload["cursor"] >= log_payload["items"][-1]["id"]
    assert {item["level"] for item in log_payload["items"]} >= {"info", "error"}