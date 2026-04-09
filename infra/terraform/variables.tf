variable "kubeconfig_path" {
  type        = string
  default     = "~/.kube/config"
  description = "Path to kubeconfig used by providers"
}

variable "namespace" {
  type        = string
  default     = "nexora"
  description = "Kubernetes namespace where the Helm release will be installed"
}

variable "release_name" {
  type        = string
  default     = "nexora"
  description = "Helm release name for the Nexora deployment"
}

variable "fullname_override" {
  type        = string
  default     = ""
  description = "Optional stable resource base name used by the chart"
}

variable "create_namespace" {
  type        = bool
  default     = true
  description = "Whether Terraform should create the target namespace"
}

variable "helm_timeout_seconds" {
  type        = number
  default     = 600
  description = "How long Terraform waits for the Helm release to become ready"
}

variable "backend_service_port" {
  type        = number
  default     = 8000
  description = "Backend Kubernetes service port"
}

variable "frontend_service_port" {
  type        = number
  default     = 3000
  description = "Frontend Kubernetes service port"
}

variable "redis_service_port" {
  type        = number
  default     = 6379
  description = "Redis Kubernetes service port"
}

variable "backend_image_repository" {
  type        = string
  default     = "nexora/backend"
  description = "Backend container image repository"
}

variable "backend_image_tag" {
  type        = string
  default     = "latest"
  description = "Backend container image tag"
}

variable "frontend_image_repository" {
  type        = string
  default     = "nexora/frontend"
  description = "Frontend container image repository"
}

variable "frontend_image_tag" {
  type        = string
  default     = "latest"
  description = "Frontend container image tag"
}

variable "agent_image_repository" {
  type        = string
  default     = "nexora/agent"
  description = "Agent container image repository"
}

variable "agent_image_tag" {
  type        = string
  default     = "latest"
  description = "Agent container image tag"
}

variable "image_pull_policy" {
  type        = string
  default     = "IfNotPresent"
  description = "Image pull policy for backend and frontend deployments"
}

variable "image_pull_secrets" {
  type        = list(string)
  default     = []
  description = "Optional Kubernetes image pull secret names"
}

variable "database_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Optional external or managed PostgreSQL connection string injected into backend.secrets.DATABASE_URL. Leave empty to provision in-cluster PostgreSQL when postgresql_enabled=true."
}

variable "postgresql_enabled" {
  type        = bool
  default     = true
  description = "Whether Terraform should provision an in-cluster PostgreSQL Helm release when database_url is empty"
}

variable "postgresql_release_name" {
  type        = string
  default     = ""
  description = "Optional Helm release name override for PostgreSQL"
}

variable "postgresql_chart_repository" {
  type        = string
  default     = "https://charts.bitnami.com/bitnami"
  description = "Helm repository used for the PostgreSQL chart"
}

variable "postgresql_chart_name" {
  type        = string
  default     = "postgresql"
  description = "Helm chart name used for the PostgreSQL deployment"
}

variable "postgresql_chart_version" {
  type        = string
  default     = ""
  description = "Optional PostgreSQL chart version pin"
}

variable "postgresql_database" {
  type        = string
  default     = "nexora"
  description = "Database name created for Nexora when Terraform provisions PostgreSQL"
}

variable "postgresql_username" {
  type        = string
  default     = "nexora"
  description = "Database username created for Nexora when Terraform provisions PostgreSQL"
}

variable "postgresql_password" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Optional PostgreSQL password. Leave empty to let Terraform generate one for the in-cluster PostgreSQL release."
}

variable "postgresql_service_port" {
  type        = number
  default     = 5432
  description = "PostgreSQL service port"
}

variable "postgresql_persistence_enabled" {
  type        = bool
  default     = true
  description = "Whether PostgreSQL data should be persisted in the cluster"
}

variable "postgresql_storage_size" {
  type        = string
  default     = "20Gi"
  description = "Persistent volume size for in-cluster PostgreSQL"
}

variable "postgresql_storage_class_name" {
  type        = string
  default     = ""
  description = "Optional storage class name for PostgreSQL persistence"
}

