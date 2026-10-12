# 0005 — Non-root images, and no pip in the backend runtime image

**Status:** Accepted

## Context

The rubric requires both images to run as non-root. The first Trivy scan of the
backend image (`5196d75`) then failed the gate with four fixable HIGH findings
(`docs/evidence/trivy-backend-before-fix.png`):

| Package | Finding | Fixed in |
|---------|---------|----------|
| msgpack 1.1.2 | GHSA-6v7p-g79w-8964 | 1.2.1 |
| setuptools 70.3.0 | CVE-2025-47273 | 78.1.1 |
| urllib3 2.7.0 | CVE-2026-97687, CVE-2026-97689 | 2.8.0 |

None of these are application dependencies. msgpack and urllib3 were pip's
*vendored* copies inside the virtualenv. setuptools came from the interpreter's
bundled `ensurepip` wheels.

## Options considered

1. **Add the IDs to `.trivyignore`.** It turns CI green and leaves the code
   there. Rejected; see ADR 0007.
2. **Upgrade pip.** This only moves the problem to the next vendored CVE.
3. **Do not ship pip at all.** The runtime only needs the installed packages.

## Decision

- **Multi-stage backend build.** The build stage creates `/opt/venv`, installs
  `requirements.txt`, then runs `python -m pip uninstall -y pip`. The runtime
  stage removes the base image's own pip and the `ensurepip/_bundled` wheels.
- **Backend user.** The backend runs as `pantrix` (uid/gid 10001); application
  files are owned by root and are read-only to that user.
- **Frontend.** The frontend uses the unprivileged Nginx image (uid 101).
- **CI check.** CI fails if `docker image inspect` reports an empty, `root` or
  `0` user.
- **Kubernetes settings:**
  - `runAsNonRoot`
  - `readOnlyRootFilesystem`
  - `allowPrivilegeEscalation: false`
  - drop `ALL` capabilities
  - `seccompProfile: RuntimeDefault`
  - the namespace enforces the `restricted` Pod Security Standard.

## Consequences

- The gate passed after commit `964bf54` with no suppression
  (`docs/evidence/trivy-backend.png`).
- You cannot `pip install` inside a running container. That is intentional; debug
  with an ephemeral container instead.
- Verified at runtime: `/proc/1/status` shows `Uid: 10001` for uvicorn and
  `Uid: 101` for nginx (`docs/evidence/docker-nonroot-users.png`).

## What I would do in production

Move to a distroless or Chainguard Python base to drop the Debian userland, which
is where the remaining unfixed findings live.
