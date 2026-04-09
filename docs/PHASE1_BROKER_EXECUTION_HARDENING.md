# Phase 1: Broker-Based Execution Hardening

Date: 2026-04-08

## Goal

Move Nexora from hybrid database polling toward broker-first remote execution without breaking the current lease, heartbeat, retry, and recovery semantics already implemented in the control plane.

Redis is the Phase 1 broker target because it is already wired into:

- `backend/app/services/work_broker.py`
- `docker/docker-compose.dev.yml`
- `helm/nexora/values.yaml`
- `backend/requirements.txt`

Kafka remains a valid future option, but introducing it now would add operational and code-surface churn before the current Redis path is fully hardened.

## Architectural stance

- The broker delivers work references, not authoritative state.
- PostgreSQL remains the source of truth for:
  - run and job state
  - claim ownership
  - lease expiration
  - heartbeat timestamps
  - retry counters
  - final result metadata
- Agents must still claim the referenced run or job through the control plane before execution begins.
- Broker maintenance remains responsible for re-enqueueing unclaimed or expired work.

This keeps Nexora aligned with the architecture already implemented instead of redesigning the runtime around broker-only state.

## Text architecture diagram

```text
CONTROL PLANE
├── FastAPI API surface
│   ├── /pipelines/{id}/runs?run_mode=remote
│   ├── /deploy?run_mode=remote
│   ├── /agent/runs/claim
│   ├── /agent/platform-jobs/claim
│   ├── /agent/heartbeat
│   ├── /agent/platform-jobs/heartbeat
│   ├── /agent/report
│   └── /agent/platform-jobs/report
├── PostgreSQL
│   ├── pipeline_runs
│   ├── pipeline_run_nodes
│   ├── pipeline_run_logs
│   └── platform_jobs
└── Broker maintenance loop
    ├── requeue_remote_runs()
    └── requeue_remote_jobs()

BROKER LAYER
└── Redis queues
    ├── nexora:work:pipeline-runs
    └── nexora:work:platform-jobs

AGENT LAYER
├── Broker consumer
│   ├── blocking consume from Redis
│   └── receives run_id/job_id references
├── Control-plane claim
│   ├── verifies claimability
│   ├── increments attempt_count
│   └── starts lease timer
├── Execution loop
│   ├── pipeline node execution
│   └── platform job execution
└── Telemetry loop
    ├── heartbeat renewals
    ├── node log streaming
    └── final status reporting
```

## Current state in code

Already implemented:

- Broker abstraction with Redis and in-memory adapters in `backend/app/services/work_broker.py`
- Remote run enqueue in `backend/app/services/pipeline_runner.py`
- Remote platform-job enqueue in `backend/app/services/platform_jobs.py`
- Agent broker consumer in `agent/agent.py`
- Control-plane claim, heartbeat, and result APIs in `backend/app/routes/agent.py`
- Re-enqueue maintenance loop in `backend/app/services/work_maintenance.py`

Still hybrid:

- The legacy HTTP poll endpoints in `backend/app/routes/agent.py` still fall back to database claim scans through:
  - `claim_next_remote_run()`
  - `claim_next_job()`
- That fallback is useful for recovery, but it means the hot path is not yet purely broker-driven.

## Phase 1 target state

### Target behavior

1. Remote work is published to Redis.
2. Agents consume only broker messages on the hot path.
3. Agents claim work via API before executing it.
4. Lease expiry or lost work is recovered by the maintenance loop, which republishes references to Redis.
5. Database fallback claim scans are removed from the hot path after rollout validation.

### Rollout model

Phase 1 should not be a flag day. Use a feature-gated cutover:

- `NEXORA_BROKER_DB_FALLBACK_ENABLED=1`
  - Current compatible behavior
  - Broker-first attempt, DB claim fallback still available
- `NEXORA_BROKER_DB_FALLBACK_ENABLED=0`
  - Broker-only hot path
  - Recovery happens through maintenance re-enqueue instead of poll-time DB scans

## Concrete file changes

### Core broker path

