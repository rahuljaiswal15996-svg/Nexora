# Nexora API Contracts (v1) — Implementable References

Common headers
- `X-Tenant-ID`: Tenant identifier (string). If missing, backend defaults to `default` (dev only).
- `X-Idempotency-Key`: Optional idempotency key for long-running operations (e.g., /convert).
- Auth: production should use `Authorization: Bearer <JWT>` with tenant claim.

Base path: browser clients use `/api` on the Next.js app, and `frontend/pages/api/[...path].js` forwards those same-origin requests to the backend in both development and production. Server-side frontend code may use `INTERNAL_API_BASE_URL` directly.

---

1) POST /api/parse
- Headers: `X-Tenant-ID`, `X-Idempotency-Key` (optional)
- Body: multipart/form-data `{ file: <code> }`
- 202 / 200 response:
```json
{ "status": "ok", "uir_id": "<uuid>", "created_at": "<iso>" }
```
- Purpose: parse source code into `UIR` and persist.

2) POST /api/convert
- Headers: `X-Tenant-ID`, `X-Idempotency-Key` (optional)
- Body: multipart/form-data `{ file: <code> }`
- Response (200):
```json
{
  "original": "...",
  "converted": "...",
  "comparison": {
    "changed": true,
    "original_length": 123,
    "converted_length": 110,
    "similarity_ratio": 0.82,
    "diff": ["@@ ..."],
    "diff_count": 12
  },
  "meta": { "engine_version": "v0.1-rule-first", "request_id": null }
}
```
- Idempotency: if `X-Idempotency-Key` is provided and an earlier request with same key succeeded, server returns cached `result_json`.

3) GET /api/history
- Headers: `X-Tenant-ID`
- Query: `?limit=50`
- Response: list of history entries persisted in DB.

4) DELETE /api/history
- Clears history for the calling tenant (dev only — production requires RBAC confirmation).

5) POST /api/pipelines
- Headers: `X-Tenant-ID`
- Body: JSON `{ name: "...", dag: { nodes: [...], edges: [...] } }`
- Response:
```json
{
  "status": "ok",
  "pipeline_id": "<uuid>",
  "created_at": "<iso>",
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "node_results": [
      {
        "node_id": "transform_orders",
        "kind": "recipe",
        "label": "Transform Orders",
        "valid": true,
        "errors": [],
        "warnings": [],
        "execution_binding": {
          "engine_type": "transform",
          "runtime_profile": "warehouse-sql",
          "executor": "transform.sql",
          "target_ref": "orders_curated"
        }
      }
    ],
    "graph": {
      "entrypoint_node_ids": ["raw_orders"],
      "terminal_node_ids": ["deploy_api"],
      "topological_order": ["raw_orders", "transform_orders", "deploy_api"],
      "executable_node_ids": ["transform_orders", "deploy_api"]
    },
    "normalized_dag": {
      "nodes": [...],
      "edges": [...],
      "metadata": { "authoring_summary": { "node_count": 3, "edge_count": 2 } }
    }
  }
}
```

5a) PUT /api/pipelines/{pipeline_id}
- Headers: `X-Tenant-ID`
- Body: JSON `{ name: "...", dag: { nodes: [...], edges: [...] } }`
- Response: same validation envelope as `POST /api/pipelines`, plus the updated pipeline payload.

5b) GET /api/pipelines/node-catalog
- Headers: `X-Tenant-ID`
- Response:
```json
{
  "items": [
    {
      "kind": "dataset",
      "label": "Dataset",
      "description": "Register a source, managed, or published dataset and bind it to the execution graph.",
      "default_label": "Dataset Node",
      "config_schema": [
        {
          "name": "dataset_name",
          "label": "Dataset name",
          "type": "text",
          "required": true,
          "default": "dataset_name"
        }
      ],
      "execution_binding_template": {
        "engine_type": "dataset",
        "runtime_profile": "catalog",
        "executor": "dataset.sync"
      }
    }
  ]
}
```

5c) POST /api/pipelines/validate
- Headers: `X-Tenant-ID`
- Body: JSON `{ dag: { nodes: [...], edges: [...] } }`
- Response: the same `validation` object returned by create/update routes.
- Purpose: validate node config, detect graph issues, and map node config to execution bindings before save or run.

