import json
from pathlib import Path
from uuid import uuid4
import sys

# Ensure backend package is importable when running tests from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app
from app.services.broker_observability import (
    BROKER_DLQ_TOTAL,
    BROKER_RECOVERY_FAILED_TOTAL,
    BROKER_RECOVERY_TOTAL,
    BROKER_REQUEUE_LOOP_DETECTED_TOTAL,
    BROKER_RETRY_TOTAL,
)
from app.services.db import get_connection, init_db
from app.services.pipeline_runner import requeue_remote_runs
from app.services.platform_jobs import requeue_remote_jobs
from app.services.work_broker import (
    PIPELINE_RUN_QUEUE,
    PLATFORM_JOB_QUEUE,
    consume_work_message,
    publish_pipeline_run_message,
    reset_work_broker,
)


def setup_module():
    init_db()


def setup_function(_function):
    reset_work_broker()


def _headers(tenant_id: str) -> dict[str, str]:
    return {
        "X-Tenant-Id": tenant_id,
        "X-User-Id": "platform-tester",
        "X-User-Role": "admin",
    }


def _expire_platform_job(job_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE platform_jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ?",
            ("2000-01-01T00:00:00+00:00", "2000-01-01T00:00:00+00:00", job_id),
        )
        conn.commit()


def _expire_pipeline_run(run_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE pipeline_runs SET lease_expires_at = ?, updated_at = ? WHERE id = ?",
            ("2000-01-01T00:00:00+00:00", "2000-01-01T00:00:00+00:00", run_id),
        )
        conn.commit()


def _backdate_platform_job_broker_metadata(job_id: str, created_at: str, *, last_enqueued_at: str | None = None) -> None:
    with get_connection() as conn:
        row = conn.execute("SELECT result_json FROM platform_jobs WHERE id = ?", (job_id,)).fetchone()
        assert row is not None
        result_payload = json.loads(row[0] or "{}")
        result_payload["broker_created_at"] = created_at
        result_payload["broker_last_enqueued_at"] = last_enqueued_at or created_at
        conn.execute(
            "UPDATE platform_jobs SET result_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(result_payload), created_at, job_id),
        )
        conn.commit()


def test_agent_poll_returns_idle_when_broker_queue_is_empty():
    reset_work_broker()
    client = TestClient(app)
    tenant_id = f"tenant-broker-only-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    pipeline_resp = client.post(
        "/pipelines",
        json={
            "name": "broker-only-cutover-smoke",
            "dag": {"nodes": [{"id": "extract", "type": "task", "simulate_seconds": 0.1}]},
        },
        headers=headers,
    )
    assert pipeline_resp.status_code == 200
    pipeline_id = pipeline_resp.json()["pipeline_id"]

    run_resp = client.post(
        f"/pipelines/{pipeline_id}/runs?run_mode=remote",
        json={"run_config": {"wave": "broker-only"}},
        headers=headers,
    )
    assert run_resp.status_code == 200
    run_id = run_resp.json()["run_id"]

    drained = consume_work_message([PIPELINE_RUN_QUEUE], timeout_seconds=1)
    assert drained is not None
    assert drained["run_id"] == run_id
    assert drained["retry_count"] == 0
    assert drained["max_retries"] >= 0
    assert drained["created_at"]
    assert drained["ttl_seconds"] > 0

    poll_resp = client.get(
        "/agent/poll",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-broker-only"},
    )
    assert poll_resp.status_code == 200
    assert poll_resp.json()["status"] == "idle"

    reset_work_broker()


def test_status_exposes_broker_snapshot_for_remote_queue_depth():
    reset_work_broker()
    client = TestClient(app)
    tenant_id = f"tenant-broker-status-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    pipeline_resp = client.post(
        "/pipelines",
        json={
            "name": "broker-observability-status",
            "dag": {"nodes": [{"id": "extract", "type": "task", "simulate_seconds": 0.1}]},
        },
        headers=headers,
    )
    assert pipeline_resp.status_code == 200

    run_resp = client.post(
        f"/pipelines/{pipeline_resp.json()['pipeline_id']}/runs?run_mode=remote",
        json={"run_config": {"wave": "observability"}},
        headers=headers,
    )
    assert run_resp.status_code == 200

    status_resp = client.get("/status")
    assert status_resp.status_code == 200
    broker = status_resp.json()["broker"]
    assert broker["backend"] in {"memory", "redis"}
    assert broker["queue_depths"][PIPELINE_RUN_QUEUE] >= 1
    assert broker["stale_work"]["pipeline_run"]["expired_lease"] >= 0
    assert broker["stale_work"]["platform_job"]["visibility_refresh_due"] >= 0
    assert broker["failed_work"]["pipeline_run"] >= 0

    reset_work_broker()