- `backend/app/services/work_broker.py`
  - Add a helper for broker-first rollout flags.
  - Keep broker selection centralized here.

- `backend/app/services/pipeline_runner.py`
  - Keep remote runs as DB source-of-truth records.
  - Continue publishing only references to Redis.
  - Later Phase 1 slice: remove hot-path dependence on `claim_next_remote_run()` from runtime-facing flows.

- `backend/app/services/platform_jobs.py`
  - Keep platform jobs as DB source-of-truth records.
  - Continue publishing references to Redis.
  - Later Phase 1 slice: remove hot-path dependence on `claim_next_job()` from runtime-facing flows.

### Agent control-plane API

- `backend/app/routes/agent.py`
  - Gate DB fallback behind `NEXORA_BROKER_DB_FALLBACK_ENABLED`.
  - Re-publish broker messages when a legacy poll request cannot consume them because of tenant mismatch.
  - Keep explicit claim endpoints as the lease boundary.

### Worker process

- `agent/agent.py`
  - Keep `broker` mode as the preferred path.
  - In a later Phase 1 slice, drop `legacy` mode after staged rollout and observability validation.

### Deployment/runtime configuration

- `docker/docker-compose.dev.yml`
  - Expose the fallback toggle explicitly for dev and rollout testing.

- `helm/nexora/values.yaml`
  - Add the toggle to backend env values.
  - Default to compatibility mode in this phase.

- `agent/README.md`
  - Document the cutover flag and migration behavior.

### Tests

- `backend/tests/test_platform_jobs_agent.py`
  - Add a test proving broker-only mode no longer performs DB hot-path claiming when the broker queue is empty.

## Step-by-step implementation plan

### Step 1: Make broker-only hot path configurable

Files:

- `backend/app/services/work_broker.py`
- `backend/app/routes/agent.py`

Implementation:

1. Add `broker_db_fallback_enabled()` helper.
2. Use it inside `/agent/poll` and `/agent/platform-jobs/poll`.
3. When disabled, return `{"status": "idle"}` instead of scanning the database for claimable work.

Acceptance:

- With fallback enabled, current tests and behavior remain unchanged.
- With fallback disabled, agents only receive work that was actually re-enqueued or still present in Redis.

### Step 2: Make broker-consume edge cases lossless

Files:

- `backend/app/routes/agent.py`

Implementation:

1. If a polled broker message does not match the tenant filter, re-publish it immediately.
2. Keep the existing platform-job re-publish behavior for mismatched `job_type`.
3. Do not rely on delayed maintenance requeue for simple routing mismatches.

Acceptance:

- A message consumed by the wrong tenant-scoped poller is not lost.
- Cross-tenant legacy polling cannot starve broker delivery.

### Step 3: Validate broker-only hot path in tests

Files:

- `backend/tests/test_platform_jobs_agent.py`

Implementation:

1. Queue a remote run.
2. Drain the broker message manually.
3. Set `NEXORA_BROKER_DB_FALLBACK_ENABLED=0`.
4. Assert that `/agent/poll` returns `idle` rather than claiming from the database.

Acceptance:

- The test proves the hot path no longer silently falls back to DB scans.

### Step 4: Roll out broker-first mode in staging

Files:

- deployment values only

Implementation:

1. Keep production on `NEXORA_BROKER_DB_FALLBACK_ENABLED=1` initially.
2. Turn it off in staging.
3. Validate:
   - remote pipeline runs are claimed from Redis-backed delivery
   - remote platform jobs are claimed from Redis-backed delivery
   - expired leases are re-enqueued by maintenance
   - no stuck `queued_remote` or `queued` records accumulate

Acceptance:

- Staging runs without DB hot-path fallback for at least one stable validation window.

### Step 5: Remove DB fallback from the hot path

Files:

- `backend/app/routes/agent.py`
- `agent/agent.py`
- optional cleanup in `pipeline_runner.py` and `platform_jobs.py`

Implementation:

