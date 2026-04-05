# Nexora – Part 8: Control Plane vs Data Plane

## Control Plane (SaaS)
- UI, APIs, metadata, orchestration
- Multi-tenant, stateless services
- Stores: metadata DB, lineage, configs

## Data Plane (Customer)
- Runs in customer VPC/on-prem/edge
- Executes pipelines, ML jobs, streaming
- Uses local data sources; no raw data leaves boundary

## Agent Model
- Lightweight agents deployed in data plane
- Secure outbound connection to control plane
- Receives job specs, returns metrics/results

## Isolation
- Per-tenant namespaces
- Quotas for CPU/GPU, memory, LLM tokens

## Networking
- PrivateLink/VPC peering for control-plane access
- No inbound to data plane required