6) POST /api/pipelines/{pipeline_id}/runs
- Headers: `X-Tenant-ID`, optional `X-Idempotency-Key`
- Body: `{ run_config: { ... } }`
- Response:
```json
{
  "status": "queued",
  "run_id": "<uuid>",
  "created_at": "<iso>",
  "telemetry": {
    "run": "/pipelines/runs/<uuid>",
    "nodes": "/pipelines/runs/<uuid>/nodes",
    "logs": "/pipelines/runs/<uuid>/logs"
  }
}
```

7) GET /api/pipelines/runs/{run_id}
- Returns run status, timestamps, merged `run_metadata`, and `node_summary`.
- Response:
```json
{
  "id": "<run_id>",
  "pipeline_id": "<pipeline_id>",
  "tenant_id": "default",
  "status": "running",
  "execution_mode": "local",
  "run_metadata": {
    "active_node_id": "transform_orders",
    "retry_from_node": null,
    "failed_node_id": null
  },
  "node_summary": {
    "total": 6,
    "queued": 2,
    "running": 1,
    "success": 3,
    "failed": 0,
    "skipped": 0
  },
  "telemetry": {
    "run": "/pipelines/runs/<run_id>",
    "nodes": "/pipelines/runs/<run_id>/nodes",
    "logs": "/pipelines/runs/<run_id>/logs"
  }
}
```

7a) GET /api/pipelines/runs/{run_id}/nodes
- Headers: `X-Tenant-ID`
- Response:
```json
{
  "items": [
    {
      "id": "<node_execution_id>",
      "execution_unit_id": "<node_execution_id>",
      "run_id": "<run_id>",
      "pipeline_id": "<pipeline_id>",
      "node_id": "transform_orders",
      "node_label": "Transform Orders",
      "node_kind": "recipe",
      "stage_index": 1,
      "status": "running",
      "attempt_count": 1,
      "max_attempts": 3,
      "error_text": null,
      "started_at": "<iso>",
      "finished_at": null,
      "updated_at": "<iso>",
      "metadata": {
        "upstream_node_ids": ["raw_orders"],
        "downstream_node_ids": ["quality_gate"],
        "view_mode": "converted",
        "overlay_mode": "execution",
        "config": {
          "language": "sql",
          "output_dataset_name": "orders_curated"
        },
        "execution_binding": {
          "engine_type": "transform",
          "runtime_profile": "warehouse-sql",
          "executor": "transform.sql",
          "target_ref": "orders_curated"
        }
      }
    }
  ]
}
```

7b) GET /api/pipelines/runs/{run_id}/logs
- Headers: `X-Tenant-ID`
- Query: `node_id=<optional>&after_id=<cursor>&limit=<max 500>`
- Response:
```json
{
  "items": [
    {
      "id": 42,
      "cursor": 42,
      "run_id": "<run_id>",
      "node_execution_id": "<node_execution_id>",
      "node_id": "transform_orders",
      "level": "info",
      "stream": "stdout",
      "message": "Execution unit claimed for node Transform Orders.",
      "created_at": "<iso>",
      "metadata": {
        "node_kind": "recipe",
        "stage_index": 1
      }
    }
  ],
  "cursor": 42
}
```

Flow Builder realtime strategy
- Current implementation is polling-first: poll `GET /pipelines/runs/{run_id}` and `GET /pipelines/runs/{run_id}/nodes` on the same interval, then poll `GET /pipelines/runs/{run_id}/logs?node_id=...&after_id=...` only for the selected node.
- This keeps the backend surface simple while preserving stable cursor semantics for the inspector.
- Websocket upgrade path: keep the same payload shapes for run, node execution, and log entries, then deliver them as event frames instead of poll responses when a websocket surface is added.

8) Notebook Workspace Integration
- Architectural rule: notebook document CRUD stays under `/notebooks`, but notebook execution must compile into the same pipeline validation and run model used by Flow Builder. The existing `POST /api/notebooks/{notebook_id}/cells/{cell_id}/execute` path should be treated as a compatibility shim and retired once the execution endpoints below land.
- Existing document routes that remain valid:
  - `POST /api/notebooks`
  - `GET /api/notebooks`
  - `GET /api/notebooks/{notebook_id}`
  - `PUT /api/notebooks/{notebook_id}`

