# Staging Cluster Validation Runbook

This runbook is the post-apply path for the Terraform staging handoff in `infra/terraform`.

It assumes:

- the cluster already exists
- Terraform has already been reviewed and applied through a saved plan
- the Nexora Helm release is managed through Terraform, not hand-edited with ad hoc `kubectl` changes

## Inputs

- a filled `infra/terraform/staging.tfvars`
- a filled `infra/terraform/staging.secrets.tfvars`
- cluster access through a working kubeconfig
- `kubectl` available on the operator machine

## Step 1: Create and review the staging plan

Use the Terraform helper so `apply` consumes the reviewed `staging.tfplan` artifact instead of recomputing values at apply time:

```powershell
.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action plan `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"
```

Review the plan for:

- image repository and tag changes
- namespace and release name
- ingress host and TLS secret
- backend environment values such as CORS and broker flags
- external `database_url` and `redis_url` usage when staging is not using in-cluster data services

## Step 2: Apply the reviewed plan

Apply from the saved plan artifact only:

```powershell
.\infra\terraform\Invoke-StagingTerraform.ps1 `
	-Action apply `
	-Runner auto `
	-KubeconfigPath "$HOME\.kube\config"
```

If the helper selected Docker during `plan`, keep using the helper for `apply` so the same mount path is used for kubeconfig and the saved plan remains valid.

## Step 3: Validate the release

Run the executable validator after Terraform apply.

Ingress path:

```powershell
.\infra\terraform\Validate-StagingRelease.ps1 `
	-Namespace nexora-staging `
	-ReleaseName nexora-staging `
	-FullnameOverride nexora-staging `
	-IngressHost staging.nexora.example.com `
	-KubeconfigPath "$HOME\.kube\config"
```

Port-forward path when ingress is not ready yet:

```powershell
.\infra\terraform\Validate-StagingRelease.ps1 `
	-Namespace nexora-staging `
	-ReleaseName nexora-staging `
	-FullnameOverride nexora-staging `
	-UsePortForward `
	-KubeconfigPath "$HOME\.kube\config"
```

The validator checks:

- namespace presence
- rollout status for required deployments and any optional agent or Redis deployments that exist
- pod, service, and ingress inventory
- frontend root page availability
- same-origin frontend `GET /api/status`
- direct backend `GET /status` when port-forward mode is used
- tenant-scoped `GET /api/jobs` using `X-Tenant-ID`, `X-User-ID`, and `X-User-Role`
- broker DLQ endpoints for `pipeline-runs` and `platform-jobs`
- agent fleet endpoint when the agent deployment is enabled

## Step 4: Capture validation evidence

Keep the following artifacts with the staging validation record:

- reviewed Terraform plan summary
- validator JSON output
- `kubectl get pods -n <namespace>`
- `kubectl get svc -n <namespace>`
- `kubectl get ingress -n <namespace>`
- image tags that were promoted in the staging tfvars file

## Expected success signals

- backend and frontend deployments report successful rollout
- `GET /api/status` returns `status=ok`
- `broker.db_fallback_enabled` is `false` in staging when broker-only validation is intended
- `GET /api/jobs` returns an `items` collection without a 403 or 5xx response
- DLQ queue depths for `pipeline-runs` and `platform-jobs` are visible through the status API
- agent fleet endpoint returns an `items` collection when the agent deployment is enabled

## Failure triage

If rollout fails:

- run `kubectl describe deployment/<name> -n <namespace>`
- run `kubectl get pods -n <namespace>`
- inspect logs with `kubectl logs deployment/<name> -n <namespace> --tail=200`

If the frontend root page works but `/api/status` fails:

- inspect frontend ConfigMap values for `INTERNAL_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL`
- confirm ingress routes `/api` to the backend service
- inspect frontend pod logs for proxy errors

If `/api/jobs` returns 403 or 401:

- confirm the validator headers are reaching the backend
- confirm runtime auth configuration matches the staging expectation
- if JWT or JWKS is enforced beyond header-only flows, validate the staging auth handoff before treating the cluster as ready

If DLQ depth is non-zero:

- query `/status/broker/dlq?queue_kind=pipeline-runs`
- query `/status/broker/dlq?queue_kind=platform-jobs`
- inspect the dead-letter payloads before continuing with broker-only rollout signoff

If the agent fleet is empty when the agent deployment is enabled:

- inspect agent pod logs
- confirm `NEXORA_CONTROL_URL` points to the backend service
- confirm `NEXORA_BROKER_URL` resolves to the intended Redis target

## Rollback posture

Because the release is Terraform-managed, prefer configuration rollback over ad hoc in-cluster edits.

- revert the staging image tags or other changed inputs in `staging.tfvars`
- create a new reviewed Terraform plan
- apply that reviewed rollback plan

Avoid mixing `kubectl rollout undo` with Terraform-managed steady state unless the environment is in incident response and you explicitly intend to reconcile Terraform afterward.

## Completion criteria

The staging deployment path can be treated as validated for this slice when:

- Terraform apply is driven from a reviewed saved plan
- the validator completes successfully
- the collected evidence is archived with the staging run
- any broker DLQ items are understood or cleared before signoff