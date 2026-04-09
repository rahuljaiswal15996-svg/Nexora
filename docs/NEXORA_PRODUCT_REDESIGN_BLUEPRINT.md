# Nexora Product Redesign Blueprint

Date: 2026-04-06

## Product Thesis

Nexora should stop behaving like a backend-led demo shell and start behaving like a product operating system for data modernization.

The target product model is:

- Dataiku-style workflow-first orchestration for data assets, recipes, and production flows.
- Databricks-style notebook and compute-first execution for exploratory, engineering, and ML work.
- Nexora-specific differentiation through migration intake, conversion validation, shadow execution, and human review.

The current problem is not backend weakness. The problem is that the UI is organized around routes and feature buckets instead of around user work.

## Design Principles

1. Projects are the organizing context.
2. Workflows are the primary experience, not APIs.
3. Notebooks are first-class, not a side utility.
4. Runtime and governance are cross-cutting operator surfaces, not mixed into project workspaces.
5. Migration is not a one-off tool. It is the entry path into the broader platform.

## Final Product Model

Nexora should split into two layers.

### Global Layer

- Home / Programs
- Runtime Operations
- Governance Desk
- Connections Hub

### Project Layer

- Migration Studio
- Flow Builder
- Notebook Workspace
- Data Catalog + Lineage
- ML Studio

This gives Nexora a clear separation between project work and platform operations.

## Final Architecture Diagram

```text
NEXORA PRODUCT PLATFORM

GLOBAL SHELL
├── Home / Programs
│   ├── Portfolio overview
│   ├── Project switcher
│   └── Cross-project activity
├── Runtime Operations
│   ├── Jobs queue
│   ├── Agent fleet
│   ├── Pipeline runs
│   └── Deployment queue
├── Governance Desk
│   ├── Policies
│   ├── Review + approvals
│   ├── Audit trail
│   └── FinOps
└── Connections Hub
    ├── Data sources
    ├── Compute targets
    ├── Deployment targets
    └── Credential health

PROJECT SHELL
├── Migration Studio
│   ├── Intake assets
│   ├── Parse + source flow
│   ├── Convert + compare
│   ├── Shadow execution
│   └── HITL approval
├── Flow Builder
│   ├── Dataset nodes
│   ├── Transform recipes
│   ├── Pipeline canvas
│   ├── Schedule + retry plan
│   └── Promotion handoff
├── Notebook Workspace
│   ├── Notebook editor
│   ├── Compute/runtime profiles
│   ├── Data browser
│   ├── Parameterized notebook jobs
│   └── Promote to flow / ML
├── Data Catalog + Lineage
│   ├── Search + asset detail
│   ├── Source/target lineage
│   ├── Quality gates
│   └── Ownership + provenance
└── ML Studio
    ├── Feature inputs
    ├── Experiment runs
    ├── Evaluation
    ├── Model registry
    └── Serving handoff

CROSS-CUTTING BACKEND
├── conversion_engine
├── parser + pipeline_blueprint + migration_program
├── pipeline_runner + platform_jobs
├── notebook
├── catalog
├── ml_lifecycle
├── deployer
├── governance + finops + collaboration
└── agent + metrics + status
```

## Redesigned Product Surfaces

### 1. Migration Studio

Purpose:

- The primary entry point for legacy modernization.
- Accepts SAS, COBOL, SQL, scripts, or notebook code.
- Auto-generates source flow, converted flow, comparison, and bootstrap assets.

UI:

- Left rail: project assets and migration batches.
- Center canvas: source flow and converted flow side-by-side.
- Bottom panels: diff, semantic comparison, validation score, shadow execution output.
- Right rail: promotion actions, quality gate, review state, target runtime recommendation.

Backend:

- `/parse`
- `/convert`
- `/validate`
- `/shadow`
- `/history`
- Services: `parser`, `conversion_engine`, `comparison`, `pipeline_blueprint`, `migration_program`, `history`

This replaces the current split between `/upload`, `/compare`, and part of `/review`.

### 2. Flow Builder

