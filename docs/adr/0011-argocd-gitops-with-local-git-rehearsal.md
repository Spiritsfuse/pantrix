# 0011 — Argo CD GitOps, rehearsed against an in-cluster Git daemon

**Status:** Accepted (`repoURL` switches to GitHub on the second computer)

## Context

The submission video must show Argo CD and a GitOps flow. Argo CD needs a Git
URL it can reach. On this computer the repository deliberately has no GitHub
remote, and none may be added.

## Options considered

1. **Wait for GitHub.** Argo CD could not be demonstrated or debugged locally.
2. **Gitea in the cluster.** A full Git server, heavier than needed.
3. **A plain `git daemon` in the cluster.** Tiny, read/write, and Argo CD reads
   `git://` URLs.

## Decision

- **Argo CD** is installed from chart 10.10.3 (app v3.5.5) with
  `gitops/argocd/values.yaml`. Trimming:
  - Dex and notifications disabled;
  - server served plain HTTP behind the local Ingress;
  - a custom health check so an HPA that is warming up shows as Progressing.
- **`gitops/application.yaml`**, the Application `pantrix-dev`:
  - renders `helm/pantrix` with `values-dev.yaml` and
    `gitops/environments/dev/values.yaml`;
  - deploys into namespace `pantrix-gitops`;
  - automated prune and self-heal, server-side apply;
  - `ignoreDifferences` for the StatefulSet's defaulted `volumeClaimTemplates`,
    which otherwise left the app OutOfSync.
- **Desired image** is `image.tag` in `gitops/environments/dev/values.yaml`, a
  full commit SHA. Changing that line is a deployment.
- **Rehearsal Git server.** `gitops/local-git-server.yaml` runs `git daemon`
  from a 3-line image (`gitops/git-server/Dockerfile`), because `alpine/git` has
  no daemon.
- **Publishing main to it.** `scripts/gitops/push-to-local-git.sh` streams a
  checksummed `git bundle` into the pod and fetches it there. Neither alternative
  worked on Windows:
  - a `git push` through `kubectl port-forward` hung (`ls-remote` worked, `push`
    never completed);
  - raw binary over `kubectl exec` stdin was once truncated ("early EOF").
  The bundle approach leaves `git remote -v` empty.
- **Promotion locally** is `scripts/gitops/promote.sh`. On GitHub it is
  `.github/workflows/promote.yml`: after a green `ci-cd` run on main it checks
  that both images exist in GHCR and commits the new tag.

## Consequences

- Verified: promotion commits `60c78d7` (→ `cdb406e`) and `ef04dee`
  (→ `1bfb95a`) each reached **Synced / Healthy** at that revision, with the
  Deployments running the new images (`docs/evidence/argocd-application.png`).
- Build/publish (GitHub Actions) and deploy (Argo CD pulling from Git) are
  separate. CI never needs cluster credentials for this environment.
- The rehearsal server keeps repos in an emptyDir; deleting the pod loses them
  until the next push. That is acceptable because Git on the laptop is the
  source.

## What I would do in production

- Point `repoURL` at the GitHub repository with a read-only deploy key.
- Protect `main`, and require a pull request for promotions to production.
- Add a `values-prod` environment and the Argo CD Image Updater (or
  promote-by-PR) for each stage.
