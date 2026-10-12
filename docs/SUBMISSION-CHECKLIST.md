# Submission checklist — Pantrix (Dhruv Sharma, @Spiritsfuse)

Maps every criterion in `GRADING.md` and `SUBMISSION.md` (Session 21 DevOps Final Capstone, deadline
**19 October 2026, 11:59 PM IST**) to the implementation, the command that verifies it, the evidence,
and its status.

| Status | Meaning |
|---|---|
| **VERIFIED** | Run and checked on 12–13 October 2026 |
| **PENDING EXTERNAL ACCESS** | Needs the GitHub repository (second computer) or valid AWS credentials plus cost approval |
| **NOT COMPLETE** | Work still to do |

A file existing is not counted as proof. Each VERIFIED row has real output behind it, listed in
[`evidence/EVIDENCE-MANIFEST.md`](evidence/EVIDENCE-MANIFEST.md).

## M1 — Application (10)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| FastAPI starts and responds to `/health` | 2 | `backend/app/main.py` | `curl localhost:8000/health` | `api-crud-curl.png` | VERIFIED |
| Min. 4 REST endpoints (GET, POST, PUT, DELETE) | 3 | `backend/app/routers/{items,donors,distributions}.py` (14 routes) | curl sequence | `api-crud-curl.png`, `api-swagger-docs.png` | VERIFIED |
| PostgreSQL with a table managed by Alembic | 2 | `backend/alembic/versions/0001_initial_schema.py` (3 tables) | `docker compose exec backend alembic current`; `psql \dt` | `database-migrations.png` | VERIFIED |
| React frontend renders and makes API calls | 2 | `frontend/src/lib/api.js`, views in `frontend/src/components/` | browser | `application-desktop.png`, `crud-*.png` | VERIFIED |
| Responsive, usable UI | 1 | `frontend/src/styles.css` breakpoints | 390 px viewport | `application-mobile.png` | VERIFIED |
| Submit `backend/app/`, migrations, `requirements.txt`, `frontend/`, `docker-compose.yml`, app screenshot | — | as listed | — | — | VERIFIED |

## M2 — Testing (10)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| `pytest` runs without errors | 3 | `backend/tests/` | `cd backend && pytest -v` | `pytest-results.png` | VERIFIED (31 passed) |
| ≥5 tests covering ≥3 endpoints | 4 | 31 tests across items, donors, distributions, health, ready, metrics | same | `pytest-results.png` | VERIFIED |
| Test DB or mock, not production | 2 | `tests/conftest.py`: temporary SQLite built by the real Alembic migrations, with an assert that refuses any non-SQLite URL | same | `pytest-results.png` | VERIFIED |
| `pytest.ini` / `conftest.py` configured | 1 | `backend/pytest.ini`, `backend/tests/conftest.py` | — | — | VERIFIED |
| Extra quality gates | — | Ruff, Bandit, pip-audit, 96% coverage floor, ESLint, Prettier, Vitest, npm audit | see evidence | `backend-quality-gates.png`, `pytest-coverage.png`, `frontend-lint-test-build.png` | VERIFIED |

## M3 — Git and GitHub (5)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| Public GitHub repository linked in the form | 2 | — | — | — | PENDING EXTERNAL ACCESS (second computer pushes; the user submits the form) |
| Meaningful commit messages | 2 | local `main`, 40+ descriptive commits authored as Dhruv Sharma | `git log --oneline` | `git-local-history.png` | VERIFIED locally |
| `.gitignore` covers `.env`, `__pycache__`, `node_modules`, `.venv` | 1 | `.gitignore` (also Terraform state, tfvars, kubeconfigs, the handoff prompt) | `git check-ignore -v ...` | `git-local-history.png` | VERIFIED |
| Commit-history screenshot (≥10 commits) on GitHub | — | — | — | `github-commit-history.png` | PENDING EXTERNAL ACCESS |

## M4 — Docker (10)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| `backend/Dockerfile` builds | 2 | multi-stage, venv, pip removed | `docker compose build` | `docker-compose-up.png` | VERIFIED |
| `frontend/Dockerfile` multi-stage (Node build + Nginx runtime) | 3 | `node:22-alpine` → `nginxinc/nginx-unprivileged:1.29-alpine` | same | `docker-compose-up.png` | VERIFIED |
| Images run as non-root | 2 | `USER 10001:10001`, `USER 101` | `docker compose exec backend id` | `docker-nonroot-users.png` | VERIFIED |
| `docker compose up --build` starts all three services | 3 | `docker-compose.yml` with health checks and a named volume | `docker compose up --build --wait` | `docker-compose-up.png`, `docker-compose-ps.png`, `docker-persistence.png` | VERIFIED |
| Browser at `localhost:3000` | — | — | — | `application-desktop-framed.png` | VERIFIED |

