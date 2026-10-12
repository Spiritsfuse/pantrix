#!/usr/bin/env bash
# End-to-end check through the Ingress: UI, API read, API write, readiness.
set -euo pipefail
BASE="${1:-http://pantrix.localtest.me}"

retry() { for i in $(seq 1 30); do "$@" && return 0; sleep 2; done; return 1; }

echo "GET  ${BASE}/"
retry curl -fsS "${BASE}/" | grep -q "<title>Pantrix"
echo "GET  ${BASE}/api/items/stats"
retry curl -fsS "${BASE}/api/items/stats" | tee /dev/stderr | grep -q total_items
echo
echo "POST ${BASE}/api/items"
id=$(curl -fsS -X POST "${BASE}/api/items" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke-test lentils","category":"grains","quantity":3,"unit":"kg"}' \
  | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "DELETE ${BASE}/api/items/${id}"
curl -fsS -o /dev/null -w '%{http_code}\n' -X DELETE "${BASE}/api/items/${id}" | grep -q 204
echo "smoke test passed"
