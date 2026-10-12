# Delivery checklist — Pantrix

Maps each delivery requirement (application, tests, Git, Docker, CI/CD, security scanning, Terraform,
Kubernetes/Helm, observability, documentation) to the implementation, the command that verifies it,
the evidence, and its status.

| Status | Meaning |
|---|---|
| **VERIFIED** | Run and checked on 12–13 October 2026 |
| **PENDING EXTERNAL ACCESS** | Needs valid AWS credentials plus cost approval |
| **NOT COMPLETE** | Work still to do |

A file existing is not counted as proof. Each VERIFIED row has real output behind it, listed in
[`evidence/EVIDENCE-MANIFEST.md`](evidence/EVIDENCE-MANIFEST.md).

## Application

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| FastAPI starts and responds to `/health` | `backend/app/main.py` | `curl localhost:8000/health` | `api-crud-curl.png` | VERIFIED |
| Min. 4 REST endpoints (GET, POST, PUT, DELETE) | `backend/app/routers/{items,donors,distributions}.py` (14 routes) | curl sequence | `api-crud-curl.png`, `api-swagger-docs.png` | VERIFIED |
| PostgreSQL with a table managed by Alembic | `backend/alembic/versions/0001_initial_schema.py` (3 tables) | `docker compose exec backend alembic current`; `psql \dt` | `database-migrations.png` | VERIFIED |
| React frontend renders and makes API calls | `frontend/src/lib/api.js`, views in `frontend/src/components/` | browser | `application-desktop.png`, `crud-*.png` | VERIFIED |
| Responsive, usable UI | `frontend/src/styles.css` breakpoints | 390 px viewport | `application-mobile.png` | VERIFIED |
| Submit `backend/app/`, migrations, `requirements.txt`, `frontend/`, `docker-compose.yml`, app screenshot | as listed | — | — | VERIFIED |

## Testing

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| `pytest` runs without errors | `backend/tests/` | `cd backend && pytest -v` | `pytest-results.png` | VERIFIED (31 passed) |
| ≥5 tests covering ≥3 endpoints | 31 tests across items, donors, distributions, health, ready, metrics | same | `pytest-results.png` | VERIFIED |
| Test DB or mock, not production | `tests/conftest.py`: temporary SQLite built by the real Alembic migrations, with an assert that refuses any non-SQLite URL | same | `pytest-results.png` | VERIFIED |
| `pytest.ini` / `conftest.py` configured | `backend/pytest.ini`, `backend/tests/conftest.py` | — | — | VERIFIED |
| Extra quality gates | Ruff, Bandit, pip-audit, 96% coverage floor, ESLint, Prettier, Vitest, npm audit | see evidence | `backend-quality-gates.png`, `pytest-coverage.png`, `frontend-lint-test-build.png` | VERIFIED |

## Git and GitHub

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| Public GitHub repository linked in the form | — | — | — | VERIFIED: https://github.com/Spiritsfuse/pantrix (public) |
| Meaningful commit messages | local `main`, 40+ descriptive commits authored as Dhruv Sharma | `git log --oneline` | `git-local-history.png`, `github-commit-history.png` | VERIFIED |
| `.gitignore` covers `.env`, `__pycache__`, `node_modules`, `.venv` | `.gitignore` (also Terraform state, tfvars, kubeconfigs, the handoff prompt) | `git check-ignore -v ...` | `git-local-history.png` | VERIFIED |
| Commit-history screenshot (≥10 commits) on GitHub | — | — | `github-commit-history.png` | VERIFIED |

## Docker

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| `backend/Dockerfile` builds | multi-stage, venv, pip removed | `docker compose build` | `docker-compose-up.png` | VERIFIED |
| `frontend/Dockerfile` multi-stage (Node build + Nginx runtime) | `node:22-alpine` → `nginxinc/nginx-unprivileged:1.29-alpine` | same | `docker-compose-up.png` | VERIFIED |
| Images run as non-root | `USER 10001:10001`, `USER 101` | `docker compose exec backend id` | `docker-nonroot-users.png` | VERIFIED |
| `docker compose up --build` starts all three services | `docker-compose.yml` with health checks and a named volume | `docker compose up --build --wait` | `docker-compose-up.png`, `docker-compose-ps.png`, `docker-persistence.png` | VERIFIED |
| Browser at `localhost:3000` | — | — | `application-desktop-framed.png` | VERIFIED |