def test_metrics_endpoint_exposes_broker_metric_families():
    client = TestClient(app)

    metrics_resp = client.get("/metrics")
    assert metrics_resp.status_code == 200
    metrics_payload = metrics_resp.text

    assert "nexora_broker_queue_depth" in metrics_payload
    assert "nexora_broker_publish_total" in metrics_payload
    assert "nexora_broker_claim_total" in metrics_payload
    assert "nexora_broker_processed_total" in metrics_payload
    assert "nexora_broker_requeue_total" in metrics_payload
    assert "nexora_broker_retry_total" in metrics_payload
    assert "nexora_broker_dlq_total" in metrics_payload
    assert "nexora_broker_requeue_loop_detected_total" in metrics_payload
    assert "nexora_broker_recovery_total" in metrics_payload
    assert "nexora_broker_recovery_failed_total" in metrics_payload
    assert "nexora_broker_stale_work_total" in metrics_payload
    assert "nexora_broker_failed_work_total" in metrics_payload


def test_remote_pipeline_run_moves_to_dlq_after_retry_limit(monkeypatch):
    reset_work_broker()
    monkeypatch.setenv("NEXORA_BROKER_MESSAGE_MAX_RETRIES", "1")
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-dlq-{uuid4().hex[:8]}"
    wrong_tenant_id = f"tenant-pipeline-dlq-wrong-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    before_retry = BROKER_RETRY_TOTAL.labels(
        queue_kind=PIPELINE_RUN_QUEUE,
        reason="tenant_mismatch",
        source="agent_poll",
    )._value.get()
    before_dlq = BROKER_DLQ_TOTAL.labels(
        queue_kind=PIPELINE_RUN_QUEUE,
        reason="retry_limit_exceeded",
        source="agent_poll",
    )._value.get()

    pipeline_resp = client.post(
        "/pipelines",
        json={
            "name": "pipeline-dlq-guardrail",
            "dag": {"nodes": [{"id": "extract", "type": "task", "simulate_seconds": 0.1}]},
        },
        headers=headers,
    )
    assert pipeline_resp.status_code == 200
    pipeline_id = pipeline_resp.json()["pipeline_id"]

    run_resp = client.post(
        f"/pipelines/{pipeline_id}/runs?run_mode=remote",
        json={"run_config": {"wave": "dlq"}},
        headers=headers,
    )
    assert run_resp.status_code == 200
    run_id = run_resp.json()["run_id"]

    poll_resp = client.get(
        "/agent/poll",
        headers={"x-tenant-id": wrong_tenant_id, "x-agent-id": "agent-dlq"},
    )
    assert poll_resp.status_code == 200
    assert poll_resp.json()["status"] == "idle"

    run_status = client.get(f"/pipelines/runs/{run_id}", headers=headers)
    assert run_status.status_code == 200
    run = run_status.json()
    assert run["status"] == "failed"
    assert run["run_metadata"]["broker_dead_letter_reason"] == "retry_limit_exceeded"
    assert run["run_metadata"]["broker_dead_letter_source"] == "agent_poll"
    assert run["run_metadata"]["broker_retry_count"] == 2

    dlq_resp = client.get(f"/status/broker/dlq?queue_kind={PIPELINE_RUN_QUEUE}")
    assert dlq_resp.status_code == 200
    dlq_payload = dlq_resp.json()
    assert dlq_payload["queue_depths"][PIPELINE_RUN_QUEUE] >= 1
    item = next(entry for entry in dlq_payload["items"] if entry["run_id"] == run_id)
    assert item["dead_letter_reason"] == "retry_limit_exceeded"

    after_retry = BROKER_RETRY_TOTAL.labels(
        queue_kind=PIPELINE_RUN_QUEUE,
        reason="tenant_mismatch",
        source="agent_poll",
    )._value.get()
    after_dlq = BROKER_DLQ_TOTAL.labels(
        queue_kind=PIPELINE_RUN_QUEUE,
        reason="retry_limit_exceeded",
        source="agent_poll",
    )._value.get()
    assert after_retry == before_retry + 1
    assert after_dlq == before_dlq + 1

    reset_work_broker()


