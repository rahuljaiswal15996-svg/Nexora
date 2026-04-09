{{- /* Helper templates for Nexora chart */ -}}
{{- define "nexora.name" -}}
{{- default .Chart.Name .Values.nameOverride -}}
{{- end -}}

{{- define "nexora.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "nexora.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "nexora.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "nexora.labels" -}}
helm.sh/chart: {{ include "nexora.chart" . }}
app.kubernetes.io/name: {{ include "nexora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "nexora.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "nexora.backend.validate" -}}
{{- $env := default dict .Values.backend.env -}}
{{- $secretEnv := coalesce .Values.backend.secrets .Values.backend.secretEnv (dict) -}}
{{- $environment := lower (trim (toString (default "development" (coalesce (index $env "NEXORA_ENV") (index $env "ENVIRONMENT"))))) -}}
{{- $isProduction := or (eq $environment "production") (eq $environment "prod") -}}
{{- $requireExplicitCorsRaw := lower (trim (toString (default "" (index $env "NEXORA_REQUIRE_EXPLICIT_CORS")))) -}}
{{- $explicitCorsRequired := or $isProduction (regexMatch "^(1|true|yes|on)$" $requireExplicitCorsRaw) -}}
{{- $allowedOrigins := default "" (index $env "NEXORA_ALLOWED_ORIGINS") -}}
{{- $allowedOriginRegex := default "" (index $env "NEXORA_ALLOWED_ORIGIN_REGEX") -}}
{{- $allowDevTokens := lower (trim (toString (default "" (index $env "NEXORA_ALLOW_DEV_TOKENS")))) -}}
{{- $databaseUrl := coalesce (index $secretEnv "DATABASE_URL") (index $env "DATABASE_URL") "" -}}
{{- $jwtSecret := coalesce (index $secretEnv "NEXORA_JWT_SECRET") (index $env "NEXORA_JWT_SECRET") "" -}}
{{- $jwksUrl := default "" (index $env "NEXORA_JWKS_URL") -}}
{{- $llmProvider := lower (trim (toString (default "mock" (index $env "NEXORA_LLM_PROVIDER")))) -}}
{{- $openaiApiKey := coalesce (index $secretEnv "OPENAI_API_KEY") (index $secretEnv "NEXORA_OPENAI_API_KEY") (index $env "OPENAI_API_KEY") (index $env "NEXORA_OPENAI_API_KEY") "" -}}
{{- if empty $databaseUrl -}}
{{- fail "helm/nexora: backend DATABASE_URL must be set via backend.secrets.DATABASE_URL (preferred) or backend.env.DATABASE_URL." -}}
{{- end -}}
{{- if and $explicitCorsRequired (empty $allowedOrigins) (empty $allowedOriginRegex) -}}
{{- fail "helm/nexora: backend explicit CORS is enabled, so set backend.env.NEXORA_ALLOWED_ORIGINS or backend.env.NEXORA_ALLOWED_ORIGIN_REGEX." -}}
{{- end -}}
{{- if and $isProduction (empty $jwtSecret) (empty $jwksUrl) -}}
{{- fail "helm/nexora: production backend requires backend.secrets.NEXORA_JWT_SECRET or backend.env.NEXORA_JWKS_URL." -}}
{{- end -}}
{{- if and $isProduction (regexMatch "^(1|true|yes|on)$" $allowDevTokens) -}}
{{- fail "helm/nexora: production backend must set backend.env.NEXORA_ALLOW_DEV_TOKENS to false." -}}
{{- end -}}
{{- if and (eq $llmProvider "openai") (empty $openaiApiKey) -}}
{{- fail "helm/nexora: backend.env.NEXORA_LLM_PROVIDER=openai requires backend.secrets.OPENAI_API_KEY or backend.secrets.NEXORA_OPENAI_API_KEY." -}}
{{- end -}}
{{- end -}}
