# Nexora Implementation Plan — Execution Mode

This file maps the 8-week roadmap into concrete, testable tasks and delivery checkpoints for a solo/small-team fast delivery (VS Code + Copilot).

Principles
- Small, testable increments with clear acceptance criteria.
- Default to simple, production-friendly defaults (Postgres for prod, SQLite for local dev).
- Keep control plane lightweight; data plane tenant isolation optional for enterprise.

How to use this doc
- Work week-by-week (or per feature) using the `todoList` in repo root tracked by the agent.
- Each checklist item includes the primary files to change and the smoke test to validate.

---

WEEK 1: Foundation (Completed)
- Goal: FastAPI backend, `/upload` API, Swagger UI
- Key files:
  - `backend/app/main.py`
  - `backend/app/routes/upload.py`
- Acceptance:
  - `uvicorn app.main:app --reload` runs and `/docs` shows the upload endpoint

WEEK 2: Conversion Engine (Completed)
- Goal: Rule-based conversion + convert API
- Key files:
  - `backend/app/services/conversion_engine.py`
  - `backend/app/routes/upload.py` (convert endpoint)
- Acceptance:
  - POST a sample SAS code to `/convert` returns `original`, `converted`, `comparison`

WEEK 3: Frontend (Completed)
- Goal: Next.js upload/compare UI
- Key files:
  - `frontend/pages/upload.js`
  - `frontend/pages/compare.js`
- Acceptance:
  - UI connects to backend via proxy (`next.config.js`) and shows converted code

WEEK 4: Comparison + History (Completed)
- Goal: Text + semantic diff and persistent history (SQLite)
- Key files:
  - `backend/app/services/comparison.py`
  - `backend/app/services/history.py` (migrated to DB)
- Acceptance:
  - Conversions saved in DB and viewable on `/compare` and `GET /history`

WEEK 5: Validation + Metrics (Completed)
- Goal: Basic validation engine and metrics
- Key files:
  - `backend/app/services/validation.py`
  - `backend/app/services/observability.py`
- Acceptance:
  - Sample `validate_all()` run and metrics exposed on `/metrics`

WEEK 6: Pipeline Visualization (Completed)
- Goal: DAG editor, create/run pipeline MVP
- Key files:
  - `frontend/pages/pipelines.js`
  - `backend/app/services/pipeline_runner.py`
  - `backend/app/routes/pipelines.py`
- Acceptance:
  - Create a pipeline via UI, start run, poll run status

WEEK 7: AI + Improvements (In-progress)
- Goal: Add LLM adapter, prompt versioning, robust conversion scoring
- Tasks (next):
  - Implement provider adapter interface and local mock adapter
  - Add prompt/version metadata in `conversions` table
  - Add server-side rate-limits and cost-tracking hooks
- Files to add/edit:
  - `backend/app/services/llm_adapter.py` (new)
  - `backend/app/services/conversion_engine.py` (hook to call adapter)
- Acceptance:
  - Conversion engine can call a mock LLM adapter and return a second candidate

WEEK 8: Polish + Deploy (Not started)
- Goal: CI/CD, Helm/K8s manifests, deploy to a cloud demo (Vercel/Render)
- Tasks:
  - Add `docker/docker-compose.dev.yml` for local dev
  - Add `docker/k8s/` skeleton and `helm/` hints
  - Add GitHub Actions pipeline templates for build/test/deploy
- Acceptance:
  - One-click `docker-compose up` brings up frontend + backend + Postgres + MinIO

---

ENTERPRISE TRACK: Control Plane Expansion (Current branch)
- Goal: connect the existing MVP endpoints into a coherent enterprise platform model.
- Completed on the current feature branch:
  - Role-aware request handling and tenant-aware frontend session bootstrap
  - Connection dataset browsing, schema inspection, and preview support
  - Source-language and target-language aware conversion workflows
  - New control-plane objects for projects, workspaces, catalog, scenarios, deployments, governance, collaboration, FinOps, and ML lifecycle
- Backend files added or expanded:
  - `backend/app/services/db.py`
  - `backend/app/routes/projects.py`
  - `backend/app/routes/catalog.py`
  - `backend/app/routes/scenarios.py`
  - `backend/app/routes/deploy.py`
  - `backend/app/routes/governance.py`
  - `backend/app/routes/finops.py`
  - `backend/app/routes/collaboration.py`
  - `backend/app/routes/ml.py`
- Acceptance for this phase:
  - New enterprise objects are persisted locally in SQLite
  - Every new route is tenant-scoped and role-gated
  - Governance audit records are emitted for mutating platform actions

NEXT PHASE: UX and orchestration integration
- Goal: expose the new platform objects in the frontend and connect them to async execution.
- Tasks:
  - Add project and catalog navigation in the frontend shell
  - Add scenario comparison and governance dashboards
  - Add deployment target management UI and deployment timeline views
  - Connect dataset quality checks, deployment runs, and ML runs to background workers
- Acceptance:
  - A tenant can create a project, register datasets, create scenarios, request reviews, deploy a pipeline, and inspect audit/cost history from the UI

Progress update on this phase
- Completed in the current branch:
  - `/platform` is now an overview hub rather than the only control-plane surface
  - Dedicated frontend pages exist for `/projects`, `/catalog`, `/operations`, `/governance`, and `/ml`
  - Asynchronous platform jobs now back dataset quality checks, deployments, and experiment runs
  - Tenant-scoped job polling is exposed through `/jobs` and `/jobs/{job_id}`
- Remaining work:
  - Replace local background threads with durable workers and a real queue
  - Add frontend polling polish, filters, and richer progress details
  - Connect deployments and experiment runs to real executors instead of simulated completion

---

Immediate next actions (today)
1. Add frontend surfaces for projects, catalog, scenarios, governance, and deployment management
2. Connect enterprise route groups to background execution instead of synchronous scaffolding
3. Expand model registry and deployment adapters beyond local simulation

Commands — quick dev
```bash
# Run backend locally
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Run frontend locally
cd frontend
npm install
npm run dev
```

Smoke test (backend only):
```bash
cd backend
python scripts/smoke_test.py
```

---

Repository references
- Architecture doc: `ARCHITECTURE_ENTERPRISE.md`
- API contracts: `API_CONTRACTS.md`
- Developer quickstart: `README.md` and `backend/scripts/smoke_test.py`

---

If you confirm, the next implementation slice should move from backend scaffolding into frontend workflows and async orchestration.