def test_remote_platform_job_detects_requeue_loop_before_dlq(monkeypatch):
    reset_work_broker()
    monkeypatch.setenv("NEXORA_BROKER_MESSAGE_MAX_RETRIES", "3")
    monkeypatch.setenv("NEXORA_BROKER_REQUEUE_LOOP_THRESHOLD", "2")
    client = TestClient(app)
    tenant_id = f"tenant-job-loop-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    before_loop = BROKER_REQUEUE_LOOP_DETECTED_TOTAL.labels(
        queue_kind=PLATFORM_JOB_QUEUE,
        reason="job_type_mismatch",
        source="agent_poll",
    )._value.get()
    before_dlq = BROKER_DLQ_TOTAL.labels(
        queue_kind=PLATFORM_JOB_QUEUE,
        reason="retry_limit_exceeded",
        source="agent_poll",
    )._value.get()

    deploy_resp = client.post(
        "/deploy?run_mode=remote",
        json={
            "pipeline_id": f"pipeline-{uuid4().hex[:6]}",
            "target_platform": "spark",
            "notes": "loop detection smoke",
        },
        headers=headers,
    )
    assert deploy_resp.status_code == 200
    job_id = deploy_resp.json()["job"]["id"]

    poll_resp = client.get(
        "/agent/platform-jobs/poll?job_type=quality_check",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-loop"},
    )
    assert poll_resp.status_code == 200
    assert poll_resp.json()["status"] == "idle"

    job_status = client.get(f"/jobs/{job_id}", headers=headers)
    assert job_status.status_code == 200
    job = job_status.json()
    assert job["status"] == "failed"
    assert job["result"]["broker_dead_letter_reason"] == "retry_limit_exceeded"
    assert job["result"]["broker_dead_letter_source"] == "agent_poll"

    dlq_resp = client.get(f"/status/broker/dlq?queue_kind={PLATFORM_JOB_QUEUE}")
    assert dlq_resp.status_code == 200
    dlq_payload = dlq_resp.json()
    assert dlq_payload["queue_depths"][PLATFORM_JOB_QUEUE] >= 1
    item = next(entry for entry in dlq_payload["items"] if entry["job_id"] == job_id)
    assert item["dead_letter_reason"] == "retry_limit_exceeded"

    after_loop = BROKER_REQUEUE_LOOP_DETECTED_TOTAL.labels(
        queue_kind=PLATFORM_JOB_QUEUE,
        reason="job_type_mismatch",
        source="agent_poll",
    )._value.get()
    after_dlq = BROKER_DLQ_TOTAL.labels(
        queue_kind=PLATFORM_JOB_QUEUE,
        reason="retry_limit_exceeded",
        source="agent_poll",
    )._value.get()
    assert after_loop == before_loop + 1
    assert after_dlq == before_dlq + 1

    reset_work_broker()


def test_agent_poll_dead_letters_ttl_expired_pipeline_message_without_claiming():
    reset_work_broker()
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-ttl-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    pipeline_resp = client.post(
        "/pipelines",
        json={
            "name": "pipeline-ttl-expiry-poll",
            "dag": {"nodes": [{"id": "extract", "type": "task", "simulate_seconds": 0.1}]},
        },
        headers=headers,
    )
    assert pipeline_resp.status_code == 200
    pipeline_id = pipeline_resp.json()["pipeline_id"]

    run_resp = client.post(
        f"/pipelines/{pipeline_id}/runs?run_mode=remote",
        json={"run_config": {"wave": "ttl-expired"}},
        headers=headers,
    )
    assert run_resp.status_code == 200
    run_id = run_resp.json()["run_id"]

    drained = consume_work_message([PIPELINE_RUN_QUEUE], timeout_seconds=1)
    assert drained is not None
    assert drained["run_id"] == run_id

    publish_pipeline_run_message(
        run_id,
        tenant_id,
        pipeline_id,
        broker_message={**drained, "created_at": "2000-01-01T00:00:00+00:00"},
    )

    poll_resp = client.get(
        "/agent/poll",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-ttl-expiry"},
    )
    assert poll_resp.status_code == 200
    assert poll_resp.json()["status"] == "idle"

    run_status = client.get(f"/pipelines/runs/{run_id}", headers=headers)
    assert run_status.status_code == 200
    run = run_status.json()
    assert run["status"] == "failed"
    assert run["attempt_count"] == 0
    assert run["claimed_by"] is None
    assert run["run_metadata"]["broker_dead_letter_reason"] == "ttl_expired"
    assert run["run_metadata"]["broker_dead_letter_source"] == "agent_poll"

    dlq_resp = client.get(f"/status/broker/dlq?queue_kind={PIPELINE_RUN_QUEUE}")
    assert dlq_resp.status_code == 200
    dlq_payload = dlq_resp.json()
    item = next(entry for entry in dlq_payload["items"] if entry["run_id"] == run_id)
    assert item["dead_letter_reason"] == "ttl_expired"

    reset_work_broker()


