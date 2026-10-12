#!/usr/bin/env bash
# Promote an image SHA to the GitOps dev environment: edit the desired state,
# commit it, publish it to the rehearsal Git server and wait for Argo CD.
#   scripts/gitops/promote.sh [<40-char git sha>]   # default: HEAD
# On GitHub the same edit is made by .github/workflows/promote.yml.
set -euo pipefail
cd "$(dirname "$0")/../.."

SHA="${1:-$(git rev-parse HEAD)}"
[[ "${SHA}" =~ ^[0-9a-f]{40}$ ]] || { echo "expected a full 40-character commit SHA" >&2; exit 2; }
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
