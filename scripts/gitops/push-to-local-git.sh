#!/usr/bin/env bash
# Publish local main to the in-cluster rehearsal Git server.
# A git bundle is copied into the pod and fetched there; streaming a push over
# `kubectl port-forward` hangs on Windows. `git remote -v` stays empty.
set -euo pipefail
cd "$(dirname "$0")/../.."
bundle="$(mktemp -d)/pantrix.bundle"
git bundle create "${bundle}" main >/dev/null 2>&1
pod="$(kubectl -n gitops get pod -l app=git-server -o jsonpath='{.items[0].metadata.name}')"
# kubectl cp mis-parses Windows drive letters ("C:"), so stream the file instead.
kubectl -n gitops exec -i "${pod}" -- sh -c 'cat > /tmp/pantrix.bundle' < "${bundle}"
kubectl -n gitops exec "${pod}" -- sh -c \
  'git -C /srv/git/pantrix.git fetch --force /tmp/pantrix.bundle main:main && rm /tmp/pantrix.bundle && git -C /srv/git/pantrix.git log --oneline -1 main'
rm -f "${bundle}"
