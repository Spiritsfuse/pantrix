# Security controls

| Layer | Control | Tool / mechanism | Runs in | Local evidence |
|---|---|---|---|---|
| Source code (SAST) | Python security lint | Bandit (`-ll`) | CI `backend-test` | `docs/evidence/backend-quality-gates.png` |
| Dependencies | Known-vulnerable Python / npm packages | pip-audit `--strict`, `npm audit --omit=dev --audit-level=high` | CI `backend-test`, `frontend-test` | `backend-quality-gates.png`, `frontend-lint-test-build.png` |
| Secrets | Secrets anywhere in Git history | Gitleaks 8.30.1 (`gitleaks git`) | CI `secret-scan` | `gitleaks-history-scan.png` |
| Container images | OS + library CVEs, fail on fixable HIGH/CRITICAL | Trivy image | CI `build-scan-push` (before push) | `trivy-backend.png`, `trivy-frontend.png`, `trivy-backend-before-fix.png` |
| Infrastructure as code | Terraform / Helm / Kubernetes / Dockerfile misconfiguration | Trivy config | CI `iac-scan` | `trivy-config-iac.png` |
| Supply chain | Bill of materials per image | Trivy CycloneDX SBOM | CI artifact; local copies in `security/sbom/` | `sbom-generation.png` |
| Supply chain | Signed build provenance for every pushed image | `actions/attest-build-provenance` (Sigstore, keyless) | CI, pushes to `main` only | pending first GitHub run |
| Supply chain | Every GitHub Action pinned to a commit SHA | workflow review, `actionlint` | — | `ci-workflow-validation.png` |
| Runtime | Non-root users (10001 backend, 101 frontend, 70 Postgres) | Dockerfiles, pod `securityContext` | build + deploy | `docker-nonroot-users.png` |
| Runtime | Read-only root filesystem, all capabilities dropped, seccomp `RuntimeDefault`, no privilege escalation | Helm `pantrix.containerSecurity` helper | deploy | `helm/pantrix/templates/_helpers.tpl` |
| Runtime | Namespace enforces the `restricted` Pod Security Standard | `k8s/namespace.yaml` labels | deploy | `kubernetes-pods.png` (pods admitted) |
| Network | Only backend pods may reach PostgreSQL | NetworkPolicy | deploy | `kubernetes-services-ingress-hpa.png` |
| Secrets at rest | DB credentials in Kubernetes Secrets, generated in-cluster, never in Git; EKS Secrets envelope-encrypted with KMS | Helm `lookup`, bootstrap scripts, Terraform `encryption_config` | deploy | — |
| HTTP | `X-Content-Type-Options`, `X-Frame-Options: DENY`, CSP, `Referrer-Policy`, no server tokens | `frontend/nginx.conf.template` | runtime | check with `curl -I http://localhost:3000/` |

Policies: [`TRIVY-POLICY.md`](TRIVY-POLICY.md). Exceptions: [`../.trivyignore`](../.trivyignore).

## Reproduce locally

```bash
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pantrix-backend:local
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pantrix-frontend:local
trivy config --severity HIGH,CRITICAL --skip-dirs terraform/.terraform --skip-dirs troubleshooting .
gitleaks git --redact -v .
cd backend && bandit -r app -ll && pip-audit -r requirements.txt
cd frontend && npm audit --omit=dev --audit-level=high
```

`security/sbom/*.cdx.json` are the CycloneDX SBOMs of the images scanned locally on 2026-10-12.
