# 0008 — One Helm chart, in-cluster PostgreSQL for the demo, RDS for production

**Status:** Accepted

## Context

The deployment needs a Helm chart with Deployments (2+ replicas each), ClusterIP
Services, an Ingress (`/` → frontend, `/api` → backend) and an HPA. The app needs
a database in the cluster for the live demo.

## Options considered

1. **Bitnami PostgreSQL sub-chart.** Feature-rich, but a large dependency, and
   Bitnami changed its image distribution in 2025.
2. **A small StatefulSet in the chart, toggled by `postgres.enabled`.**
   Readable, restricted-PSS compliant, enough for a demo.
3. **Managed database only (RDS).** Not available on a laptop cluster.

## Decision

`helm/pantrix/` contains:
- frontend and backend Deployments and Services;
- a PostgreSQL StatefulSet with a 1–2 Gi PVC;
- Ingress, two HPAs (backend 2–6 replicas at 60% CPU, frontend 2–4 at 70%);
- PodDisruptionBudgets;
- a NetworkPolicy that only lets backend pods reach port 5432;
- an optional ServiceMonitor and a `helm test` pod.

Database credentials:
- **Helm installs:** the chart generates a random password Secret and keeps it
  stable across upgrades with `lookup`.
- **Argo CD:** Argo renders charts without cluster access, so `lookup` cannot
  work there. It uses `postgres.existingSecret`, created once by the bootstrap
  script.

`values-prod.yaml` shows the production shape:
- `postgres.enabled=false` with an external host;
- three replicas minimum;
- TLS via cert-manager;
- no demo seed data.

The Postgres pod template carries only stable labels, so an app release does
not restart the database (commit `6020c58`).

## Consequences

- Verified on kind: `helm upgrade --install` deploys, 2+2 pods Running,
  `helm test` passes and the Ingress smoke test passes.
- In-cluster Postgres has no backups, replication or point-in-time recovery.
  Acceptable for the demo only (see `docs/engineering/known-limitations.md`).

## What I would do in production

Amazon RDS for PostgreSQL (Multi-AZ, automated backups, IAM auth) or CloudNativePG,
with credentials from AWS Secrets Manager via External Secrets.
