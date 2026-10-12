#!/usr/bin/env bash
# Generate realistic Pantrix API traffic (reads, writes, hand-outs, a few 404/409/422s)
# so the Grafana panels have data.   Usage: generate-traffic.sh [BASE_URL] [SECONDS]
set -uo pipefail
BASE="${1:-http://pantrix.localtest.me}"
DURATION="${2:-180}"
end=$(( $(date +%s) + DURATION ))
n=0
categories=(produce dairy grains canned protein bakery hygiene baby)

while [ "$(date +%s)" -lt "$end" ]; do
  curl -s -o /dev/null "${BASE}/api/items"
  curl -s -o /dev/null "${BASE}/api/items/stats"
  curl -s -o /dev/null "${BASE}/api/items?category=${categories[$((n % 8))]}"
  curl -s -o /dev/null "${BASE}/api/donors"
  curl -s -o /dev/null "${BASE}/api/distributions"
  if (( n % 5 == 0 )); then
    id=$(curl -s -X POST "${BASE}/api/items" -H 'Content-Type: application/json' \
      -d "{\"name\":\"Load-test rice ${n}\",\"category\":\"grains\",\"quantity\":20,\"unit\":\"kg\",\"location\":\"LT-${n}\"}" \
      | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    if [ -n "${id}" ]; then
      curl -s -o /dev/null -X PUT "${BASE}/api/items/${id}" -H 'Content-Type: application/json' -d '{"quantity":15}'
      curl -s -o /dev/null -X POST "${BASE}/api/distributions" -H 'Content-Type: application/json' \
        -d "{\"item_id\":${id},\"quantity\":5,\"recipient\":\"Load-test shelter\"}"
      curl -s -o /dev/null -X POST "${BASE}/api/distributions" -H 'Content-Type: application/json' \
        -d "{\"item_id\":${id},\"quantity\":999,\"recipient\":\"Over-ask (expect 409)\"}"
      curl -s -o /dev/null -X DELETE "${BASE}/api/items/${id}"
    fi
  fi
  (( n % 7 == 0 )) && curl -s -o /dev/null "${BASE}/api/items/999999"            # 404
  (( n % 9 == 0 )) && curl -s -o /dev/null -X POST "${BASE}/api/items" \
      -H 'Content-Type: application/json' -d '{"name":"x","category":"tools","quantity":-1}'  # 422
  n=$((n + 1))
done
echo "sent ${n} traffic rounds to ${BASE}"
