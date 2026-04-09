# Nexora Architecture Diagrams

High-level architecture and sequence flows for the current Nexora runtime model.

## System overview

```mermaid
graph LR
  User[Browser User] -->|HTTPS / and /api| Edge[Ingress or Next.js runtime]

  subgraph ControlPlane[Control Plane]
    Frontend[Next.js Frontend]
    Proxy[Next.js API Proxy /api]
    API[FastAPI Backend]
    DB[(PostgreSQL)]
    Broker[(Redis Work Broker)]
    Migrations[Alembic]
    LLM[LLM Adapter]
  end

  subgraph Delivery[Delivery Pipeline]
    CI[GitHub Actions]
    Helm[Helm Chart]
    TF[Terraform helm_release]
  end

  subgraph DataPlane[Customer Data Plane]
    Agent[Remote Agent]
    DataSources[(Customer Data)]
  end

  Edge --> Frontend
  Frontend --> Proxy
  Proxy -->|forward /api| API
  API --> DB
  API --> Broker
  API --> Migrations
  API --> LLM
  Broker -->|deliver remote runs and jobs| Agent
  Agent -->|execute pipelines against| DataSources
  Agent -->|claim, heartbeat, telemetry, report| API
  CI --> Helm
  CI --> TF
  CI -->|compose readiness, helm template, terraform validate| API
  CI --> Frontend
```

## Browser request path

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Next as Next.js Frontend
    participant Proxy as /api Proxy Route
    participant API as FastAPI Backend
    participant DB as PostgreSQL

    User->>Browser: open workspace
    Browser->>Next: GET /
    Browser->>Proxy: POST /api/convert
    Proxy->>API: forward request using INTERNAL_API_BASE_URL
    API->>DB: read/write state
    API-->>Proxy: JSON response
    Proxy-->>Browser: same-origin /api response
```

## Deployment sequence

```mermaid
sequenceDiagram
    participant CI as GitHub Actions
    participant Compose as Docker Compose
    participant Helm as Helm
    participant TF as Terraform
    participant K8s as Kubernetes
  participant API as Backend

    CI->>Compose: build and boot production stack
    CI->>API: check /status and /api/status
    CI->>Helm: lint and template chart
    CI->>TF: init and validate module
  TF->>Helm: install local chart with helm_release
  Helm->>K8s: apply frontend, backend, agent, redis, config, secret, ingress
```

## Remote agent flow

```mermaid
sequenceDiagram
    participant Agent
    participant ControlAPI as FastAPI Backend
  participant Broker as Redis Work Broker
    participant DB as PostgreSQL

  ControlAPI->>Broker: publish run or platform job reference
  Broker-->>Agent: deliver queued work reference
  Agent->>ControlAPI: POST /agent/runs/claim or /agent/platform-jobs/claim
  Agent->>ControlAPI: POST heartbeat endpoints
  Agent->>Agent: execute pipeline nodes with shared execution engine
  Agent->>ControlAPI: POST /agent/runs/node-update
  Agent->>ControlAPI: POST final report endpoint
    ControlAPI->>DB: persist run status and telemetry
```

---

See also: `ARCHITECTURE.md`, `docs/infra/HELM_TERRAFORM.md`, and `docs/Part10_Deployment_CICD.md`.
