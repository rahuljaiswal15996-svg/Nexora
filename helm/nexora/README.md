# Nexora Helm Chart

This chart packages the Nexora backend and frontend for deployment to Kubernetes.

Usage (example):

Install via Helm from repository root:

```bash
helm install nexora ./helm/nexora -n nexora --create-namespace
```

Override images and tags with `--set`:

```bash
helm upgrade --install nexora ./helm/nexora -n nexora \
  --set backend.image.repository=yourrepo/nexora-backend \
  --set backend.image.tag=1.2.3 \
  --set frontend.image.repository=yourrepo/nexora-frontend \
  --set frontend.image.tag=1.2.3
```

To render templates locally for inspection:

```bash
helm template nexora ./helm/nexora
```
