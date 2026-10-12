#!/usr/bin/env bash
# Push local main to the in-cluster rehearsal Git server through a temporary
# port-forward. Uses a URL, so `git remote -v` stays empty.
set -euo pipefail
cd "$(dirname "$0")/../.."
kubectl -n gitops port-forward svc/git-server 19418:9418 >/dev/null 2>&1 &
pf=$!
trap 'kill ${pf} 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/19418) 2>/dev/null && break; sleep 1; done
git push --force git://127.0.0.1:19418/pantrix.git HEAD:refs/heads/main
