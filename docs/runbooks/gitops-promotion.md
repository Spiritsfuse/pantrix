# GitOps promotion

The dev environment runs whatever image SHA is written in
`gitops/environments/dev/values.yaml` (`image.tag`). Argo CD watches that file.
Promoting means changing that line in Git, and nothing else.

## On GitHub (after the repository exists)

There are two ways to promote:
- **Automatic.** `.github/workflows/promote.yml` runs after every successful
  `ci-cd` push run on `main`. It confirms both
  `ghcr.io/<owner>/pantrix-{backend,frontend}:<sha>` exist, commits the new tag
  and pushes. `ci-cd` ignores `gitops/environments/**`, and pushes made with
  `GITHUB_TOKEN` do not start new runs, so there is no loop.
- **Manual.** Actions → *promote* → *Run workflow* → paste a full 40-character
  SHA that CI has already built.

Watch the result in Argo CD (`pantrix-dev` → Synced at the new revision), or:

```bash
kubectl get applications.argoproj.io pantrix-dev -n argocd \
  -o jsonpath='{.status.sync.status} {.status.health.status} {.status.sync.revision}{"\n"}'
kubectl get deploy -n pantrix-gitops -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
```

## Locally (rehearsal Git server)

```bash
bash scripts/k8s/deploy-local.sh        # builds + loads images for HEAD (if not already)
bash scripts/gitops/promote.sh          # or: promote.sh <40-char sha>
```

`promote.sh` performs these steps:
1. Edits the tag and commits "Promote <sha7> to the dev environment through
   GitOps".
2. Publishes `main` to the in-cluster Git daemon with a git bundle.
3. Asks Argo CD to refresh.
4. Waits for `Synced Healthy <commit>`.

Real runs:
- `60c78d7` promoted `cdb406e`;
- `ef04dee` promoted `1bfb95a`.

## Rules

- Only promote SHAs whose images exist. CI pushed them, or `deploy-local.sh`
  loaded them into kind.
- Never use `latest` or a short SHA.
- To undo a promotion, `git revert` the promotion commit and let Argo CD sync
  again. Do not edit the cluster by hand: self-heal reverts manual changes.
