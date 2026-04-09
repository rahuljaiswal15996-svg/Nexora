# Nexora Helm Chart

This chart packages the Nexora backend, frontend, remote agent, and a default
Redis broker for Kubernetes deployment.

## What gets deployed

- FastAPI backend Deployment and Service
- Next.js frontend Deployment and Service
- Nexora remote agent Deployment
- Redis Deployment and Service for broker-backed remote work delivery
- Backend and frontend ConfigMaps, backend Secret, and optional Ingress

## Install

From the repository root:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora --create-namespace
```

Override image repositories and tags:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set backend.image.repository=yourrepo/nexora-backend \
  --set backend.image.tag=1.2.3 \
  --set frontend.image.repository=yourrepo/nexora-frontend \
  --set frontend.image.tag=1.2.3 \
  --set agent.image.repository=yourrepo/nexora-agent \
  --set agent.image.tag=1.2.3
```

Use an external Redis instance instead of the bundled deployment:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set redis.enabled=false \
  --set backend.env.NEXORA_BROKER_URL=redis://your-redis:6379/0 \
  --set agent.env.NEXORA_BROKER_URL=redis://your-redis:6379/0
```

Enable ingress:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set ingress.enabled=true \
  --set ingress.host=nexora.example.com \
  --set ingress.className=nginx
```

Set deployment-specific environment values:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set backend.env.NEXORA_ALLOWED_ORIGINS=https://nexora.example.com \
  --set frontend.env.NEXT_PUBLIC_API_BASE_URL=/api \
  --set frontend.env.INTERNAL_API_BASE_URL=http://nexora-backend:8000 \
  --set agent.env.NEXORA_CONTROL_URL=http://nexora-backend:8000
```

## Required backend environment variables

The backend chart now mirrors the production validation enforced in `backend/app/core/settings.py`.

- Always required:
  - `DATABASE_URL` via `backend.secrets.DATABASE_URL`.
  - `NEXORA_ENV` to distinguish development from production behavior.
  - `NEXORA_WORK_BROKER` and `NEXORA_BROKER_URL` for broker-backed remote execution.
- Required when explicit CORS is enabled, which is the default in production:
  - `NEXORA_ALLOWED_ORIGINS` or `NEXORA_ALLOWED_ORIGIN_REGEX`.
- Required in production authentication configuration:
  - `backend.secrets.NEXORA_JWT_SECRET`, or
  - `backend.env.NEXORA_JWKS_URL` with optional `backend.env.NEXORA_JWKS_AUD`.
- Required when `backend.env.NEXORA_LLM_PROVIDER=openai`:
  - `backend.secrets.OPENAI_API_KEY` or `backend.secrets.NEXORA_OPENAI_API_KEY`.

The chart also carries the same runtime defaults as Docker Compose for:

- `NEXORA_ALLOW_DEV_TOKENS`
- `NEXORA_JWT_ALGO`
- `NEXORA_DEFAULT_ROLE`
- `NEXORA_DEFAULT_TENANT_ID`
- `NEXORA_DEFAULT_USER_ID`
- `NEXORA_OPENAI_MODEL`

## Production validation

Helm render now fails fast when the backend configuration is incompatible with production mode. The chart rejects these cases before deployment:

- `backend.env.NEXORA_ENV=production` without explicit CORS configuration
- `backend.env.NEXORA_ENV=production` without `backend.secrets.NEXORA_JWT_SECRET` or `backend.env.NEXORA_JWKS_URL`
- `backend.env.NEXORA_ENV=production` with `backend.env.NEXORA_ALLOW_DEV_TOKENS=true`
- `backend.env.NEXORA_LLM_PROVIDER=openai` without an OpenAI API key secret

## Production example

Use the included override file as a production starting point:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  -f helm/nexora/values.production.example.yaml
```

That example keeps sensitive values in `backend.secrets` and uses explicit production-safe backend defaults.

## Validate

Render locally:

```bash
helm template nexora ./helm/nexora
```

Check rollout status after install:

```bash
kubectl rollout status deployment/nexora-backend -n nexora
kubectl rollout status deployment/nexora-frontend -n nexora
kubectl rollout status deployment/nexora-agent -n nexora
kubectl rollout status deployment/nexora-redis -n nexora
```

Smoke check through the cluster:

```bash
kubectl port-forward svc/nexora-frontend 3000:3000 -n nexora
curl http://127.0.0.1:3000/api/status
```
