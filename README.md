# Nexora

Nexora is a FastAPI and Next.js control plane for code conversion, notebook and flow authoring, runtime operations, governance, and remote execution. The current deployment path is PostgreSQL plus Alembic for persistence, same-origin `/api` calls from the browser, Docker Compose for local stacks, and Helm plus Terraform for Kubernetes installs.

## Current stack

- Backend: FastAPI app under `backend/app` with tenant-aware routes, pipeline execution, notebook services, governance APIs, and remote-agent endpoints.
- Frontend: Next.js app under `frontend/` with app workspaces for Migration Studio, Flow Builder, Notebook Workspace, Runtime Ops, Governance, Connections, Catalog, and ML.
- Persistence: SQLAlchemy-backed database layer in `backend/app/services/db.py` with Alembic migrations in `backend/alembic/`.
- Database target: PostgreSQL for deployment; if `DATABASE_URL` is not set the backend falls back to a local SQLite file for development.
- Runtime proxy model: browser traffic uses same-origin `/api`, forwarded by `frontend/pages/api/[...path].js` to the backend.
- Deployment: Dockerfiles and Compose stacks in `docker/`, Helm chart in `helm/nexora`, and Terraform Helm installation in `infra/terraform`.
- Remote execution: `agent/agent.py` polls the control plane for `queued_remote` pipeline runs and platform jobs.

## Repository layout

```text
backend/             FastAPI control plane, services, routes, tests, Alembic
frontend/            Next.js UI, workspace pages, API proxy route, tests
agent/               Minimal remote worker for pipeline runs and platform jobs
docker/              Backend/frontend Dockerfiles and Compose stacks
helm/nexora/         Kubernetes chart for backend, frontend, config, secret, ingress
infra/terraform/     Terraform module that installs the Helm chart
docs/                Product, architecture, deployment, and UX references
```

## Local development

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m alembic -c alembic.ini upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Important backend environment variables:

- `DATABASE_URL` or `NEXORA_DATABASE_URL`: PostgreSQL for deployment, optional for local fallback to SQLite.
- `NEXORA_ENV`: deployment mode. Set this to `production` in real deployments so startup validation requires explicit CORS and secure auth configuration.
- `NEXORA_ALLOWED_ORIGINS`: comma-separated browser origins allowed by CORS. The backend no longer injects implicit localhost origins, so set this explicitly in local, Docker, and ingress-backed environments.
- `NEXORA_ALLOWED_ORIGIN_REGEX`: optional regex for broader ingress-origin matching when a fixed origin list is not practical. Origins are validated as scheme-plus-host values only, and production startup now fails fast if neither an origin list nor a regex is configured.
- `NEXORA_REQUIRE_EXPLICIT_CORS`: optional override for explicit-CORS startup validation. Defaults to `true` in production.
- `NEXORA_JWT_SECRET` or `NEXORA_JWKS_URL` with `NEXORA_JWKS_AUD`: required auth configuration for production. Set a secret for HMAC tokens or configure JWKS for OIDC/JWT validation.
- `NEXORA_ALLOW_DEV_TOKENS`: developer convenience switch for `POST /auth/token`. It now defaults to `false` in production and should stay disabled outside local development.
- `NEXORA_DEFAULT_ROLE`, `NEXORA_DEFAULT_TENANT_ID`, and `NEXORA_DEFAULT_USER_ID`: fallback principal values used only when requests do not supply auth context.
- `NEXORA_LLM_PROVIDER`, `OPENAI_API_KEY` or `NEXORA_OPENAI_API_KEY`, and `NEXORA_OPENAI_MODEL`: conversion-provider settings for mock or OpenAI-backed generation.

Backend docs and observability:

- Swagger UI: `http://127.0.0.1:8000/docs`
- Metrics: `http://127.0.0.1:8000/metrics`
- Health: `http://127.0.0.1:8000/status`

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

The browser always calls `/api`. In development and production, `frontend/pages/api/[...path].js` forwards that same-origin traffic to the backend using `INTERNAL_API_BASE_URL`. When the Next.js server makes backend requests directly, `INTERNAL_API_BASE_URL` must be set unless `NEXT_PUBLIC_API_BASE_URL` is configured as an absolute URL.

Important frontend environment variables:

- `NEXT_PUBLIC_API_BASE_URL`: public API base for browser calls. Default is `/api`.
- `INTERNAL_API_BASE_URL`: backend URL used by the Next.js server runtime and API proxy route.

## Docker Compose

Development stack with bind mounts and PostgreSQL:

```powershell
docker compose -f docker/docker-compose.dev.yml up --build
```

