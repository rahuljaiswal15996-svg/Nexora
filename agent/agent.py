#!/usr/bin/env python3
"""Broker-backed data-plane agent for Nexora.

This agent consumes remote work from the configured broker, claims the work in the
control plane to preserve lease semantics, executes pipeline nodes with the shared
execution engine, and streams node telemetry back to the backend.
"""
from collections.abc import Callable
from datetime import datetime, timezone
from importlib import import_module
import os
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, cast

import requests

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

ExecutionNodeCallable = Callable[..., dict[str, Any]]
ConsumeWorkMessageCallable = Callable[[list[str], int], dict[str, Any] | None]
NodeErrorRetryableCallable = Callable[[Exception], bool]
NodeErrorDetailsCallable = Callable[..., dict[str, Any]]
ResolveExecutorCallable = Callable[[dict[str, Any]], str]

_execution_engine_module = import_module("app.services.execution_engine")
_work_broker_module = import_module("app.services.work_broker")

execute_node = cast(ExecutionNodeCallable, getattr(_execution_engine_module, "execute_node"))
node_error_is_retryable = cast(NodeErrorRetryableCallable, getattr(_execution_engine_module, "node_error_is_retryable"))
node_execution_error_details = cast(NodeErrorDetailsCallable, getattr(_execution_engine_module, "node_execution_error_details"))
resolve_executor = cast(ResolveExecutorCallable, getattr(_execution_engine_module, "resolve_executor"))
PIPELINE_RUN_QUEUE = cast(str, getattr(_work_broker_module, "PIPELINE_RUN_QUEUE"))
PLATFORM_JOB_QUEUE = cast(str, getattr(_work_broker_module, "PLATFORM_JOB_QUEUE"))
consume_work_message = cast(ConsumeWorkMessageCallable, getattr(_work_broker_module, "consume_work_message"))

AGENT_ID = os.getenv("NEXORA_AGENT_ID", f"agent-{uuid.uuid4().hex[:6]}")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2"))
HEARTBEAT_INTERVAL = float(os.getenv("NEXORA_AGENT_HEARTBEAT_INTERVAL", "20"))
BROKER_URL = os.getenv("NEXORA_BROKER_URL", "").strip()
AGENT_MODE = (os.getenv("NEXORA_AGENT_CONSUMER_MODE") or ("broker" if BROKER_URL else "legacy")).strip().lower()


def _get_optional_url(name: str) -> str | None:
    configured = os.getenv(name, "").strip()
    if not configured:
        return None
    return configured.rstrip("/")


def _control_base_url() -> str:
    configured = _get_optional_url("NEXORA_CONTROL_URL")
    if configured:
        return configured
    raise RuntimeError(
        "NEXORA_CONTROL_URL must be set for the Nexora agent so worker traffic can reach the backend control plane."
    )


def _control_endpoint(path: str) -> str:
    return f"{_control_base_url()}{path}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    typed_value = cast(dict[str, Any], value)
    return dict(typed_value)


def _as_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, Any]] = []
    for item in cast(list[Any], value):
        if isinstance(item, dict):
            items.append(dict(cast(dict[str, Any], item)))
    return items


def _agent_headers() -> dict[str, str]:
    return {"X-Agent-Id": AGENT_ID}


def _node_max_attempts(node: dict[str, Any], default: int = 3) -> int:
    config = _as_dict(node.get("config"))
    candidates: list[Any] = [config.get("retry_limit"), os.getenv("NEXORA_REMOTE_RUN_MAX_ATTEMPTS"), default]
    for value in candidates:
        if value is None:
            continue
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            continue
    return max(1, default)


def _retry_backoff_seconds(node: dict[str, Any], attempt: int) -> float:
    config = _as_dict(node.get("config"))
    configured = config.get("retry_backoff_seconds")
    if configured is not None:
        try:
            return max(0.1, min(5.0, float(configured)))
        except (TypeError, ValueError):
            pass
    return min(5.0, max(0.1, 0.25 * attempt))


def _start_heartbeat_loop(
    callback: Callable[[], Any],
    interval_seconds: float = HEARTBEAT_INTERVAL,
) -> tuple[threading.Event, threading.Thread]:
    stop_event = threading.Event()

    def _loop() -> None:
        while not stop_event.wait(interval_seconds):
            callback()

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
    return stop_event, thread


def _stop_heartbeat_loop(stop_event: threading.Event, thread: threading.Thread) -> None:
    stop_event.set()
    thread.join(timeout=1.0)