def test_maintenance_dead_letters_ttl_expired_platform_job_without_requeue():
    reset_work_broker()
    client = TestClient(app)
    tenant_id = f"tenant-job-ttl-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)
    expired_at = "2000-01-01T00:00:00+00:00"

    before_recovery = BROKER_RECOVERY_TOTAL.labels(
        workload_kind="platform_job",
        reason="queued_visibility_refresh",
        outcome="dead_lettered",
        source="maintenance",
    )._value.get()
    before_failed = BROKER_RECOVERY_FAILED_TOTAL.labels(
        workload_kind="platform_job",
        reason="queued_visibility_refresh",
        source="maintenance",
    )._value.get()

    deploy_resp = client.post(
        "/deploy?run_mode=remote",
        json={
            "pipeline_id": f"pipeline-{uuid4().hex[:6]}",
            "target_platform": "spark",
            "notes": "maintenance ttl expiry",
        },
        headers=headers,
    )
    assert deploy_resp.status_code == 200
    job_id = deploy_resp.json()["job"]["id"]

    drained = consume_work_message([PLATFORM_JOB_QUEUE], timeout_seconds=1)
    assert drained is not None
    assert drained["job_id"] == job_id
    _backdate_platform_job_broker_metadata(job_id, expired_at)

    recovered = requeue_remote_jobs(tenant_id=tenant_id, job_id=job_id)
    assert recovered == 0
    assert consume_work_message([PLATFORM_JOB_QUEUE], timeout_seconds=1) is None

    job_status = client.get(f"/jobs/{job_id}", headers=headers)
    assert job_status.status_code == 200
    job = job_status.json()
    assert job["status"] == "failed"
    assert job["result"]["broker_dead_letter_reason"] == "ttl_expired"
    assert job["result"]["broker_dead_letter_source"] == "maintenance"

    dlq_resp = client.get(f"/status/broker/dlq?queue_kind={PLATFORM_JOB_QUEUE}")
    assert dlq_resp.status_code == 200
    dlq_payload = dlq_resp.json()
    item = next(entry for entry in dlq_payload["items"] if entry["job_id"] == job_id)
    assert item["dead_letter_reason"] == "ttl_expired"

    assert requeue_remote_jobs(tenant_id=tenant_id, job_id=job_id) == 0

    after_recovery = BROKER_RECOVERY_TOTAL.labels(
        workload_kind="platform_job",
        reason="queued_visibility_refresh",
        outcome="dead_lettered",
        source="maintenance",
    )._value.get()
    after_failed = BROKER_RECOVERY_FAILED_TOTAL.labels(
        workload_kind="platform_job",
        reason="queued_visibility_refresh",
        source="maintenance",
    )._value.get()
    assert after_recovery == before_recovery + 1
    assert after_failed == before_failed

    reset_work_broker()


