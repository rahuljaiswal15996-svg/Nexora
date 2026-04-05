Kubernetes skeleton

This folder contains minimal Kubernetes manifests to bootstrap a demo cluster.

How to use (dev/demo):
1. Build container images for `nexora/backend` and `nexora/frontend` and push to a registry accessible to your cluster.
2. Update `image:` fields accordingly in the manifests.
3. Apply manifests:

```bash
kubectl apply -f docker/k8s/backend-deployment.yaml
kubectl apply -f docker/k8s/frontend-deployment.yaml
```

Notes:
- These are **skeleton** manifests. Swap in Helm charts and configure resource limits, probes, secrets, and RBAC for production.
- You will also need DB (Postgres), object storage (S3/minio), and Kafka/streaming services for the full platform.
