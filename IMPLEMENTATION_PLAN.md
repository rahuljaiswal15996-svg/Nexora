# Nexora Implementation Plan — Execution Mode

This file maps the 8-week roadmap into concrete, testable tasks and delivery checkpoints for a solo/small-team fast delivery (VS Code + Copilot).

Principles
- Small, testable increments with clear acceptance criteria.
- Default to production-friendly database and deployment paths: PostgreSQL for deployment, with SQLite retained only as a local fallback when `DATABASE_URL` is not set.
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
  - UI connects to backend through the same-origin `/api` route and shows converted code

WEEK 4: Comparison + History (Completed)
- Goal: Text + semantic diff and persistent history through the shared SQLAlchemy-backed database layer
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

WEEK 8: Polish + Deploy (Completed)
- Goal: CI/CD, Docker/Compose runtime, Helm deployment contract, and Terraform-based install path
- Tasks completed:
  - Add `docker/docker-compose.dev.yml` and `docker/docker-compose.yml` aligned to PostgreSQL and same-origin frontend routing
  - Productionize `helm/nexora` with probes, resources, ConfigMaps, Secret injection, and ingress routing for `/` and `/api`
  - Add GitHub Actions validation for backend, frontend, Compose, Helm, Terraform, and gated image publication
  - Activate `infra/terraform` as a real `helm_release` installer instead of a placeholder module
- Acceptance:
  - `docker compose -f docker/docker-compose.yml config` renders cleanly for the full stack
  - CI validates the Helm chart and Terraform module before image publication

---

ENTERPRISE TRACK: Control Plane Expansion (Current branch)
- Goal: connect the existing MVP endpoints into a coherent enterprise platform model.
- Completed on the current feature branch:
  - Role-aware request handling and tenant-aware frontend session bootstrap
  - Connection dataset browsing, schema inspection, and preview support
  - Source-language and target-language aware conversion workflows
  - New control-plane objects for projects, workspaces, catalog, scenarios, deployments, governance, collaboration, FinOps, and ML lifecycle
  - Split global and project workspace navigation with dedicated pages for home, runtime, connections, governance, projects, catalog, flow, notebooks, and ML
  - Flow Builder authoring backed by backend node catalog, graph validation, execution telemetry, retry-from-node, and persisted DAG updates
  - Notebook Workspace execution moved onto the shared pipeline runtime through `POST /notebooks/{id}/executions` with run, node, and log telemetry reuse
  - Runtime Ops now exposes jobs, agent fleet, pipeline runs, deployment drill-down, retry, and rollback controls
  - Public marketing routes split cleanly from app routes so the operating product stays workflow-focused
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
  - New enterprise objects are persisted through the shared database layer, with PostgreSQL as the deployment target and SQLite retained only for local fallback
  - Every new route is tenant-scoped and role-gated
  - Governance audit records are emitted for mutating platform actions

CURRENT PRODUCT COMPLETION SNAPSHOT (April 2026)
- Core migration flow: ~95%
  - Upload, parse, convert, compare, history, and migration bootstrap flow are implemented and passing live validation.
- Flow Builder: ~90%
  - Graph authoring, backend validation, runtime telemetry, retry-from-node, and promotion handoff are implemented.
- Notebook Workspace: ~90%
  - Shared runtime execution, flow binding, persisted outputs, and pipeline telemetry integration are implemented.
- Catalog + Lineage: ~85%
  - Dataset inventory, quality, lineage, and notebook entry points are implemented; deeper lineage analysis remains.
- Runtime Ops: ~90%
  - Jobs, agents, run drill-down, deployment inspection, retry, and rollback are implemented.
- Governance Desk: ~80%
  - Policies, FinOps, and Reviews are split and functional; richer audit and workflow automation remain.
- Connections Hub: ~80%
  - Connection management, testing, and dataset browsing are implemented; enterprise promotion depth remains.
- Programs / Home / Projects: ~85%
  - Portfolio summary and project entry flows are implemented; deeper project administration remains.
- ML Studio: ~75%
  - Core platform scaffolding exists, but this remains one of the thinner major surfaces.
- Review / Shadow HITL: ~75%
  - Functional, but shallower than Flow Builder, Notebook Workspace, and Runtime Ops.
- Deployment / infra / hardening: ~75%
  - Local runtime and validation paths are solid; cluster validation and real executor depth remain.

NEXT PHASE: Platform depth and production hardening
- Goal: finish the thinner modules and replace simulation-heavy runtime paths with production-grade execution.
- Tasks:
  - Replace database-backed polling loops with broker-backed workers while preserving the current lease, heartbeat, and reclaim semantics
  - Expand ML Studio, Review, and observability surfaces so they match the depth of Flow Builder, Notebook Workspace, and Runtime Ops
  - Connect deployments and experiment runs to real executors instead of simulated completion
  - Validate Helm and Terraform deployment paths in a real target cluster environment
- Acceptance:
  - A tenant can create a project, register datasets, run notebook-backed and flow-backed workloads, request reviews, inspect governance and cost state, and deploy through a validated cluster path without simulated execution gaps

