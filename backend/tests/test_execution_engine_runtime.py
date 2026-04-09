import importlib
import json
from pathlib import Path
import sys
import time
from uuid import uuid4

import requests
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(REPO_ROOT))

from app.main import app
from app.services.db import init_db
from app.services.execution_engine import (
    NodeExecutionError,
    execute_node,
    node_error_is_retryable,
    node_execution_error_details,
)
from app.services import execution_engine as execution_engine_module


def setup_module():
    init_db()


def _headers(tenant_id: str) -> dict[str, str]:
    return {
        "X-Tenant-Id": tenant_id,
        "X-User-Id": "execution-runtime-tester",
        "X-User-Role": "admin",
    }


class _FakeResponse:
    def __init__(self, status_code: int, body: object, *, content_type: str = "application/json") -> None:
        self.status_code = status_code
        self._body = body
        self.headers = {"content-type": content_type}
        self.text = json.dumps(body) if isinstance(body, (dict, list)) else str(body)

    def json(self) -> object:
        return self._body


def test_execute_node_materializes_upstream_rows_for_sql_handler():
    node = {
        "id": "normalize_orders",
        "kind": "recipe",
        "label": "Normalize Orders",
        "config": {
            "language": "sql",
            "runtime_profile": "warehouse-sql",
            "expression": "SELECT order_id, amount FROM input_dataset ORDER BY order_id",
            "output_dataset_name": "orders_curated",
        },
        "execution_binding": {
            "engine_type": "transform",
            "runtime_profile": "warehouse-sql",
            "executor": "transform.sql",
            "target_ref": "orders_curated",
        },
    }
    upstream_results = {
        "seed_orders": {
            "metadata": {"dataset_name": "orders_raw"},
            "output_artifacts": [
                {
                    "output_type": "table",
                    "title": "Orders",
                    "columns": [
                        {"name": "order_id", "type": "text"},
                        {"name": "amount", "type": "number"},
                    ],
                    "rows": [
                        {"order_id": "A1", "amount": 10},
                        {"order_id": "A2", "amount": 15},
                    ],
                }
            ],
        }
    }

    result = execute_node(node, {"upstream_results": upstream_results, "_attempt": 2, "_max_attempts": 3})

    assert result["metadata"]["executor"] == "transform.sql"
    assert result["metadata"]["runtime_profile"] == "warehouse-sql"
    assert result["metadata"]["attempt"] == 2
    assert result["metadata"]["max_attempts"] == 3
    assert result["metadata"]["row_count"] == 2
    assert result["output_artifacts"][0]["rows"][0]["order_id"] == "A1"
    assert result["output_artifacts"][0]["rows"][1]["amount"] in {"15", 15}
    assert result["log_entries"][0]["metadata"]["executor"] == "transform.sql"


def test_execute_node_marks_api_timeouts_retryable(monkeypatch):
    node = {
        "id": "notify_orders",
        "kind": "deploy",
        "label": "Notify Orders",
        "config": {
            "target_platform": "api",
            "endpoint_url": "https://example.test/hooks/orders",
            "request_method": "POST",
            "request_body": {"batch": "daily"},
            "timeout_seconds": 5,
        },
        "execution_binding": {
            "engine_type": "deployment",
            "runtime_profile": "runtime-ops",
            "executor": "deploy.api",
            "target_ref": "https://example.test/hooks/orders",
        },
    }

    def _raise_timeout(*_args, **_kwargs):
        raise requests.Timeout("timed out")

    monkeypatch.setattr(execution_engine_module.requests, "request", _raise_timeout)

    try:
        execute_node(node)
    except NodeExecutionError as exc:
        details = node_execution_error_details(exc, node=node)
        assert node_error_is_retryable(exc) is True
        assert details["error_code"] == "api_timeout"
        assert details["executor"] == "deploy.api"
    else:  # pragma: no cover - test should always raise
        raise AssertionError("Expected API timeout to raise NodeExecutionError")


