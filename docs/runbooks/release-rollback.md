# Release rollback

## Symptoms

- `helm upgrade` ends with `UPGRADE FAILED: … not ready … context deadline exceeded`.
- New pods are in `ErrImagePull` / `ImagePullBackOff` / `CrashLoopBackOff` / `Init:Error`.
- The Deployments use `maxUnavailable: 0`, so the old pods normally keep serving
  while this happens.

## Confirm the app is still up

```bash
kubectl get pods -n pantrix
curl -s -o /dev/null -w '%{http_code}\n' http://pantrix.localtest.me/api/items/stats
```

## Roll back (Helm-managed release, namespace `pantrix`)

```bash
helm history pantrix -n pantrix --max 5
helm rollback pantrix -n pantrix --wait --timeout 3m     # no revision = the release before the failed one
helm history pantrix -n pantrix --max 3
kubectl get pods -n pantrix
```

Do not pick "the last superseded revision" from `helm history`. After a failed
upgrade, the last good revision is still marked `deployed`. The first version of
drill 5 made exactly that mistake and rolled back too far (fixed in `82d36e6`).

Recorded run (`docs/evidence/troubleshooting-05-rollback.png`):
1. Revision 10 (`image.tag=0000000-does-not-exist`) failed.
2. Three requests during the failure all returned 200.
3. `helm rollback` created revision 11, "Rollback to 9".

That is a 3-request sample, not a load test.

## Roll back (Argo CD-managed `pantrix-dev`)

Revert the promotion commit in Git and let Argo CD sync:

```bash
git revert <promotion-commit>
bash scripts/gitops/push-to-local-git.sh     # on GitHub: git push
```

Argo CD's own *History and Rollback* button works too. Automated sync then
fights it until Git matches, so prefer the Git revert.

## Afterwards

Record which image or config change failed, and why the CI gates did not catch
it.