def poll_for_job() -> dict[str, Any] | None:
    try:
        resp = requests.get(_control_endpoint("/agent/poll"), headers=_agent_headers(), timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("status") != "claimed":
            return None
        return data
    except Exception as e:
        print("poll error:", e)
        return None


def report_result(run_id: str, status: str, metadata: dict[str, Any] | None = None) -> bool:
    try:
        payload: dict[str, Any] = {"run_id": run_id, "status": status, "run_metadata": metadata or {}}
        resp = requests.post(_control_endpoint("/agent/report"), json=payload, headers=_agent_headers(), timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print("report error:", e)
        return False


def heartbeat_run(run_id: str) -> bool:
    try:
        payload: dict[str, Any] = {"run_id": run_id}
        resp = requests.post(_control_endpoint("/agent/heartbeat"), json=payload, headers=_agent_headers(), timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print("heartbeat error:", e)
        return False


def poll_for_platform_job() -> dict[str, Any] | None:
    try:
        resp = requests.get(_control_endpoint("/agent/platform-jobs/poll"), headers=_agent_headers(), timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("status") != "claimed":
            return None
        return data.get("job")
    except Exception as e:
        print("platform poll error:", e)
        return None


def claim_run(run_id: str) -> dict[str, Any] | None:
    try:
        resp = requests.post(_control_endpoint("/agent/runs/claim"), json={"run_id": run_id}, headers=_agent_headers(), timeout=10)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception as e:
        print("run claim error:", e)
        return None


def claim_platform_job(job_id: str, tenant_id: str) -> dict[str, Any] | None:
    try:
        resp = requests.post(
            _control_endpoint("/agent/platform-jobs/claim"),
            json={"job_id": job_id, "tenant_id": tenant_id},
            headers=_agent_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception as e:
        print("platform claim error:", e)
        return None


def report_platform_job(
    job: dict[str, Any],
    status: str,
    result: dict[str, Any] | None = None,
    error_text: str | None = None,
) -> bool:
    try:
        payload: dict[str, Any] = {
            "job_id": job.get("id"),
            "tenant_id": job.get("tenant_id"),
            "status": status,
            "result": result or {},
            "error_text": error_text,
        }
        resp = requests.post(_control_endpoint("/agent/platform-jobs/report"), json=payload, headers=_agent_headers(), timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print("platform report error:", e)
        return False


def heartbeat_platform_job(job: dict[str, Any]) -> bool:
    try:
        payload: dict[str, Any] = {
            "job_id": job.get("id"),
            "tenant_id": job.get("tenant_id"),
        }
        resp = requests.post(_control_endpoint("/agent/platform-jobs/heartbeat"), json=payload, headers=_agent_headers(), timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print("platform heartbeat error:", e)
        return False


def report_run_node_event(
    run_id: str,
    node_id: str,
    status: str,
    *,
    metadata: dict[str, Any] | None = None,
    error_text: str | None = None,
    logs: list[dict[str, Any]] | None = None,
) -> bool:
    try:
        payload: dict[str, Any] = {
            "run_id": run_id,
            "node_id": node_id,
            "status": status,
            "metadata": metadata or {},
            "error_text": error_text,
            "logs": logs or [],
        }
        resp = requests.post(_control_endpoint("/agent/runs/node-update"), json=payload, headers=_agent_headers(), timeout=15)
        return resp.status_code == 200
    except Exception as e:
        print("run node update error:", e)
        return False


def execute_pipeline(run: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    pipeline = _as_dict(run.get("pipeline"))
    dag_json = _as_dict(pipeline.get("dag_json"))
    nodes = _as_dict_list(dag_json.get("nodes"))
    run_metadata = _as_dict(run.get("run_metadata"))
    retry_from_node = str(run_metadata.get("retry_from_node") or "").strip()
    force_failure_node_id = str(run_metadata.get("force_failure_node_id") or run_metadata.get("fail_node_id") or "").strip()
    retry_start_index = 0
    if retry_from_node:
        for index, node in enumerate(nodes):
            if str(node.get("id") or "") == retry_from_node:
                retry_start_index = index
                break

    print(f"Agent {AGENT_ID} executing run {run.get('run_id')} nodes={len(nodes)} mode={AGENT_MODE}")
    started = _utc_now_iso()
    upstream_results: dict[str, Any] = {}
    nodes_executed = 0
    try:
        for index, node in enumerate(nodes):
            node_id = str(node.get("id") or uuid.uuid4().hex)
            node_label = str(node.get("label") or node_id)
            if retry_from_node and index < retry_start_index:
                continue

            max_attempts = _node_max_attempts(node)
            execution_binding = _as_dict(node.get("execution_binding") or _as_dict(node.get("data")).get("execution_binding"))
            executor_name = resolve_executor(node)
            for attempt in range(1, max_attempts + 1):
                report_run_node_event(
                    str(run.get("run_id") or ""),
                    node_id,
                    "running",
                    metadata={
                        "active": True,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                    },
                    logs=[
                        {
                            "level": "info",
                            "message": f"Remote execution attempt {attempt} started for {node_label}.",
                            "metadata": {
                                "agent_id": AGENT_ID,
                                "stage_index": index,
                                "executor": executor_name,
                                "runtime_profile": execution_binding.get("runtime_profile"),
                                "engine_type": execution_binding.get("engine_type"),
                            },
                        }
                    ],
                )
                if force_failure_node_id and node_id == force_failure_node_id:
                    error_message = f"Forced failure on node {node_id}"
                else:
                    error_message = ""

                try:
                    if error_message:
                        raise RuntimeError(error_message)
                    result: dict[str, Any] = execute_node(
                        node,
                        {
                            "run_id": run.get("run_id"),
                            "pipeline_id": pipeline.get("id"),
                            "tenant_id": run.get("tenant_id"),
                            "run_config": run_metadata,
                            "parameters": run_metadata.get("parameters") or run_metadata.get("parameter_bindings") or {},
                            "upstream_results": upstream_results,
                            "_attempt": attempt,
                            "_max_attempts": max_attempts,
                        },
                    )
                    result_metadata = _as_dict(result.get("metadata"))
                    success_metadata: dict[str, Any] = {
                        **result_metadata,
                        "active": False,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                    }
                    success_logs: list[dict[str, Any]] = list(cast(list[dict[str, Any]], result.get("log_entries") or []))
                    success_logs.append(
                        {
                            "level": "success",
                            "message": f"Remote execution completed successfully for {node_label}.",
                            "metadata": {
                                "agent_id": AGENT_ID,
                                "stage_index": index,
                                "executor": executor_name,
                                "runtime_profile": execution_binding.get("runtime_profile"),
                                "engine_type": execution_binding.get("engine_type"),
                            },
                        }
                    )
                    report_run_node_event(
                        str(run.get("run_id") or ""),
                        node_id,
                        "success",
                        metadata={
                            **success_metadata,
                            "output_artifacts": result.get("output_artifacts") or [],
                        },
                        logs=success_logs,
                    )
                    upstream_results[node_id] = {
                        "metadata": success_metadata,
                        "output_artifacts": result.get("output_artifacts") or [],
                    }
                    nodes_executed += 1
                    break
                except Exception as exc:
                    error_details: dict[str, Any] = node_execution_error_details(exc, node=node)
                    error_message = str(error_details.get("error_message") or exc)
                    will_retry = attempt < max_attempts and node_error_is_retryable(exc)
                    failure_logs: list[dict[str, Any]] = [
                        {
                            "level": "error",
                            "message": f"Remote execution attempt {attempt} failed on {node_label}: {error_message}",
                            "stream": "stderr",
                            "metadata": {
                                "agent_id": AGENT_ID,
                                "stage_index": index,
                                "attempt": attempt,
                                **error_details,
                            },
                        }
                    ]
                    if will_retry:
                        failure_logs.append(
                            {
                                "level": "warn",
                                "message": f"Retrying {node_label} after attempt {attempt}.",
                                "metadata": {
                                    "retry_backoff_seconds": _retry_backoff_seconds(node, attempt),
                                    "retryable": True,
                                    "error_code": error_details.get("error_code"),
                                    "executor": executor_name,
                                },
                            }
                        )
                        report_run_node_event(
                            str(run.get("run_id") or ""),
                            node_id,
                            "queued",
                            metadata={
                                "active": False,
                                "attempt": attempt,
                                "max_attempts": max_attempts,
                                "last_error": error_message,
                                "waiting_retry": True,
                                "retryable": True,
                                "error_code": error_details.get("error_code"),
                            },
                            logs=failure_logs,
                        )
                        time.sleep(_retry_backoff_seconds(node, attempt))
                        continue

                    report_run_node_event(
                        str(run.get("run_id") or ""),
                        node_id,
                        "failed",
                        metadata={
                            "active": False,
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                            "last_error": error_message,
                            "retryable": bool(error_details.get("retryable")),
                            "error_code": error_details.get("error_code"),
                        },
                        error_text=error_message,
                        logs=failure_logs,
                    )
                    return False, {
                        "error": error_message,
                        "error_code": error_details.get("error_code"),
                        "retryable": bool(error_details.get("retryable")),
                        "failed_node_id": node_id,
                        "failed_node_label": node_label,
                        "nodes_executed": nodes_executed,
                        "agent_id": AGENT_ID,
                    }

        finished = _utc_now_iso()
        metadata: dict[str, Any] = {
            "started_at": started,
            "finished_at": finished,
            "nodes_executed": nodes_executed,
            "agent_id": AGENT_ID,
        }
        return True, metadata
    except Exception as e:
        print("execution error:", e)
        return False, {"error": str(e)}


def execute_platform_job(job: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    job_type = str(job.get("job_type") or "")
    payload = _as_dict(job.get("payload"))
    print(f"Agent {AGENT_ID} executing platform job {job.get('id')} type={job_type}")
    try:
        if job_type == "quality_check":
            time.sleep(0.5)
            metrics_payload = _as_dict(payload.get("metrics"))
            metrics: dict[str, Any] = {
                **metrics_payload,
                "evaluated_rows": metrics_payload.get("row_count", 0) or 1024,
                "freshness_minutes": 4,
                "agent_id": AGENT_ID,
            }
            return True, {"metrics": metrics, "final_status": payload.get("final_status", "passed")}

        if job_type == "deployment":
            time.sleep(0.8)
            return True, {
                "deployment_status": "deployed",
                "status_details": {
                    "stage": "completed",
                    "target_platform": payload.get("target_platform"),
                    "agent_id": AGENT_ID,
                },
            }

        if job_type == "experiment_run":
            time.sleep(0.6)
            metrics_payload = _as_dict(payload.get("metrics"))
            metrics: dict[str, Any] = {
                **metrics_payload,
                "duration_seconds": 48,
                "status_reason": "Completed by remote Nexora agent",
                "agent_id": AGENT_ID,
            }
            return True, {
                "final_status": payload.get("final_status", "completed"),
                "params": payload.get("params") or {},
                "metrics": metrics,
                "artifacts": payload.get("artifacts") or {},
            }

        return False, {"error": f"Unsupported platform job type: {job_type}"}
    except Exception as e:
        print("platform execution error:", e)
        return False, {"error": str(e)}


def consume_broker_work() -> dict[str, Any] | None:
    try:
        return consume_work_message([PIPELINE_RUN_QUEUE, PLATFORM_JOB_QUEUE], max(1, int(POLL_INTERVAL)))
    except Exception as e:
        print("broker consume error:", e)
        return None


def main():
    print("Nexora agent starting", AGENT_ID, f"mode={AGENT_MODE}")
    while True:
        if AGENT_MODE == "broker":
            message = consume_broker_work()
            if not message:
                continue

            if message.get("kind") == "pipeline_run":
                claim = claim_run(str(message.get("run_id") or ""))
                if not claim or claim.get("status") != "claimed":
                    continue
                run_id = str(claim.get("run_id") or "")
                heartbeat_run(run_id)
                stop_event, heartbeat_thread = _start_heartbeat_loop(lambda: heartbeat_run(run_id))
                try:
                    success, meta = execute_pipeline(claim)
                finally:
                    _stop_heartbeat_loop(stop_event, heartbeat_thread)
                status = "success" if success else "failed"
                ok = report_result(run_id, status, meta)
                print(f"Reported result for {run_id}: {status} (ok={ok})")
                continue

            if message.get("kind") == "platform_job":
                claim = claim_platform_job(str(message.get("job_id") or ""), str(message.get("tenant_id") or "default"))
                if not claim or claim.get("status") != "claimed":
                    continue
                broker_job = _as_dict(claim.get("job"))
                heartbeat_platform_job(broker_job)
                stop_event, heartbeat_thread = _start_heartbeat_loop(lambda: heartbeat_platform_job(broker_job))
                try:
                    success, result = execute_platform_job(broker_job)
                finally:
                    _stop_heartbeat_loop(stop_event, heartbeat_thread)
                status = "success" if success else "failed"
                ok = report_platform_job(
                    broker_job,
                    status,
                    result if success else {},
                    None if success else result.get("error"),
                )
                print(f"Reported platform job {broker_job.get('id')}: {status} (ok={ok})")
                continue
        else:
            pipeline_job = poll_for_job()
            if pipeline_job:
                run_id = str(pipeline_job.get("run_id") or "")
                if not run_id:
                    time.sleep(POLL_INTERVAL)
                    continue
                heartbeat_run(run_id)
                stop_event, heartbeat_thread = _start_heartbeat_loop(lambda: heartbeat_run(run_id))
                try:
                    success, meta = execute_pipeline(pipeline_job)
                finally:
                    _stop_heartbeat_loop(stop_event, heartbeat_thread)
                status = "success" if success else "failed"
                ok = report_result(run_id, status, meta)
                print(f"Reported result for {run_id}: {status} (ok={ok})")
                continue

            legacy_job = poll_for_platform_job()
            if legacy_job:
                legacy_job_payload: dict[str, Any] = legacy_job
                heartbeat_platform_job(legacy_job_payload)
                stop_event, heartbeat_thread = _start_heartbeat_loop(lambda: heartbeat_platform_job(legacy_job_payload))
                try:
                    success, result = execute_platform_job(legacy_job_payload)
                finally:
                    _stop_heartbeat_loop(stop_event, heartbeat_thread)
                status = "success" if success else "failed"
                ok = report_platform_job(
                    legacy_job_payload,
                    status,
                    result if success else {},
                    None if success else result.get("error"),
                )
                print(f"Reported platform job {legacy_job_payload.get('id')}: {status} (ok={ok})")
                continue

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
