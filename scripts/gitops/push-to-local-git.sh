#!/usr/bin/env bash
# Publish local main to the in-cluster rehearsal Git server.
# A git bundle is copied into the pod with `kubectl cp`, checksum-verified and
# fetched there. (Streaming `git push` through `kubectl port-forward`, or large
# payloads through `kubectl exec` stdin, hangs or truncates on Windows; kubectl cp
# is reliable as long as the local path is relative, without a drive letter.)
# Only commits the server does not have yet are bundled. `git remote -v` stays empty.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo="$(pwd)"
# Under Git Bash, hand kubectl a Windows-style KUBECONFIG path: MSYS_NO_PATHCONV
# (used below) would otherwise leave a /c/... path that kubectl.exe cannot open.
if [ -n "${KUBECONFIG:-}" ] && command -v cygpath >/dev/null 2>&1; then
  KUBECONFIG="$(cygpath -m -p "${KUBECONFIG}")"
  export KUBECONFIG
fi

work="${TMPDIR:-/tmp}/pantrix-gitops-push"
mkdir -p "${work}"

pod="$(kubectl -n gitops get pod -l app=git-server -o jsonpath='{.items[0].metadata.name}')"
# MSYS_NO_PATHCONV keeps Git Bash from rewriting in-pod paths such as /srv/git.
in_pod() { MSYS_NO_PATHCONV=1 kubectl -n gitops exec "${pod}" -- "$@"; }

# Bundle only what the server is missing (full history the first time).
server_head="$(in_pod git -C /srv/git/pantrix.git rev-parse --verify -q main 2>/dev/null | tr -d '\r' || true)"
range=(main)
if [ -n "${server_head}" ] && git merge-base --is-ancestor "${server_head}" main 2>/dev/null; then
  if [ "${server_head}" = "$(git rev-parse main)" ]; then
    echo "rehearsal server already at $(git rev-parse --short main)"
    exit 0
  fi
  range=(main "^${server_head}")
fi
git bundle create "${work}/pantrix.bundle" "${range[@]}" >/dev/null 2>&1
sum="$(sha256sum "${work}/pantrix.bundle" | cut -d' ' -f1)"

(cd "${work}" && MSYS_NO_PATHCONV=1 kubectl cp pantrix.bundle "gitops/${pod}:/tmp/pantrix.bundle")
cd "${repo}"

remote_sum="$(in_pod sha256sum /tmp/pantrix.bundle | cut -d' ' -f1)"
if [ "${remote_sum}" != "${sum}" ]; then
  echo "bundle checksum mismatch after copy (${remote_sum} != ${sum})" >&2
  exit 1
fi
in_pod git -C /srv/git/pantrix.git fetch -q --force /tmp/pantrix.bundle main:main
in_pod git -C /srv/git/pantrix.git log --oneline -1 main
