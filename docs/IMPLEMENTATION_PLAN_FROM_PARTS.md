# Nexora — Implementation Plan (From Parts 1–10)

This implementation plan is derived from the provided Part docs and maps work into an 8-week, prioritized backlog suitable for the current repo MVP.

## Goals
- Harden the conversion & UIR pipeline.
- Integrate a pluggable LLM adapter (dev → prod).
- Add production-grade auth and tenant hardening.
- Provide infra and CI/CD for reproducible deploys.
- Add shadow execution, HITL workflows, and observability.

## High-level phases (8 weeks)

Week 1 — Stabilize & Docs
- Import design docs (done).
- Create a consolidated implementation plan (this file).
- Verify smoke tests and developer quickstart.

Week 2 — Conversion Engine Improvements
- Implement a pluggable provider adapter interface.
- Add one real provider scaffold (OpenAI placeholder reading envs).
- Add prompt templates, versioning metadata in DB.

Week 3 — Validation & Shadow Execution
Week 3 — Validation & Shadow Execution (IMPLEMENTED — MVP)
- Implemented shadow execution runner and queueing: `backend/app/services/shadow.py`.
- Added HITL endpoints (`/shadow`, `/shadow/{id}/review`) and review tracking in DB (`shadow_runs` table).
- Confidence scoring uses adapter-reported confidence or similarity ratio; low-confidence runs are flagged for manual review.
	- Added HITL integration tests and CI job: `backend/tests/test_shadow_hitl.py` and CI updated to run `pytest`.

Week 4 — Production Auth & Multi-tenancy
Week 4 — Production Auth & Multi-tenancy
- Replace dev JWT with OIDC/JWKS validation middleware. (IMPLEMENTED — middleware now supports JWKS via `NEXORA_JWKS_URL` and falls back to `NEXORA_JWT_SECRET` for dev)
- Add tenant RBAC checks and integration tests.
- Add tenant quotas and basic usage metering.

Week 5 — Infra & CI/CD Foundations
- Add GitHub Actions: lint → test → build → image push. (IMPLEMENTED — backend and frontend validation, compose readiness, Helm lint/template, and Terraform validate now run in CI.)
- Add Helm chart and Terraform modules for infra. (IMPLEMENTED — `helm/nexora` now contains production-oriented backend/frontend config, secret, probes, and ingress; `infra/terraform` installs the chart with `helm_release`.)
- Add secrets management guidance (K8s secrets / Vault). (PARTIAL — backend `DATABASE_URL` is injected through a Helm Secret; broader secret-store integration remains open.)

Week 6 — Data Plane Agent + Observability
- Implement data-plane agent skeleton (secure outbound job runner).
- Add Prometheus metrics and structured logs across services.
- Add health/readiness checks and resource requests/limits.
	- Data-plane agent: scaffolded `agent/agent.py` with polling and report flow (MVP).

Week 7 — Feature Store & Model Lifecycle
- Add feature store skeleton (offline/online separation).
- Add model registry scaffolding (train/eval/deploy hooks).
- Integrate model usage audit logs.

Week 8 — Polish + Governance
- Add SLO checks, release gating, approval workflows.
- Run full smoke/regression; QA and docs finalization.
- Prepare rollout runbook and rollback/playbook.

## Immediate next steps (actionable)
1. Choose priority: implement LLM provider adapter or implement OIDC/JWKS auth.
2. If LLM first: scaffold provider adapter, add env-based config, add unit tests and a small E2E smoke that calls the adapter.
3. If Auth first: add OIDC middleware, add JWKS URL config, add basic test tokens and integration tests for tenant isolation.

## Artifacts created
- Consolidated plan (this file).
- Part docs (docs/Part1_Architecture.md … Part10_Deployment_CICD.md).

---

If you want, I can now:
- Start implementing the LLM provider adapter (scaffold + tests), or
- Start implementing production OIDC/JWKS auth (middleware + tests).
Which should I start on next? (LLM adapter / CI/CD templates / infra)