Purpose:

- The system-of-record for production data workflows.
- Converts migration output into maintainable orchestration.

UI:

- Dataiku-style flow canvas.
- Left inventory: datasets, notebooks, reusable transforms, models.
- Center canvas: nodes and dependencies.
- Right inspector: runtime, schedule, retries, compute target, deployment policy.
- Run timeline panel for historical executions.

Backend:

- `/pipelines`
- `/pipelines/{id}`
- `/pipelines/{id}/runs`
- `/scenarios`
- `/deploy`
- `/optimization`
- Services: `pipeline_runner`, `platform_jobs`, `deployer`, `pipeline_optimizer`, `scenario_service`

This should absorb the strongest pieces of the current `/pipelines` and `/operations` pages.

### 3. Notebook Workspace

Purpose:

- Databricks-style exploration, engineering, and parameterized notebook jobs.
- Bridge between interactive work and production pipelines.

UI:

- Left rail: datasets, notebooks, experiments, saved outputs.
- Center: multi-tab notebook editor with cells, results, and version snapshots.
- Right rail: runtime profile, parameters, job schedule, linked pipeline/model.
- Toolbar: Run now, schedule, promote to pipeline node, track as experiment.

Backend:

- `/notebooks`
- `/notebooks/{id}`
- `/notebooks/{id}/cells/*`
- `/connections/*` for data access
- `/ml/*` for experiment linkage
- Services: `notebook`, `cloud_connections`, `ml_lifecycle`

This should be promoted from a thin page to a core workspace.

### 4. Data Catalog + Lineage

Purpose:

- The truth layer for data assets, lineage, quality, and migration provenance.

UI:

- Search bar + filters across datasets, pipelines, notebooks, and models.
- Asset page with schema, owners, quality checks, and freshness.
- Lineage graph with source -> transform -> target path.
- Provenance panel showing which migration batch or notebook created the asset.

Backend:

- `/catalog/datasets`
- `/catalog/datasets/{id}`
- `/catalog/datasets/{id}/lineage`
- `/catalog/datasets/{id}/quality`
- Services: `catalog`, `platform_jobs`

This must become deeper than the current catalog listing page because the backend model is already richer.

### 5. ML Studio

Purpose:

- The project surface for features, experiments, evaluation, model versioning, and serving handoff.

UI:

- Experiment board.
- Run comparison table.
- Evaluation charts and metrics.
- Model registry timeline.
- Serving endpoints and deployment readiness.

Backend:

- `/ml/experiments`
- `/ml/experiments/{id}/runs`
- `/ml/model-serving`
- Services: `ml_lifecycle`, `platform_jobs`

### 6. Runtime Operations

Purpose:

- The operator surface for everything asynchronous and operational.

UI:

- Jobs tab: queue, state filters, retry/cancel, lease status.
- Agents tab: agent id, heartbeat, claimed work, worker pools, health.
- Pipeline Runs tab: run graph, stage status, backfill, rerun.
- Deployments tab: pending promotion, rollout state, failures.
- Incidents tab: failed jobs, blocked approvals, broken targets.

Backend:

- `/jobs`
- `/agent/*`
- `/pipelines/runs/{id}`
- `/deployments`
- `/status`
- `/metrics`
- Services: `platform_jobs`, `pipeline_runner`, `agent`, `status`, `metrics`, `deployer`

This is where the current backend is far ahead of the UI.

### 7. Governance Desk

Purpose:

- The control layer for policy, cost, reviews, audit, and exception handling.

UI:

- Policies tab.
- Approvals tab.
- Review queue tab.
- Audit explorer tab.
- FinOps tab.

Backend:

- `/governance/*`
- `/finops/*`
- `/collaboration/*`
- `/shadow/{id}/review` for migration approval context
- Services: `governance`, `finops`, `collaboration`, `shadow`

This replaces the current overloaded `/governance` page.

### 8. Connections Hub

Purpose:

- Manage sources, destinations, compute backends, deployment targets, and connectivity trust.

UI:

