# Nexora – Part 9: Shadow Execution, HITL, APIs & DB

## Shadow Execution
- Mirror production inputs to legacy and new pipelines
- Compare outputs (byte/metric-level)
- Non-intrusive (read-only taps, queue mirroring)

## HITL Debugging
- Confidence score per conversion
- If < threshold → manual review workflow
- Diff view + suggested fixes + approve/reject

## API Contracts (examples)
- POST /jobs (idempotency-key)
- GET /jobs/{id}
- POST /convert
- POST /validate
- POST /deploy
- GET /lineage/{asset}

### Shadow Execution / HITL endpoints (MVP)
- POST /shadow — create a shadow execution. Body: {"input": "...", "input_type": "code", "threshold": 0.85}
- GET /shadow — list shadow runs (optional query `?status=manual_review`)
- GET /shadow/{id} — fetch shadow run details (input, legacy_output, converted_output, comparison)
- POST /shadow/{id}/review — record manual review. Body: {"reviewer": "user@org", "action": "approve|reject|needs-fix", "comment": "..."}

### Idempotency
- Header: Idempotency-Key
- Server stores key → prevents duplicate execution/billing

## Database Schema (core)
- users(id, email, role, tenant_id)
- tenants(id, plan, quota)
- files(id, tenant_id, path, version)
- jobs(id, tenant_id, status, type, created_at)
- conversions(id, job_id, input, output, confidence)
- validations(id, job_id, row_match, agg_diff, score)
- pipelines(id, job_id, nodes_json, edges_json)
- actions(id, user_id, job_id, action, ts)

### Shadow runs table (new)
- shadow_runs(id, tenant_id, input_type, input_blob, legacy_output, converted_output, comparison_json, confidence, status, created_at, reviewed_at, reviewer_id, review_action, review_comment)

Notes:
- `confidence` is a heuristic (adapter confidence or similarity ratio).
- `status` values: `queued`, `auto_approved`, `manual_review`, `reviewed_approved`, `reviewed_rejected`, `reviewed_needs_fix`.