1. Remove `claim_next_remote_run()` usage from `/agent/poll`.
2. Remove `claim_next_job()` usage from `/agent/platform-jobs/poll`.
3. Keep claim endpoints for explicit run/job claiming by id.
4. Keep maintenance requeue logic as the recovery path.

Acceptance:

- Broker delivery is authoritative for work distribution.
- Database remains authoritative for state, lease, retry, and telemetry.

## Backward compatibility and migration plan

### Compatibility stance

- Phase 1 keeps the database schema and lease semantics unchanged.
- Existing remote execution APIs remain valid.
- Existing agent `legacy` mode remains valid during rollout.

### Migration sequence

1. Ship the fallback toggle and tenant-safe re-publish logic.
2. Validate broker-only mode in development and staging.
3. Add queue-depth and stale-work observability.
4. Remove hot-path DB fallback once the maintenance loop is trusted.
5. Retire `legacy` consumer mode later, not in the first cut.

## Risks to watch

- Lost broker messages due to consumer-side filtering without re-publish.
- Stale queued work if maintenance cadence is too slow relative to queue visibility timeout.
- Operators misreading `queued_remote` rows as stuck when the queue was drained but not yet refreshed.
- In-memory broker remaining enabled outside local-only environments.

## Phase 1 completion criteria

- Broker-first execution is enabled in staging without DB hot-path scans.
- Lease and heartbeat semantics remain unchanged.
- Expired or abandoned work is recovered solely through maintenance re-enqueue.
- Remote pipeline runs and remote platform jobs can both complete end-to-end without legacy polling.

## Task 1: Broker observability

The Phase 1 observability layer should use the existing Prometheus endpoint instead of inventing a second stats system.

### Metrics design

- `nexora_broker_queue_depth{queue_kind}`
  - Current queue depth for `pipeline-runs` and `platform-jobs`.
- `nexora_broker_publish_total{queue_kind}`
  - Total broker publishes by queue.
- `nexora_broker_claim_total{workload_kind,source}`
  - Tracks broker-driven claims, explicit claim-by-id calls, and DB fallback claims.
- `nexora_broker_processed_total{workload_kind,status}`
  - Final remote work completions. Prometheus `rate()` on this metric becomes the processing-rate view.
- `nexora_broker_processing_duration_seconds{workload_kind,status}`
  - End-to-end duration from claim/start to final report.
- `nexora_broker_requeue_total{queue_kind,reason,source}`
  - Requeues caused by maintenance, tenant mismatch, or job-type mismatch.
- `nexora_broker_stale_work_total{workload_kind,state}`
  - Current stale work count split into `expired_lease` and `visibility_refresh_due`.
- `nexora_broker_failed_work_total{workload_kind}`
  - Current failed remote run/job count in the database.
- `nexora_broker_db_fallback_enabled`
  - Binary rollout indicator for the legacy DB hot-path fallback.

### File-level instrumentation

- `backend/app/services/broker_observability.py`
  - Central Prometheus metrics and broker snapshot helpers.
- `backend/app/services/observability.py`
  - Refresh broker gauges on every `/metrics` scrape.
- `backend/app/services/work_broker.py`
  - Publish counters and queue-depth tracking.
- `backend/app/services/pipeline_runner.py`
  - Claim counters, terminal processing counters, and maintenance requeue counters for remote runs.
- `backend/app/services/platform_jobs.py`
  - Claim counters, terminal processing counters, and maintenance requeue counters for remote platform jobs.
- `backend/app/routes/agent.py`
  - Tenant/job-type mismatch requeue counters and control-plane warning logs.
- `backend/app/routes/status.py`
  - Expose a broker snapshot for queue depth, stale work, failed work, backend mode, and fallback mode.

### Logging integration

- Tenant-mismatch and job-type-mismatch requeues should emit warnings from `backend/app/routes/agent.py`.
- Lease-expiry requeues should emit warnings from `pipeline_runner.py` and `platform_jobs.py`.
- `/metrics` remains the Prometheus scrape target, while `/status` exposes a lightweight operational snapshot that can be consumed by Runtime Ops and staging validation.