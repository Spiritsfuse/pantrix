# 0012 — Trimmed kube-prometheus-stack with a Pantrix dashboard

**Status:** Accepted

## Context

The stack needs Prometheus scraping the app, Grafana installed, and at least
one panel with live application metrics. All of it has to fit on the same
laptop cluster as the app and Argo CD.

## Options considered

1. **kube-prometheus-stack.** The Prometheus Operator, ServiceMonitor CRDs,
   Grafana and kube-state-metrics in one chart.
2. **Standalone Prometheus + Grafana charts.** Scrape config would be
   hand-written instead of declarative ServiceMonitors.
3. **Hosted Grafana Cloud.** Requires an external account and pushing data off
   the machine.

## Decision

kube-prometheus-stack 92.3.0 with `monitoring/prometheus-values.yaml`.

**Settings:**
- Prometheus has 2-day retention and a 15 s scrape interval.
- The `*SelectorNilUsesHelmValues: false` settings let it discover
  ServiceMonitors in any namespace.
- Prometheus and Grafana are exposed through the Ingress.
- The Grafana admin password comes from a Secret created by
  `scripts/monitoring/install-monitoring.sh` with a random value.

**Trimming, based on what happened on this laptop:**
- **Bundled dashboards off.** With the ~25 bundled dashboards, Grafana's search
  indexer used about 13 CPU cores on the kind node, so
  `grafana.defaultDashboardsEnabled: false`. Grafana is also capped at 1 CPU and
  768 Mi.
- **Unscrapeable targets off.** The node exporter and the kind control-plane
  scrapers (etcd, scheduler, controller-manager, proxy) are disabled because
  they cannot be scraped on kind.
- **Alertmanager off.** It was disabled when memory got tight. Alert rules
  (`monitoring/pantrix-alerts.yaml`) still evaluate in Prometheus.

The chart's ServiceMonitor scrapes `/metrics` on the backend Service. The
Pantrix dashboard (`monitoring/dashboards/pantrix-overview.json`) is loaded by
the Grafana sidecar from a labelled ConfigMap.

## Consequences

- Verified: Prometheus shows `serviceMonitor/pantrix/pantrix-backend/0` with
  6/6 targets UP during the load test. The dashboard panels were populated by
  real generated traffic (`docs/evidence/grafana-dashboard.png`).
- Kubernetes infrastructure dashboards are not installed. Explore can still
  query kube-state-metrics.
- Logs are structured JSON on stdout, but no Loki/Alloy pipeline is deployed.

## What I would do in production

Amazon Managed Prometheus/Grafana or a properly sized stack with remote storage,
Alertmanager routed to on-call, Loki or CloudWatch Logs for the JSON logs, and
SLO-based burn-rate alerts.
