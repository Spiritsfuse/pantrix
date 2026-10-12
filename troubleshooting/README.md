# Troubleshooting drills

Five deliberate failures. Each one is broken, diagnosed and fixed by a script,
and the output was captured from real runs on the kind cluster.

Drills 1–4 run in an isolated namespace, `pantrix-lab`, with a throw-away
PostgreSQL (`00-lab-namespace.yaml`). They never touch the real release. Drill 5
runs against the real Helm release on purpose, to show that a bad release does
not cause an outage.

```bash
export KUBECONFIG=~/.kube/pantrix.kubeconfig      # or your kind context
bash scripts/troubleshooting/run-drill.sh 1       # 1 | 2 | 3 | 4 | 5 | all | cleanup
```

The drills use the image SHA of the currently deployed Helm release, so the
"fixed" state always runs real images.

---

## 1 — Broken image tag

Evidence: `docs/evidence/troubleshooting-01-broken-image.png`, transcript
`docs/evidence/transcripts/troubleshooting-01-broken-image.txt`.

**Manifest:** `01-broken-image.yaml`, image `pantrix-frontend:v9.9.9-typo`.

**Symptom:** pod `0/1 ImagePullBackOff`.

**Diagnose:**
```bash
kubectl get pods -n pantrix-lab -l app=shelf-ui
kubectl describe pod -n pantrix-lab -l app=shelf-ui | grep -A12 '^Events:'
```
The events show `Failed to pull image … v9.9.9-typo … 403 Forbidden` and then
`ErrImagePull`. GHCR answers 403 for references that do not exist or are not
public.

**Root cause:** the tag was never published. CI only publishes full commit-SHA
tags.

**Fix:**
```bash
kubectl set image deployment/shelf-ui -n pantrix-lab frontend=ghcr.io/spiritsfuse/pantrix-frontend:<sha>
```

**Lesson:** `describe` → Events tells you why a pod is not starting. Deploy only
tags CI produced.

## 2 — Service selector matches nothing

Evidence: `troubleshooting-02-broken-service.png`, transcript `troubleshooting-02-broken-service.txt`.

**Manifest:** `02-broken-service.yaml`. The Service selects
`app: shelf-frontend`, but the pods are labelled `app: shelf-ui`.

**Symptom:** the Service exists and the pods are Running and Ready, but
`wget http://shelf-ui/healthz` gets `Connection refused`.

**Diagnose:**
```bash
kubectl get endpointslices -n pantrix-lab -l kubernetes.io/service-name=shelf-ui   # ENDPOINTS <unset>
kubectl get pods -n pantrix-lab --show-labels -l app=shelf-ui
```

**Fix:**
```bash
kubectl patch svc shelf-ui -n pantrix-lab --type=merge -p '{"spec":{"selector":{"app":"shelf-ui"}}}'
```
The EndpointSlice then lists the pod IP, and `wget` returns `ok`.

**Lesson:** a Service only routes to pods whose labels match its selector. No
match means no endpoints, which means no traffic.

**Side finding:** this drill exposed a real bug. The frontend's Nginx crashed
with `host not found in upstream` when its API Service did not exist yet. Fixed
in commit `1bfb95a` with a runtime DNS resolver (ADR 0004).

## 3 — Readiness failure (alive but not ready)

Evidence: `troubleshooting-03-readiness.png`, transcript `troubleshooting-03-readiness.txt`.

**Manifest:** `03-readiness-failure.yaml`. The API is given a DATABASE_URL with
the wrong password.

**Symptom:** the pod is `Running` but `0/1` READY, and the Service has no ready
endpoints.

**Diagnose:** inside the pod, `/health` returns 200 and `/ready` returns 503
with `{"status":"not ready","database":"unreachable"}`.

The readiness check does not log the database error, so the log tail only shows
a normal uvicorn start-up. In the drill the cause was found by comparing the
Deployment's Secret with the working `lab-db` Secret. Logging the exception
class from `/ready` is a sensible follow-up.

**Root cause:** wrong credentials.

**Why the split between probes matters:**
- Liveness (`/health`) passes, so Kubernetes does not restart the pod pointlessly.
- Readiness (`/ready`) fails, so no user traffic reaches it.

**Fix:**
```bash
kubectl set env deployment/lab-api -n pantrix-lab --from=secret/lab-db --keys=DATABASE_URL
```
The new pod becomes `1/1` and appears in the EndpointSlice.

## 4 — Migration failure (init container)

Evidence: `troubleshooting-04-migration.png`, transcript `troubleshooting-04-migration.txt`.

**Manifest:** `04-migration-failure.yaml`. The `migrate` init container points
at host `lab-postgresql`; the Service is `lab-postgres`.

**Symptom:** pod `Init:Error` / `Init:CrashLoopBackOff`, and the API container
never starts.

**Diagnose:**
```bash
kubectl logs -n pantrix-lab deploy/lab-migrate -c migrate
```
psycopg's `OperationalError` shows that the host name cannot be resolved.

**Fix:**
```bash
kubectl set env deployment/lab-migrate -n pantrix-lab -c migrate --from=secret/lab-db --keys=DATABASE_URL
```
The logs then show `Running upgrade -> 0001_initial_schema`, and the pod becomes
Running.

**Lesson:** read the logs of the failing *init* container with `-c`, not the
main container's.

## 5 — Bad release and rollback (real release, no downtime)

Evidence: `troubleshooting-05-rollback.png`, transcript `troubleshooting-05-rollback.txt`.

**Action:**
```bash
helm upgrade pantrix … --set image.tag=0000000-does-not-exist --wait --timeout 60s
```

**Symptom:** `UPGRADE FAILED … not ready … context deadline exceeded`. The new
pods are in `Init:ErrImagePull` / `ErrImagePull`, and the old pods are still
`Running`.

**Check:** three requests to `/api/items/stats` during the failure all returned
`200`. The Deployments use `maxUnavailable: 0`, so old pods are not removed
until new ones are ready.

**Fix:**
```bash
helm rollback pantrix -n pantrix --wait --timeout 3m
```
History shows `failed` for the bad revision and `Rollback to <previous>`.

**Lesson:** a rolling update with readiness probes and `maxUnavailable: 0`
contains a bad release. `helm rollback` with no revision returns to the release
before the failed one. The drill first picked "the last superseded revision",
which was wrong (fixed in `82d36e6`).

---

Clean up with `bash scripts/troubleshooting/run-drill.sh cleanup`, which
deletes namespace `pantrix-lab`.
