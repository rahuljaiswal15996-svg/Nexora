# Nexora Data Plane Agent

The Nexora agent executes remote pipeline runs and remote platform jobs outside
the control plane while preserving control-plane lease, heartbeat, and telemetry
state.

How it works:

- The backend publishes remote pipeline runs and platform jobs to the configured
  work broker.
- The agent consumes broker messages, then explicitly claims the referenced run
  or job over the `/agent/*` API surface so the database remains the source of
  truth for status, lease, and heartbeat metadata.
- Pipeline nodes execute through the shared execution engine instead of the old
  sleep-based simulation path.
- Node-level telemetry streams back to `/agent/runs/node-update`, while final
  run and platform-job completion still reports through `/agent/report` and
  `/agent/platform-jobs/report`.
- A maintenance loop in the control plane re-enqueues stale remote work when a
  lease expires or a worker disappears.

The agent talks directly to the FastAPI backend. It does not use the frontend
same-origin `/api` proxy route.

Quickstart (run locally):

```bash
# from repo root
python -m pip install -r backend/requirements.txt
NEXORA_CONTROL_URL=http://127.0.0.1:8000 python agent/agent.py
```

Docker Compose development stack:

```bash
docker compose -f docker/docker-compose.dev.yml up --build
```

Common control URLs:

- Local backend: `http://127.0.0.1:8000`
- Docker Compose service-to-service: `http://backend:8000`
- Kubernetes service: `http://nexora-backend:8000` or your release-specific backend service DNS

Environment variables:

- `NEXORA_CONTROL_URL` — control plane base URL. Required for direct agent execution; Docker Compose and Helm set it automatically.
- `NEXORA_AGENT_ID` — optional agent id
- `NEXORA_AGENT_CONSUMER_MODE` — `broker` or `legacy`; defaults to `broker`
  when `NEXORA_BROKER_URL` is set
- `NEXORA_WORK_BROKER` — broker backend selector, currently `redis` or `memory`
- `NEXORA_BROKER_URL` — Redis connection string for the work broker
- `NEXORA_BROKER_DB_FALLBACK_ENABLED` — backend-side rollout flag; `1` keeps
  legacy DB claim fallback on HTTP poll endpoints, `0` makes the hot path
  broker-only and relies on maintenance re-enqueue for recovery
- `NEXORA_AGENT_HEARTBEAT_INTERVAL` — heartbeat cadence in seconds
- `POLL_INTERVAL` — legacy poll interval and broker consume timeout in seconds

This agent remains intentionally lightweight. Production use still needs
stronger authentication, workload isolation, sandboxing, and broker durability
policies appropriate for your environment.
