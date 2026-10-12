#!/usr/bin/env bash
# Publish local main to the in-cluster rehearsal Git server.
# A git bundle is streamed into the pod (base64, checksum-verified) and fetched
# there: streaming a push over `kubectl port-forward`, or raw binary over
# `kubectl exec` stdin, is unreliable on Windows. `git remote -v` stays empty.
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
git bundle create "${tmp}/pantrix.bundle" main >/dev/null 2>&1
sum="$(sha256sum "${tmp}/pantrix.bundle" | cut -d' ' -f1)"
base64 -w0 "${tmp}/pantrix.bundle" > "${tmp}/pantrix.b64"
pod="$(kubectl -n gitops get pod -l app=git-server -o jsonpath='{.items[0].metadata.name}')"
kubectl -n gitops exec -i "${pod}" -- sh -c 'base64 -d > /tmp/pantrix.bundle' < "${tmp}/pantrix.b64"
kubectl -n gitops exec "${pod}" -- sh -c "
  set -e
  echo '${sum}  /tmp/pantrix.bundle' | sha256sum -c -s
  git -C /srv/git/pantrix.git fetch --force /tmp/pantrix.bundle main:main
  rm /tmp/pantrix.bundle
  git -C /srv/git/pantrix.git log --oneline -1 main"
