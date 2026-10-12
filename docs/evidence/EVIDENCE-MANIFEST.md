# Evidence manifest

Every image here comes from the real Pantrix system. Nothing is mocked up, and nothing comes
from another project or account.

**Capture methods**

| Code | Method |
|---|---|
| **B** | Browser screenshot of the live system, taken with Playwright by `scripts/evidence/capture-browser.mjs`. Each `<name>-framed.png` twin wraps the same image in a minimal browser frame whose address bar shows the URL Playwright actually visited. |
| **T** | Terminal evidence. `scripts/evidence/capture-transcripts.sh` re-runs the real commands and saves their output to `transcripts/<name>.txt`. `scripts/evidence/render-terminal.mjs` renders that text into a terminal-window PNG. The prompt `dhruv-sharma@pantrix` is configured by `scripts/lib/term.sh`. Long output is cut with a visible "N lines omitted" marker that points to the full transcript. |
| **R** | A saved tool report (not a shell session), rendered the same way and labelled as a report in its title bar. |
| **E** | Terraform output against **Moto, a local AWS API emulator**. These are real Terraform runs, but they are **not** evidence of AWS resources. Every image in this group says so in its title and footer. |

**Status values**

- **VERIFIED**: captured and checked against the output.
- **PENDING EXTERNAL ACCESS**: needs real AWS credentials.

Capture date for everything below: 2026-10-12 and 2026-10-13 (IST), on the first computer, against the
kind cluster `pantrix`, the Docker Compose stack and the local repository.

## Application (M1)

| File | Proves | Method | Status |
|---|---|---|---|
| `application-desktop.png` (+framed, +`-full`) | The React UI loaded at `http://localhost:3000`, with data from the API: KPI strip, expiry-sorted shelf | B | VERIFIED |
| `application-mobile.png` (+framed) | Responsive layout at 390×844 | B | VERIFIED |
| `application-filter-expired.png`, `application-donors.png`, `application-handouts.png` (+framed) | Filters, donors CRUD table, hand-out history | B | VERIFIED |
| `application-error-state.png` (+framed) | Error state when the API is unreachable. Playwright aborts the `/api` requests; the banner is the app's real error handling | B | VERIFIED |
| `crud-1-create-form.png` … `crud-8-deleted.png` | A full create → read → update → hand-out → 409 conflict → delete flow through the UI | B | VERIFIED |
| `api-swagger-docs.png` (+framed) | FastAPI Swagger at `:8000/docs` listing every endpoint | B | VERIFIED |
| `api-crud-curl.png` | `GET`/`POST`/`PUT`/`DELETE`, `/health`, `/ready`, 404 and 422 responses through curl | T | VERIFIED |
| `database-migrations.png` | `alembic current` and `alembic history`, `\dt`, and rows in `stock_items` (PostgreSQL) | T | VERIFIED |

## Testing and quality (M2)

| File | Proves | Method | Status |
|---|---|---|---|
| `pytest-results.png` | `pytest -v`: 31 passed | T | VERIFIED |
| `pytest-coverage.png` | 96% coverage, 31 passed | T | VERIFIED |
| `backend-quality-gates.png` | Ruff lint and format, Bandit (exit 0), pip-audit (no known vulnerabilities) | T | VERIFIED |
| `frontend-lint-test-build.png` | ESLint, Prettier, Vitest (10 passed), `npm audit` (0), `vite build` | T | VERIFIED |

## Git (M3)

| File | Proves | Method | Status |
|---|---|---|---|
| `git-local-history.png` | Local `main` history, commit count, empty `git remote -v`, `.gitignore` rules for `.env`, `.venv`, `node_modules`, Terraform state and the handoff prompt | T | VERIFIED (local) |
| `github-repository.png`, `github-commit-history.png` | Repository front page and commit history on GitHub | B | VERIFIED |

## Docker (M4)

