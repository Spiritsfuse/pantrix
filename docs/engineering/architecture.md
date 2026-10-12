# Architecture

## Components

| Component | Tech | Image / chart | Runs as |
|-----------|------|---------------|---------|
| Frontend | React 19 + Vite 8, served by Nginx 1.29 | `pantrix-frontend:<sha>` | uid 101, port 8080 |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 | `pantrix-backend:<sha>` | uid 10001, port 8000 |
| Database | PostgreSQL 17 (alpine) | StatefulSet in `helm/pantrix` | uid 70, port 5432 |
| Ingress | ingress-nginx controller v1.15.1 | kind manifest | — |
| Autoscaling | HPA (autoscaling/v2) + metrics-server v0.9.0 | chart + add-on | — |
| Monitoring | kube-prometheus-stack 92.3.0 | `monitoring/prometheus-values.yaml` | — |
| GitOps | Argo CD v3.5.5 (chart 10.10.3) | `gitops/argocd/values.yaml` | — |
| Cloud (code) | Terraform: VPC + EKS 1.35 | `terraform/` | — |

## Request flow (Kubernetes)

```text
Browser ── http://pantrix.localtest.me ──► ingress-nginx
                                           │  path /      ──► Service pantrix-frontend:80 ──► Nginx pods (static React build)
                                           │  path /api   ──► Service pantrix-backend:8000 ──► FastAPI pods
                                                                                               │
                                                     NetworkPolicy: only backend pods ──────────┴──► Service pantrix-postgres:5432 ──► StatefulSet (PVC)
Prometheus ── ServiceMonitor ──► pantrix-backend:8000/metrics (every 15 s)
```

In Docker Compose the frontend's Nginx proxies `/api/` to `backend:8000` and is
published on `localhost:3000`. The backend is also published on `localhost:8000`
for Swagger.

The UI only uses relative `/api` paths (ADR 0003). The same frontend image
therefore works behind Nginx, the Ingress and the Vite dev proxy.

## Data model

| Table | Key columns | Rules |
|-------|-------------|-------|
| `donors` | name (unique), donor_type, contact_email, city | Deleting a donor keeps its items (`donor_id` → NULL) |
| `stock_items` | name, category, quantity ≥ 0, unit, expiry_date, location, donor_id | `status` is computed: out_of_stock → expired → expiring (≤ 7 days) → ok |
| `distributions` | item_id, quantity > 0, recipient, distributed_on | Creating one decrements stock; 409 if it exceeds stock or the item is expired |

The schema is owned by `backend/alembic/versions/0001_initial_schema.py`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness: the process is up, no DB call |
| GET | `/ready` | Readiness: `SELECT 1`; 503 when the DB is unreachable |
| GET | `/metrics` | Prometheus exposition |
| GET / POST | `/api/items` | List (filters: category, status, q) / create |
| GET | `/api/items/stats` | Dashboard figures |
| GET / PUT / DELETE | `/api/items/{id}` | Read / partial update / delete |
| GET / POST | `/api/donors` | List with item counts / create (409 on duplicate name) |
| GET / PUT / DELETE | `/api/donors/{id}` | — |
| GET / POST | `/api/distributions` | History / hand out stock |

OpenAPI: http://localhost:8000/docs.

## Namespaces on the demo cluster

| Namespace | Contents | Managed by |
|-----------|----------|------------|
| `pantrix` | Helm release `pantrix` (2+2 pods, Postgres, Ingress, HPAs, PDBs, NetworkPolicy, ServiceMonitor) | `helm upgrade --install` |
| `pantrix-gitops` | The same chart, 1+1 pods, host `pantrix-gitops.localtest.me` | Argo CD (`pantrix-dev`) |
| `monitoring` | Prometheus, Grafana, operator, kube-state-metrics | Helm |
| `argocd` | Argo CD | Helm |
| `gitops` | Rehearsal `git daemon` | `kubectl apply` |
| `ingress-nginx`, `kube-system` | Controller, metrics-server | add-on script |
| `pantrix-lab` | Troubleshooting drills (temporary) | `run-drill.sh` |

All Pantrix namespaces enforce the `restricted` Pod Security Standard.

## AWS target (Terraform, applied and destroyed in ap-south-1)

A VPC `10.42.0.0/16` spans two AZs:
- public subnets for the NAT gateway and load balancers;
- private subnets for the EKS nodes.

EKS 1.35 has a private API endpoint unless the operator allows a CIDR, plus a
managed node group of `t3.medium` nodes. See ADR 0013 and
`docs/runbooks/aws-provision-and-teardown.md`.
