{{- /* Helper templates for Nexora chart */ -}}
{{- define "nexora.name" -}}
{{- default .Chart.Name .Values.nameOverride -}}
{{- end -}}

{{- define "nexora.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride -}}
{{- else -}}
{{- printf "%s-%s" (include "nexora.name" .) .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