Production-like stack with built images and PostgreSQL:

```powershell
docker compose -f docker/docker-compose.yml up --build
```

The Compose stacks now follow the same production routing model as Kubernetes:

- frontend serves the UI on port `3000`
- backend serves FastAPI on port `8000`
- browser requests still go to frontend `/api`
- frontend forwards server-side and proxy traffic to `INTERNAL_API_BASE_URL`
- `docker-compose.yml` disables dev token issuance by default, while `docker-compose.dev.yml` keeps it enabled for local development.

## Kubernetes deployment

### Helm

```bash
helm upgrade --install nexora ./helm/nexora \
	--namespace nexora \
	--create-namespace \
	--set backend.image.repository=your-registry/nexora-backend \
	--set backend.image.tag=2026.04.07 \
	--set frontend.image.repository=your-registry/nexora-frontend \
	--set frontend.image.tag=2026.04.07 \
	--set-string backend.secretEnv.DATABASE_URL=postgresql+psycopg://user:password@postgres:5432/nexora \
	--set ingress.enabled=true \
	--set ingress.host=nexora.example.com
```

The chart provisions:

- backend and frontend Deployments
- backend and frontend Services
- backend ConfigMap and Secret
- frontend ConfigMap with internal backend routing
- ingress routing `/api` to backend and `/` to frontend
- readiness and liveness probes plus default resource requests and limits

### Terraform

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan \
	-var="database_url=postgresql+psycopg://user:password@postgres:5432/nexora" \
	-var="backend_image_repository=your-registry/nexora-backend" \
	-var="backend_image_tag=2026.04.07" \
	-var="frontend_image_repository=your-registry/nexora-frontend" \
	-var="frontend_image_tag=2026.04.07" \
	-var="ingress_enabled=true" \
	-var="ingress_host=nexora.example.com"
terraform -chdir=infra/terraform apply \
	-var="database_url=postgresql+psycopg://user:password@postgres:5432/nexora" \
	-var="backend_image_repository=your-registry/nexora-backend" \
	-var="backend_image_tag=2026.04.07" \
	-var="frontend_image_repository=your-registry/nexora-frontend" \
	-var="frontend_image_tag=2026.04.07" \
	-var="ingress_enabled=true" \
	-var="ingress_host=nexora.example.com"
```

Terraform now installs the local Helm chart directly instead of serving as a placeholder example.

## Remote agent

The minimal agent is documented in `agent/README.md` and supports:

- `GET /agent/poll` and `POST /agent/report` for remote pipeline runs
- `/agent/heartbeat` lease renewal for claimed runs
- `/agent/platform-jobs/poll`, `/agent/platform-jobs/report`, and `/agent/platform-jobs/heartbeat` for remote control-plane jobs

Use a direct backend URL for `NEXORA_CONTROL_URL`. The browser-facing `/api` proxy is for the frontend, not for workers.

## Testing and validation

Backend tests:

```bash
python -m pytest -q backend/tests
```

Frontend tests:

```bash
cd frontend
npm test -- --runInBand
```

Backend smoke test:

```bash
python backend/scripts/smoke_test.py
```

CI in `.github/workflows/ci.yml` now validates:

- backend dependency install, Alembic migrations, tests, and smoke test
- frontend install, tests, and production build
- production Compose boot plus `/status` and `/api/status` checks
- Helm lint and `helm template`
- Terraform `fmt`, `init -backend=false`, and `validate`
- gated image publishing on `main`

## Key docs

- Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md)
- Enterprise architecture: [ARCHITECTURE_ENTERPRISE.md](ARCHITECTURE_ENTERPRISE.md)
- API contracts: [API_CONTRACTS.md](API_CONTRACTS.md)
- Deployment and CI/CD: [docs/Part10_Deployment_CICD.md](docs/Part10_Deployment_CICD.md)
- Diagrams: [docs/DIAGRAMS.md](docs/DIAGRAMS.md)
- Helm and Terraform quickstart: [docs/infra/HELM_TERRAFORM.md](docs/infra/HELM_TERRAFORM.md)
- Terraform module notes: [infra/terraform/README.md](infra/terraform/README.md)
- UX and platform overview: [docs/UX_OVERVIEW.md](docs/UX_OVERVIEW.md)

## Current deployment direction

- PostgreSQL is the production database path.
- Alembic runs before backend startup in containerized environments.
- Browser API traffic stays same-origin at `/api`.
- Kubernetes ingress sends `/api` to FastAPI and `/` to Next.js.
- Terraform and Helm now describe the same runtime model as Docker Compose and CI.
