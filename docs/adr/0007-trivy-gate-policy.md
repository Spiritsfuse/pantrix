# 0007 — Trivy gate: fail on fixable HIGH/CRITICAL, never ignore image CVEs

**Status:** Accepted

## Context

The rubric asks that the pipeline fail on HIGH or CRITICAL CVEs. Base OS images
always carry some HIGH findings that have no fixed package yet. Failing on
those would block every build with nothing actionable to do.

## Options considered

1. **Fail on any HIGH/CRITICAL.** Blocks forever on unfixable Debian findings.
2. **Fail on HIGH/CRITICAL that have a fix (`--ignore-unfixed`), report everything.**
   Every failure then has a concrete remedy.
3. **Report only.** This is what the instructor's working workflow effectively
   did: no `--exit-code`.

## Decision

Per image in CI:
1. A full report at every severity (exit 0), uploaded as an artifact.
2. **The gate:** `severity: HIGH,CRITICAL`, `ignore-unfixed: true`,
   `exit-code: 1`.
3. A CycloneDX SBOM.

**Config scan.** Trivy also scans Terraform, the Helm chart and the Dockerfiles
(`scan-type: config`, HIGH/CRITICAL, exit 1). `terraform/.terraform` (vendored
module examples) and `troubleshooting/` (deliberately broken manifests) are
skipped.

**`.trivyignore` rules.** Image CVEs are never added. The only entry is AWS-0104,
EKS node security-group egress to `0.0.0.0/0`. It carries a reason (nodes need
egress via NAT to pull images and reach AWS APIs), mitigations and a review date
of 2027-01-31.

**Fixed rather than ignored:**
- the pip-vendored CVEs (ADR 0005);
- AWS-0040/AWS-0041, by making the EKS API endpoint private unless the operator
  passes their own CIDR (ADR 0013).

All actions, Trivy included, are pinned to commit SHAs. trivy-action tags were
re-pointed during the March 2026 supply-chain incident.

## Consequences

- The backend still carries unfixed Debian findings. At `ae29a59`: LOW 61,
  MEDIUM 58, HIGH 44 and UNKNOWN 3, with fixes available only for 2 UNKNOWN. They
  are visible in the report artifact and do not block.
- A new fixable HIGH in a base image fails the next build. That is the intended
  pressure to rebuild.

## What I would do in production

Track unfixed findings with an expiry (VEX statements), alert when a fix appears,
and rebuild nightly so base-image patches flow in without a code change.