- Sources tab: databases, storage, warehouses.
- Targets tab: deployment targets, serving endpoints, runtime clusters.
- Discovery tab: browse datasets and schemas from connections.
- Health tab: connection tests, credential expiry, access issues.

Backend:

- `/connections`
- `/connections/{id}/datasets`
- `/deploy/targets`
- Services: `cloud_connections`, `deployer`

## Target User Journey

The target journey should feel like Dataiku workflow progression with Databricks notebook depth.

### Core Journey

```text
Connect Source
  -> Intake Asset
  -> Parse Source Logic
  -> Generate Source Flow
  -> Convert Code
  -> Compare + Validate
  -> Shadow Execute
  -> Human Approval
  -> Register Source/Target Assets in Catalog
  -> Open in Flow Builder or Notebook Workspace
  -> Add Runtime Plan
  -> Train / Evaluate Model if needed
  -> Queue Deployment
  -> Monitor Jobs / Agents / Runs
  -> Audit + Cost + Review in Governance Desk
```

### Screen-by-Screen Journey

1. Connections Hub
   - User selects source system and validates connectivity.

2. Migration Studio / Intake
   - User uploads SAS/COBOL/SQL assets.
   - System detects source language and structure.

3. Migration Studio / Source Flow
   - System shows current legacy execution graph.

4. Migration Studio / Conversion Review
   - User reviews converted code, diff, comparison metrics, and confidence.

5. Migration Studio / Shadow + Approval
   - Shadow execution and HITL review happen here.
   - Low-confidence assets route to review queue.

6. Catalog + Lineage
   - Source and target datasets are registered.
   - User inspects lineage and data quality.

7. Flow Builder or Notebook Workspace
   - If production path: open Flow Builder.
   - If exploratory or engineering path: open Notebook Workspace.

8. ML Studio
   - Optional branch if model work is needed.

9. Runtime Operations
   - Queue execution, watch agents, monitor deployment and jobs.

10. Governance Desk
   - Final approval, audit, quota, and cost visibility.

## How To Fix The Current Overloaded Pages

### Break `/platform`

Current issue:

- It tries to be a hub, dashboard, and cross-domain monitor at the same time.

New structure:

- `/home` or `/programs` for portfolio summary only.
- `/runtime` for jobs, agents, and deployments.
- `/projects` for project portfolio only.

Rule:

- Keep `/platform` only if it becomes a thin landing page. Do not let it carry real operational workflows.

### Break `/operations`

Current issue:

- Scenario creation, deployment targets, comparisons, and deployment queue are mixed.

New structure:

- `/flows/scenarios`
- `/connections/targets`
- `/runtime/deployments`

Rule:

- Scenario authoring belongs to Flow Builder.
- Targets belong to Connections Hub.
- Deployment state belongs to Runtime Operations.

### Break `/governance`

Current issue:

- Policies, quotas, costs, comments, reviews, and audit logs compete on one screen.

New structure:

- `/governance/policies`
- `/governance/reviews`
- `/governance/audit`
- `/governance/finops`

Rule:

- Governance is one domain, but it still needs sub-surfaces.

## Notebook-First Strategy

Notebook should be elevated from utility to primary product surface.

### Required Behaviors

1. Every dataset can be opened in a notebook.
2. Every notebook can be promoted into a flow step.
3. Every notebook can be parameterized and scheduled as a job.
4. Every notebook run can be attached to an experiment.
5. Every notebook has runtime, dependency, and compute profile metadata.

### UX Model

- Left panel: catalog browser, connections, notebooks, experiments.
- Center: notebook tabs with cell execution.
- Right panel: runtime profile, linked datasets, linked pipelines, linked experiments.

### Backend Alignment

- `notebook` service becomes the center.
- `pipeline_runner` consumes notebooks as executable pipeline nodes.
- `ml_lifecycle` tracks experiment runs launched from notebooks.
- `cloud_connections` powers dataset exploration inside notebooks.

## Operator UI Design

Runtime Operations should be a true operator console.

### Jobs UI

