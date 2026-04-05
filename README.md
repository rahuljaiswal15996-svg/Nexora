# Nexora MVP

Enterprise-quality MVP for Nexora with a FastAPI backend, Next.js frontend, backend history persistence, comparison metrics, and Docker scaffolding.

## Project structure

```
nexora/
 ├── backend/
 │   ├── app/
 │   │   ├── core/
 │   │   ├── data/
 │   │   │   ├── nexora.db
 │   │   ├── models/
 │   │   │   ├── schemas.py
 │   │   ├── routes/
 │   │   │   ├── history.py
 │   │   │   ├── status.py
 │   │   │   ├── upload.py
 │   │   ├── services/
 │   │   │   ├── comparison.py
 │   │   │   ├── conversion.py
 │   │   │   ├── history.py
 │   │   ├── main.py
 │   ├── requirements.txt
 ├── frontend/
 │   ├── components/
 │   │   ├── CodeEditor.js
 │   │   ├── DiffViewer.js
 │   ├── pages/
 │   │   ├── index.js
 │   │   ├── compare.js
 │   │   ├── history.js
 │   ├── services/
 │   │   ├── api.js
 │   │   ├── history.js
 │   ├── package.json
 │   ├── next.config.js
 ├── docker/
 │   ├── Dockerfile.backend
 │   ├── Dockerfile.frontend
 │   ├── docker-compose.yml
 ├── README.md
```

## Backend setup

### Install

```powershell
cd backend
python -m pip install -r requirements.txt
```

### Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Enabling OIDC / JWKS token validation

The backend supports validating OIDC tokens using a remote JWKS endpoint. Set the following environment variables to enable:

- `NEXORA_JWKS_URL` — JWKS endpoint (e.g. https://login.example.com/.well-known/jwks.json)
- `NEXORA_JWKS_AUD` — optional audience claim to validate

If `NEXORA_JWKS_URL` is not set the service falls back to HMAC verification using `NEXORA_JWT_SECRET` (use only for local testing).


### Observability

Once the backend is running, Prometheus metrics are exposed at:

```text
http://127.0.0.1:8000/metrics
```

Structured logs are configured by default for easier ingestion.

### API docs

Open:

```text
http://127.0.0.1:8000/docs
```

## Backend API

- `POST /upload` — upload a file and return filename + size
- `POST /convert` — upload a file, convert code, compute comparison metrics, and persist history
- `GET /history` — retrieve stored conversion history
- `DELETE /history` — clear stored conversion history
- `GET /status` — health check endpoint
 - `POST /convert` — upload a file, convert code, compute comparison metrics, and persist history
 - `GET /history` — retrieve stored conversion history
 - `DELETE /history` — clear stored conversion history
 - `GET /status` — health check endpoint
 - `POST /shadow` — create a shadow execution (compare legacy vs converted outputs and mark for HITL if needed)
 - `GET /shadow` — list shadow runs
 - `GET /shadow/{id}` — fetch shadow run details
 - `POST /shadow/{id}/review` — record HITL review action (approve/reject/needs-fix)

## Frontend setup

### Install

```powershell
cd frontend
npm install
```

### Run

```powershell
npm run dev
```

Open:

```text
http://localhost:3000

### Pages added (MVP)

- `/upload` — Upload or paste legacy code, parse to UIR, and convert.
- `/compare` — Compare original vs converted code with enhanced diff viewer.
- `/history` — View conversion history.
- `/pipelines` — Create and run DAG pipelines (MVP runner).

Note: Frontend proxies `/api/*` to the backend at `http://127.0.0.1:8000/` via `next.config.js`.
```

## Frontend features

- Upload legacy code files or paste code directly
- Convert code using the FastAPI backend
- View original and converted results side by side
- See similarity metrics and enhanced diff viewer with unified/split views
- Browse conversion history and clear history from the backend

## Docker support

Run both services with Docker Compose from the `docker/` directory:

```powershell
docker compose -f docker/docker-compose.yml up --build
```

## Developer quick test

From the `backend` directory you can run a lightweight smoke test that initializes the DB, parses a sample, converts it, creates a pipeline and runs it:

```bash
cd backend
python scripts/smoke_test.py
```

This is useful for local validation of core flows without running the full frontend.

## Run tests

Run backend integration/unit tests with `pytest` from the repo root:

```bash
python -m pytest -q backend/tests
```

Or from the `backend` folder:

```bash
cd backend
pytest -q tests
```

## Execution artifacts and docs

- Implementation plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- API contracts: [API_CONTRACTS.md](API_CONTRACTS.md)
- Docker dev compose: [docker/docker-compose.dev.yml](docker/docker-compose.dev.yml)
- K8s skeleton: [docker/k8s/README.md](docker/k8s/README.md)
 - Architecture diagrams: [docs/DIAGRAMS.md](docs/DIAGRAMS.md)
 - UX & Platform overview: [docs/UX_OVERVIEW.md](docs/UX_OVERVIEW.md)
 - Preview: [docs/preview.html](docs/preview.html)

## CI / GitHub Actions

- A CI workflow is provided at `.github/workflows/ci.yml`.
- It runs the backend smoke test (`backend/scripts/smoke_test.py`) and builds the Next.js frontend on pull requests and pushes.
- On pushes to `main` it will (optionally) build and push Docker images if `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured in repository secrets.

To enable Docker image publishing, set the GitHub repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.


## Next priorities

- Add syntax-aware diff highlighting with unified/split views
- Add backend database persistence with SQLite storage
- Add user sessions and multi-tenant workspaces
- Add pipeline visualization and validation

## Design principles

This MVP follows the correct order:
1. Backend logic
2. API routes
3. Frontend integration

It also includes history persistence, explicit comparison metrics, and a clean UI flow for the core Nexora use case.
