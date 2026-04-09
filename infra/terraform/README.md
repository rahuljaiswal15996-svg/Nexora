# Nexora Terraform infra

This module turns the Nexora Helm chart into a real Terraform deployment path for an existing Kubernetes cluster.

It assumes the cluster already exists and focuses on executable application deployment:

- creates the target namespace when requested
- optionally provisions in-cluster PostgreSQL through a Helm release
- resolves PostgreSQL and Redis connection URLs
- passes the full backend Helm env contract into `helm/nexora`
- injects backend secrets through Helm `set_sensitive`

## Deployment model

Cluster layer:

- Existing Kubernetes cluster, referenced through `kubeconfig_path`
- No cloud-specific EKS, GKE, or AKS resources in this module

Data services:

- PostgreSQL: use an external managed database through `database_url`, or let Terraform install in-cluster PostgreSQL when `postgresql_enabled=true` and `database_url` is empty
- Redis: use the in-cluster Redis deployment from `helm/nexora` when `redis_enabled=true`, or provide an external `redis_url`

Application layer:

- Installs `helm/nexora`
- Passes backend.env and backend.secrets values that match the production Helm contract
- Resolves agent control-plane and frontend internal API URLs inside Terraform so the final runtime contract is inspectable before apply

## Quickstart

Use the default executable path with in-cluster PostgreSQL and in-cluster Redis:

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan \
	-var="kubeconfig_path=$HOME/.kube/config" \
	-var="backend_image_repository=your-registry/nexora-backend" \
	-var="backend_image_tag=2026.04.08" \
	-var="frontend_image_repository=your-registry/nexora-frontend" \
	-var="frontend_image_tag=2026.04.08" \
	-var="agent_image_repository=your-registry/nexora-agent" \
	-var="agent_image_tag=2026.04.08" \
	-var="ingress_enabled=true" \
	-var="ingress_host=nexora.example.com"
terraform -chdir=infra/terraform apply \
	-var="kubeconfig_path=$HOME/.kube/config" \
	-var="backend_image_repository=your-registry/nexora-backend" \
	-var="backend_image_tag=2026.04.08" \
	-var="frontend_image_repository=your-registry/nexora-frontend" \
	-var="frontend_image_tag=2026.04.08" \
	-var="agent_image_repository=your-registry/nexora-agent" \
	-var="agent_image_tag=2026.04.08" \
	-var="ingress_enabled=true" \
	-var="ingress_host=nexora.example.com"
```

Use an external managed PostgreSQL instance and external Redis instead:

```bash
terraform -chdir=infra/terraform apply \
	-var="kubeconfig_path=$HOME/.kube/config" \
	-var="postgresql_enabled=false" \
	-var="redis_enabled=false" \
	-var="database_url=postgresql+psycopg://user:password@managed-postgres:5432/nexora" \
	-var="redis_url=redis://managed-redis:6379/0" \
	-var="backend_environment=production" \
	-var="backend_allowed_origins={https://nexora.example.com}" \
	-var="backend_allow_dev_tokens=false" \
	-var="backend_jwt_secret=replace-with-production-secret"
```

## Staging handoff

The module now ships committed handoff templates for a production-like staging install:

- `staging.tfvars.example` for non-sensitive cluster, image, ingress, and runtime values
- `staging.secrets.tfvars.example` for secrets and managed service URLs

Create untracked working copies before planning:

```powershell
Copy-Item infra/terraform/staging.tfvars.example infra/terraform/staging.tfvars
Copy-Item infra/terraform/staging.secrets.tfvars.example infra/terraform/staging.secrets.tfvars
```

Fill in at least these values before you plan:

- image repositories and tags
- ingress host, class, annotations, and TLS secret name
- `backend_jwt_secret`
- `openai_api_key` or `nexora_openai_api_key` when `backend_llm_provider="openai"`
- `database_url` when `postgresql_enabled=false`
- `redis_url` when `redis_enabled=false`

Use the PowerShell helper to keep plan and apply on the same runner. On machines without native Terraform, it falls back to Docker automatically and mounts kubeconfig into the container:

```powershell
.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action plan `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"
```

