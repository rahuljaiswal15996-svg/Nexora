# Nexora — Enterprise-Grade Platform Design (Implementable)

This document captures a production-ready, multi-tenant SaaS architecture and an implementable MVP plan for Nexora: legacy migration, data engineering, ML, GenAI and Lakehouse unification.

## Executive summary
- Goal: provide an end-to-end platform to upload legacy code, convert to modern pipelines, validate correctness, enable ML lifecycle, deploy anywhere (multi-cloud), and provide enterprise-grade governance.
- Approach: Control Plane (multi-tenant SaaS control) + Customer Data Plane (tenant data isolation), orchestrated microservices running on Kubernetes, event-driven with Kafka, and object storage on S3/GCS/Azure Blob.

## High-level component map

Mermaid diagram (overview):

```mermaid
graph LR
  subgraph Frontend
    A[Next.js UI]
  end

  subgraph Edge
    A -->|REST/gRPC| APIGW[API Gateway + AuthN/Z]
  end

  subgraph ControlPlane
    APIGW --> CPAuth[Auth Service]
    APIGW --> Orchestrator[Control Plane Orchestrator]
    Orchestrator --> Parser[Parsing & UIR Service]
    Orchestrator --> Converter[Conversion Service]
    Orchestrator --> Compare[Comparison Service]
    Orchestrator --> Validator[Validation Service]
    Orchestrator --> PipelineSvc[Pipeline Service]
    Orchestrator --> MLPlatform[ML & Model Registry]
    Orchestrator --> Billing[Billing + Quotas]
    Orchestrator --> Observability[Metrics & Tracing]
  end

  subgraph EventBus
    Parser -->|events| Kafka[Kafka / PubSub]
    Converter --> Kafka
    PipelineSvc --> Kafka
    Kafka --> WorkerPool[Workers]
  end

  subgraph DataPlane[(Tenant Data Plane)]
    WorkerPool --> S3[(Object Storage)]
    WorkerPool --> Lake[Lakehouse: Delta/Iceberg]
    WorkerPool --> DataWarehouse[Snowflake/BigQuery/Redshift]
    WorkerPool --> VectorDB[Vector DB]
    WorkerPool --> FeatureStore[Feature Store + Postgres/Redis]
  end

  APIGW ---|control| AdminUI[Admin Console]
```
```

## Key design decisions (implementable)

1. Hybrid multi-tenancy: Control plane is single multi-tenant instance (managed by Nexora). Data plane is per-tenant and can be shared or isolated depending on compliance.
   - Default: tenant-scoped schema and object stores. Enterprise option: dedicated data plane in customer VPC with secure peering.
2. Event-driven architecture for conversions and pipelines using Kafka (Confluent/MSK) with exactly-once processing semantics where required.
3. Universal Intermediate Representation (UIR) — canonical JSON AST with metadata & type information. UIR is the contract between Parser, Converter, Comparison, and Pipeline services.
4. Conversion engine is hybrid: deterministic rule engine (fast) + LLM-assisted transformer for ambiguous patterns. Both are versioned and A/B testable.
5. Pipeline runtime MVP: Prefect 2 or lightweight runner (K8s jobs) for initial offering; later add Argo Workflows for full K8s-native DAGs.

## Database schemas (MVP SQL for PostgreSQL / SQLite compatibility)

Note: store JSON blobs in a `jsonb` column (Postgres). For SQLite use TEXT.

-- Tenants and auth

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

-- UIR, parsing, conversions

```sql
CREATE TABLE uir (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  source_filename TEXT,
  language TEXT,
  uir_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE conversions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  uir_id TEXT REFERENCES uir(id),
  request_id TEXT, -- idempotency
  status TEXT,
  result_json JSONB,
  metrics_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

-- Pipelines and runs

```sql
CREATE TABLE pipelines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT,
  dag_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  status TEXT,
  run_metadata JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);
```

-- Models & Feature Store metadata

```sql
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE model_versions (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id),
  version TEXT,
  artifact_location TEXT,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE features (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT,
  definition JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

-- Lineage and history

```sql
CREATE TABLE lineage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  source JSONB,
  target JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## API Contracts (v1) — Implementable

Common patterns:
- All mutating requests support `X-Idempotency-Key` header for idempotency. Server stores request_id -> result mapping (TTL) to deduplicate.
- Tenant-scoped requests must include `X-Tenant-ID` header or use JWT with tenant claim.
- Responses contain `job_id` for long-running operations.

1) Parse source -> UIR

POST /api/v1/parse
Headers: `X-Tenant-ID`, `X-Idempotency-Key`
Content: multipart/form-data { file: code file, language: optional }
Response 202 Accepted:
{
  "job_id": "<uuid>",
  "uir_id": "<uuid> (when ready)",
  "status_url": "/api/v1/jobs/<job_id>"
}

2) Convert UIR

POST /api/v1/convert
Headers: `X-Tenant-ID`, `X-Idempotency-Key`
Body: { "uir_id": "<uuid>", "target_platform": "prefect|airflow|databricks|spark|sql" }
Response 202 with job id; final /api/v1/convert/<id> returns result JSON including converted code, metrics (similarity, diff_count), and artifacts.

