#!/usr/bin/env bash
# Promote an image SHA to the GitOps dev environment: edit the desired state,
# commit it, publish it to the rehearsal Git server and wait for Argo CD.
#   scripts/gitops/promote.sh [<40-char git sha>]
# Default: the image tag the Helm-installed release in namespace "pantrix" runs,
# i.e. images that were actually built and verified. Never HEAD: a promotion
# commit itself has no images.
# On GitHub the same edit is made by .github/workflows/promote.yml.
set -euo pipefail
cd "$(dirname "$0")/../.."

SHA="${1:-$(helm get values pantrix -n pantrix -a -o json | grep -o '"tag":"[0-9a-f]\{40\}"' | head -1 | cut -d'"' -f4)}"
[[ "${SHA}" =~ ^[0-9a-f]{40}$ ]] || { echo "expected a full 40-character commit SHA" >&2; exit 2; }
for c in backend frontend; do
  docker image inspect "ghcr.io/spiritsfuse/pantrix-${c}:${SHA}" >/dev/null 2>&1 \
    || { echo "no local image ghcr.io/spiritsfuse/pantrix-${c}:${SHA} - build it first (deploy-local.sh)" >&2; exit 1; }
done
FILE=gitops/environments/dev/values.yaml

sed -i "s/^  tag: \"[0-9a-f]\{40\}\"/  tag: \"${SHA}\"/" "${FILE}"
if git diff --quiet -- "${FILE}"; then
  echo "dev already runs ${SHA:0:7}"
else
  git add "${FILE}"
  git commit -q -m "Promote ${SHA:0:7} to the dev environment through GitOps"
fi

bash scripts/gitops/push-to-local-git.sh
kubectl -n argocd annotate applications.argoproj.io pantrix-dev argocd.argoproj.io/refresh=normal --overwrite >/dev/null

want="$(git rev-parse HEAD)"
for _ in $(seq 1 60); do
  state="$(kubectl -n argocd get applications.argoproj.io pantrix-dev \
    -o jsonpath='{.status.sync.status} {.status.health.status} {.status.sync.revision}')"
  [ "${state}" = "Synced Healthy ${want}" ] && break
  sleep 5
done
echo "Argo CD: ${state}"
kubectl get deploy -n pantrix-gitops \
  -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas
