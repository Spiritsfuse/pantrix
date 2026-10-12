# Security

Security here is a set of layers, each catching a different class of problem.
A clean scanner result means "nothing known was found by this tool", not "secure".

## Controls

| Layer | Tool / mechanism | Where | Result on the build computer |
|-------|------------------|-------|------------------------------|
| SAST | Bandit (`-ll`, medium+ severity) | CI `backend-test` | 0 findings |
| Lint with security rules | Ruff rule set `S` (flake8-bandit) | CI `backend-test` | clean |
| Python dependencies | pip-audit `--strict` | CI `backend-test` | "No known vulnerabilities found" |
| JS dependencies | `npm audit --omit=dev --audit-level=high` | CI `frontend-test` | 0 vulnerabilities |
| Secrets in Git | Gitleaks 8.30.1 over the full history | CI `secret-scan` | "no leaks found" (20 commits at time of scan) |
| Container images | Trivy, gate = fixable HIGH/CRITICAL | CI `build-scan-push` | both images pass (exit 0) |
| IaC / manifests | Trivy config: Terraform, Helm, Dockerfiles, k8s YAML | CI `iac-scan` | clean except documented AWS-0104 |
| SBOM | Trivy CycloneDX per image | CI artifact, `security/sbom/` | backend 119, frontend 71 components |
| Provenance | `actions/attest-build-provenance` | CI, after push | pending first GitHub run |
| Supply chain of CI itself | Actions pinned to commit SHAs, least-privilege token per job | `.github/workflows/` | validated with actionlint |
| Runtime: users | non-root images (10001 / 101), `runAsNonRoot` | Dockerfiles, chart | verified (`/proc/1/status`) |
| Runtime: hardening | read-only root FS, no privilege escalation, drop `ALL` capabilities, seccomp `RuntimeDefault`, no service account token | chart | enforced by `restricted` PSS on the namespace |
| Network | NetworkPolicy: only backend pods reach Postgres :5432 | chart | applied (enforcement depends on the CNI, see limitations) |
| Secrets at runtime | Random DB password in a K8s Secret (Helm `lookup` keeps it stable); Grafana password random; nothing in Git | chart, scripts | verified |
| HTTP | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `server_tokens off` | `frontend/nginx.conf.template` | verified in response headers |
| Cloud | KMS envelope encryption of EKS Secrets, private API endpoint by default, IMDSv2 hop limit 1, VPC flow logs | `terraform/` | `validate` + Trivy config; not applied to AWS |

Exception policy: `.trivyignore` is for IaC findings only. Each entry needs a
reason, the mitigations and a review date. Image CVEs are never ignored
(ADR 0007).

## A real finding, investigated and fixed

The first Trivy scan of the backend image (`ghcr.io/spiritsfuse/pantrix-backend:5196d75…`)
**failed the gate** with four fixable HIGH vulnerabilities
(`docs/evidence/trivy-backend-before-fix.png`):

| Package | ID | Installed → fixed | Nature |
|---------|----|-------------------|--------|
| msgpack | GHSA-6v7p-g79w-8964 | 1.1.2 → 1.2.1 | out-of-bounds read / crash on Unpacker reuse |
| setuptools | CVE-2025-47273 | 70.3.0 → 78.1.1 | path traversal in `PackageIndex` |
| urllib3 | CVE-2026-97687 | 2.7.0 → 2.8.0 | traffic interception via HTTPS proxy TLS configuration override |
| urllib3 | CVE-2026-97689 | 2.7.0 → 2.8.0 | DoS via unbounded memory allocation in the chunk parser |

**Investigation:**
- `find` inside the image showed `msgpack` and `urllib3` only under
  `/opt/venv/lib/python3.12/site-packages/pip/_vendor/`. They were pip's private
  copies.
- `setuptools` came from the interpreter's bundled `ensurepip` wheels.
- The API imports none of them.

**Fix (commit `964bf54`):** pip is uninstalled from the virtualenv after the
dependencies are installed, and the base image's pip and `ensurepip/_bundled`
are deleted in the runtime stage.

**Result:**
- The gate passes (exit 0).
- The image still imports FastAPI, SQLAlchemy and psycopg.
- `command -v pip` is empty.
- Nothing was added to `.trivyignore`.

## What the remaining findings mean

The full report for the current backend image (`ae29a59`) lists LOW 61,
MEDIUM 58, HIGH 44 and UNKNOWN 3. Only 2 UNKNOWN have a fix available.

These come from Debian 13 base-image packages that the Debian security team has
not patched yet. They cannot be fixed by this project short of changing the base
image, so the gate (`--ignore-unfixed`) reports them without blocking. The
frontend image (Alpine 3.23 with `apk upgrade` at build time) reports no
vulnerabilities in its scan.

Next step: a distroless or Chainguard Python base to remove most of the Debian
userland, and nightly rebuilds so fixes arrive without code changes.

## How to reproduce

```bash
bash scripts/evidence/capture-transcripts.sh security      # Trivy (both images), Trivy config, Gitleaks, SBOMs
```