variable "redis_enabled" {
  type        = bool
  default     = true
  description = "Whether the Nexora chart should provision its in-cluster Redis deployment"
}

variable "redis_url" {
  type        = string
  default     = ""
  description = "Optional external Redis URL. Leave empty to use the in-cluster Redis service when redis_enabled=true."
}

variable "backend_replicas" {
  type        = number
  default     = 2
  description = "Replica count for the backend deployment"
}

variable "frontend_replicas" {
  type        = number
  default     = 2
  description = "Replica count for the frontend deployment"
}

variable "agent_enabled" {
  type        = bool
  default     = true
  description = "Whether the remote agent deployment should be enabled"
}

variable "agent_replicas" {
  type        = number
  default     = 1
  description = "Replica count for the agent deployment"
}

variable "backend_environment" {
  type        = string
  default     = "development"
  description = "Value passed to NEXORA_ENV"
}

variable "backend_require_explicit_cors" {
  type        = bool
  default     = false
  description = "Whether to require explicit CORS configuration even outside production"
}

variable "backend_allowed_origins" {
  type        = list(string)
  default     = ["https://nexora.local"]
  description = "Comma-joined list of allowed browser origins for backend CORS"
}

variable "backend_allowed_origin_regex" {
  type        = string
  default     = ""
  description = "Optional regex passed to NEXORA_ALLOWED_ORIGIN_REGEX"
}

variable "backend_allow_dev_tokens" {
  type        = bool
  default     = true
  description = "Whether dev token issuance remains enabled"
}

variable "backend_jwt_algorithm" {
  type        = string
  default     = "HS256"
  description = "JWT algorithm passed to NEXORA_JWT_ALGO"
}

variable "backend_jwks_url" {
  type        = string
  default     = ""
  description = "Optional JWKS URL passed to NEXORA_JWKS_URL"
}

variable "backend_jwks_audience" {
  type        = string
  default     = ""
  description = "Optional JWT audience passed to NEXORA_JWKS_AUD"
}

variable "backend_dev_token_expiration_seconds" {
  type        = number
  default     = 86400
  description = "Lifetime for developer-issued tokens in seconds"
}

variable "backend_default_role" {
  type        = string
  default     = "admin"
  description = "Fallback role passed to NEXORA_DEFAULT_ROLE"
}

variable "backend_default_tenant_id" {
  type        = string
  default     = "default"
  description = "Fallback tenant id passed to NEXORA_DEFAULT_TENANT_ID"
}

variable "backend_default_user_id" {
  type        = string
  default     = "admin@nexora.local"
  description = "Fallback user id passed to NEXORA_DEFAULT_USER_ID"
}

variable "backend_llm_provider" {
  type        = string
  default     = "mock"
  description = "LLM provider passed to NEXORA_LLM_PROVIDER"
}

variable "backend_openai_model" {
  type        = string
  default     = "gpt-4o-mini"
  description = "Default OpenAI model passed to NEXORA_OPENAI_MODEL"
}

variable "backend_work_broker" {
  type        = string
  default     = "redis"
  description = "Backend broker mode passed to NEXORA_WORK_BROKER"
}

variable "backend_broker_db_fallback_enabled" {
  type        = bool
  default     = true
  description = "Whether broker poll endpoints can fall back to database scans"
}

variable "backend_broker_queue_prefix" {
  type        = string
  default     = "nexora"
  description = "Queue prefix passed to NEXORA_BROKER_QUEUE_PREFIX"
}

variable "backend_broker_visibility_timeout_seconds" {
  type        = number
  default     = 30
  description = "Visibility timeout for broker messages"
}

variable "backend_broker_maintenance_interval_seconds" {
  type        = number
  default     = 10
  description = "Maintenance interval for broker recovery loops"
}

variable "backend_broker_message_max_retries" {
  type        = number
  default     = 3
  description = "Maximum number of broker retries per message"
}

variable "backend_broker_message_ttl_seconds" {
  type        = number
  default     = 900
  description = "Broker message TTL in seconds"
}

variable "backend_broker_requeue_loop_threshold" {
  type        = number
  default     = 2
  description = "Threshold used to detect broker requeue loops"
}