def test_remote_quality_check_job_can_be_claimed_and_reported():
    client = TestClient(app)
    tenant_id = f"tenant-quality-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    dataset_resp = client.post(
        "/catalog/datasets",
        json={
            "name": "orders_daily",
            "source_path": "s3://demo/orders_daily",
            "metadata": {"domain": "sales"},
        },
        headers=headers,
    )
    assert dataset_resp.status_code == 200
    dataset_id = dataset_resp.json()["id"]

    queue_resp = client.post(
        f"/catalog/datasets/{dataset_id}/quality-checks?run_mode=remote",
        json={
            "check_name": "freshness",
            "metrics": {"row_count": 250},
            "status": "passed",
        },
        headers=headers,
    )
    assert queue_resp.status_code == 200
    queued = queue_resp.json()
    assert queued["status"] == "queued_remote"
    assert queued["job"]["execution_mode"] == "remote"

    poll_resp = client.get(
        "/agent/platform-jobs/poll?job_type=quality_check",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-a"},
    )
    assert poll_resp.status_code == 200
    claimed = poll_resp.json()
    assert claimed["status"] == "claimed"
    job = claimed["job"]
    assert job["id"] == queued["job"]["id"]
    assert job["status"] == "running"
    assert job["claimed_by"] == "agent-a"
    assert job["attempt_count"] == 1

    heartbeat_resp = client.post(
        "/agent/platform-jobs/heartbeat",
        json={"job_id": job["id"], "tenant_id": tenant_id},
        headers={"x-agent-id": "agent-a"},
    )
    assert heartbeat_resp.status_code == 200

    _expire_platform_job(job["id"])
    requeue_remote_jobs(tenant_id=tenant_id, job_id=job["id"])

    reclaim_resp = client.get(
        "/agent/platform-jobs/poll?job_type=quality_check",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-b"},
    )
    assert reclaim_resp.status_code == 200
    reclaimed = reclaim_resp.json()
    assert reclaimed["status"] == "claimed"
    job = reclaimed["job"]
    assert job["claimed_by"] == "agent-b"
    assert job["attempt_count"] == 2

    report_resp = client.post(
        "/agent/platform-jobs/report",
        json={
            "job_id": job["id"],
            "tenant_id": tenant_id,
            "status": "success",
            "result": {
                "metrics": {"row_count": 250, "freshness_minutes": 3},
                "final_status": "passed",
            },
        },
        headers={"x-agent-id": "agent-b"},
    )
    assert report_resp.status_code == 200

    job_status = client.get(f"/jobs/{job['id']}", headers=headers)
    assert job_status.status_code == 200
    completed = job_status.json()
    assert completed["status"] == "success"
    assert completed["result"]["quality_check"]["status"] == "passed"

    quality_resp = client.get(f"/catalog/datasets/{dataset_id}/quality", headers=headers)
    assert quality_resp.status_code == 200
    quality_items = quality_resp.json()["items"]
    record = next(item for item in quality_items if item["id"] == queued["quality_check"]["id"])
    assert record["status"] == "passed"
    assert record["metrics"]["freshness_minutes"] == 3


def test_remote_deployment_job_can_be_claimed_and_reported():
    client = TestClient(app)
    tenant_id = f"tenant-deploy-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    deploy_resp = client.post(
        "/deploy?run_mode=remote",
        json={
            "pipeline_id": f"pipeline-{uuid4().hex[:6]}",
            "target_platform": "databricks",
            "notes": "remote rollout",
        },
        headers=headers,
    )
    assert deploy_resp.status_code == 200
    queued = deploy_resp.json()
    assert queued["status"] == "queued_remote"
    deployment_id = queued["deployment"]["id"]

    poll_resp = client.get(
        "/agent/platform-jobs/poll?job_type=deployment",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-deploy"},
    )
    assert poll_resp.status_code == 200
    job = poll_resp.json()["job"]
    assert job["resource_id"] == deployment_id

    report_resp = client.post(
        "/agent/platform-jobs/report",
        json={
            "job_id": job["id"],
            "tenant_id": tenant_id,
            "status": "success",
            "result": {
                "deployment_status": "deployed",
                "status_details": {
                    "stage": "completed",
                    "runtime": "databricks-jobs",
                },
            },
        },
        headers={"x-agent-id": "agent-deploy"},
    )
    assert report_resp.status_code == 200

    deployment_status = client.get(f"/deployments/{deployment_id}", headers=headers)
    assert deployment_status.status_code == 200
    deployment = deployment_status.json()
    assert deployment["status"] == "deployed"
    assert deployment["runs"][0]["status"] == "success"
    assert deployment["runs"][0]["status_details"]["runtime"] == "databricks-jobs"


