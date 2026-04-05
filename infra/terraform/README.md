# Nexora Terraform infra (skeleton)

This folder contains a minimal Terraform skeleton to deploy the Nexora Helm chart
into an existing Kubernetes cluster (via the Terraform `helm` provider).

This is intentionally a small, provider-agnostic example. For production use,
replace the placeholder with a cloud-specific module (EKS/GKE/AKS) and secure
secrets/credentials using your CI/CD secret store.

Quickstart (assumes you have a kubeconfig at `~/.kube/config`):

```bash
cd infra/terraform
terraform init
terraform plan -var "kubeconfig_path=$HOME/.kube/config"
terraform apply -var "kubeconfig_path=$HOME/.kube/config" -auto-approve
```

To deploy the Helm chart directly (manual):

```bash
helm install nexora ./helm/nexora -n nexora --create-namespace
```
