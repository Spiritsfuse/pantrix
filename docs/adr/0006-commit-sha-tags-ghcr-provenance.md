# 0006 — Images tagged with the Git commit SHA, pushed to GHCR with provenance

**Status:** Accepted and verified on GitHub

## Context

Images in GitHub Container Registry must be tagged with the commit
SHA, not `latest`. A tag must lead back to exactly one source commit.

## Options considered

1. **Full 40-character SHA only.** Unambiguous and immutable in practice.
2. **SHA + `latest`.** Convenient, but `latest` silently changes and hides which
   build is deployed.
3. **Semantic versions.** Needs a release process this project does not have.

## Decision

`.github/workflows/ci-cd.yml` tags `ghcr.io/<owner>/pantrix-{backend,frontend}:${{ github.sha }}`.
The owner is lower-cased, because GHCR rejects upper-case names.

**Push conditions.** It pushes only when all of these hold:
- the event is a push to `main`;
- the tests, secret scan and IaC scan have all passed;
- the image's own non-root check and Trivy gate have passed.

**After the push.** It attests build provenance with
`actions/attest-build-provenance`. The token permissions are `packages: write`,
`id-token: write` and `attestations: write`, and only on that job.

**Locally.** `scripts/k8s/deploy-local.sh` uses the same naming, refuses to build
when `backend/`, `frontend/` or `helm/` have uncommitted changes, and loads the
images into kind instead of pushing.

## Consequences

- Every Helm revision and GitOps promotion names a commit. For example, the Argo
  CD app showed images `1bfb95a…` after the promotion commit `ef04dee`.
- Old tags accumulate in GHCR and need a retention policy.
- GHCR packages are private by default. The cluster needs an `imagePullSecret`,
  or the packages need to be made public.

**Status today:** verified. Run #6 pushed both images tagged with the full commit SHA, attested
them, and the kind job pulled them back from GHCR. The packages are public.

## What I would do in production

Sign images with cosign (keyless), enforce signature and provenance verification
at admission (Kyverno or the Sigstore policy controller), and pin deployments by
digest.