8a) POST /api/notebooks/open
- Headers: `X-Tenant-ID`
- Body:
```json
{
  "source": {
    "type": "dataset",
    "dataset_id": "orders_curated"
  }
}
```
- Response:
```json
{
  "notebook": {
    "id": "<notebook_id>",
    "title": "Orders Exploration",
    "cells": [...],
    "metadata": {
      "runtime_defaults": {
        "target": "local",
        "profile": "local"
      }
    }
  },
  "open_context": {
    "source_type": "dataset",
    "dataset_id": "orders_curated",
    "linked_dataset_ids": ["orders_curated"],
    "flow": {
      "pipeline_id": null,
      "node_id": null
    }
  },
  "flow_binding": null
}
```
- Purpose: unify the dataset, flow-node, and new-notebook entry points so Notebook Workspace can hydrate from one contract.

8b) POST /api/notebooks/{notebook_id}/flow-binding
- Headers: `X-Tenant-ID`
- Body:
```json
{
  "pipeline_id": "<pipeline_id>",
  "attach_mode": "existing_node",
  "node_id": "analysis_notebook",
  "label": "Orders Analysis",
  "position": { "x": 720, "y": 260 },
  "config": {
    "runtime_profile": "local",
    "entrypoint_cell": "cell_010",
    "parameters": {
      "sample_limit": 1000
    },
    "linked_dataset_ids": ["orders_curated"]
  }
}
```
- Response:
```json
{
  "status": "ok",
  "pipeline_id": "<pipeline_id>",
  "node_id": "analysis_notebook",
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "normalized_dag": {
      "nodes": [...],
      "edges": [...]
    }
  },
  "flow_binding": {
    "pipeline_id": "<pipeline_id>",
    "node_id": "analysis_notebook",
    "execution_binding": {
      "engine_type": "notebook_job",
      "runtime_profile": "local",
      "executor": "notebook.execute",
      "target_ref": "<notebook_id>"
    }
  }
}
```
- Purpose: attach a notebook asset to a flow node without inventing a second orchestration model.

8c) POST /api/notebooks/{notebook_id}/executions
- Headers: `X-Tenant-ID`, optional `X-Idempotency-Key`
- Body:
```json
{
  "mode": "selection",
  "cell_ids": ["cell_003", "cell_004"],
  "runtime": {
    "target": "local",
    "profile": "local",
    "cluster_id": null
  },
  "parameters": {
    "sample_limit": 1000
  },
  "linked_dataset_ids": ["orders_curated"],
  "flow_context": {
    "pipeline_id": "<pipeline_id>",
    "node_id": "analysis_notebook"
  }
}
```
- Response:
```json
{
  "status": "queued",
  "session_id": "<session_id>",
  "pipeline_id": "<transient_pipeline_id>",
  "run_id": "<run_id>",
  "execution_plan": {
    "mode": "selection",
    "execution_units": [
      {
        "unit_id": "cell_003",
        "cell_id": "cell_003",
        "language": "sql",
        "executor": "notebook.cell.sql",
        "runtime_profile": "local"
      },
      {
        "unit_id": "cell_004",
        "cell_id": "cell_004",
        "language": "python",
        "executor": "notebook.cell.python",
        "runtime_profile": "local"
      }
    ]
  },
  "telemetry": {
    "run": "/pipelines/runs/<run_id>",
    "nodes": "/pipelines/runs/<run_id>/nodes",
    "logs": "/pipelines/runs/<run_id>/logs"
  }
}
```
- Purpose: run a cell, a selection, or an entire notebook through the same pipeline execution engine used by Flow Builder.

8d) GET /api/notebooks/{notebook_id}/sessions/{session_id}
- Headers: `X-Tenant-ID`
- Response:
```json
{
  "session_id": "<session_id>",
  "notebook_id": "<notebook_id>",
  "run_id": "<run_id>",
  "status": "running",
  "runtime": {
    "target": "local",
    "profile": "local",
    "cluster_id": null
  },
  "resource_usage": {
    "wall_time_ms": 842,
    "cpu_ms": 401,
    "memory_mb_peak": 196
  },
  "active_cell_ids": ["cell_004"],
  "completed_cell_ids": ["cell_003"],
  "telemetry": {
    "run": "/pipelines/runs/<run_id>",
    "nodes": "/pipelines/runs/<run_id>/nodes",
    "logs": "/pipelines/runs/<run_id>/logs"
  }
}
```
- Purpose: expose notebook-specific runtime posture while still reusing the canonical pipeline telemetry endpoints.

