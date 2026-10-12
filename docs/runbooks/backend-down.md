# Backend down / API returning 5xx

Linked from the `PantrixBackendDown` alert (`monitoring/pantrix-alerts.yaml`).
That alert fires when no `job="pantrix-backend"` target has been up for 2
minutes.

## 1. What does the user see?

```bash
curl -s -o /dev/null -w 'UI  %{http_code}\n' http://pantrix.localtest.me/
curl -s -w '  API %{http_code}\n' http://pantrix.localtest.me/api/items/stats
```

| Result | Meaning |
|--------|---------|
| UI 200 + API 502 | Nginx is fine, but the backend is unreachable. Since ADR 0004 the UI stays up in this case. |
| API 503 `Database unavailable` | The API is up but cannot reach PostgreSQL. |

## 2. Pods and readiness

```bash
kubectl get pods -n pantrix -l app.kubernetes.io/component=backend
kubectl get endpointslices -n pantrix -l kubernetes.io/service-name=pantrix-backend
kubectl describe pod -n pantrix -l app.kubernetes.io/component=backend | sed -n '/^Events:/,$p'
```

| State | Likely cause | Drill |
|-------|--------------|-------|
| `ErrImagePull` / `ImagePullBackOff` | wrong tag, or a private GHCR package without a pull secret | 1 |
| `Init:Error` / `Init:CrashLoopBackOff` | the migration init container failed | 4 |
| Running but `0/1` READY | `/ready` returns 503: database credentials, host or NetworkPolicy | 3 |
| No endpoints although pods are Ready | the Service selector does not match the pod labels | 2 |
| `CrashLoopBackOff` | read the logs | — |

## 3. Logs (JSON, one object per line)

```bash
kubectl logs -n pantrix deploy/pantrix-backend --tail=50
kubectl logs -n pantrix deploy/pantrix-backend -c migrate --tail=50
kubectl logs -n pantrix pantrix-postgres-0 --tail=50
```

## 4. Database

```bash
kubectl get pods,pvc -n pantrix -l app.kubernetes.io/component=postgres
kubectl exec -n pantrix pantrix-postgres-0 -- pg_isready -U pantrix
kubectl get networkpolicy pantrix-postgres -n pantrix -o yaml   # only backend pods may connect
```

## 5. Recover

- **A release caused it:** follow [release-rollback.md](release-rollback.md).
- **Bad config or Secret:** fix the value, then
  `kubectl rollout restart deploy/pantrix-backend -n pantrix`.
- **The database is down:** check the PVC and node disk. In-cluster PostgreSQL
  has no automatic failover (see `docs/engineering/known-limitations.md`).

## 6. Confirm

Run `bash scripts/k8s/smoke-test.sh http://pantrix.localtest.me`. Then check that
Prometheus Targets shows the backend pods UP and the alert has cleared.
