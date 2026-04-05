# Nexora – Part 10: Deployment & CI/CD

## CI/CD
- GitHub Actions / GitLab CI
- Steps: lint → test → build → scan → deploy

## Containerization
- Docker images per service
- Versioned artifacts

## Deployment Strategies
- Blue/Green
- Canary releases
- Feature flags

## Environments
- Dev → Staging → Prod
- Isolated infra per env

## Infra as Code
- Terraform / Pulumi
- Repeatable environments

## Observability in CI/CD
- SLO checks before promotion
- Rollback on failure

## Runtime Ops
- Health probes, autoscaling
- Alerting (PagerDuty/Slack)

## Release Governance
- Approval gates for prod
- Change logs and audit trail
