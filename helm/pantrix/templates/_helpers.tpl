{{- define "pantrix.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "pantrix.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | trunc 12 | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: pantrix
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* Stable selector labels for one component: include "pantrix.selector" (list . "backend") */}}
{{- define "pantrix.selector" -}}
{{- $ctx := index . 0 -}}
app.kubernetes.io/name: {{ $ctx.Chart.Name }}
app.kubernetes.io/instance: {{ $ctx.Release.Name }}
app.kubernetes.io/component: {{ index . 1 }}
{{- end -}}

{{- define "pantrix.image" -}}
{{- $ctx := index . 0 -}}
{{- printf "%s/pantrix-%s:%s" $ctx.Values.image.registry (index . 1) $ctx.Values.image.tag -}}
{{- end -}}

{{- define "pantrix.dbSecret" -}}
{{- default (printf "%s-db" (include "pantrix.fullname" .)) .Values.postgres.existingSecret -}}
{{- end -}}

{{- define "pantrix.dbHost" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "%s-postgres" (include "pantrix.fullname" .) -}}
{{- else -}}
{{- required "postgres.externalHost is required when postgres.enabled=false" .Values.postgres.externalHost -}}
{{- end -}}
{{- end -}}

{{/* Restricted-profile security settings shared by every container. */}}
{{- define "pantrix.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
runAsNonRoot: true
capabilities:
  drop: ["ALL"]
seccompProfile:
  type: RuntimeDefault
{{- end -}}
