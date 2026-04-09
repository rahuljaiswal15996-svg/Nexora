# Nexora Architecture

## Overview

Nexora is a control-plane application built around a FastAPI backend, a Next.js frontend, a PostgreSQL-ready persistence layer, a broker-backed remote execution fabric, and a lightweight remote agent for off-control-plane execution. The current deployment model is consistent across local Docker, Kubernetes Helm, Terraform, and CI:

- browser clients call same-origin `/api`
- Next.js proxies `/api` to the backend at runtime
- backend services persist state through SQLAlchemy and Alembic
- PostgreSQL is the deployment target, with SQLite retained only as a local fallback
- remote pipeline runs and platform jobs are delivered through a broker and claimed by agents outside the control plane

## Backend architecture

### Control plane entrypoint

- `backend/app/main.py` initializes the FastAPI app, CORS policy, tenant and auth middleware, observability middleware, and all route modules.
- startup uses lifespan initialization and calls `init_db()` so schema bootstrap and connection setup happen before request handling.

### Core service layers

- `backend/app/services/db.py` provides the SQLAlchemy-backed compatibility layer, database URL normalization, engine creation, and schema bootstrap helpers.
- `backend/alembic/` owns managed schema migrations for PostgreSQL-oriented deployment.
- `backend/app/services/pipeline_runner.py` and `backend/app/services/platform_jobs.py` drive pipeline execution, telemetry, retry, lease, and remote-worker coordination.
- `backend/app/services/notebook.py` and the notebook routes keep notebook state and notebook-to-flow binding inside the same platform graph model.
- `backend/app/services/history.py`, `uir_service.py`, `pipeline_optimizer.py`, and related modules now use database-portable patterns instead of SQLite-only SQL.

### Database model

- Production path: `DATABASE_URL=postgresql+psycopg://...`
- Local fallback: if `DATABASE_URL` is not set, the backend uses `backend/app/data/nexora.db`
- Migration path: containers run Alembic before the backend starts, and CI validates Alembic upgrade on PostgreSQL

### Runtime and remote execution

- `backend/app/services/work_broker.py` provides the broker abstraction used for remote pipeline runs and platform jobs, with Redis as the production path and in-memory fallback for local-only scenarios.
- `backend/app/services/work_maintenance.py` re-enqueues stale remote work so lease expiry still supports reclaim without database polling in the agent.
- `backend/app/services/execution_engine.py` executes Python, SQL, API, dataset, validation, and generic control-plane node types and returns structured telemetry artifacts.
- `POST /pipelines/{pipeline_id}/runs?run_mode=remote` and remote platform-job creation publish work to the broker.
- Agents consume broker messages, call explicit claim endpoints, renew leases with heartbeat endpoints, stream node telemetry, and submit final completion reports.

## Frontend architecture

### UI structure

The frontend is no longer just a thin MVP upload shell. It now contains split workspaces for:

- Home and Programs summary
- Migration Studio
- Flow Builder
- Notebook Workspace
- Catalog and Lineage
- Runtime Operations
- Governance Desk
- Connections Hub
- ML Studio

### API routing model

- `frontend/services/api.js` resolves the API base path dynamically.
- browser calls use `/api`
- server-side calls use `INTERNAL_API_BASE_URL` when set, or a local fallback
- `frontend/pages/api/[...path].js` is the catch-all proxy route that forwards requests to the backend in both development and production

This replaced the earlier localhost rewrite approach and makes Docker and Kubernetes deployments use the same browser contract.

### Frontend runtime behavior

- Next.js builds in standalone mode for the production image
- the frontend container runs `node server.js`
- the browser never needs to know the backend service hostname directly

## Deployment architecture

### Containers and Compose

- `docker/Dockerfile.backend` installs backend dependencies, copies Alembic assets, runs migrations, and starts uvicorn
- `docker/Dockerfile.frontend` is a multi-stage production build using Next.js standalone output
- `docker/docker-compose.dev.yml` provides bind-mounted development with PostgreSQL and same-origin `/api`
- `docker/docker-compose.yml` provides a production-like multi-container stack with PostgreSQL and internal service routing

### Kubernetes and Helm

The Helm chart in `helm/nexora` now provisions:

- backend and frontend Deployments
- agent and Redis Deployments
- backend and frontend Services
- Redis Service
- backend ConfigMap and Secret
- frontend ConfigMap with `INTERNAL_API_BASE_URL`
- backend and agent broker configuration through ConfigMaps
- readiness and liveness probes
- default resource requests and limits
- ingress routing `/api` to backend and `/` to frontend

### Terraform

`infra/terraform` is now an active installer for the Helm chart instead of a placeholder module. It:

- installs the chart with `helm_release`
- injects image repositories and tags
- injects `DATABASE_URL` securely with `set_sensitive`
- configures ingress values and frontend runtime routing
- returns namespace, release status, service names, and frontend URL outputs

## CI and deployment readiness

`.github/workflows/ci.yml` validates the same runtime model that production uses:

- backend install, Alembic upgrade, tests, and smoke test
- frontend install, tests, and production build
- Compose-based deployment readiness checks for backend `/status` and frontend `/api/status`
- Helm lint and `helm template`
- Terraform formatting, init, and validate
- gated image publish on pushes to `main`

## Architectural direction

The main architectural shift is complete:

- database persistence is no longer described as future work
- same-origin `/api` routing is now the actual frontend contract
- Kubernetes deployment is charted and installable through Terraform
- remote execution is part of the operational model, not just a demo stub
- remote delivery no longer depends on agent-side database polling
- pipeline execution no longer depends on sleep-based node simulation

The remaining work is evolutionary rather than foundational: richer Terraform environment modules, deeper secrets integration, and broader end-to-end deployment validation.
