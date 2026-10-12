#!/usr/bin/env bash
# Install Argo CD, start the in-cluster rehearsal Git server, push the current
# main branch to it (by URL — no git remote is added), create the database Secret
# and register the Pantrix Application.
set -euo pipefail
cd "$(dirname "$0")/../.."

ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-10.10.3}"

echo "==> Argo CD ${ARGOCD_CHART_VERSION}"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace \
  --version "${ARGOCD_CHART_VERSION}" -f gitops/argocd/values.yaml --wait --timeout 10m

echo "==> target namespace and database Secret (generated once, never in Git)"
kubectl apply -f gitops/namespace.yaml
if ! kubectl -n pantrix-gitops get secret pantrix-db >/dev/null 2>&1; then
  pw="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  kubectl -n pantrix-gitops create secret generic pantrix-db \
    --from-literal=POSTGRES_PASSWORD="${pw}" \
    --from-literal=DATABASE_URL="postgresql+psycopg://pantrix:${pw}@pantrix-postgres:5432/pantrix"
fi

echo "==> rehearsal Git server"
kubectl apply -f gitops/local-git-server.yaml
kubectl -n gitops rollout status deploy/git-server --timeout=120s
bash scripts/gitops/push-to-local-git.sh

echo "==> Application"
kubectl apply -f gitops/application.yaml
echo
echo "Argo CD:  http://argocd.localtest.me   (user: admin)"
echo "Password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