Review the saved plan, then apply the exact approved artifact:

```powershell
.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action apply `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"
```

After apply, validate the release through ingress or port-forward mode:

```powershell
.\infra\terraform\Validate-StagingRelease.ps1 `
	-Namespace nexora-staging `
	-ReleaseName nexora-staging `
	-FullnameOverride nexora-staging `
	-IngressHost staging.nexora.example.com `
	-KubeconfigPath "$HOME\.kube\config"
```

The full operator checklist lives in `docs/infra/STAGING_CLUSTER_VALIDATION_RUNBOOK.md`.

If the helper selects Docker, use the helper for both `plan` and `apply` so the kubeconfig mount path stays consistent with the saved plan file.

Native Terraform uses the same saved-plan workflow:

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan \
	-lock-timeout=5m \
	-out=staging.tfplan \
	-var-file=staging.tfvars \
	-var-file=staging.secrets.tfvars
terraform -chdir=infra/terraform show staging.tfplan
terraform -chdir=infra/terraform apply staging.tfplan
```

Inspect the resolved non-sensitive Helm contract before apply:

```bash
cat <<'EOF' | terraform -chdir=infra/terraform console \
	-var-file=staging.tfvars \
	-var-file=staging.secrets.tfvars
jsonencode({
	backend_env  = local.backend_env
	frontend_env = local.frontend_env
	agent_env    = local.agent_env
	helm_values  = local.helm_values
})
EOF
```

## Key variables

Images and release shape:

- `backend_image_repository`, `backend_image_tag`
- `frontend_image_repository`, `frontend_image_tag`
- `agent_image_repository`, `agent_image_tag`
- `namespace`, `release_name`, `fullname_override`

Database and broker wiring:

- `database_url`
- `postgresql_enabled`, `postgresql_database`, `postgresql_username`, `postgresql_password`
- `redis_enabled`, `redis_url`

Backend runtime configuration:

- `backend_environment`
- `backend_allowed_origins`, `backend_allowed_origin_regex`
- `backend_allow_dev_tokens`
- `backend_jwks_url`, `backend_jwks_audience`, `backend_jwt_secret`
- `backend_llm_provider`, `backend_openai_model`, `openai_api_key`, `nexora_openai_api_key`
- `backend_work_broker`
- `backend_extra_env`

## Outputs

- namespace
- Helm release name, status, revision, and chart version
- in-cluster backend and frontend service names
- resolved `database_url` and `redis_url`
- in-cluster backend and frontend service URLs
- non-sensitive `helm_backend_env`
- non-sensitive `helm_frontend_env` and `helm_agent_env`
- resolved non-sensitive `helm_values`
- frontend URL when ingress is enabled

## Notes

- This module assumes an existing cluster and kubeconfig.
- PostgreSQL deployment is optional. If `database_url` is set, Terraform skips in-cluster PostgreSQL and uses the supplied external connection string.
- Redis deployment remains inside the Nexora Helm chart unless `redis_enabled=false` and an external `redis_url` is provided.
- Working copies such as `staging.tfvars`, `staging.secrets.tfvars`, and `staging.tfplan` remain untracked because `*.tfvars` and `*.tfvars.json` are ignored in the repo root `.gitignore`.
- Saved plan artifacts such as `staging.tfplan` remain untracked because `*.tfplan` is ignored in the repo root `.gitignore`.
- Terraform resolves chart-side fallback URLs for `INTERNAL_API_BASE_URL` and `NEXORA_CONTROL_URL` so operators can verify the exact runtime env contract without relying on Helm template defaults.
- Terraform preconditions fail early when no database URL can be resolved or when Redis is required but no Redis URL is available.
