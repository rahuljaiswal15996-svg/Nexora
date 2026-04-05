# Nexora Architecture Diagrams

High-level architecture and sequence flows for the Nexora MVP.

## System Overview (graph)

```mermaid
graph LR
  subgraph ControlPlane[Control Plane]
    UI[Next.js Frontend]
    API[FastAPI Backend]
    DB[(Metadata DB / SQLite)]
    LLM[LLM Adapter (Mock / OpenAI)]
    CI[CI / GitHub Actions]
  end

  subgraph DataPlane[Data Plane (Customer)]
    Agent[Data-plane Agent]
    DataSources[(Customer Data)]
  end

  UI -->|API calls (/api/*)| API
  API -->|persist metadata| DB
  API -->|call| LLM
  API -->|queue remote runs| Agent
  Agent -->|execute pipelines against| DataSources
  Agent -->|report results| API
  CI -->|build/publish| API
  CI -->|build/publish| UI
```

## Conversion Sequence (sequence)

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Parser
    participant ConvEngine
    participant LLM
    participant DB

    User->>UI: upload legacy code
    UI->>API: POST /convert (file)
    API->>Parser: parse_to_uir(code)
    API->>ConvEngine: convert(code)
    ConvEngine->>LLM: generate(prompt) (optional)
    ConvEngine->>DB: store conversion, metrics
    API-->>UI: return converted code + comparison

    Note over ConvEngine,LLM: If confidence < threshold -> create shadow run -> mark for HITL
```

## Agent Polling Flow (graph)

```mermaid
sequenceDiagram
    participant Agent
    participant ControlAPI
    Agent->>ControlAPI: GET /agent/poll
    ControlAPI-->>Agent: run payload (pipeline spec) or idle
    Agent->>Agent: execute nodes (local)
    Agent->>ControlAPI: POST /agent/report {run_id, status}
    ControlAPI-->>DB: update run status
```

---

See also: `docs/Part1_Architecture.md`, `docs/Part2_IR_Conversion.md`, and `docs/Part9_Shadow_HITL_API_DB.md` for more detail.
