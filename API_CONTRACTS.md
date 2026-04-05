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