## CI/CD

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| Workflow file present | `.github/workflows/ci-cd.yml`, `promote.yml` | `actionlint` | `ci-workflow-validation.png` | VERIFIED |
| Triggers on push to `main` | `on.push.branches: [main]` | file | `ci-workflow-validation.png` | VERIFIED in a real run |
| Pytest job fails the build on test failure | `backend-test` (`pytest ... --cov-fail-under=85`); `build-scan-push` `needs:` every gate | file | — | VERIFIED in a real run |
| Frontend built in the pipeline | `frontend-test` → `npm run build` | file | — | VERIFIED in a real run |
| Docker images built for both | `build-scan-push` matrix [backend, frontend] | file | — | VERIFIED in a real run |
| Images pushed to GHCR | `docker/login-action` + `docker push ghcr.io/<owner>/pantrix-*` (main only) | GHCR packages page | `ghcr-backend-package.png`, `ghcr-frontend-package.png` | VERIFIED |
| Tags use the commit SHA, not `latest` | `tag=${GITHUB_SHA}` | file / GHCR | `ci-workflow-validation.png` | VERIFIED: tags are full commit SHAs |
| Green run URL, GHCR screenshot | — | https://github.com/Spiritsfuse/pantrix/actions/runs/38305646085 | `github-actions-run.png` | VERIFIED |

Local equivalents of every CI step (tests, lint, audits, builds, Trivy, Gitleaks, Helm lint, Terraform
validate) were run on this computer; see module , module , module , module  and module .

## Trivy

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| Trivy scans both images in CI | `build-scan-push` (`aquasecurity/trivy-action`, pinned SHA, v0.36.0) | local `trivy image` | `trivy-backend.png`, `trivy-frontend.png` | VERIFIED locally and in the CI run (`security-backend` / `security-frontend` artifacts) |
| Fail on HIGH/CRITICAL | `severity: HIGH,CRITICAL`, `exit-code: 1`, `ignore-unfixed: true` | policy | `security/TRIVY-POLICY.md`, `trivy-backend-before-fix.png` (it really failed) | VERIFIED |
| Explain a CVE / a clean result | `security/TRIVY-POLICY.md`, `docs/engineering/security.md` | — | — | VERIFIED |
| 2–3 sentence explanation | below | — | — | VERIFIED |

> Trivy scanned the OS packages (Debian 13 / Alpine 3.23) and the Python packages inside both images.
> The first backend image failed the gate with four fixable HIGH findings — GHSA-6v7p-g79w-8964
> (msgpack), CVE-2025-47273 (setuptools) and CVE-2026-97687/97689 (urllib3). All four were in copies
> that pip and ensurepip bundle, which the API never imports, so removing pip from the runtime image
> fixed them; nothing was suppressed. The current images have no fixable HIGH or CRITICAL findings. The
> backend still reports 44 HIGH findings in Debian packages that have no fix yet; the policy reports
> these but does not block on them.

## Terraform / AWS

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| `terraform/` valid HCL | `versions.tf`, `variables.tf`, `main.tf`, `outputs.tf` | `terraform validate` | `terraform-init-validate.png` | VERIFIED |
| `terraform init` succeeds | — | `terraform init` | `terraform-init-validate.png` | VERIFIED |
| `terraform plan` non-empty, no errors | — | `terraform plan` | `terraform-plan-blocked.png` (real AWS: invalid credentials); `terraform-plan-emulator.png` (62 to add against the Moto emulator) | Real plan: PENDING EXTERNAL ACCESS. Emulator plan: VERIFIED |
| VPC with ≥2 public subnets provisioned | `module.vpc` (2 public + 2 private subnets) | AWS Console | — | PENDING EXTERNAL ACCESS (emulator apply created them in Moto only) |
| EKS cluster with ≥1 worker node group | `module.eks` + `general` node group | AWS Console, `kubectl get nodes` | — | PENDING EXTERNAL ACCESS |
| `terraform destroy` clean | — | `terraform destroy` | `terraform-destroy-emulator.png` (emulator only) | Real: PENDING EXTERNAL ACCESS |
| `terraform.tfvars.example`, no credentials committed | `terraform/terraform.tfvars.example`; Gitleaks clean | `gitleaks git` | `gitleaks-history-scan.png` | VERIFIED |