| File | Proves | Method | Status |
|---|---|---|---|
| `docker-compose-up.png` | `docker compose up --build --wait`: all three services Healthy | T | VERIFIED |
| `docker-compose-ps.png` | `docker compose ps`, plus backend logs showing the migration and the demo seed | T | VERIFIED |
| `docker-nonroot-users.png` | Image `User` config (10001, 101), `id` inside the containers, UID of PID 1, image sizes | T | VERIFIED |
| `docker-persistence.png` | A record survives `docker compose down` / `up` (named volume) | T | VERIFIED |
| `application-desktop-framed.png` | The browser at `localhost:3000` | B | VERIFIED |

## CI/CD (M5)

| File | Proves | Method | Status |
|---|---|---|---|
| `ci-workflow-validation.png` | `actionlint` passes on `ci-cd.yml` and `promote.yml`; the job graph, Trivy flags and SHA tagging lines | T | VERIFIED (local) |
| `github-actions-run.png`, `github-actions-pytest.png`, `github-actions-ghcr-push.png`, `github-actions-k8s-smoke.png`, `github-promote-run.png`, `github-actions-artifacts.png` | A real pipeline run on GitHub | B | PENDING EXTERNAL ACCESS |
| `ghcr-backend-package.png`, `ghcr-frontend-package.png` | GHCR packages with commit-SHA tags | B | VERIFIED |

## Trivy / DevSecOps (M6)

| File | Proves | Method | Status |
|---|---|---|---|
| `trivy-backend-before-fix.png` | The first backend image (`5196d75`) **failed** the gate: 4 fixable HIGH findings (msgpack, setuptools, urllib3) | R | VERIFIED |
| `trivy-backend.png` | Backend image after the fix: 0 fixable HIGH/CRITICAL (gate exit 0), plus totals across all severities | T | VERIFIED |
| `trivy-frontend.png` | Frontend image: 0 vulnerabilities (gate exit 0) | T | VERIFIED |
| `trivy-config-iac.png` | Trivy misconfiguration scan of Terraform, Helm, Kubernetes and Dockerfiles: 0 HIGH/CRITICAL (AWS-0104 is a documented exception) | T | VERIFIED |
| `gitleaks-history-scan.png` | Gitleaks over the full Git history: no leaks | T | VERIFIED |
| `sbom-generation.png` | CycloneDX SBOMs (119 / 71 components) | T | VERIFIED |
| `github-trivy-backend.png`, `github-trivy-frontend.png` | The Trivy steps inside a real pipeline run | B | PENDING EXTERNAL ACCESS |

## Terraform / AWS (M7)

| File | Proves | Method | Status |
|---|---|---|---|
| `terraform-init-validate.png` | `terraform version`, `fmt -check`, `init`, `validate` | T | VERIFIED |
| `terraform-plan-blocked.png` | A real `terraform plan` stops with `InvalidClientTokenId`: the credentials on this computer are invalid | T | VERIFIED (shows the blocker) |
| `terraform-plan-emulator.png` | `terraform plan` against Moto: **62 to add** | E | VERIFIED (emulator only) |
| `terraform-emulator-apply-destroy.png` | Apply against Moto created 54/62 (VPC, subnets, IGW, NAT, EKS cluster, node group) and stopped at EKS APIs Moto lacks; destroy removed all 54 | E | VERIFIED (emulator only) |
| `terraform-destroy-emulator.png` | `Destroy complete! Resources: 54 destroyed.` (emulator) | E | VERIFIED (emulator only) |
| `aws-vpc.png`, `aws-subnets.png`, `aws-eks-cluster.png`, `aws-eks-node-group.png`, `terraform-apply.png`, `terraform-destroy.png` (real AWS) | Real AWS resources and their teardown | B/T | PENDING EXTERNAL ACCESS — valid AWS credentials plus cost approval are needed |

No AWS Console screenshot exists. None was created, edited or borrowed.
`docs/presentation/aws-architecture.png` is a design diagram and is labelled as not provisioned.

## Kubernetes and Helm (M8)