3) Get history
GET /api/v1/history?limit=50&cursor=...

4) Pipeline create
POST /api/v1/pipelines
Body: { name, dag_json }

5) Pipeline run
POST /api/v1/pipelines/<id>/runs
Body: { run_config, idempotency_key }
Response: 202 { "run_id": "..." }

6) Job status
GET /api/v1/jobs/<job_id>
Response: { status: queued|running|success|failed, progress: { stage: "parsing" }, result_url }

7) Metrics stream
GET /api/v1/metrics?tenant_id=...

Authentication: OAuth2 / JWT with tenant claim; support SSO (SAML, OIDC)

## Event topics / schemas (Kafka)
- nexora.code.uploaded { tenant_id, file_name, language, uir_id }
- nexora.uir.parsed { tenant_id, uir_id }
- nexora.conversion.requested { tenant_id, conversion_id }
- nexora.conversion.completed { tenant_id, conversion_id, metrics }
- nexora.pipeline.run.requested { tenant_id, pipeline_run_id }
- nexora.pipeline.run.completed { tenant_id, pipeline_run_id, metrics }

## UIR format (contract)
- `id`, `language`, `metadata` (line numbers, comments), `ast` field (lossless AST), `symbols` (variables, tables, functions), `data_access` (source tables, columns), `control_flow` (basic DAG of operations), `annotations` (semantic hints).
- Stored as JSONB in database and as compressed artifact in object storage for large UIRs.

## Conversion engine (implementable MVP)
1. Deterministic rule-engine: pattern-based conversion (regex + AST transforms) for 60% of cases.
2. LLM-assisted: for complex constructs, use RAG with UIR + examples + few-shot prompts to produce candidate converted code.
3. Candidate generation -> static analysis -> unit tests (if available) -> scoring (similarity) -> present to user.
4. Versioning and A/B test endpoints via `conversion_versions` and feature flags.

## Comparison & Validation engine (implementable MVP)
- Syntax diff: unified diff of generated code.
- Semantic diff: AST-level diff on UIR nodes (compare `symbols`, `data_access`, `control_flow`).
- Shadow execution: optional run of converted pipeline on a sampled dataset to compute data-match %.
- Validation rules: row counts, checksums, aggregations, null checks, distribution similarity metric (KS test) for numeric distributions.

## Pipeline engine (MVP)
- DAG JSON shape: nodes { id, type, image, resources, parameters }, edges list.
- Runner options (configurable per tenant): Prefect 2 (recommended) or K8s-runner (simple job-per-task).
- Support retry semantics, checkpointing, and idempotency (task-level idempotency keys).

## Observability & Governance
- Metrics: Prometheus metrics per service; Grafana dashboards per tenant + aggregated
- Tracing: OpenTelemetry + Jaeger
- Logs: structured logs to ELK or managed logging (Cloud logging)
- Audit: All control-plane actions stored in audit table with trace id
- Governance: policy engine (OPA) for rules (data residency, allowed connectors)

## Security & Network
- TLS everywhere; mutual TLS for data plane peered connectors
- KMS-based envelope encryption for object stores and DB credentials
- VPC Peering / PrivateLink for enterprise data plane deployments
- RBAC + ABAC support; SAML/SSO integration

## Multi-region & DR
- RPO/RTO targets: default RPO 1h, RTO < 1h for control-plane read-only operations; per-tenant SLA configurable
- Cross-region replication: object store replication + DB Global/replica set
- Active-active read replicas for read-heavy operations; control plane failover with global load balancer (Route 53/GSLB)
- Backup plan: nightly snapshot + continuous incremental backups for DB and object store

## Deployment (MVP concrete steps)
- Use k8s Helm charts for: api-gateway (NGINX/Traefik), control-plane services, workers, Kafka connect, Postgres, Redis, minio (S3 compatible) for local dev
- Provide a `docker-compose.dev.yml` for quick local environment (api, db, kafka, minio)

## MVP Implementation plan (code-level)
1. Parser service: implement `parse_to_uir(content, language)` (initial AST for SQL, Python, SAS). Persist UIR.
2. Conversion service: wrap existing `convert_code()` with a versioned API and a hook for LLM calls.
3. Comparison service: AST-level compare + existing difflib-based fallback.
4. History & job tracking: store job state, support `X-Idempotency-Key`.
5. Pipeline runner: implement a queue + worker (Celery / Prefect) to run simple DAGs.
6. Frontend: Upload, Parse, Convert, Compare pages; show metrics and job status.

## Trade-offs
- Using a single control plane reduces cost but increases blast radius; recommended hybrid model for enterprises.
- Prefect (managed) vs Argo (K8s-native): Prefect quicker to integrate; Argo offers more K8s-native ops.
- LLM-in-the-loop gives high recall but increases cost and governance complexity; guardrails + RAG needed.

## Next steps (short-term)
- Implement Parser + UIR persistence (DB table + API) — high priority
- Add idempotency storage for job requests
- Add pipeline-run skeleton and worker image
- Add Dev `docker-compose` for local CI tests

---

This file will be used as the canonical implementation guide; I'll now add the DB schema into the backend and a parser/UIR skeleton to the codebase for the MVP.
