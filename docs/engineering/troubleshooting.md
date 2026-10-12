# Troubleshooting

The five failure drills are in
[`troubleshooting/README.md`](../../troubleshooting/README.md), with real
transcripts and screenshots in `docs/evidence/`. Operational procedures:
- [`docs/runbooks/backend-down.md`](../runbooks/backend-down.md)
- [`docs/runbooks/release-rollback.md`](../runbooks/release-rollback.md)

Quick triage:

```bash
kubectl get pods,svc,ingress,hpa -n pantrix
kubectl get events -n pantrix --sort-by=.lastTimestamp | tail -20
kubectl describe pod <pod> -n pantrix | sed -n '/^Events:/,$p'
kubectl logs -n pantrix deploy/pantrix-backend --tail=50          # add -c migrate for the init container
kubectl get endpointslices -n pantrix -l kubernetes.io/service-name=pantrix-backend
```
