# GitOps with Argo CD

## Idea

Build and deploy are separate:

| Concern | Tool | Output |
|---------|------|--------|
| Build, test, scan, publish | GitHub Actions (`ci-cd.yml`) | Immutable images `ghcr.io/<owner>/pantrix-*:<commit sha>` |
| Decide what runs | A Git commit to `gitops/environments/dev/values.yaml` (`promote.yml` or a person) | Desired state in Git |
| Make the cluster match | Argo CD (`gitops/application.yaml`) | Synced / Healthy, or a visible diff |

CI never needs credentials for the GitOps cluster. To roll back, revert the
promotion commit.

## Files

| Path | Role |
|------|------|
| `gitops/argocd/values.yaml` | Argo CD install (chart 10.10.3) |
| `gitops/application.yaml` | Application `pantrix-dev`: chart `helm/pantrix` + `values-dev.yaml` + `gitops/environments/dev/values.yaml` → namespace `pantrix-gitops`; automated prune + self-heal |
| `gitops/environments/dev/values.yaml` | **Desired state**: image registry, `image.tag` (full SHA), `existingSecret`, host, replica limits |
| `gitops/namespace.yaml` | Target namespace (restricted PSS) |
| `gitops/local-git-server.yaml`, `gitops/git-server/` | Rehearsal Git daemon used before GitHub exists |
| `scripts/gitops/bootstrap-gitops.sh` | Installs Argo CD, creates the DB Secret, starts the Git daemon, pushes `main`, applies the Application |
| `scripts/gitops/push-to-local-git.sh` | Publishes `main` to the Git daemon (bundle, no remote) |
| `scripts/gitops/promote.sh` | Local equivalent of `promote.yml` |

## Verified locally

- Bootstrap → `pantrix-dev` **Synced / Healthy**.
- Promotion `60c78d7` deployed images `cdb406e…`. Promotion `ef04dee` deployed
  `1bfb95a…`. Each one was observed as `Synced Healthy <promotion commit>` with
  the Deployments on the new image
  (`docs/evidence/argocd-application.png`, `argocd-gitops-cli.png`).

## Switching Argo CD to the GitHub repository

1. The repository is on GitHub. CI publishes images, and `promote.yml`
   commits the SHA to `gitops/environments/dev/values.yaml` (see commit `d311f11`).
2. If the repository is private, register it with Argo CD:
   `argocd repo add https://github.com/<owner>/<repo>.git --username <user> --password <fine-grained read-only token>`.
   A public repository needs nothing.
3. Edit `gitops/application.yaml`:
   ```yaml
   source:
     repoURL: https://github.com/<owner>/<repo>.git
     targetRevision: main
   ```
4. Commit, push and `kubectl apply -f gitops/application.yaml`.
5. The GHCR packages are public. If they are made private, create a pull secret in `pantrix-gitops` and add `imagePullSecrets` to
   `gitops/environments/dev/values.yaml`:
   ```bash
   kubectl -n pantrix-gitops create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<user> --docker-password=<read:packages token>
   ```
6. Delete the rehearsal server: `kubectl delete -f gitops/local-git-server.yaml`.
   Optionally remove `gitops/local-git-server.yaml`, `gitops/git-server/` and
   `scripts/gitops/push-to-local-git.sh` from the repository.
7. Check `kubectl get applications.argoproj.io -n argocd` →
   `Synced Healthy <latest promotion commit>`.

A kind cluster on a laptop cannot be reached by GitHub. That is fine: Argo CD
pulls from GitHub, so nothing needs to push into the cluster.
