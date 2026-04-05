# Nexora Data Plane Agent (MVP)

This is a minimal data-plane agent that demonstrates how remote pipeline
runs can be executed outside the control plane.

How it works (MVP):

- The control plane (FastAPI backend) supports queuing remote runs by calling
  the pipelines run endpoint with `run_mode=remote`.
- The agent polls the control plane at `/agent/poll` and claims runs with
  status `queued_remote`.
- After executing the pipeline nodes locally (simulated), the agent reports
  results to `/agent/report`.

Quickstart (run locally):

```bash
# from repo root
python -m pip install requests
python agent/agent.py
```

Environment variables:

- `NEXORA_CONTROL_URL` — control plane base URL (default `http://127.0.0.1:8000`)
- `NEXORA_AGENT_ID` — optional agent id
- `POLL_INTERVAL` — seconds between poll attempts (default `2`)

Note: This agent is intentionally minimal and for demo/development only.
For production use, implement secure authentication (mTLS, signed tokens),
retries, robust error handling, and resource isolation.
