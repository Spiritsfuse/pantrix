# Trivy policy

Pantrix uses [Trivy](https://trivy.dev) at two points in the pipeline:

| Scan | What it looks at | Where it runs | Fails the build when |
|---|---|---|---|
| `trivy image` | OS packages (Debian 13 / Alpine 3.23) and Python packages inside the **built** backend and frontend images | `build-scan-push` job, once per image, **before** the push to GHCR | any **HIGH or CRITICAL** vulnerability **that has a fixed version available** (`--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`) |
| `trivy config` | Terraform, the rendered Helm chart, Kubernetes manifests and Dockerfiles | `iac-scan` job | any HIGH or CRITICAL misconfiguration not listed in `.trivyignore` |

A full report of every severity, fixable or not, is also produced for each image and uploaded as a
workflow artifact together with a CycloneDX SBOM, so nothing is hidden by the gate.

## Why "fixable only" for images

An unfixed CVE in a Debian base package cannot be remediated by this project: there is no newer
package to install. Failing on it would block every release without improving security. Those
findings stay visible in the full report and are re-evaluated whenever the base image is rebuilt.
A HIGH/CRITICAL with a fix **must** be fixed — by upgrading the dependency, rebuilding on a newer
base image, or removing the component — before the image can be published.

## Exceptions (`.trivyignore`)

* **Image CVEs are never ignored.** `.trivyignore` is only for misconfiguration IDs.
* Every entry carries: the ID, why the risk is accepted, the compensating controls, and a review date.
* Current entries: **AWS-0104** (EKS node security group egress to `0.0.0.0/0`) — required for
  nodes to reach ECR/GHCR and AWS APIs through the NAT gateway; nodes are in private subnets with
  IMDSv2 hop limit 1 and VPC flow logs. Review 2027-01-31.

## Findings handled so far

| Date | Finding | Source | Resolution |
|---|---|---|---|
| 2026-10-12 | GHSA-6v7p-g79w-8964 (msgpack), CVE-2025-47273 (setuptools), CVE-2026-97687 and CVE-2026-97689 (urllib3) — 4 fixable HIGH | pip's vendored libraries in the backend venv and the base image's ensurepip wheels | pip and the ensurepip wheels are removed from the runtime image (commit `964bf54`); gate passes with 0 fixable HIGH/CRITICAL |
| 2026-10-12 | AWS-0040 / AWS-0041 (CRITICAL) — EKS API endpoint public to `0.0.0.0/0` | `terraform/main.tf` | endpoint is private unless the operator passes their own CIDRs; `0.0.0.0/0` is rejected by variable validation (commit `571688a`) |
| 2026-10-12 | AWS-0104 (CRITICAL) — node egress to the internet | upstream EKS module | documented exception (above) |
| 2026-10-12 | KSV-0014/0118 in `.terraform/modules/eks/examples` | vendored module examples, not deployed | scan skips `terraform/.terraform` |

Evidence: `docs/evidence/trivy-backend-before-fix.png`, `trivy-backend.png`, `trivy-frontend.png`,
`trivy-config-iac.png` and the transcripts next to them.

## What Trivy does not cover

Trivy finds *known* vulnerabilities in *packaged* components and *known* misconfiguration patterns.
It does not find bugs in Pantrix's own code (Bandit and the tests do part of that), runtime attacks,
leaked secrets in Git history (Gitleaks does), or vulnerabilities that have not been published yet.
A clean scan means "nothing known and fixable today", not "secure".