## M5 — CI/CD (15)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| Workflow file present | 1 | `.github/workflows/ci-cd.yml`, `promote.yml` | `actionlint` | `ci-workflow-validation.png` | VERIFIED |
| Triggers on push to `main` | 1 | `on.push.branches: [main]` | file | `ci-workflow-validation.png` | VERIFIED (config); a real run is PENDING |
| Pytest job fails the build on test failure | 3 | `backend-test` (`pytest ... --cov-fail-under=85`); `build-scan-push` `needs:` every gate | file | — | Config VERIFIED; real run PENDING EXTERNAL ACCESS |
| Frontend built in the pipeline | 2 | `frontend-test` → `npm run build` | file | — | Config VERIFIED; real run PENDING |
| Docker images built for both | 3 | `build-scan-push` matrix [backend, frontend] | file | — | Config VERIFIED; real run PENDING |
| Images pushed to GHCR | 3 | `docker/login-action` + `docker push ghcr.io/<owner>/pantrix-*` (main only) | GHCR packages page | `ghcr-*-package.png` | PENDING EXTERNAL ACCESS |
| Tags use the commit SHA, not `latest` | 2 | `tag=${GITHUB_SHA}` | file / GHCR | `ci-workflow-validation.png` | Config VERIFIED; real tags PENDING |
| Green run URL, GHCR screenshot | — | — | — | — | PENDING EXTERNAL ACCESS |

Local equivalents of every CI step (tests, lint, audits, builds, Trivy, Gitleaks, Helm lint, Terraform
validate) were run on this computer; see M2, M4, M6, M7 and M8.

## M6 — Trivy (5)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| Trivy scans both images in CI | 3 | `build-scan-push` (`aquasecurity/trivy-action`, pinned SHA, v0.36.0) | local `trivy image` | `trivy-backend.png`, `trivy-frontend.png` | Local VERIFIED; CI run PENDING |
| Fail on HIGH/CRITICAL | 1 | `severity: HIGH,CRITICAL`, `exit-code: 1`, `ignore-unfixed: true` | policy | `security/TRIVY-POLICY.md`, `trivy-backend-before-fix.png` (it really failed) | VERIFIED |
| Explain a CVE / a clean result | 1 | `security/TRIVY-POLICY.md`, `docs/engineering/security.md` | — | — | VERIFIED |
| 2–3 sentence explanation | — | below | — | — | VERIFIED |

> Trivy scanned the OS packages (Debian 13 / Alpine 3.23) and the Python packages inside both images.
> The first backend image failed the gate with four fixable HIGH findings — GHSA-6v7p-g79w-8964
> (msgpack), CVE-2025-47273 (setuptools) and CVE-2026-97687/97689 (urllib3). All four were in copies
> that pip and ensurepip bundle, which the API never imports, so removing pip from the runtime image
> fixed them; nothing was suppressed. The current images have no fixable HIGH or CRITICAL findings. The
> backend still reports 44 HIGH findings in Debian packages that have no fix yet; the policy reports
> these but does not block on them.

## M7 — Terraform / AWS (15)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| `terraform/` valid HCL | 2 | `versions.tf`, `variables.tf`, `main.tf`, `outputs.tf` | `terraform validate` | `terraform-init-validate.png` | VERIFIED |
| `terraform init` succeeds | 1 | — | `terraform init` | `terraform-init-validate.png` | VERIFIED |
| `terraform plan` non-empty, no errors | 2 | — | `terraform plan` | `terraform-plan-blocked.png` (real AWS: invalid credentials); `terraform-plan-emulator.png` (62 to add against the Moto emulator) | Real plan: PENDING EXTERNAL ACCESS. Emulator plan: VERIFIED |
| VPC with ≥2 public subnets provisioned | 3 | `module.vpc` (2 public + 2 private subnets) | AWS Console | — | PENDING EXTERNAL ACCESS (emulator apply created them in Moto only) |
| EKS cluster with ≥1 worker node group | 4 | `module.eks` + `general` node group | AWS Console, `kubectl get nodes` | — | PENDING EXTERNAL ACCESS |
| `terraform destroy` clean | 2 | — | `terraform destroy` | `terraform-destroy-emulator.png` (emulator only) | Real: PENDING EXTERNAL ACCESS |
| `terraform.tfvars.example`, no credentials committed | 1 | `terraform/terraform.tfvars.example`; Gitleaks clean | `gitleaks git` | `gitleaks-history-scan.png` | VERIFIED |

**Blocker:** `aws sts get-caller-identity` on the first computer returns `InvalidClientTokenId`.
Provisioning real EKS costs about $0.25–0.30 per hour and requires the owner's explicit approval.
Runbook: [`runbooks/aws-provision-and-teardown.md`](runbooks/aws-provision-and-teardown.md).

