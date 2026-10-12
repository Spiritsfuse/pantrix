# Pantrix

**Donated stock and expiry tracking for community food banks, taken from a laptop to a monitored
Kubernetes cluster.**

Built by **Dhruv Sharma** · GitHub [@Spiritsfuse](https://github.com/spiritsfuse)

![Pantrix walkthrough](demo/preview.gif)

| | |
|---|---|
| Video walkthrough | [`demo/presentation.mp4`](demo/presentation.mp4) (captions: [`demo/presentation.srt`](demo/presentation.srt)) |
| Slides | [`demo/presentation.pptx`](demo/presentation.pptx) · [`demo/presentation.pdf`](demo/presentation.pdf) · [script](demo/DEMO-SCRIPT.md) |
| Delivery checklist | [`docs/DELIVERY-CHECKLIST.md`](docs/DELIVERY-CHECKLIST.md) |
| Evidence | [`docs/evidence/EVIDENCE-MANIFEST.md`](docs/evidence/EVIDENCE-MANIFEST.md) (real output only) |

> **Verification status, in short:** the application, tests, Docker, Helm/Kubernetes with Ingress and
> HPA, Argo CD, Prometheus/Grafana, security scans and troubleshooting drills were run and verified
> locally. The **GitHub Actions run and GHCR push** happen once this repository is pushed to GitHub.
> The **Terraform has not been applied to a real AWS account**, because no valid credentials were
> available. It was validated and run against a local AWS API emulator instead. See
> [Known limitations](#known-limitations).

---

## Contents

1. [Problem and features](#problem-and-features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [Run it locally (Docker Compose)](#run-it-locally-docker-compose)
6. [Local development without Docker](#local-development-without-docker)
7. [API reference](#api-reference)
8. [Database and migrations](#database-and-migrations)
9. [Tests and code quality](#tests-and-code-quality)
10. [Docker images](#docker-images)
11. [CI/CD pipeline](#cicd-pipeline)
12. [Security (DevSecOps) and Trivy](#security-devsecops-and-trivy)
13. [Terraform and AWS](#terraform-and-aws)
14. [Kubernetes and Helm](#kubernetes-and-helm)
15. [GitOps with Argo CD](#gitops-with-argo-cd)
16. [Observability: Prometheus and Grafana](#observability-prometheus-and-grafana)
17. [Troubleshooting drills](#troubleshooting-drills)
18. [Engineering decisions](#engineering-decisions)
19. [Measurements](#measurements)
20. [Known limitations](#known-limitations)
21. [Cleanup and cost](#cleanup-and-cost)

---

## Problem and features

Food banks receive perishable donations from farms, bakeries, businesses and individuals. When nobody
can see what expires first, food spoils on the shelf while other stock goes out. Pantrix is the shelf
ledger for a community pantry:

- **Shelf**: every donated item with quantity, unit, shelf code, donor and a shelf-life bar. Items are
  sorted by soonest expiry, so the oldest stock goes out first. Filter by status (use soon, expired,
  out of stock, fresh) and category, and search by name or shelf code.
- **Today at the pantry**: KPIs for units on the shelf, items to use within 7 days, expired items to
  pull, out-of-stock items, and units handed out in the last 30 days.
- **Donors**: create, edit and remove the farms, kitchens, businesses and people who donate.
- **Hand-outs**: record stock given to partner organisations (shelters, meal programmes). The API
  decrements stock in a single transaction with a row lock. It refuses to hand out expired stock or
  more than is on the shelf (HTTP 409).
- Loading skeletons, empty states, an error banner with retry, toasts, and validation messages from
  the API shown in the form. The layout is responsive down to phone width.

| Desktop | Phone |
|---|---|
| ![Desktop](docs/evidence/application-desktop.png) | ![Mobile](docs/evidence/application-mobile.png) |

The demo data is a fictional "Pilani demo hub", including a "Spiritsfuse Community Kitchen".

## Architecture

![Architecture](docs/presentation/architecture.png)

```text
Developer ─► Git (main) ─► GitHub Actions ─┬─ backend-test  (ruff, bandit, pip-audit, pytest ≥85% coverage)
                                           ├─ frontend-test (eslint, prettier, vitest, npm audit, vite build)
                                           ├─ secret-scan   (gitleaks, full history)
                                           └─ iac-scan      (terraform validate, helm lint, trivy config)
                                                   │ all green
                                                   ▼
                                    build-scan-push (backend, frontend)
                                    build → non-root check → Trivy gate → SBOM
                                    → push ghcr.io/<owner>/pantrix-*:<git sha> → provenance
                                                   │
                       ┌───────────────────────────┴──────────────────────────┐
                       ▼                                                      ▼
            k8s-smoke (kind + Helm + Ingress)              promote.yml → gitops/environments/dev/values.yaml
                                                                               │
                                                                Argo CD reconciles the cluster
Browser ─► Ingress (ingress-nginx)
             ├─ /     ─► frontend Service ─► Nginx pods (2)  (static React build)
             └─ /api  ─► backend Service  ─► FastAPI pods (2-6, HPA) ─► PostgreSQL StatefulSet + PVC
Prometheus ─(ServiceMonitor, /metrics)─► backend pods      Grafana ─► Prometheus
Terraform ─► AWS VPC (2 public + 2 private subnets, NAT) + EKS 1.35 + managed node group   (design; see below)
```

Inside the browser, every call is a relative `/api/...` request. Vite's dev proxy, the Compose Nginx
and the Kubernetes Ingress each route it, so one frontend build works everywhere.

More detail: [`docs/engineering/architecture.md`](docs/engineering/architecture.md),
CI/CD diagram [`docs/presentation/cicd-flow.png`](docs/presentation/cicd-flow.png),
AWS design [`docs/presentation/aws-architecture.png`](docs/presentation/aws-architecture.png).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, lucide-react, self-hosted Fraunces + DM Sans fonts, Vitest + Testing Library, ESLint, Prettier |
| Backend | Python 3.12, FastAPI 0.143, Pydantic 2, SQLAlchemy 2.1, Alembic 1.20, psycopg 3, Uvicorn |
| Database | PostgreSQL 17 |
| Observability | prometheus-fastapi-instrumentator, custom `pantrix_*` counters, JSON logs, kube-prometheus-stack 92.3.0 (Prometheus, Grafana) |
| Containers | Docker multi-stage builds, `python:3.12-slim`, `nginxinc/nginx-unprivileged:1.29-alpine`, Docker Compose |
| CI/CD | GitHub Actions (every action pinned to a commit SHA), GHCR, build provenance attestations |
| Security | Trivy (image + config), Gitleaks, Bandit, pip-audit, npm audit, CycloneDX SBOMs, actionlint |
| Infrastructure | Terraform 1.16, AWS provider 6, terraform-aws-modules VPC 6.7 / EKS 21.29, region ap-south-1 |
| Kubernetes | kind (local), Helm 3 chart, ingress-nginx, metrics-server, HPA, NetworkPolicy, PDB, restricted Pod Security |
| GitOps | Argo CD 3.5 (chart 10.10.3) |

## Repository layout

```text
pantrix/
├── backend/                 FastAPI app (app/), Alembic migrations, pytest suite, Dockerfile
│   ├── app/                 main.py, config, database, models, schemas, services, routers/, seed, observability
│   ├── alembic/versions/    0001_initial_schema.py
│   └── tests/               31 tests (conftest builds a SQLite test DB with the real migrations)
├── frontend/                React + Vite app, Vitest tests, multi-stage Dockerfile, nginx.conf.template
├── docker-compose.yml       postgres + backend + frontend with health checks and a named volume
├── .github/workflows/       ci-cd.yml (test, scan, build, push, deploy rehearsal), promote.yml (GitOps)
├── helm/pantrix/            Chart, values (dev/prod), templates (deployments, services, ingress, hpa,
│                            postgres StatefulSet, secret, servicemonitor, networkpolicy, pdb, tests)
├── k8s/                     namespace.yaml (restricted PSS), kind-config.yaml
├── gitops/                  Argo CD values + Application, dev environment desired state, rehearsal git server
├── monitoring/              kube-prometheus-stack values, Grafana dashboard JSON, alert rules
├── terraform/               VPC + EKS (versions, variables, main, outputs, tfvars example, README)
├── troubleshooting/         five break/diagnose/fix drills + README
├── scripts/                 k8s/, monitoring/, gitops/, troubleshooting/, terraform/, evidence/, video/, lib/
├── security/                Trivy policy, controls overview, SBOMs
├── docs/                    adr/ (14 ADRs), runbooks/, engineering/, evidence/, presentation/, DELIVERY-CHECKLIST.md
└── demo/                    presentation.pptx/.pdf/.mp4, preview.gif, DEMO-SCRIPT.md
```

## Run it locally (Docker Compose)

Prerequisites: Docker Desktop or Docker Engine with Compose v2.

```bash
cp .env.example .env            # optional: change the local database password
docker compose up --build       # or: docker compose up --build --wait   (returns when all are healthy)
```

| URL | What |
|---|---|
| http://localhost:3000 | Pantrix UI (Nginx serves the build and proxies `/api`) |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/health · /ready · /metrics | liveness · readiness (checks the DB) · Prometheus metrics |

The backend runs `alembic upgrade head` on start and seeds demo data into an empty database
(`SEED_DEMO_DATA=true`). Stop with `docker compose down`; add `-v` to delete the database volume.

## Local development without Docker

```bash
# backend (Python 3.12, a PostgreSQL on localhost:5432)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements-dev.txt
export DATABASE_URL='postgresql+psycopg://pantrix:pantrix@localhost:5432/pantrix'
alembic upgrade head
SEED_DEMO_DATA=true uvicorn app.main:app --reload --port 8000

# frontend (Node 22)
cd frontend
npm ci
npm run dev                  # http://localhost:5173, proxies /api to :8000
```

## API reference

| Method | Path | Purpose | Notable responses |
|---|---|---|---|
| GET | `/health` | Liveness: process is up, no DB call | 200 |
| GET | `/ready` | Readiness: `SELECT 1` against PostgreSQL | 200 / 503 |
| GET | `/metrics` | Prometheus metrics | 200 |
| GET | `/api/items` | List stock; `?category=`, `?status=ok\|expiring\|expired\|out_of_stock`, `?q=` | 200 |
| GET | `/api/items/stats` | KPIs: totals, expiring, expired, out of stock, donors, 30-day hand-outs, per category | 200 |
| GET | `/api/items/{id}` | One item with computed `status` and `days_to_expiry` | 200 / 404 |
| POST | `/api/items` | Log a donation | 201 / 422 |
| PUT | `/api/items/{id}` | Partial update | 200 / 404 / 422 |
| DELETE | `/api/items/{id}` | Remove an item | 204 / 404 |
| GET | `/api/donors`, `/api/donors/{id}` | List (with item counts) / get | 200 / 404 |
| POST | `/api/donors` | Create | 201 / 409 duplicate / 422 |
| PUT, DELETE | `/api/donors/{id}` | Update / delete (items keep their history, donor set to null) | 200, 204 / 404 |
| GET | `/api/distributions` | Recent hand-outs | 200 |
| POST | `/api/distributions` | Hand out stock; decrements quantity atomically | 201 / 404 / 409 / 422 |

Validation comes from Pydantic models (`backend/app/schemas.py`): allowed categories, units and donor
types, non-negative quantities, non-blank names, and valid emails. Errors use FastAPI's standard
`{"detail": ...}` body. Evidence: [`api-crud-curl.png`](docs/evidence/api-crud-curl.png),
[`api-swagger-docs.png`](docs/evidence/api-swagger-docs.png).

## Database and migrations

Three tables: `donors`, `stock_items` (FK `donor_id`, `ON DELETE SET NULL`, check `quantity >= 0`)
and `distributions` (FK `item_id`, `ON DELETE CASCADE`, check `quantity > 0`). Alembic owns the
schema; `backend/alembic/versions/0001_initial_schema.py` creates it. `alembic/env.py` takes a
PostgreSQL advisory lock, so replicas that start together never run a migration twice.

```bash
docker compose exec backend alembic current
docker compose exec postgres psql -U pantrix -d pantrix -c '\dt'
```

Evidence: [`database-migrations.png`](docs/evidence/database-migrations.png).

## Tests and code quality

```bash
cd backend && pytest -v                     # 31 tests, 96% coverage (CI fails below 85%)
ruff check . && ruff format --check . && bandit -r app -ll && pip-audit -r requirements.txt
cd frontend && npm run lint && npm run format:check && npm test && npm audit --omit=dev --audit-level=high
```

The tests never touch the Compose or Kubernetes database. `tests/conftest.py` points `DATABASE_URL`
at a temporary SQLite file and builds it with the **real Alembic migrations**. It asserts that the
engine is SQLite and truncates tables between tests. The tests cover success paths, validation
failures (422), missing records (404), conflicts (409 duplicate donor, over-asking, expired stock),
readiness with a broken database (503), the metrics format and the demo seed. Ten frontend tests
cover rendering, API failure, creating an item and showing API validation errors.

Evidence: [`pytest-results.png`](docs/evidence/pytest-results.png),
[`pytest-coverage.png`](docs/evidence/pytest-coverage.png),
[`frontend-lint-test-build.png`](docs/evidence/frontend-lint-test-build.png).
Details: [`docs/engineering/testing.md`](docs/engineering/testing.md).

## Docker images

| Image | Build | Runtime user | Size (local) |
|---|---|---|---|
| `pantrix-backend` | build stage creates a venv; runtime `python:3.12-slim` without pip, setuptools or ensurepip wheels | `10001:10001` | 311 MB |
| `pantrix-frontend` | `node:22-alpine` runs `npm ci` and `vite build`; runtime `nginx-unprivileged:1.29-alpine` on port 8080 | `101` (nginx) | 114 MB |

The frontend's Nginx resolves the API host at runtime through the container's own DNS server. It
therefore starts even when the backend does not exist yet; a troubleshooting drill found this problem
(see ADR 0004). Compose adds `read_only`, `cap_drop: [ALL]` and `no-new-privileges`.

Evidence: [`docker-compose-up.png`](docs/evidence/docker-compose-up.png),
[`docker-nonroot-users.png`](docs/evidence/docker-nonroot-users.png),
[`docker-persistence.png`](docs/evidence/docker-persistence.png).

## CI/CD pipeline

[`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) runs on every push to `main`, on pull
requests and on demand:

| Job | Steps | Blocks |
|---|---|---|
| `backend-test` | Ruff, Bandit, pip-audit, `pytest -v --cov-fail-under=85`, uploads JUnit and coverage | images |
| `frontend-test` | `npm ci`, ESLint, Prettier, Vitest, `npm audit`, `vite build` | images |
| `secret-scan` | Gitleaks over the full history | images |
| `iac-scan` | `terraform fmt`/`validate`, `helm lint --strict`, `trivy config` | images |
| `build-scan-push` (matrix: backend, frontend) | build → refuse root user → Trivy report → **Trivy gate** → CycloneDX SBOM → **push `ghcr.io/<owner>/pantrix-<component>:<full git sha>`** → provenance attestation | — |
| `k8s-smoke` | kind cluster, pulls the just-pushed images, `helm upgrade --install --atomic`, smoke test through the Ingress | — |

Pushes happen only for `main`, and only after all four gates pass. Tags are always the commit SHA,
never `latest`. Permissions are least-privilege per job (`contents: read`; `packages: write`,
`id-token: write` and `attestations: write` only where needed). Every job has a timeout, and every
action is pinned to a full commit SHA.

[`promote.yml`](.github/workflows/promote.yml) runs after a green `ci-cd` on `main`. It checks that
both SHA-tagged images exist in GHCR and commits the new tag to
`gitops/environments/dev/values.yaml` for Argo CD. Promotion commits do not trigger a rebuild.

**Status:** both workflows pass `actionlint`
([evidence](docs/evidence/ci-workflow-validation.png)), and every step was run locally with the same
tools. The first real GitHub run, and the GHCR packages, will be captured after the repository is
pushed. Details: [`docs/engineering/ci-cd.md`](docs/engineering/ci-cd.md).

## Security (DevSecOps) and Trivy

Layers: SAST (Bandit) → dependencies (pip-audit, npm audit) → secrets (Gitleaks) → images (Trivy) →
IaC (Trivy config) → supply chain (SBOM, provenance, SHA-pinned actions) → runtime (non-root,
read-only root filesystem, no capabilities, seccomp, restricted Pod Security, NetworkPolicy).
Overview: [`security/README.md`](security/README.md).

**Trivy policy:** fail on any HIGH or CRITICAL finding that has a fix available. Unfixed
vulnerabilities in base OS packages are reported in full but do not block. Image CVEs are never added
to `.trivyignore`. ([`security/TRIVY-POLICY.md`](security/TRIVY-POLICY.md))

**What Trivy found, and what it means.** Trivy scans the operating system packages (Debian 13 for the
backend, Alpine 3.23 for the frontend) and the Python packages inside each built image, before the
image is pushed. The first backend image failed the gate with four fixable HIGH findings:
GHSA-6v7p-g79w-8964 in msgpack, CVE-2025-47273 in setuptools, and CVE-2026-97687 / CVE-2026-97689 in
urllib3. None of these libraries is used by Pantrix. They were copies vendored by pip, plus the
ensurepip wheels. Removing pip from the runtime image fixed all four without suppressing anything
(commit `964bf54`). The images now pass the gate. The backend still reports 44 HIGH findings in Debian
packages that have no fix yet; those are tracked, not hidden.
Before/after: [`trivy-backend-before-fix.png`](docs/evidence/trivy-backend-before-fix.png),
[`trivy-backend.png`](docs/evidence/trivy-backend.png),
[`trivy-frontend.png`](docs/evidence/trivy-frontend.png).

`trivy config` also found the EKS API endpoint open to `0.0.0.0/0` (AWS-0040/0041). It is now private
unless you pass your own CIDR. Node egress (AWS-0104) is the one documented, justified exception.

## Terraform and AWS

[`terraform/`](terraform/) describes ap-south-1:

- a VPC `10.42.0.0/16` with **2 public and 2 private `/20` subnets** across two AZs, one NAT gateway
  and flow logs;
- **EKS 1.35**, with Secrets encrypted by KMS, control-plane logs, and core add-ons including
  metrics-server;
- **one managed node group** (t3.medium, 1–3 nodes, IMDSv2) in the private subnets;
- IAM roles from the modules, outputs, and a `terraform.tfvars.example` without credentials.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # set endpoint_public_access_cidrs to your IP/32
terraform init && terraform fmt -check && terraform validate
terraform plan -out tfplan && terraform apply tfplan
$(terraform output -raw configure_kubectl) && kubectl get nodes
terraform destroy
```

| Step | Result |
|---|---|
| `init`, `fmt`, `validate`, Trivy config | **Verified** ([evidence](docs/evidence/terraform-init-validate.png)) |
| `plan` against real AWS | **Blocked**: `InvalidClientTokenId`; the AWS credentials on the build machine are invalid ([evidence](docs/evidence/terraform-plan-blocked.png)) |
| `plan` / `apply` / `destroy` against the **Moto AWS emulator** | plan: 62 to add · apply: 54/62 created, then stopped at EKS add-on and access-entry APIs Moto lacks · destroy: 54 destroyed ([plan](docs/evidence/terraform-plan-emulator.png), [apply/destroy](docs/evidence/terraform-emulator-apply-destroy.png)). **Not AWS.** |
| Real apply, AWS Console screenshots, real destroy | **Pending**: needs valid credentials and the owner's approval for about $0.25–0.30/hour |

Full guide, cost table and cleanup checks: [`terraform/README.md`](terraform/README.md) and
[`docs/runbooks/aws-provision-and-teardown.md`](docs/runbooks/aws-provision-and-teardown.md).

## Kubernetes and Helm

The local demo cluster is **kind** (`k8s/kind-config.yaml`), with host ports 80/443 mapped to
ingress-nginx. `*.localtest.me` resolves to 127.0.0.1, so no hosts-file edits are needed.

```bash
kind create cluster --name pantrix --config k8s/kind-config.yaml
bash scripts/k8s/install-addons.sh          # ingress-nginx + metrics-server
bash scripts/k8s/deploy-local.sh            # builds images for HEAD, kind load, helm upgrade --install
#   = kubectl apply -f k8s/namespace.yaml
#     helm upgrade --install pantrix helm/pantrix -n pantrix -f helm/pantrix/values-dev.yaml --set image.tag=<sha>
kubectl get pods,svc,ingress,hpa -n pantrix
helm list -n pantrix && helm test pantrix -n pantrix
open http://pantrix.localtest.me
```

The chart (`helm/pantrix`) contains:

- frontend and backend Deployments: **2 replicas minimum** via HPA (backend 2–6 at 60% CPU, frontend
  2–4), rolling updates with `maxUnavailable: 0`;
- ClusterIP Services, and an Ingress routing `/` → frontend and `/api` → backend;
- PostgreSQL as a StatefulSet with a PVC, and a DB Secret generated once and kept across upgrades;
- a migration init container, startup/liveness/readiness probes, and resource requests and limits;
- a non-root, read-only root filesystem, all capabilities dropped and seccomp in every container,
  under the namespace's **restricted** Pod Security Standard;
- a NetworkPolicy so only backend pods reach PostgreSQL, PodDisruptionBudgets, a ServiceMonitor,
  and a `helm test` pod.

Under 12 parallel traffic generators the backend HPA went from 2 to 6 replicas
([evidence](docs/evidence/hpa-scaling.png)). Evidence: [pods](docs/evidence/kubernetes-pods.png),
[services/ingress/HPA](docs/evidence/kubernetes-services-ingress-hpa.png),
[helm](docs/evidence/helm-release.png), [via Ingress](docs/evidence/ingress-application-framed.png).
Runbook: [`docs/runbooks/deploy-local-kubernetes.md`](docs/runbooks/deploy-local-kubernetes.md).

## GitOps with Argo CD

CI builds, scans and publishes images. **It never deploys to the long-lived cluster.** Deployment is
a Git change: `gitops/environments/dev/values.yaml` pins `image.tag` to a commit SHA, and the Argo CD
Application [`gitops/application.yaml`](gitops/application.yaml) (automated sync, prune, self-heal)
reconciles namespace `pantrix-gitops` to it.

```bash
bash scripts/gitops/bootstrap-gitops.sh     # Argo CD, DB secret, rehearsal git server, Application
bash scripts/gitops/promote.sh              # commit the SHA the Helm release runs, publish, wait for Synced/Healthy
```

This computer may not have a GitHub remote, so the rehearsal source is an in-cluster git daemon. Main
is published to it as a git bundle; `git remote -v` stays empty. After the push to GitHub, `repoURL`
switches to the GitHub repository and `promote.yml` makes the promotion commits
([`docs/engineering/gitops.md`](docs/engineering/gitops.md)).
Evidence: [`argocd-application.png`](docs/evidence/argocd-application.png),
[`argocd-gitops-cli.png`](docs/evidence/argocd-gitops-cli.png).

## Observability: Prometheus and Grafana

```bash
bash scripts/monitoring/install-monitoring.sh   # kube-prometheus-stack 92.3.0 + dashboard + alert rules
bash scripts/monitoring/generate-traffic.sh http://pantrix.localtest.me 300
```

| What | Where |
|---|---|
| Metrics | `/metrics`: `http_requests_total{handler,method,status}`, `http_request_duration_seconds` histogram, `pantrix_stock_events_total{action}`, `pantrix_units_distributed_total` |
| Scraping | ServiceMonitor `pantrix-backend` (port `http`, 15 s); [targets 6/6 UP](docs/evidence/prometheus-targets.png) |
| Dashboard | `monitoring/dashboards/pantrix-overview.json`, loaded by the Grafana sidecar: targets up, request rate, 5xx ratio, p95 latency, units handed out, HPA replicas, rate per endpoint, latency p50/p95/p99, status codes, stock events, pod CPU and memory ([screenshot](docs/evidence/grafana-dashboard.png)) |
| Alerts | `monitoring/pantrix-alerts.yaml`: backend down, 5xx ratio > 5%, p95 > 500 ms |
| Logs | Structured JSON access and application logs on stdout (`backend/app/observability.py`) |

Prometheus: http://prometheus.localtest.me · Grafana: http://grafana.localtest.me (user `admin`; the
password is generated into the `grafana-admin` Secret).

## Troubleshooting drills

`bash scripts/troubleshooting/run-drill.sh 1|2|3|4|5|all` breaks something, shows the diagnosis, fixes
it and verifies the fix:

| # | Failure | Symptom | Fix |
|---|---|---|---|
| 1 | Image tag that was never published | `ErrImagePull` / `ImagePullBackOff` | deploy the Git-SHA tag |
| 2 | Service selector matches no pods | Service has no endpoints, connection refused | correct the selector |
| 3 | Wrong DB credentials | Pod Running but 0/1 Ready; `/health` 200, `/ready` 503 | correct the Secret |
| 4 | Migration cannot reach the DB | `Init:Error` / `CrashLoopBackOff` in the `migrate` init container | correct the DB host |
| 5 | Bad Helm release | new pods `ImagePullBackOff`, old pods keep serving (3/3 HTTP 200) | `helm rollback` |

Drill 2 exposed a real bug: Nginx crash-looped with "host not found in upstream" when its API Service
did not exist yet. It was fixed in the product (runtime DNS resolution).
Guide: [`troubleshooting/README.md`](troubleshooting/README.md).

## Engineering decisions

Fourteen ADRs, each with the options rejected and what production would do, are in
[`docs/adr/`](docs/adr/README.md). Highlights:

- test against a SQLite database built by the real migrations;
- run migrations in an init container behind an advisory lock;
- keep liveness separate from readiness;
- unprivileged Nginx with runtime DNS;
- fix CVEs instead of suppressing them;
- tag images with the commit SHA and attach provenance;
- in-cluster PostgreSQL for the demo, versus RDS in production;
- kind with ingress-nginx locally, with Gateway API or the AWS Load Balancer Controller in production;
- Argo CD with a separate promotion step;
- a private EKS endpoint by default;
- the emulator as a correctness check, not as proof of AWS.

Runbooks: [`docs/runbooks/`](docs/runbooks/README.md). Engineering notes:
[`docs/engineering/`](docs/engineering/README.md).

## Measurements

Only values that were actually measured, on the first computer (Windows 11, Docker Desktop, kind
single node), 12–13 October 2026. Method and context: [`docs/engineering/measurements.md`](docs/engineering/measurements.md).

| Metric | Value | How |
|---|---|---|
| Backend tests | 31 passed in 0.45 s, 96% coverage | `pytest -v`, `pytest --cov` |
| Frontend tests | 10 passed | `vitest run` |
| Image sizes | backend 311 MB, frontend 114 MB | `docker image ls` |
| Trivy, fixable HIGH/CRITICAL | 4 → 0 (backend), 0 (frontend) | `trivy image --ignore-unfixed` |
| SBOM components | 119 backend, 71 frontend | CycloneDX from Trivy |
| HPA | 2 → 6 backend replicas at 397% of the CPU target | 12 traffic generators for 150 s |
| Bad-release availability | 3/3 requests HTTP 200 while the broken rollout was stuck | drill 5 |

## Known limitations

- **No real AWS run.** The credentials on the build machine are invalid. The Terraform is validated
  and emulator-tested, but VPC/EKS provisioning, Console screenshots and a real destroy are pending.
- **GitHub Actions and GHCR have not run yet.** The repository is pushed from a second computer. The
  workflow is validated with actionlint, and every step was run locally.
- **ingress-nginx was retired upstream in March 2026** (last release v1.15.1). It is fine for the
  local demo; production should use the Gateway API or the AWS Load Balancer Controller.
- The demo runs on a single-node kind cluster with in-cluster PostgreSQL and no backups. Use RDS in
  production.
- GHCR packages are private by default. Make them public, or add an `imagePullSecret`, before pulling
  them from a cluster.
- Alert rules are evaluated, but the laptop demo has no alert routing and Loki is not deployed.
- kind's default CNI does not enforce NetworkPolicy, so the policy is declared but was not exercised.
- The video narration is a synthesized voice reading the project script. The CI/CD-on-GitHub segment
  is recorded after the repository exists.

Full list: [`docs/engineering/known-limitations.md`](docs/engineering/known-limitations.md).

## Cleanup and cost

```bash
docker compose down -v                       # local stack and its volume
kind delete cluster --name pantrix           # whole local Kubernetes environment
cd terraform && terraform destroy            # only if AWS was provisioned: about $0.25-0.30/hour while up
```

[`docs/runbooks/cleanup.md`](docs/runbooks/cleanup.md) also covers verifying that nothing billable
is left in AWS.

---

Pantrix · built by Dhruv Sharma ([@Spiritsfuse](https://github.com/spiritsfuse)), an end-to-end DevSecOps
reference: application, pipeline, infrastructure, GitOps and observability in one repository.
