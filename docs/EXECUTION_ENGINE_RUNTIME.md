# Execution Engine Runtime

This document defines the Phase 2A execution contract used by both the local backend runtime and the broker-driven remote agent.

## Goals

- Execute real node logic instead of sleep-based simulation.
- Keep one shared node execution contract across the control plane and broker workers.
- Preserve node retries, structured telemetry, and existing pipeline run APIs.

## Runtime Contract

Each executable node is expected to provide:

- `kind`: high-level node category such as `recipe`, `deploy`, `dataset`, or `validation`
- `config`: executor-specific configuration payload
- `execution_binding`: normalized runtime binding produced by pipeline authoring

Shared execution bindings now matter at runtime:

- `engine_type`: logical execution family such as `transform` or `deployment`
- `runtime_profile`: target runtime like `warehouse-sql`, `python-batch`, or `runtime-ops`
- `executor`: concrete handler name such as `transform.sql`, `transform.python`, or `deploy.api`
- `target_ref`: human-readable or runtime target reference

The shared executor returns:

- `metadata`: structured execution metadata including executor, duration, attempt, runtime profile, and handler-specific fields
- `log_entries`: structured logs with consistent metadata for executor, node id, attempt, and runtime context
- `output_artifacts`: downstream-consumable outputs such as tables, JSON payloads, validation summaries, and API responses

## Handler Matrix

- `transform.python`, `transform.pyspark`, `notebook.execute`, `notebook.cell.python`, `notebook.cell.pyspark`
  - Executes Python expressions or scripts.
  - Captures stdout and stderr.
  - Produces JSON, table, or text artifacts from the resulting value.

- `transform.sql`, `notebook.cell.sql`
  - Executes real SQL statements against the configured SQLAlchemy engine.
  - Materializes upstream table outputs into temp tables such as `input_dataset`.
  - Returns affected row counts or result-table artifacts.

- `deploy.api`
  - Executes real HTTP requests with method, headers, body, timeout, and structured response metadata.
  - Classifies timeouts, connection failures, `429`, and `5xx` as retryable.

- `dataset.*`, `validation.*`, and remaining control-plane executors
  - Continue through lightweight handlers with structured telemetry.

## Retry Model

Retries still happen in the pipeline runtime loops, but handlers now classify failures.

- Non-retryable failures:
  - Python syntax errors
  - Python runtime failures
  - empty SQL scripts
  - validation failures
  - malformed API configuration
  - HTTP `4xx` API responses except `429`

- Retryable failures:
  - SQL operational failures
  - API timeouts
  - API connection failures
  - API `429` and `5xx` responses

Both the backend pipeline runner and the remote broker agent use the same retryability signal before scheduling another node attempt.

## Structured Logging

Every handler log entry is normalized with:

- `executor`
- `engine_type`
- `runtime_profile`
- `node_id`
- `node_kind`
- `node_label`
- `attempt`
- `max_attempts`

Failure metadata additionally includes:

- `error_code`
- `error_type`
- `retryable`
- handler-specific details such as `status_code` or `endpoint_url`

## Example Nodes

### Python node

```json
{
  "id": "seed_orders",
  "kind": "recipe",
  "label": "Seed Orders",
  "config": {
    "language": "python",
    "runtime_profile": "python-batch",
    "expression": "[{\"order_id\": \"A1\", \"amount\": 10}, {\"order_id\": \"A2\", \"amount\": 15}]",
    "output_dataset_name": "orders_seed",
    "retry_limit": 2,
    "retry_backoff_seconds": 0.5
  },
  "execution_binding": {
    "engine_type": "transform",
    "runtime_profile": "python-batch",
    "executor": "transform.python",
    "target_ref": "orders_seed"
  }
}
```

### SQL node

```json
{
  "id": "normalize_orders",
  "kind": "recipe",
  "label": "Normalize Orders",
  "config": {
    "language": "sql",
    "runtime_profile": "warehouse-sql",
    "expression": "SELECT order_id, amount FROM input_dataset ORDER BY order_id",
    "output_dataset_name": "orders_curated",
    "retry_limit": 2,
    "retry_backoff_seconds": 0.5
  },
  "execution_binding": {
    "engine_type": "transform",
    "runtime_profile": "warehouse-sql",
    "executor": "transform.sql",
    "target_ref": "orders_curated"
  }
}
```

### API node

```json
{
  "id": "notify_orders",
  "kind": "deploy",
  "label": "Notify Orders",
  "config": {
    "target_platform": "api",
    "target_name": "orders-webhook",
    "endpoint_url": "https://api.example.com/hooks/orders",
    "request_method": "POST",
    "request_headers": {
      "Authorization": "Bearer ${TOKEN}"
    },
    "request_body": {
      "batch": "daily"
    },
    "timeout_seconds": 30,
    "retry_limit": 2,
    "retry_backoff_seconds": 1
  },
  "execution_binding": {
    "engine_type": "deployment",
    "runtime_profile": "runtime-ops",
    "executor": "deploy.api",
    "target_ref": "https://api.example.com/hooks/orders"
  }
}
```

## Integration Points

- Local execution path: `backend/app/services/pipeline_runner.py`
- Broker worker execution path: `agent/agent.py`
- Shared execution handlers: `backend/app/services/execution_engine.py`
- Authoring contract: `backend/app/services/pipeline_authoring.py`