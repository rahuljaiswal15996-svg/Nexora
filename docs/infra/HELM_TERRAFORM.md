# Helm and Terraform: Nexora infra quickstart

This document shows how to deploy the current Nexora chart and Terraform module. The runtime contract is:

- frontend serves the UI and same-origin `/api`
- ingress routes `/` to frontend and `/api` to backend
- backend reads `DATABASE_URL` from a Kubernetes Secret
- browser clients never need the backend service hostname directly

## Helm

Validate the chart locally before install:

```bash
helm lint helm/nexora
helm template nexora helm/nexora \
  --set ingress.enabled=true \
  --set ingress.host=nexora.example.com
```

Install or upgrade the release:

```bash
helm upgrade --install nexora ./helm/nexora \
  --namespace nexora \
  --create-namespace \
  --set backend.image.repository=your-registry/nexora-backend \
  --set backend.image.tag=2026.04.07 \
  --set frontend.image.repository=your-registry/nexora-frontend \
  --set frontend.image.tag=2026.04.07 \
  --set-string backend.secretEnv.DATABASE_URL=postgresql+psycopg://user:password@postgres:5432/nexora \
  --set ingress.enabled=true \
  --set ingress.host=nexora.example.com
```

Optional examples:

```bash
# add ingress class and annotation
helm upgrade --install nexora ./helm/nexora \
  --namespace nexora \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.host=nexora.example.com \
  --set ingress.annotations."nginx\.ingress\.kubernetes\.io/proxy-body-size"=50m
```

## Terraform

The Terraform module in `infra/terraform` now installs the chart directly with `helm_release` and supports a saved-plan staging handoff.

Recommended path:

- copy `infra/terraform/staging.tfvars.example` to `infra/terraform/staging.tfvars`
- copy `infra/terraform/staging.secrets.tfvars.example` to `infra/terraform/staging.secrets.tfvars`
- plan through `infra/terraform/Invoke-StagingTerraform.ps1`
- apply only from the reviewed `staging.tfplan`
- validate the release through `infra/terraform/Validate-StagingRelease.ps1`

Example:

```powershell
.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action plan `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"

.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action apply `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"

.\infra\terraform\Validate-StagingRelease.ps1 `
	-Namespace nexora-staging `
	-ReleaseName nexora-staging `
	-FullnameOverride nexora-staging `
	-IngressHost staging.nexora.example.com `
	-KubeconfigPath "$HOME\.kube\config"
```

See `infra/terraform/README.md` for the current variable contract and `docs/infra/STAGING_CLUSTER_VALIDATION_RUNBOOK.md` for the post-apply validation path.

Useful Terraform variables:

- `release_name`
- `namespace`
- `image_pull_secrets`
- `backend_allowed_origins`
- `backend_extra_env`
- `frontend_extra_env`
- `ingress_class_name`
- `ingress_annotations`
- `ingress_tls`

## Operational notes

- The chart includes default probes and resource requests or limits for backend and frontend.
- Terraform resolves the frontend internal API URL and agent control URL directly before values are handed to Helm.
- The Terraform module sets a stable `fullnameOverride` so the service names remain predictable.
- CI validates both the Helm chart and Terraform module before image publication.
