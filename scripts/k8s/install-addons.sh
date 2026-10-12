#!/usr/bin/env bash
# Install the cluster add-ons Pantrix relies on: an Ingress controller and
# metrics-server (needed by the HPA). Idempotent; safe to re-run.
set -euo pipefail

# On failure, say why: the pod table and the newest events, one line each so CI
# surfaces them as annotations even when the full log is not at hand.
diagnose() {
  echo "::group::add-on diagnostics"
  kubectl get pods -A -o wide || true
  kubectl get events -A --sort-by=.lastTimestamp | tail -25 || true
  echo "::endgroup::"
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::error title=add-ons failed::pods: $(kubectl get pods -A --no-headers 2>&1 | awk '{printf "%s/%s %s %s; ", $1, $2, $4, $3}')"
    echo "::error title=add-on events::$(kubectl get events -A --sort-by=.lastTimestamp --no-headers 2>&1 | tail -6 | tr '
' '|' | cut -c1-900)"
  fi
}
trap diagnose ERR

INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-controller-v1.15.1}"
METRICS_SERVER_VERSION="${METRICS_SERVER_VERSION:-v0.9.0}"

echo "==> ingress-nginx ${INGRESS_NGINX_VERSION} (kind provider manifest)"
kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/kind/deploy.yaml"

echo "==> metrics-server ${METRICS_SERVER_VERSION}"
kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml"
# kind kubelets use self-signed serving certs.
kubectl -n kube-system patch deployment metrics-server --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' 2>/dev/null || true

echo "==> waiting for the ingress controller"
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
# The admission webhook answers a few seconds after the pod is Ready; installing
# an Ingress before then fails with "failed calling webhook".
for _ in $(seq 1 30); do
  if kubectl -n ingress-nginx get endpoints ingress-nginx-controller-admission \
       -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null | grep -q .; then
    break
  fi
  sleep 2
done
kubectl -n kube-system rollout status deployment/metrics-server --timeout=300s
echo "==> add-ons ready"
