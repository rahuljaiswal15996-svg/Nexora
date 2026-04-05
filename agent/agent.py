#!/usr/bin/env python3
"""Simple data-plane agent for Nexora (MVP).

- Polls control-plane `/agent/poll` for jobs
- Executes pipeline nodes (simulated) and reports results to `/agent/report`

Configure via environment variables:
- NEXORA_CONTROL_URL (default: http://127.0.0.1:8000)
- NEXORA_AGENT_ID
- POLL_INTERVAL (seconds, default: 2)
"""
import os
import time
import uuid
import requests
from datetime import datetime

CONTROL_URL = os.getenv("NEXORA_CONTROL_URL", "http://127.0.0.1:8000")
AGENT_ID = os.getenv("NEXORA_AGENT_ID", f"agent-{uuid.uuid4().hex[:6]}")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2"))

POLL_ENDPOINT = f"{CONTROL_URL.rstrip('/')}/agent/poll"
REPORT_ENDPOINT = f"{CONTROL_URL.rstrip('/')}/agent/report"


def poll_for_job():
    try:
        headers = {"X-Agent-Id": AGENT_ID}
        resp = requests.get(POLL_ENDPOINT, headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("status") != "claimed":
            return None
        return data
    except Exception as e:
        print("poll error:", e)
        return None


def report_result(run_id, status, metadata=None):
    try:
        payload = {"run_id": run_id, "status": status, "run_metadata": metadata or {}}
        resp = requests.post(REPORT_ENDPOINT, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print("report error:", e)
        return False


def execute_pipeline(run):
    pipeline = run.get("pipeline") or {}
    nodes = (pipeline.get("dag_json") or {}).get("nodes", []) if pipeline else []
    print(f"Agent {AGENT_ID} executing run {run.get('run_id')} nodes={len(nodes)}")
    started = datetime.utcnow().isoformat() + "Z"
    try:
        for node in nodes:
            nid = node.get("id") or uuid.uuid4().hex
            ntype = node.get("type", "task")
            secs = node.get("simulate_seconds", 0.2)
            print(f" - node {nid} ({ntype}) sleeping {secs}s")
            time.sleep(max(0.05, float(secs)))
        finished = datetime.utcnow().isoformat() + "Z"
        metadata = {"started_at": started, "finished_at": finished, "nodes_executed": len(nodes), "agent_id": AGENT_ID}
        return True, metadata
    except Exception as e:
        print("execution error:", e)
        return False, {"error": str(e)}


def main():
    print("Nexora agent starting", AGENT_ID)
    while True:
        job = poll_for_job()
        if job:
            run_id = job.get("run_id")
            success, meta = execute_pipeline(job)
            status = "success" if success else "failed"
            ok = report_result(run_id, status, meta)
            print(f"Reported result for {run_id}: {status} (ok={ok})")
        else:
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
