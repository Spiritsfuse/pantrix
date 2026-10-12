#!/usr/bin/env bash
# Install Prometheus + Grafana (kube-prometheus-stack), the Pantrix dashboard and
# alert rules. Grafana: http://grafana.localtest.me  Prometheus: http://prometheus.localtest.me
set -euo pipefail
cd "$(dirname "$0")/../.."

KPS_VERSION="${KPS_VERSION:-92.3.0}"

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Random Grafana admin password, generated once and never written to Git.
if ! kubectl -n monitoring get secret grafana-admin >/dev/null 2>&1; then
  kubectl -n monitoring create secret generic grafana-admin \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community >/dev/null
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --version "${KPS_VERSION}" -f monitoring/prometheus-values.yaml --wait --timeout 10m

# Dashboard is loaded by the Grafana sidecar from any ConfigMap labelled grafana_dashboard=1.
kubectl -n monitoring create configmap pantrix-dashboard \
  --from-file=pantrix-overview.json=monitoring/dashboards/pantrix-overview.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl annotate --local -f - grafana_folder=Pantrix -o yaml \
  | kubectl apply -f -

kubectl apply -f monitoring/pantrix-alerts.yaml

echo
echo "Grafana:    http://grafana.localtest.me   (user: admin)"
echo "Password:   kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d"
echo "Prometheus: http://prometheus.localtest.me/targets"