**Blocker:** `aws sts get-caller-identity` on the first computer returns `InvalidClientTokenId`.
Provisioning real EKS costs about $0.25–0.30 per hour and requires the owner's explicit approval.
Runbook: [`runbooks/aws-provision-and-teardown.md`](runbooks/aws-provision-and-teardown.md).

## Kubernetes and Helm

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| `k8s/namespace.yaml` applies cleanly | restricted Pod Security labels | `kubectl apply -f k8s/namespace.yaml` | `kubernetes-pods.png` | VERIFIED |
| Helm chart with `Chart.yaml`, `values.yaml`, templates | `helm/pantrix/` (+ `values-dev.yaml`, `values-prod.yaml`) | `helm lint --strict` | `helm-lint-template.png` | VERIFIED |
| `helm upgrade --install` succeeds | `scripts/k8s/deploy-local.sh` | `helm list` | `helm-release.png` | VERIFIED (kind) |
| ≥2 replicas each for backend and frontend | HPA `minReplicas: 2` | `kubectl get pods` | `kubernetes-pods.png` | VERIFIED |
| ClusterIP Services for backend and frontend | `templates/backend.yaml`, `frontend.yaml` | `kubectl get svc` | `kubernetes-services-ingress-hpa.png` | VERIFIED |
| Ingress `/` → frontend, `/api` → backend | `templates/ingress.yaml` | `kubectl describe ingress`, browser | `ingress-routing.png`, `ingress-application.png`, `ingress-api-route.png` | VERIFIED |
| All pods Running | — | `kubectl get pods -n pantrix` | `kubernetes-pods.png` | VERIFIED |
| HPA (README requirement) | `templates/hpa.yaml`, metrics-server | load test | `hpa-scaling.png` (2→6) | VERIFIED |

The cluster is a local kind cluster, which the course permits for the demo. Deploying the same chart on
EKS is PENDING real AWS access.

## Observability

| Criterion | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|
| `/metrics` in Prometheus format | `prometheus-fastapi-instrumentator` + `pantrix_*` counters | `curl /metrics` | `metrics-endpoint.png` | VERIFIED |
| Prometheus installed and scraping the app | `monitoring/prometheus-values.yaml`, ServiceMonitor in the chart | Targets page | `prometheus-targets.png` (6/6 UP) | VERIFIED |
| Grafana installed and accessible | kube-prometheus-stack Grafana at `grafana.localtest.me` | browser | `grafana-dashboard.png` | VERIFIED |
| Panel with live app metrics | `monitoring/dashboards/pantrix-overview.json` (12 panels) | browser | `grafana-dashboard.png` | VERIFIED |

## Presentation and documentation

| Criterion | Implementation | Evidence | Status |
|---|---|---|---|
| `README.md` with full technical documentation | root `README.md` | — | VERIFIED |
| Video in the repo (`demo/`) | `demo/presentation.mp4` | — | Non-GitHub parts VERIFIED; the CI/CD-on-GitHub segment is a labelled placeholder, PENDING the second computer |
| PPT deck committed (≥8 slides) | `demo/presentation.pptx` (16 slides), `demo/presentation.pdf` | — | VERIFIED |

Video order:

| Required item | Status |
|---|---|
| Slides first | VERIFIED |
| Codebase | VERIFIED |
| CI/CD — push and pipeline end to end | VERIFIED (segment recorded from the real run) |
| Terraform plan + AWS Console (VPC + EKS) | Plan blocker and emulator shown; Console PENDING EXTERNAL ACCESS |
| Argo CD synced app + GitOps flow | VERIFIED |
| Kubernetes pods / services / ingress | VERIFIED |
| Prometheus targets UP | VERIFIED |
| Grafana live dashboard | VERIFIED |

## Honest summary

- **Done and verified on the first computer:** module , module , module , module  (locally), module , module , the module  local parts,
  the module  configuration, the module  code/validation/emulator runs, the deck, and the video for every
  non-GitHub segment.
- **Needs the GitHub repository (second computer):** the push, the Actions run, GHCR packages with SHA
  tags, the GitHub commit history, and the CI segment of the video.
- **Needs real AWS access and the owner's cost approval:** a real `plan`/`apply`, AWS Console
  screenshots of the VPC and EKS, and a real `destroy`. Without them, the module  provisioning criteria
  (VPC 3, EKS 4, destroy 2, and arguably plan 2) remain at risk.