- Queue filters by type, status, project, tenant, runtime.
- Retry, cancel, inspect payload, inspect result.
- Show job lineage to pipeline, dataset, or deployment.

### Agents UI

- Agent id
- heartbeat timestamp
- lease expiry
- current claimed job or run
- capacity / worker pool
- runtime version

### Pipeline Runs UI

- Gantt-style run timeline
- node-by-node status
- duration and retry count
- backfill and rerun actions

### Deployment Queue UI

- pending approvals
- environment matrix
- rollout status
- rollback actions
- target platform health

## Frontend to Backend Alignment Map

### Migration Studio

- Frontend: Migration Studio workspace
- Backend: `upload.py`, `parse.py`, `validate.py`, `shadow.py`, `history.py`
- Services: `conversion_engine`, `parser`, `comparison`, `pipeline_blueprint`, `migration_program`, `shadow`

### Flow Builder

- Frontend: Flow canvas, scenario editor, run planner
- Backend: `pipelines.py`, `optimization.py`, `scenarios.py`, `deploy.py`
- Services: `pipeline_runner`, `pipeline_optimizer`, `platform_jobs`, `deployer`

### Notebook Workspace

- Frontend: Notebook editor, runtime panel, dataset browser
- Backend: `notebook.py`, `connections.py`, `ml.py`
- Services: `notebook`, `cloud_connections`, `ml_lifecycle`

### Data Catalog + Lineage

- Frontend: Catalog search, asset profile, lineage graph
- Backend: `catalog.py`
- Services: `catalog`, `platform_jobs`

### ML Studio

- Frontend: experiments, registry, serving
- Backend: `ml.py`
- Services: `ml_lifecycle`, `platform_jobs`

### Runtime Operations

- Frontend: Jobs, Agents, Runs, Deployments
- Backend: `agent.py`, `status.py`, `metrics.py`, `pipelines.py`, `deploy.py`
- Services: `platform_jobs`, `pipeline_runner`, `deployer`, `agent`

### Governance Desk

- Frontend: policies, approvals, audit, finops
- Backend: `governance.py`, `finops.py`, `collaboration.py`
- Services: `governance`, `finops`, `collaboration`

### Connections Hub

- Frontend: source/target registry, discovery, health
- Backend: `connections.py`, `deploy.py`
- Services: `cloud_connections`, `deployer`

## Final Menu and Navigation

### Global Sidebar

```text
Home / Programs
Migration Studio
Flow Builder
Notebook Workspace
Catalog + Lineage
ML Studio
Runtime Operations
Governance Desk
Connections Hub
```

### Project Header

```text
Project Switcher | Global Search | Notifications | Environment | User Role
```

### In-Project Secondary Nav

```text
Overview | Assets | Runs | Reviews | Settings
```

## Route Hierarchy Recommendation

```text
/home
/projects
/project/[projectId]/migration
/project/[projectId]/flows
/project/[projectId]/notebooks
/project/[projectId]/catalog
/project/[projectId]/ml
/runtime/jobs
/runtime/agents
/runtime/pipeline-runs
/runtime/deployments
/governance/policies
/governance/reviews
/governance/audit
/governance/finops
/connections/sources
/connections/targets
/connections/discovery
```

## What Changes Immediately

1. Upload and compare stop feeling like separate features and become Migration Studio.
2. Pipelines stop being JSON-first and become Flow Builder.
3. Notebooks stop being secondary and become a compute-first workspace.
4. Catalog becomes the truth layer for lineage and quality, not just a list.
5. Operations becomes Runtime Operations instead of a mixed scenario/deploy screen.
6. Governance becomes a proper desk with sub-surfaces.
7. Backend modules gain clear UI homes, removing orphan or underexposed services.

## Final Product Outcome

This redesign turns Nexora from:

- backend-heavy
- route-driven
- operationally fragmented

into:

- project and workflow driven
- notebook and compute aware
- migration differentiated
- operationally coherent

The result is not just better IA. It is a product model where the frontend finally expresses the actual strength of the backend.