variable "backend_broker_requeue_history_limit" {
  type        = number
  default     = 6
  description = "Number of requeue events kept in broker history"
}

variable "backend_remote_run_lease_seconds" {
  type        = number
  default     = 90
  description = "Lease duration for remote pipeline runs"
}

variable "backend_remote_run_max_attempts" {
  type        = number
  default     = 3
  description = "Maximum attempts for remote pipeline runs"
}

variable "backend_remote_job_lease_seconds" {
  type        = number
  default     = 90
  description = "Lease duration for remote platform jobs"
}

variable "backend_remote_job_max_attempts" {
  type        = number
  default     = 3
  description = "Maximum attempts for remote platform jobs"
}

variable "backend_pipeline_log_page_size" {
  type        = number
  default     = 200
  description = "Pipeline log page size used by the backend runtime"
}

variable "backend_hitl_threshold" {
  type        = number
  default     = 0.85
  description = "Threshold passed to NEXORA_HITL_THRESHOLD"
}

variable "backend_jwt_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "JWT secret injected into backend.secrets.NEXORA_JWT_SECRET"
}

variable "openai_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "OpenAI API key injected into backend.secrets.OPENAI_API_KEY"
}

variable "nexora_openai_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Alternate OpenAI API key injected into backend.secrets.NEXORA_OPENAI_API_KEY"
}

variable "backend_db_connect_retries" {
  type        = number
  default     = 10
  description = "Backend startup retry count for database connectivity"
}

variable "backend_db_connect_retry_delay" {
  type        = number
  default     = 3
  description = "Seconds between backend database connection retries"
}

variable "backend_extra_env" {
  type        = map(string)
  default     = {}
  description = "Additional non-secret backend environment variables"
}

variable "agent_control_url" {
  type        = string
  default     = ""
  description = "Optional override for NEXORA_CONTROL_URL. Leave empty to let Terraform resolve the in-cluster backend service URL."
}

variable "agent_consumer_mode" {
  type        = string
  default     = "broker"
  description = "Agent consumer mode passed to NEXORA_AGENT_CONSUMER_MODE"
}

variable "agent_heartbeat_interval" {
  type        = number
  default     = 20
  description = "Agent heartbeat interval in seconds"
}

variable "agent_poll_interval" {
  type        = number
  default     = 2
  description = "Agent broker poll interval in seconds"
}

variable "agent_extra_env" {
  type        = map(string)
  default     = {}
  description = "Additional non-secret agent environment variables"
}

variable "frontend_public_api_base_url" {
  type        = string
  default     = "/api"
  description = "Public API base path used by the browser-facing frontend"
}

variable "frontend_internal_api_base_url" {
  type        = string
  default     = ""
  description = "Optional backend URL used by the frontend server runtime; leave empty to let Terraform resolve the in-cluster backend service URL"
}

variable "frontend_extra_env" {
  type        = map(string)
  default     = {}
  description = "Additional non-secret frontend environment variables"
}

variable "ingress_enabled" {
  type        = bool
  default     = false
  description = "Whether to create an ingress resource for the Nexora frontend and /api backend path"
}

variable "ingress_class_name" {
  type        = string
  default     = ""
  description = "Ingress class name to set on the chart"
}

variable "ingress_host" {
  type        = string
  default     = "nexora.local"
  description = "Ingress host used when ingress is enabled"
}

variable "ingress_annotations" {
  type        = map(string)
  default     = {}
  description = "Annotations applied to the ingress"
}

variable "ingress_frontend_path" {
  type        = string
  default     = "/"
  description = "Ingress path routed to the frontend service"
}

variable "ingress_frontend_path_type" {
  type        = string
  default     = "Prefix"
  description = "Ingress path type for the frontend route"
}

variable "ingress_backend_path" {
  type        = string
  default     = "/api"
  description = "Ingress path routed to the backend service"
}

variable "ingress_backend_path_type" {
  type        = string
  default     = "Prefix"
  description = "Ingress path type for the backend route"
}

variable "ingress_tls" {
  type = list(object({
    secret_name = string
    hosts       = list(string)
  }))
  default     = []
  description = "Optional ingress TLS definitions"
}
