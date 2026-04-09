output "namespace" {
  value       = var.namespace
  description = "Kubernetes namespace used for Nexora"
}

output "release_name" {
  value       = helm_release.nexora.name
  description = "Installed Helm release name"
}

output "release_status" {
  value       = helm_release.nexora.status
  description = "Current Helm release status"
}

output "release_revision" {
  value       = try(helm_release.nexora.metadata[0].revision, null)
  description = "Current Helm release revision"
}

output "chart_version" {
  value       = helm_release.nexora.version
  description = "Installed Helm chart version"
}

output "frontend_service_name" {
  value       = local.frontend_service_name
  description = "Frontend Kubernetes service name"
}

output "backend_service_name" {
  value       = local.backend_service_name
  description = "Backend Kubernetes service name"
}

output "postgresql_release_name" {
  value       = var.postgresql_enabled && trimspace(var.database_url) == "" ? helm_release.postgresql[0].name : null
  description = "In-cluster PostgreSQL Helm release name when Terraform provisions PostgreSQL"
}

output "postgresql_service_name" {
  value       = var.postgresql_enabled && trimspace(var.database_url) == "" ? local.postgresql_service : null
  description = "In-cluster PostgreSQL service name when Terraform provisions PostgreSQL"
}

output "database_url" {
  value       = local.database_url
  sensitive   = true
  description = "Resolved database URL passed into backend.secrets.DATABASE_URL"
}

output "redis_service_name" {
  value       = var.redis_enabled ? local.redis_service_name : null
  description = "In-cluster Redis service name when the Nexora chart provisions Redis"
}

output "redis_url" {
  value       = local.redis_url
  description = "Resolved Redis URL passed into backend.env.NEXORA_BROKER_URL"
}

output "backend_service_url" {
  value       = local.backend_service_url
  description = "In-cluster backend service URL"
}

output "frontend_service_url" {
  value       = local.frontend_service_url
  description = "In-cluster frontend service URL"
}

output "helm_backend_env" {
  value       = local.helm_values.backend.env
  description = "Non-sensitive backend environment values passed into the Helm release"
}

output "helm_frontend_env" {
  value       = local.helm_values.frontend.env
  description = "Non-sensitive frontend environment values passed into the Helm release"
}

output "helm_agent_env" {
  value       = local.helm_values.agent.env
  description = "Non-sensitive agent environment values passed into the Helm release"
}

output "helm_values" {
  value       = local.helm_values
  description = "Resolved non-sensitive Helm values passed into the Nexora Helm release before secret injection"
}

output "frontend_url" {
  value       = var.ingress_enabled ? format("%s://%s", length(var.ingress_tls) > 0 ? "https" : "http", var.ingress_host) : null
  description = "Frontend URL when ingress is enabled"
}
