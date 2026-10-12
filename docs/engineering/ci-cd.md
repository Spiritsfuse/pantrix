# CI/CD

Two workflows live in `.github/workflows/`. Every action is pinned to a full
commit SHA (with the version in a comment). Every job has a timeout, and the
default token permission is `contents: read`.

## `ci-cd.yml` — on push to `main`, pull requests to `main`, manual

Pushes that only touch `**.md`, `docs/`, `demo/` or `gitops/environments/` do
not start it.

```text
backend-test ─┐
frontend-test ┼──► build-scan-push (matrix: backend, frontend) ──► k8s-smoke
secret-scan  ─┤
iac-scan     ─┘
```

| Job | Steps | Fails the build when |
|-----|-------|----------------------|
| backend-test | ruff check + format, bandit `-ll`, pip-audit `--strict`, `pytest -v --cov-fail-under=85` (JUnit + coverage uploaded) | any lint error, medium+ Bandit finding, known dependency CVE, failing test or coverage < 85% |
| frontend-test | `npm ci`, ESLint, Prettier check, Vitest, `npm audit --omit=dev --audit-level=high`, `vite build` (dist uploaded) | lint/format/test failure, high runtime CVE, build error |
| secret-scan | Gitleaks 8.30.1 over the full history (`fetch-depth: 0`) | any secret found |
| iac-scan | `terraform fmt -check`, `init -backend=false`, `validate`; `helm lint --strict` + `helm template`; `kubectl apply --dry-run=client` of the namespace; Trivy config scan | invalid HCL or chart, or a HIGH/CRITICAL misconfiguration not in `.trivyignore` |
| build-scan-push | Buildx build (`load`), non-root check, Trivy full report, **Trivy gate** (HIGH/CRITICAL, ignore-unfixed, exit 1), CycloneDX SBOM, then **only on push to main**: GHCR login, push `:<github.sha>`, build-provenance attestation | root user, fixable HIGH/CRITICAL CVE, push failure |
| k8s-smoke | kind cluster, pull the just-pushed images and `kind load` them, ingress-nginx + metrics-server, `helm upgrade --install --atomic --wait`, `scripts/k8s/smoke-test.sh` through the Ingress | pods not ready, or the UI/API smoke test fails (diagnostics dumped) |

`needs:` ordering guarantees that no image is pushed unless every gate passed.
Images are tagged only with the full commit SHA, never `latest` (ADR 0006).

## `promote.yml` — after a successful `ci-cd` push run on main, or manual

1. Resolve the SHA (`workflow_run.head_sha` or the input) and require 40 hex
   characters.
2. `docker manifest inspect` both GHCR images.
3. Update `gitops/environments/dev/values.yaml` (registry owner and `image.tag`).
4. Commit as `github-actions[bot]` and push.

Argo CD then reconciles the cluster. See [gitops.md](gitops.md).

## What has been validated on the build computer

- `actionlint 1.7.12` reports no problems in either workflow
  (`docs/evidence/ci-workflow-validation.png`).
- Every gate's command was run locally and passed. Transcripts are in
  `docs/evidence/transcripts/`:
  - pytest (31 passed) and coverage (96%);
  - ruff, bandit and pip-audit;
  - ESLint, Prettier, Vitest (10 passed), npm audit (0 vulnerabilities) and the
    Vite build;
  - Gitleaks (no leaks);
  - terraform fmt and validate;
  - helm lint and template;
  - Trivy config (clean, apart from the documented AWS-0104 exception);
  - Trivy image gate on both images (exit 0);
  - SBOM generation.
- The Helm deploy plus smoke test that `k8s-smoke` performs was run on a local
  kind cluster and passed.

## First hosted run: what it exposed

The first runs on GitHub-hosted runners found two real problems that local runs could not:

- `kubectl apply --dry-run=client` still performs API discovery, so it fails on a runner with no
  cluster. The IaC job now checks `k8s/namespace.yaml` structurally; the kind job applies it for real.
- The shell scripts had been committed without the executable bit (exit code 126). They are now
  `100755` in Git.

After those fixes the run is green: [`ci-cd` #6](https://github.com/Spiritsfuse/pantrix/actions/runs/38305646085) with all seven jobs passing, both
images pushed to GHCR as `ghcr.io/spiritsfuse/pantrix-{backend,frontend}:<full sha>`, attested, pulled
back and deployed on kind through Helm and the Ingress. `promote.yml` then committed the SHA to
`gitops/environments/dev/values.yaml`.
