# Helm and Terraform: Nexora infra quickstart

This document shows quick commands to deploy the Nexora Helm chart and a
small Terraform example that can apply the chart to an existing Kubernetes
cluster.

Helm (local / dev)

```bash
# From repository root
helm install nexora ./helm/nexora -n nexora --create-namespace

# Override image tags
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set backend.image.repository=yourrepo/nexora-backend \
  --set backend.image.tag=1.2.3 \
  --set frontend.image.repository=yourrepo/nexora-frontend \
  --set frontend.image.tag=1.2.3
```

Terraform (example)

1. Ensure `~/.kube/config` connects to a cluster with `kubectl` access.
2. Initialize and apply the example Terraform configuration in `infra/terraform`:

```bash
cd infra/terraform
terraform init
terraform apply -var "kubeconfig_path=$HOME/.kube/config" -auto-approve
```

Notes
- The Terraform example is a skeleton: for production, create a dedicated
  module (EKS/GKE/AKS) that provisions the cluster and then uses the Helm
  provider to install the chart.
- Secure credentials via your CI secret store (GitHub Actions secrets,
  HashiCorp Vault, cloud secret manager).