Progress update on this phase
- Completed in the current branch:
  - `/platform`, `/operations`, and legacy governance overload have been split into dedicated workspaces including `/home`, `/runtime`, `/connections`, `/governance/policies`, `/governance/finops`, `/governance/reviews`, `/projects`, `/catalog`, `/flow`, `/notebooks`, and `/ml`
  - Asynchronous platform jobs now back dataset quality checks, deployments, and experiment runs
  - Tenant-scoped job polling is exposed through `/jobs` and `/jobs/{job_id}`
  - Remote worker claim/report APIs now exist for platform jobs through `/agent/platform-jobs/poll` and `/agent/platform-jobs/report`
  - Remote platform jobs and pipeline runs now support lease-based claiming, heartbeat renewal, and stale-work reclamation for worker recovery
  - Legacy agent poll endpoints now consume broker-backed work only; DB hot-path fallback claiming has been removed while the DB remains the state and recovery source of truth
  - Flow Builder authoring now uses backend-driven node schemas and validation through `/pipelines/node-catalog` and `/pipelines/validate`
  - Notebook Workspace now executes through the shared runtime path at `/notebooks/{id}/executions` and reuses `/pipelines/runs/{run_id}`, `/nodes`, and `/logs`
  - Backend deployment configuration is now environment-driven for CORS and worker control-plane URLs, with Compose wiring parameterized for container and ingress-style deployments
  - Terraform now includes committed staging handoff templates plus a saved-plan PowerShell helper so operators can prepare `staging.tfvars`, keep secrets separate, and apply only from the reviewed plan artifact
  - Cluster validation now has an executable staging checker plus a runbook covering rollout status, same-origin `/api/status`, tenant-scoped `/api/jobs`, broker DLQ inspection, and optional agent fleet validation
  - Current live validation passes end to end: backend notebook tests, backend smoke test, frontend Jest, frontend production build, and the comprehensive HTTP suite
- Remaining work:
  - Validate broker-only worker execution under staging-style load while watching recovery and DLQ metrics
  - Deepen ML Studio, Review, and observability so those modules reach parity with the stronger workspaces
  - Add richer operator filters, progress details, and observability surfaces on top of the current runtime foundation
  - Connect deployments and experiment runs to real executors instead of simulated completion
  - Run the staging Terraform handoff against a real cluster and capture operator validation evidence end to end

---

90-DAY ROADMAP: Dataiku / Databricks-Level Nexora, migration-first

Days 0-30: Runtime foundation and migration command center
- Durable job backbone: move pipeline and platform execution from thread-based execution to claimable workers with retries and lease expiry.
- Migration command center: unify upload, parse, convert, compare, review, history, and project assignment into one end-to-end migration workflow.
- Secrets and connectors: harden connection credentials, connector testing, warehouse/lakehouse onboarding, and environment-scoped configs.
- Governance baseline: approvals, audit visibility, policy checks, and role-based project/workspace permissions.

Days 31-60: Data product operating system
- Notebook/runtime layer: notebook kernels, run history, package/environment profiles, and parameterized jobs.
- Orchestration parity: scheduled scenarios, dependency-aware pipeline execution, retries, backfills, notifications, and run timelines.
- Catalog and lineage depth: richer lineage graphs, data-quality suites, ownership, tags, SLAs, and search.
- Deployment adapters: replace simulated deployment completion with real executors for container, warehouse, and notebook/job targets.

Days 61-90: Enterprise platform parity layer
- ML lifecycle parity: experiment tracking, model registry/versioning, serving endpoints, evaluation dashboards, and rollback paths.
- Observability and FinOps: tenant usage, quotas, cost tracing, job telemetry, alerting, and service-level dashboards.
- Control-plane admin: tenant administration, plans, billing hooks, support tools, and compliance exports.
- Data-plane packaging: isolated worker pools, customer-VPC execution, secure agent auth, and cloud deployment reference stacks.

Migration blockbuster positioning
- Primary wedge: legacy estate intake, semantic conversion, side-by-side validation, review workflows, and governed promotion into projects, pipelines, notebooks, and ML.
- Product principle: Nexora should not chase generic parity first; it should win the migration program, then expand into the full operating platform around that workflow.

Definition of success for this roadmap
- A customer can ingest a legacy analytics estate, convert and validate it, organize it into governed projects and catalog assets, run it on remote workers, and deploy to real targets from one platform.

---

Immediate next actions (today)
1. Validate broker-only worker execution with recovery and DLQ telemetry in a staging-style environment
2. Deepen ML Studio, Review, and observability surfaces to close the current product-depth gap
3. Use the staging Terraform handoff path to validate the Helm and Terraform deployment flow in a target cluster environment and replace simulated executors where needed

Broker execution safety checklist
- Recovery metrics present and stable: `nexora_broker_recovery_total` and `nexora_broker_recovery_failed_total`
- DLQ inspection available through `/status/broker/dlq` and `nexora_broker_dlq_total`
- TTL expiry validated in both agent-poll and maintenance recovery paths
- Broker-only poll endpoints verified idle when the queue is empty; no DB hot-path claim scans remain

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

The next implementation slice should focus on broker-backed execution, ML and review depth, real executor integration, and cluster-level validation of the deployment path.