| File | Proves | Method | Status |
|---|---|---|---|
| `kubernetes-pods.png` | Node Ready; `kubectl apply -f k8s/namespace.yaml`; `helm list`; 2 backend + 2 frontend + PostgreSQL pods Running | T | VERIFIED |
| `kubernetes-services-ingress-hpa.png` | ClusterIP Services, the Ingress (`pantrix.localtest.me`), the HPAs, Deployments, StatefulSet, PVC, NetworkPolicy, PDBs | T | VERIFIED |
| `helm-release.png` | `helm list`, `helm history` (including a failed release and its rollback), `helm test` Succeeded | T | VERIFIED |
| `helm-lint-template.png` | `helm lint --strict` and the rendered resource kinds | T | VERIFIED |
| `ingress-application.png` (+framed), `ingress-api-route.png` (+framed) | The app and the API served through the Ingress hostname | B | VERIFIED |
| `ingress-routing.png` | `kubectl describe ingress` (`/api` → backend, `/` → frontend) and the smoke test through the Ingress | T | VERIFIED |
| `hpa-scaling.png`, `hpa-scaled-pods.png` | HPA at 397% of the CPU target scaled the backend from 2 to 6 replicas under generated load | T | VERIFIED |

## Argo CD / GitOps

| File | Proves | Method | Status |
|---|---|---|---|
| `argocd-applications.png` (+framed), `argocd-application.png` (+framed) | Application `pantrix-dev` Synced and Healthy, with its resource tree | B | VERIFIED |
| `argocd-gitops-cli.png` | Application status, the promotion commits in `git log`, and the image SHA running in `pantrix-gitops` | T | VERIFIED |

The rehearsal source is an in-cluster git daemon, because no GitHub remote may exist on this computer.
Switching `repoURL` to GitHub is documented in `docs/engineering/gitops.md`.

## Observability (M9)

| File | Proves | Method | Status |
|---|---|---|---|
| `metrics-endpoint.png` | `curl /metrics`: Prometheus format, request counters, histogram buckets, `pantrix_*` business metrics | T | VERIFIED |
| `prometheus-targets.png` (+framed) | `serviceMonitor/pantrix/pantrix-backend`: 6/6 targets **UP** | B | VERIFIED |
| `prometheus-query.png` (+framed) | Live PromQL request rate per handler | B | VERIFIED |
| `prometheus-servicemonitor.png` | ServiceMonitor, PrometheusRule, and the Prometheus API answer for `up{job="pantrix-backend"}` | T | VERIFIED |
| `grafana-dashboard.png` (+framed) | "Pantrix · API overview" with every panel populated from real traffic | B | VERIFIED |

## Troubleshooting

| File | Proves | Method | Status |
|---|---|---|---|
| `troubleshooting-01-broken-image.png` | ImagePullBackOff → describe/events → fixed with the SHA tag | T | VERIFIED |
| `troubleshooting-02-broken-service.png` | No endpoints → label mismatch → selector fixed → `ok` | T | VERIFIED |
| `troubleshooting-03-readiness.png` | Running but 0/1 Ready (`/ready` 503, `/health` 200) → correct Secret → Ready | T | VERIFIED |
| `troubleshooting-04-migration.png` | Alembic init container fails (DNS) → URL fixed → migration runs | T | VERIFIED |
| `troubleshooting-05-rollback.png` | Bad release fails, old pods keep serving (3/3 HTTP 200) → `helm rollback` | T | VERIFIED |

## Presentation (M10)

| File | Proves | Status |
|---|---|---|
| `demo/presentation.pptx`, `demo/presentation.pdf` | 16-slide deck with speaker notes | VERIFIED (opened and rendered) |
| `demo/presentation.mp4`, `demo/preview.gif` | Video: slides first, then the live walkthrough. The GitHub segment is a placeholder until the repository exists | VERIFIED for the non-GitHub parts; the GitHub segment is PENDING EXTERNAL ACCESS |
| `demo/DEMO-SCRIPT.md` | Script plus the GitHub capture checklist | VERIFIED |

## Not used, on purpose

- No screenshots from the reference repositories.
- No edited AWS, GitHub or terminal captures.
- No simulated consoles.
