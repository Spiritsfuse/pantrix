# Observability

## Metrics exposed by the backend (`GET /metrics`)

From `prometheus-fastapi-instrumentator` (`/metrics`, `/health` and `/ready`
excluded, status codes not grouped):

| Metric | Labels | Use |
|--------|--------|-----|
| `http_requests_total` | handler, method, status | request rate, error ratio |
| `http_request_duration_seconds` (histogram) | handler, method | latency percentiles |
| `http_request_duration_highr_seconds` (histogram) | — | fine-grained latency |
| `http_request_size_bytes`, `http_response_size_bytes` | handler | payload sizes |

Pantrix business counters (`backend/app/observability.py`):

| Metric | Labels | Incremented when |
|--------|--------|------------------|
| `pantrix_stock_events_total` | action = created / updated / deleted / distributed | a stock item changes through the API |
| `pantrix_units_distributed_total` | — | units are handed out |

Process and Python runtime metrics come from `prometheus_client` defaults.

## Scraping

The Helm chart's ServiceMonitor (enabled in `values-dev.yaml`) points Prometheus
at the backend Service port `http`, path `/metrics`, every 15 s. Prometheus is
configured to accept ServiceMonitors from any namespace. Verified: target pool
`serviceMonitor/pantrix/pantrix-backend/0` shows **6/6 UP** while the HPA had
scaled to six pods (`docs/evidence/prometheus-targets.png`).

## Dashboard — *Pantrix · API overview* (`monitoring/dashboards/pantrix-overview.json`)

| Panel | Query (abridged) |
|-------|------------------|
| Backend targets UP | `sum(up{job="pantrix-backend"})` |
| Request rate | `sum(rate(http_requests_total{job="pantrix-backend"}[1m]))` |
| 5xx error ratio | 5xx rate / total rate over 5 m |
| p95 latency | `histogram_quantile(0.95, …http_request_duration_seconds_bucket…)` |
| Units handed out | `sum(pantrix_units_distributed_total)` |
| Backend replicas (HPA) | `kube_horizontalpodautoscaler_status_current_replicas` |
| Requests/s by endpoint, latency p50/p95/p99, responses by status, stock changes by action, pod CPU, pod memory | time series |

The dashboard is provisioned by the Grafana sidecar from a ConfigMap labelled
`grafana_dashboard=1` (folder *Pantrix*). In the captured screenshot it is
populated by traffic from `scripts/monitoring/generate-traffic.sh`. That script
mixes reads, creates, updates, hand-outs, deletes, and deliberate 404/409/422
responses.

## Alerts (`monitoring/pantrix-alerts.yaml`, PrometheusRule)

| Alert | Condition |
|-------|-----------|
| PantrixBackendDown (critical) | no backend target UP for 2 m → runbook `docs/runbooks/backend-down.md` |
| PantrixHighErrorRate (warning) | 5xx > 5% of requests for 5 m |
| PantrixSlowRequests (warning) | p95 > 500 ms for 10 m |

The rules are evaluated by Prometheus. Alertmanager is disabled in the laptop
demo to save memory, so alerts are visible on Prometheus' *Alerts* page but are
not routed anywhere.

## Logs

The backend writes one JSON object per line to stdout:

```json
{"ts": "...", "level": "INFO", "logger": "pantrix.access", "msg": "request", "method": "GET", "path": "/api/items", "status": 200, "duration_ms": 4.1}
```

Access logs skip `/health`, `/ready` and `/metrics` to avoid probe noise.
Uvicorn's plain-text access log is disabled.

**Not implemented:** no log pipeline (Loki/Alloy or CloudWatch) is deployed.
Logs are read with `kubectl logs` / `docker compose logs`.

## Health endpoints

| Endpoint | Used by | Behaviour |
|----------|---------|-----------|
| `/health` | liveness and startup probes, Docker HEALTHCHECK | 200 if the process answers; no DB call, so a DB outage does not restart pods |
| `/ready` | readiness probe | `SELECT 1`; 503 if the DB is unreachable, so the pod leaves the Service endpoints |
| `/healthz` (frontend Nginx) | frontend probes | static 200 |
