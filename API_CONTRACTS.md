# Nexora API Contracts (v1) — Implementable References

Common headers
- `X-Tenant-ID`: Tenant identifier (string). If missing, backend defaults to `default` (dev only).
- `X-Idempotency-Key`: Optional idempotency key for long-running operations (e.g., /convert).
- Auth: production should use `Authorization: Bearer <JWT>` with tenant claim.

Base path: `/api` (Next.js proxies `/api/*` to backend in development)

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
- Response: `{ status: "ok", pipeline_id: "<uuid>" }`

6) POST /api/pipelines/{pipeline_id}/runs
- Headers: `X-Tenant-ID`, optional `X-Idempotency-Key`
- Body: `{ run_config: { ... } }`
- Response: `{ status: "queued", run_id: "<uuid>" }`

7) GET /api/pipelines/runs/{run_id}
- Returns run status and timestamps.

8) GET /metrics
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

Async job notes
- Current implementation uses local background workers for development and scaffolding.
- Job statuses move through `queued -> running -> success|failed`.
- Resource records continue to be the source of truth once the job completes:
  - quality checks: `GET /api/catalog/datasets/{dataset_id}/quality`
  - deployments: `GET /api/deployments/{deployment_id}`
  - experiment runs: `GET /api/ml/experiments/{experiment_id}/runs`

