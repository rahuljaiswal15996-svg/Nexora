# Nexora – Part 10: Deployment & CI/CD

## Current deployment model

Nexora now deploys with one consistent runtime contract across local Docker, CI, and Kubernetes:

- browser clients call same-origin `/api`
- Next.js forwards `/api` to the backend at runtime
- backend containers run Alembic before FastAPI startup
- PostgreSQL is the deployment database target
- Helm publishes the Kubernetes objects
- Terraform installs the Helm chart with release-specific values

## CI/CD

The GitHub Actions workflow in `.github/workflows/ci.yml` now runs four layers of validation:

1. Backend validation
	- install backend dependencies
	- run Alembic upgrade against PostgreSQL
	- execute `pytest -q backend/tests`
	- execute `python backend/scripts/smoke_test.py`
2. Frontend validation
	- install frontend dependencies with `npm ci`
	- run frontend tests
	- run the production Next.js build
3. Deployment readiness
	- build and boot the production Compose stack
	- verify backend `GET /status`
	- verify frontend `GET /api/status`
	- verify frontend root response
4. Kubernetes and infra validation
	- `helm lint`
	- `helm template`
	- `terraform fmt -check`
	- `terraform init -backend=false`
	- `terraform validate`

On pushes to `main`, image publishing is still gated behind successful validation and Docker registry credentials.

## Containerization

- `docker/Dockerfile.backend` installs Python dependencies, copies Alembic assets, and runs migrations before uvicorn.
- `docker/Dockerfile.frontend` is a multi-stage Next.js standalone build.
- `docker/docker-compose.dev.yml` is the editable local stack with bind mounts and PostgreSQL.
- `docker/docker-compose.yml` is the production-like stack used for readiness checks.

## Kubernetes release shape

The Helm chart now deploys:

- backend Deployment, Service, ConfigMap, and Secret
- frontend Deployment, Service, and ConfigMap
- readiness and liveness probes for both services
- resource requests and limits
- ingress with `/api` routed to the backend and `/` routed to the frontend

This is no longer a chart skeleton. It is the current deployment contract for the application.

## Infra as Code

`infra/terraform` now installs the local Helm chart through a real `helm_release` resource. The module supports:

- backend and frontend image repository and tag overrides
- namespace and release name selection
- Kubernetes image pull secret names
- backend `DATABASE_URL` injection through `set_sensitive`
- ingress host, class, annotations, and TLS configuration
- frontend and backend runtime environment overrides

## Environments

- Local developer mode: backend and frontend run directly, or through `docker compose -f docker/docker-compose.dev.yml up --build`
- Local production-like validation: `docker compose -f docker/docker-compose.yml up --build`
- Kubernetes: Helm install directly or Terraform apply against an existing cluster

## Observability and runtime operations

- backend exposes `/status` and `/metrics`
- Helm sets readiness and liveness probes against `/status`
- CI checks both backend health and frontend proxy health before image publication
- remote agents and platform jobs are part of the runtime operations model, not a side channel

## Release governance

- CI blocks publication until backend, frontend, compose, Helm, and Terraform validation pass
- image publishing stays gated to `main`
- runtime job, deployment, and review flows remain traceable through the platform APIs and audit model