## M8 — Kubernetes and Helm (15)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| `k8s/namespace.yaml` applies cleanly | 1 | restricted Pod Security labels | `kubectl apply -f k8s/namespace.yaml` | `kubernetes-pods.png` | VERIFIED |
| Helm chart with `Chart.yaml`, `values.yaml`, templates | 3 | `helm/pantrix/` (+ `values-dev.yaml`, `values-prod.yaml`) | `helm lint --strict` | `helm-lint-template.png` | VERIFIED |
| `helm upgrade --install` succeeds | 3 | `scripts/k8s/deploy-local.sh` | `helm list` | `helm-release.png` | VERIFIED (kind) |
| ≥2 replicas each for backend and frontend | 2 | HPA `minReplicas: 2` | `kubectl get pods` | `kubernetes-pods.png` | VERIFIED |
| ClusterIP Services for backend and frontend | 2 | `templates/backend.yaml`, `frontend.yaml` | `kubectl get svc` | `kubernetes-services-ingress-hpa.png` | VERIFIED |
| Ingress `/` → frontend, `/api` → backend | 2 | `templates/ingress.yaml` | `kubectl describe ingress`, browser | `ingress-routing.png`, `ingress-application.png`, `ingress-api-route.png` | VERIFIED |
| All pods Running | 2 | — | `kubectl get pods -n pantrix` | `kubernetes-pods.png` | VERIFIED |
| HPA (README requirement) | — | `templates/hpa.yaml`, metrics-server | load test | `hpa-scaling.png` (2→6) | VERIFIED |

The cluster is a local kind cluster, which the course permits for the demo. Deploying the same chart on
EKS is PENDING real AWS access.

## M9 — Observability (10)

| Criterion | Pts | Implementation | Verify | Evidence | Status |
|---|---|---|---|---|---|
| `/metrics` in Prometheus format | 2 | `prometheus-fastapi-instrumentator` + `pantrix_*` counters | `curl /metrics` | `metrics-endpoint.png` | VERIFIED |
| Prometheus installed and scraping the app | 3 | `monitoring/prometheus-values.yaml`, ServiceMonitor in the chart | Targets page | `prometheus-targets.png` (6/6 UP) | VERIFIED |
| Grafana installed and accessible | 2 | kube-prometheus-stack Grafana at `grafana.localtest.me` | browser | `grafana-dashboard.png` | VERIFIED |
| Panel with live app metrics | 3 | `monitoring/dashboards/pantrix-overview.json` (12 panels) | browser | `grafana-dashboard.png` | VERIFIED |

## M10 — Presentation and documentation (5)

| Criterion | Pts | Implementation | Evidence | Status |
|---|---|---|---|---|
| `README.md` with full technical documentation | 2 | root `README.md` | — | VERIFIED |
| Video in the repo (`demo/`) | 2 | `demo/presentation.mp4` | — | Non-GitHub parts VERIFIED; the CI/CD-on-GitHub segment is a labelled placeholder, PENDING the second computer |
| PPT deck committed (≥8 slides) | 1 | `demo/presentation.pptx` (16 slides), `demo/presentation.pdf` | — | VERIFIED |

Video order required by `SUBMISSION.md`:

| Required item | Status |
|---|---|
| Slides first | VERIFIED |
| Codebase | VERIFIED |
| CI/CD — push and pipeline end to end | PENDING EXTERNAL ACCESS |
| Terraform plan + AWS Console (VPC + EKS) | Plan blocker and emulator shown; Console PENDING EXTERNAL ACCESS |
| Argo CD synced app + GitOps flow | VERIFIED |
| Kubernetes pods / services / ingress | VERIFIED |
| Prometheus targets UP | VERIFIED |
| Grafana live dashboard | VERIFIED |

## Submission (SUBMISSION.md)

| Item | Status |
|---|---|
| Single GitHub repository link via https://forms.gle/XWAP1vAumDJgAPM1A | PENDING — the owner submits it personally |
| `README.md` | VERIFIED |
| `demo/` video (MP4) | Present; final version after the GitHub segment is recorded |
| `demo/` slide deck (PPT/PDF) | VERIFIED |

## Honest summary

- **Done and verified on the first computer:** M1, M2, M4, M6 (locally), M8, M9, the M3 local parts,
  the M5 configuration, the M7 code/validation/emulator runs, the deck, and the video for every
  non-GitHub segment.
- **Needs the GitHub repository (second computer):** the push, the Actions run, GHCR packages with SHA
  tags, the GitHub commit history, and the CI segment of the video.
- **Needs real AWS access and the owner's cost approval:** a real `plan`/`apply`, AWS Console
  screenshots of the VPC and EKS, and a real `destroy`. Without them, the M7 provisioning criteria
  (VPC 3, EKS 4, destroy 2, and arguably plan 2) remain at risk.
