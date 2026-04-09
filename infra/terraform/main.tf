terraform {
  required_version = ">= 1.3"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.16"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig_path
  }
}

resource "kubernetes_namespace_v1" "nexora" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace
  }
}

resource "random_password" "postgresql" {
  count = var.postgresql_enabled && trimspace(var.database_url) == "" && trimspace(var.postgresql_password) == "" ? 1 : 0

  length  = 32
  special = false
}

locals {
  namespace_name        = trimspace(var.namespace)
  release_fullname      = trimspace(var.fullname_override) != "" ? trimspace(var.fullname_override) : trimspace(var.release_name)
  postgresql_release    = trimspace(var.postgresql_release_name) != "" ? trimspace(var.postgresql_release_name) : "${local.release_fullname}-postgresql"
  postgresql_service    = "${local.postgresql_release}-postgresql"
  postgresql_password   = trimspace(var.postgresql_password) != "" ? trimspace(var.postgresql_password) : (var.postgresql_enabled && trimspace(var.database_url) == "" ? random_password.postgresql[0].result : "")
  backend_service_name  = "${local.release_fullname}-backend"
  frontend_service_name = "${local.release_fullname}-frontend"
  redis_service_name    = "${local.release_fullname}-redis"
  backend_service_url   = format("http://%s.%s.svc.cluster.local:%d", local.backend_service_name, local.namespace_name, var.backend_service_port)
  frontend_service_url  = format("http://%s.%s.svc.cluster.local:%d", local.frontend_service_name, local.namespace_name, var.frontend_service_port)

  database_url = trimspace(var.database_url) != "" ? trimspace(var.database_url) : (
    var.postgresql_enabled ? format(
      "postgresql+psycopg://%s:%s@%s.%s.svc.cluster.local:%d/%s",
      urlencode(var.postgresql_username),
      urlencode(local.postgresql_password),
      local.postgresql_service,
      local.namespace_name,
      var.postgresql_service_port,
      urlencode(var.postgresql_database),
    ) : ""
  )

  redis_url = trimspace(var.redis_url) != "" ? trimspace(var.redis_url) : (
    var.redis_enabled ? format(
      "redis://%s.%s.svc.cluster.local:%d/0",
      local.redis_service_name,
      local.namespace_name,
      var.redis_service_port,
    ) : ""
  )

  frontend_public_api_base_url   = trimspace(var.frontend_public_api_base_url) != "" ? trimspace(var.frontend_public_api_base_url) : "/api"
  frontend_internal_api_base_url = trimspace(var.frontend_internal_api_base_url) != "" ? trimspace(var.frontend_internal_api_base_url) : local.backend_service_url
  agent_control_url              = trimspace(var.agent_control_url) != "" ? trimspace(var.agent_control_url) : local.backend_service_url

  ingress_tls = [
    for item in var.ingress_tls : {
      hosts      = item.hosts
      secretName = item.secret_name
    }
  ]

  postgresql_values = {
    architecture = "standalone"
    auth = {
      username = var.postgresql_username
      database = var.postgresql_database
    }
    primary = {
      persistence = merge(
        {
          enabled = var.postgresql_persistence_enabled
          size    = var.postgresql_storage_size
        },
        trimspace(var.postgresql_storage_class_name) != "" ? {
          storageClass = trimspace(var.postgresql_storage_class_name)
        } : {},
      )
    }
  }

  backend_env = merge(
    {
      NEXORA_ENV                                 = var.backend_environment
      NEXORA_REQUIRE_EXPLICIT_CORS               = tostring(var.backend_require_explicit_cors)
      NEXORA_ALLOWED_ORIGINS                     = join(",", var.backend_allowed_origins)
      NEXORA_ALLOWED_ORIGIN_REGEX                = var.backend_allowed_origin_regex
      NEXORA_ALLOW_DEV_TOKENS                    = tostring(var.backend_allow_dev_tokens)
      NEXORA_JWT_ALGO                            = var.backend_jwt_algorithm
      NEXORA_JWKS_URL                            = var.backend_jwks_url
      NEXORA_JWKS_AUD                            = var.backend_jwks_audience
      NEXORA_DEV_TOKEN_EXP_SECONDS               = tostring(var.backend_dev_token_expiration_seconds)
      NEXORA_DEFAULT_ROLE                        = var.backend_default_role
      NEXORA_DEFAULT_TENANT_ID                   = var.backend_default_tenant_id
      NEXORA_DEFAULT_USER_ID                     = var.backend_default_user_id
      NEXORA_LLM_PROVIDER                        = var.backend_llm_provider
      NEXORA_OPENAI_MODEL                        = var.backend_openai_model
      NEXORA_WORK_BROKER                         = var.backend_work_broker
      NEXORA_BROKER_URL                          = local.redis_url
      NEXORA_BROKER_DB_FALLBACK_ENABLED          = tostring(var.backend_broker_db_fallback_enabled)
      NEXORA_BROKER_QUEUE_PREFIX                 = var.backend_broker_queue_prefix
      NEXORA_BROKER_VISIBILITY_TIMEOUT_SECONDS   = tostring(var.backend_broker_visibility_timeout_seconds)
      NEXORA_BROKER_MAINTENANCE_INTERVAL_SECONDS = tostring(var.backend_broker_maintenance_interval_seconds)
      NEXORA_BROKER_MESSAGE_MAX_RETRIES          = tostring(var.backend_broker_message_max_retries)
      NEXORA_BROKER_MESSAGE_TTL_SECONDS          = tostring(var.backend_broker_message_ttl_seconds)
      NEXORA_BROKER_REQUEUE_LOOP_THRESHOLD       = tostring(var.backend_broker_requeue_loop_threshold)
      NEXORA_BROKER_REQUEUE_HISTORY_LIMIT        = tostring(var.backend_broker_requeue_history_limit)
      NEXORA_REMOTE_RUN_LEASE_SECONDS            = tostring(var.backend_remote_run_lease_seconds)
      NEXORA_REMOTE_RUN_MAX_ATTEMPTS             = tostring(var.backend_remote_run_max_attempts)
      NEXORA_REMOTE_JOB_LEASE_SECONDS            = tostring(var.backend_remote_job_lease_seconds)
      NEXORA_REMOTE_JOB_MAX_ATTEMPTS             = tostring(var.backend_remote_job_max_attempts)
      NEXORA_PIPELINE_LOG_PAGE_SIZE              = tostring(var.backend_pipeline_log_page_size)
      NEXORA_HITL_THRESHOLD                      = tostring(var.backend_hitl_threshold)
      NEXORA_DB_CONNECT_RETRIES                  = tostring(var.backend_db_connect_retries)
      NEXORA_DB_CONNECT_RETRY_DELAY              = tostring(var.backend_db_connect_retry_delay)
    },
    var.backend_extra_env,
  )

  frontend_env = merge(
    {
      NEXT_PUBLIC_API_BASE_URL = local.frontend_public_api_base_url
      INTERNAL_API_BASE_URL    = local.frontend_internal_api_base_url
    },
    var.frontend_extra_env,
  )

  agent_env = merge(
    {
      NEXORA_CONTROL_URL              = local.agent_control_url
      NEXORA_WORK_BROKER              = var.backend_work_broker
      NEXORA_BROKER_URL               = local.redis_url
      NEXORA_AGENT_CONSUMER_MODE      = var.agent_consumer_mode
      NEXORA_AGENT_HEARTBEAT_INTERVAL = tostring(var.agent_heartbeat_interval)
      POLL_INTERVAL                   = tostring(var.agent_poll_interval)
    },
    var.agent_extra_env,
  )

  helm_values = {
    fullnameOverride = local.release_fullname
    imagePullSecrets = [for secret_name in var.image_pull_secrets : { name = secret_name }]

    backend = {
      image = {
        repository = var.backend_image_repository
        tag        = var.backend_image_tag
        pullPolicy = var.image_pull_policy
      }
      service = {
        port = var.backend_service_port
      }
      replicas = var.backend_replicas
      env      = local.backend_env
    }

    agent = {
      enabled = var.agent_enabled
      image = {
        repository = var.agent_image_repository
        tag        = var.agent_image_tag
        pullPolicy = var.image_pull_policy
      }
      replicas = var.agent_replicas
      env      = local.agent_env
    }

    frontend = {
      image = {
        repository = var.frontend_image_repository
        tag        = var.frontend_image_tag
        pullPolicy = var.image_pull_policy
      }
      service = {
        port = var.frontend_service_port
      }
      replicas = var.frontend_replicas
      env      = local.frontend_env
    }

    redis = {
      enabled = var.redis_enabled
      service = {
        port = var.redis_service_port
      }
    }

    ingress = {
      enabled          = var.ingress_enabled
      className        = var.ingress_class_name
      host             = var.ingress_host
      annotations      = var.ingress_annotations
      frontendPath     = var.ingress_frontend_path
      frontendPathType = var.ingress_frontend_path_type
      backendPath      = var.ingress_backend_path
      backendPathType  = var.ingress_backend_path_type
      tls              = local.ingress_tls
    }
  }
}

