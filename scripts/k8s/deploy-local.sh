#!/usr/bin/env bash
# Build both images for the current commit, load them into the kind cluster and
# roll the Helm release forward. Mirrors what CI does with GHCR, minus the push.
#   scripts/k8s/deploy-local.sh            # uses HEAD
# Refuses to run with uncommitted changes so the image tag always equals the source.
set -euo pipefail
cd "$(dirname "$0")/../.."

CLUSTER="${KIND_CLUSTER:-pantrix}"
REGISTRY="${REGISTRY:-ghcr.io/spiritsfuse}"

if [ -n "$(git status --porcelain -- backend frontend helm)" ]; then
  echo "Uncommitted changes in backend/, frontend/ or helm/ - commit first so the tag matches the source." >&2
  exit 1
fi
SHA="$(git rev-parse HEAD)"

for c in backend frontend; do
  echo "==> building ${REGISTRY}/pantrix-${c}:${SHA}"
  docker build -q -t "${REGISTRY}/pantrix-${c}:${SHA}" "${c}"
  kind load docker-image --name "${CLUSTER}" "${REGISTRY}/pantrix-${c}:${SHA}"
done

kubectl apply -f k8s/namespace.yaml
helm upgrade --install pantrix helm/pantrix -n pantrix \
  -f helm/pantrix/values-dev.yaml \
  --set image.registry="${REGISTRY}" \
  --set image.tag="${SHA}" \
  --wait --timeout 8m
kubectl get pods,svc,ingress,hpa -n pantrix