def test_local_pipeline_run_executes_real_python_and_sql_nodes():
    client = TestClient(app)
    tenant_id = f"tenant-runtime-real-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    create_response = client.post(
        "/pipelines",
        json={
            "name": "real-execution-runtime",
            "dag": {
                "nodes": [
                    {
                        "id": "seed_orders",
                        "kind": "recipe",
                        "label": "Seed Orders",
                        "config": {
                            "language": "python",
                            "runtime_profile": "python-batch",
                            "expression": "[{\"order_id\": \"A1\", \"amount\": 10}, {\"order_id\": \"A2\", \"amount\": 15}]",
                            "output_dataset_name": "orders_seed",
                        },
                    },
                    {
                        "id": "normalize_orders",
                        "kind": "recipe",
                        "label": "Normalize Orders",
                        "config": {
                            "language": "sql",
                            "runtime_profile": "warehouse-sql",
                            "expression": "SELECT order_id, amount FROM input_dataset ORDER BY order_id",
                            "output_dataset_name": "orders_normalized",
                        },
                    },
                    {
                        "id": "summarize_orders",
                        "kind": "recipe",
                        "label": "Summarize Orders",
                        "config": {
                            "language": "python",
                            "runtime_profile": "python-batch",
                            "expression": "rows = upstream_results['normalize_orders']['output_artifacts'][0]['rows']\n{'row_count': len(rows), 'total_amount': sum(int(row['amount']) for row in rows)}",
                            "output_dataset_name": "orders_summary",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "seed_orders", "target": "normalize_orders"},
                    {"id": "e2", "source": "normalize_orders", "target": "summarize_orders"},
                ],
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    pipeline_id = create_response.json()["pipeline_id"]

    start_response = client.post(
        f"/pipelines/{pipeline_id}/runs",
        json={"run_config": {"initiated_from": "pytest-real-runtime"}},
        headers=headers,
    )
    assert start_response.status_code == 200
    run_id = start_response.json()["run_id"]

    run_payload = None
    for _ in range(40):
        run_response = client.get(f"/pipelines/runs/{run_id}", headers=headers)
        assert run_response.status_code == 200
        run_payload = run_response.json()
        if run_payload["status"] not in {"queued", "running", "queued_remote", "running_remote"}:
            break
        time.sleep(0.2)

    assert run_payload is not None
    assert run_payload["status"] == "success"
    assert run_payload["run_metadata"]["nodes_executed"] == 3

    node_response = client.get(f"/pipelines/runs/{run_id}/nodes", headers=headers)
    assert node_response.status_code == 200
    node_items = node_response.json()["items"]
    assert [item["status"] for item in node_items] == ["success", "success", "success"]
    assert node_items[0]["metadata"]["executor"] == "transform.python"
    assert node_items[1]["metadata"]["executor"] == "transform.sql"
    assert node_items[1]["metadata"]["row_count"] == 2
    assert node_items[2]["metadata"]["result"]["total_amount"] == 25


def test_remote_agent_execute_pipeline_retries_retryable_api_node(monkeypatch):
    worker_agent = importlib.import_module("agent.agent")
    events: list[dict[str, object]] = []
    request_calls = {"count": 0}

    def _fake_report_run_node_event(
        run_id: str,
        node_id: str,
        status: str,
        *,
        metadata: dict[str, object] | None = None,
        error_text: str | None = None,
        logs: list[dict[str, object]] | None = None,
    ) -> bool:
        events.append(
            {
                "run_id": run_id,
                "node_id": node_id,
                "status": status,
                "metadata": metadata or {},
                "error_text": error_text,
                "logs": logs or [],
            }
        )
        return True

    def _fake_request(*_args, **_kwargs):
        request_calls["count"] += 1
        if request_calls["count"] == 1:
            raise requests.Timeout("timed out")
        return _FakeResponse(200, {"accepted": True, "batch": "daily"})

    monkeypatch.setattr(worker_agent, "report_run_node_event", _fake_report_run_node_event)
    monkeypatch.setattr(worker_agent.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(execution_engine_module.requests, "request", _fake_request)

    run = {
        "run_id": f"remote-run-{uuid4().hex[:8]}",
        "tenant_id": "tenant-remote-runtime",
        "pipeline": {
            "id": f"pipeline-{uuid4().hex[:6]}",
            "dag_json": {
                "nodes": [
                    {
                        "id": "notify_orders",
                        "kind": "deploy",
                        "label": "Notify Orders",
                        "config": {
                            "target_platform": "api",
                            "endpoint_url": "https://example.test/hooks/orders",
                            "request_method": "POST",
                            "request_body": {"batch": "daily"},
                            "retry_limit": 2,
                            "retry_backoff_seconds": 0.01,
                        },
                        "execution_binding": {
                            "engine_type": "deployment",
                            "runtime_profile": "runtime-ops",
                            "executor": "deploy.api",
                            "target_ref": "https://example.test/hooks/orders",
                        },
                    }
                ]
            },
        },
        "run_metadata": {},
    }

    success, metadata = worker_agent.execute_pipeline(run)

    assert success is True
    assert metadata["nodes_executed"] == 1
    assert request_calls["count"] == 2
    assert [event["status"] for event in events] == ["running", "queued", "running", "success"]
    assert events[1]["metadata"]["retryable"] is True
    assert events[-1]["metadata"]["status_code"] == 200