Notebook execution telemetry
- Notebook workspace should continue polling the same pipeline run telemetry used by Flow Builder:
  - `GET /pipelines/runs/{run_id}`
  - `GET /pipelines/runs/{run_id}/nodes`
  - `GET /pipelines/runs/{run_id}/logs?node_id=...&after_id=...`
- Cell outputs map from `pipeline_run_nodes.metadata` and `pipeline_run_logs` back to notebook cell ids; no second log or status channel should be introduced.

9) GET /metrics
- Prometheus-compatible metrics endpoint.

9) POST /api/auth/token
- Dev-only token issuance endpoint for local development
- Body: `{ "tenant_id": "default", "user": "dev@local", "role": "admin", "exp_seconds": 86400 }`
- Response: `{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 86400 }`

Usage notes:
- In development you can call `/api/auth/token` to obtain a JWT. Pass it as `Authorization: Bearer <token>` to test tenant-scoped requests.
- In production, use OIDC/SAML and validate tokens against provider JWKS instead of this dev endpoint.

---

Idempotency details (server behavior)
- The server stores the `request_id` -> `conversion_id` mapping in `conversions` table and saves `result_json`.
- If a request arrives with an `X-Idempotency-Key` that has a successful result, the server returns that result immediately.
- TTL/expiry: production must expunge idempotency records after a configured TTL to bound storage costs.

---

Notes
- All mutating endpoints MUST be tenant-scoped either via `X-Tenant-ID` header or via tenant claim in `Authorization` JWT.
- For production, require proper authentication and enforce tenant access control checks in middleware.

---

Enterprise control-plane extensions

Additional headers used by the current development flow
- `X-User-ID`: optional explicit dev user identity.
- `X-User-Role`: optional explicit dev role (`viewer`, `editor`, `admin`).

10) GET /api/projects
- Headers: `X-Tenant-ID`, `Authorization` or dev role headers.
- Response: `{ "items": [ { "id": "...", "name": "...", "members": [...], "workspaces": [...] } ] }`

11) POST /api/projects
- Body: `{ "name": "Migration Factory", "description": "...", "metadata": { ... } }`
- Role: `editor` or above.
- Response: project object with auto-created default workspace.

12) POST /api/projects/{project_id}/members
- Body: `{ "user_id": "analyst@tenant", "role": "viewer" }`
- Role: `admin`.

13) GET /api/catalog/datasets
- Query: `q`, `project_id`
- Response: `{ "items": [dataset...] }`

14) POST /api/catalog/datasets
- Body:
```json
{
  "name": "orders_curated",
  "source_path": "s3://tenant/orders/curated.parquet",
  "project_id": "<optional>",
  "connection_id": "<optional>",
  "schema": [{ "name": "order_id", "type": "string" }],
  "metadata": { "owner": "data-eng" },
  "tags": ["gold", "finance"]
}
```
- Role: `editor` or above.

15) POST /api/catalog/datasets/{dataset_id}/quality-checks
- Body: `{ "check_name": "row_count", "status": "passed", "metrics": { "row_count": 18231 } }`
- Role: `editor` or above.
- Response: queued job envelope:
```json
{
  "status": "queued",
  "job": { "id": "<job_id>", "job_type": "quality_check", "status": "queued" },
  "quality_check": { "id": "<quality_check_id>", "status": "queued" }
}
```

16) GET /api/connections/{connection_id}/datasets
- Existing connection browsing surface used for Dataiku-style dataset discovery.

17) GET /api/connections/{connection_id}/datasets/{dataset_name}/preview
- Existing preview endpoint returning tabular sample rows and column metadata.

18) GET /api/scenarios
- Query: `project_id` optional.
- Response: `{ "items": [scenario...] }`

19) POST /api/scenarios/{scenario_id}/versions
- Body: `{ "version": "v2", "uir_id": "...", "converted_code": "...", "metadata": { ... } }`
- Role: `editor` or above.

20) POST /api/scenarios/compare
- Body: `{ "version_a": "<scenario_version_id>", "version_b": "<scenario_version_id>" }`
- Response: comparison object with diff payload and similarity score.

21) GET /api/deploy/targets
- Lists deploy targets registered for the tenant.

22) POST /api/deploy/targets
- Body: `{ "name": "Databricks Prod", "platform_type": "databricks", "endpoint_config": { ... } }`
- Role: `admin`.