def test_operator_actions_can_cancel_retry_and_rollback_deployments():
    client = TestClient(app)
    tenant_id = f"tenant-runtime-actions-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    deploy_resp = client.post(
        "/deploy?run_mode=remote",
        json={
            "pipeline_id": f"pipeline-{uuid4().hex[:6]}",
            "target_platform": "container",
            "notes": "runtime operator action smoke",
        },
        headers=headers,
    )
    assert deploy_resp.status_code == 200
    queued = deploy_resp.json()
    original_job_id = queued["job"]["id"]
    original_deployment_id = queued["deployment"]["id"]

    claim_resp = client.get(
        "/agent/platform-jobs/poll?job_type=deployment",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "agent-runtime-ops"},
    )
    assert claim_resp.status_code == 200
    claimed = claim_resp.json()
    assert claimed["status"] == "claimed"
    assert claimed["job"]["id"] == original_job_id
    assert claimed["job"]["status"] == "running"

    cancel_resp = client.post(f"/jobs/{original_job_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    cancelled_job = cancel_resp.json()["job"]
    assert cancelled_job["status"] == "cancelled"
    assert cancelled_job["claimed_by"] is None
    assert cancelled_job["result"]["deployment_id"] == original_deployment_id

    cancelled_deployment_resp = client.get(f"/deployments/{original_deployment_id}", headers=headers)
    assert cancelled_deployment_resp.status_code == 200
    cancelled_deployment = cancelled_deployment_resp.json()
    assert cancelled_deployment["status"] == "cancelled"
    assert cancelled_deployment["runs"][0]["status"] == "cancelled"

    retry_resp = client.post(f"/jobs/{original_job_id}/retry", headers=headers)
    assert retry_resp.status_code == 200
    retried = retry_resp.json()
    assert retried["status"] == "ok"
    assert retried["job"]["id"] != original_job_id
    assert retried["job"]["status"] == "queued"
    retried_deployment_id = retried["deployment"]["id"]
    assert retried_deployment_id != original_deployment_id
    assert retried["deployment"]["status"] == "queued"

    rollback_resp = client.post(
        f"/deployments/{retried_deployment_id}/rollback",
        json={"run_mode": "remote"},
        headers=headers,
    )
    assert rollback_resp.status_code == 200
    rollback = rollback_resp.json()
    assert rollback["status"] == "queued_remote"
    assert rollback["job"]["job_type"] == "deployment_rollback"
    assert rollback["job"]["resource_id"] == retried_deployment_id
    assert rollback["deployment"]["status"] == "rollback_queued"

    rolled_back_deployment_resp = client.get(f"/deployments/{retried_deployment_id}", headers=headers)
    assert rolled_back_deployment_resp.status_code == 200
    rollback_deployment = rolled_back_deployment_resp.json()
    assert rollback_deployment["status"] == "rollback_queued"
    assert rollback_deployment["runs"][0]["status"] == "queued"
    assert rollback_deployment["runs"][0]["status_details"]["stage"] == "rollback_queued"


def test_remote_pipeline_run_supports_heartbeat_and_reclaim():
    client = TestClient(app)
    tenant_id = f"tenant-pipeline-{uuid4().hex[:8]}"
    headers = _headers(tenant_id)

    pipeline_resp = client.post(
        "/pipelines",
        json={
            "name": "customer-migration",
            "dag": {"nodes": [{"id": "extract", "type": "task", "simulate_seconds": 0.1}]},
        },
        headers=headers,
    )
    assert pipeline_resp.status_code == 200
    pipeline_id = pipeline_resp.json()["pipeline_id"]

    run_resp = client.post(
        f"/pipelines/{pipeline_id}/runs?run_mode=remote",
        json={"run_config": {"wave": "w1"}},
        headers=headers,
    )
    assert run_resp.status_code == 200
    run_id = run_resp.json()["run_id"]

    poll_resp = client.get(
        "/agent/poll",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "pipeline-a"},
    )
    assert poll_resp.status_code == 200
    claimed = poll_resp.json()
    assert claimed["status"] == "claimed"
    assert claimed["run_id"] == run_id
    assert claimed["claimed_by"] == "pipeline-a"
    assert claimed["attempt_count"] == 1

    heartbeat_resp = client.post(
        "/agent/heartbeat",
        json={"run_id": run_id},
        headers={"x-agent-id": "pipeline-a"},
    )
    assert heartbeat_resp.status_code == 200

    _expire_pipeline_run(run_id)
    requeue_remote_runs(tenant_id=tenant_id, run_id=run_id)

    reclaim_resp = client.get(
        "/agent/poll",
        headers={"x-tenant-id": tenant_id, "x-agent-id": "pipeline-b"},
    )
    assert reclaim_resp.status_code == 200
    reclaimed = reclaim_resp.json()
    assert reclaimed["status"] == "claimed"
    assert reclaimed["run_id"] == run_id
    assert reclaimed["claimed_by"] == "pipeline-b"
    assert reclaimed["attempt_count"] == 2

    report_resp = client.post(
        "/agent/report",
        json={
            "run_id": run_id,
            "status": "success",
            "run_metadata": {"nodes_executed": 1, "agent_id": "pipeline-b"},
        },
        headers={"x-agent-id": "pipeline-b"},
    )
    assert report_resp.status_code == 200

    status_resp = client.get(f"/pipelines/runs/{run_id}", headers=headers)
    assert status_resp.status_code == 200
    run = status_resp.json()
    assert run["status"] == "success"
    assert run["claimed_by"] is None
    assert run["attempt_count"] == 2
    assert run["run_metadata"]["nodes_executed"] == 1