resource "helm_release" "postgresql" {
  count = var.postgresql_enabled && trimspace(var.database_url) == "" ? 1 : 0

  name             = local.postgresql_release
  repository       = var.postgresql_chart_repository
  chart            = var.postgresql_chart_name
  version          = trimspace(var.postgresql_chart_version) != "" ? trimspace(var.postgresql_chart_version) : null
  namespace        = local.namespace_name
  create_namespace = false
  atomic           = true
  cleanup_on_fail  = true
  timeout          = var.helm_timeout_seconds
  wait             = true

  values = [yamlencode(local.postgresql_values)]

  set_sensitive {
    name  = "auth.password"
    value = local.postgresql_password
  }

  depends_on = [kubernetes_namespace_v1.nexora]
}

resource "helm_release" "nexora" {
  name             = var.release_name
  chart            = "${path.module}/../../helm/nexora"
  namespace        = local.namespace_name
  create_namespace = false
  atomic           = true
  cleanup_on_fail  = true
  timeout          = var.helm_timeout_seconds
  wait             = true

  values = [yamlencode(local.helm_values)]

  set_sensitive {
    name  = "backend.secrets.DATABASE_URL"
    value = local.database_url
  }

  set_sensitive {
    name  = "backend.secrets.NEXORA_JWT_SECRET"
    value = var.backend_jwt_secret
  }

  set_sensitive {
    name  = "backend.secrets.OPENAI_API_KEY"
    value = var.openai_api_key
  }

  set_sensitive {
    name  = "backend.secrets.NEXORA_OPENAI_API_KEY"
    value = var.nexora_openai_api_key
  }

  depends_on = [
    kubernetes_namespace_v1.nexora,
    helm_release.postgresql,
  ]

  lifecycle {
    precondition {
      condition     = trimspace(local.database_url) != ""
      error_message = "Set database_url or leave postgresql_enabled=true so Terraform can supply backend.secrets.DATABASE_URL."
    }

    precondition {
      condition     = lower(trimspace(var.backend_work_broker)) != "redis" || trimspace(local.redis_url) != ""
      error_message = "Set redis_url or leave redis_enabled=true so Terraform can supply backend.env.NEXORA_BROKER_URL."
    }

    precondition {
      condition     = can(regex("^(/|https?://)", local.frontend_public_api_base_url))
      error_message = "frontend_public_api_base_url must start with / or be an absolute http(s) URL so the frontend can resolve API requests."
    }

    precondition {
      condition     = can(regex("^https?://", local.frontend_internal_api_base_url))
      error_message = "frontend_internal_api_base_url must resolve to an absolute http(s) URL for the frontend server runtime."
    }

    precondition {
      condition     = !var.agent_enabled || can(regex("^https?://", local.agent_control_url))
      error_message = "agent_control_url must resolve to an absolute http(s) URL when the agent deployment is enabled."
    }
  }
}
