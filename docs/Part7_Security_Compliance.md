# Nexora – Part 7: Security & Compliance

## Identity & Access
- RBAC + ABAC
- SSO (SAML/OIDC)
- Service-to-service mTLS

### OIDC / JWKS
- The backend supports OIDC token validation using a remote JWKS endpoint.
- Configure `NEXORA_JWKS_URL` with your provider's JWKS URL to enable public-key verification (RS256/RS512).
- Optionally set `NEXORA_JWKS_AUD` to validate the token audience.
- For local development use `NEXORA_JWT_SECRET` (HMAC HS256) as a fallback; this is not suitable for production.

Environment variables:
- `NEXORA_JWKS_URL` — JWKS endpoint (e.g., https://login.example.com/.well-known/jwks.json)
- `NEXORA_JWKS_AUD` — expected audience claim (optional)
- `NEXORA_JWT_SECRET` — local dev HMAC secret (fallback)

## Data Security
- Encryption in transit (TLS 1.2+)
- Encryption at rest (KMS/CMK)
- Secrets management (Vault/Secrets Manager)

## Data Governance
- Row-level security
- Column masking
- Data classification (PII/PHI)

## Compliance
- GDPR, HIPAA, SOC2
- ISO 27001
- FedRAMP (for gov deployments)

## Auditing
- Immutable audit logs
- Access trails for datasets and models

## Zero Trust
- No public ingress for data plane
- Least-privilege IAM policies