23) POST /api/deploy
- Body:
```json
{
  "pipeline_id": "<uuid>",
  "target_platform": "container|spark|databricks|dbt",
  "target_id": "<optional deployment target>",
  "target_config": { "cluster": "jobs-prod" },
  "estimated_cost": 42.5,
  "notes": "promote scenario v2"
}
```
- Role: `admin`.
- Response: queued deployment plus job envelope. Final state is retrieved through `GET /api/deployments/{deployment_id}` or `GET /api/jobs/{job_id}`.

24) GET /api/governance/audit-log
- Query: `resource_type` optional.
- Response: tenant audit records for platform mutations.

25) POST /api/governance/policies
- Body: `{ "name": "EU residency", "rule": { ... }, "enforcement": "advisory|enforced" }`
- Role: `admin`.

26) GET /api/finops/quotas
- Role: `viewer` or above.

27) POST /api/finops/quotas
- Body: `{ "resource_type": "deployments", "limit_value": 25, "unit": "runs/month" }`
- Role: `admin`.

28) GET /api/finops/costs
- Query: `period` optional.
- Role: `admin`.

29) POST /api/collaboration/comments
- Body: `{ "resource_type": "dataset", "resource_id": "<uuid>", "text": "Need lineage before release" }`
- Role: `editor` or above.

30) POST /api/collaboration/reviews
- Body: `{ "resource_type": "scenario", "resource_id": "<uuid>", "assigned_to": "lead@tenant", "comments": ["validate target SQL"] }`
- Role: `editor` or above.

31) GET /api/ml/experiments
- Query: `project_id` optional.
- Response: experiment list.

32) POST /api/ml/experiments/{experiment_id}/runs
- Body: `{ "status": "completed", "metrics": { "rmse": 0.14 }, "artifacts": { "model": "s3://..." } }`
- Role: `editor` or above.
- Response: queued job envelope with the created experiment run.

33) POST /api/ml/model-serving
- Body: `{ "model_version_id": "<uuid>", "endpoint_url": "https://...", "status": "active", "metadata": { ... } }`
- Role: `editor` or above.

34) GET /api/jobs
- Query: `status`, `job_type` optional.
- Response: `{ "items": [job...] }`
- Purpose: list tenant-scoped asynchronous control-plane jobs.

35) GET /api/jobs/{job_id}
- Response: job object with `payload` and `result` blobs.
- Purpose: poll deployments, dataset quality checks, and experiment runs until terminal state.

36) POST /api/jobs/{job_id}/cancel
- Role: `editor` or above.
- Response:
```json
{
  "status": "ok",
  "job": {
    "id": "<job_id>",
    "status": "cancelled",
    "resource_type": "deployment",
    "resource_id": "<deployment_id>",
    "result": {
      "deployment_id": "<deployment_id>",
      "cancelled_at": "<iso>"
    }
  }
}
```
- Purpose: cancel queued or running control-plane work from Runtime Ops.
- Notes: cancelling a deployment, quality check, or experiment run also updates the linked resource record to a cancelled state.

37) POST /api/jobs/{job_id}/retry
- Role: `editor` or above.
- Response: `{"status": "ok", ...queued_job_envelope }`
- Purpose: requeue a terminal job from Runtime Ops.
- Notes: deployment retries create a fresh deployment record plus a new job envelope; rollback jobs requeue against the same deployment record.

38) POST /api/deployments/{deployment_id}/rollback
- Role: `admin`.
- Body: `{ "run_mode": "local|remote" }` with `local` as the default.
- Response:
```json
{
  "status": "queued_remote",
  "tenant_id": "default",
  "job": {
    "id": "<job_id>",
    "job_type": "deployment_rollback",
    "resource_id": "<deployment_id>"
  },
  "deployment": {
    "id": "<deployment_id>",
    "status": "rollback_queued"
  }
}
```
- Purpose: queue a deployment rollback from Runtime Ops while preserving deployment run history.

Async job notes
- Current implementation uses local background workers for development and scaffolding.
- Job statuses move through `queued -> running -> success|failed|cancelled`.
- Resource records continue to be the source of truth once the job completes:
  - quality checks: `GET /api/catalog/datasets/{dataset_id}/quality`
  - deployments: `GET /api/deployments/{deployment_id}`
  - experiment runs: `GET /api/ml/experiments/{experiment_id}/runs`
- Deployment resources can also move through `rollback_queued -> rolling_back -> rolled_back|failed` while the underlying rollback work is tracked as a `deployment_rollback` job.

