# Deploy to a local Kubernetes cluster (kind)

Brings up the whole platform:
- Pantrix through Helm (namespace `pantrix`);
- the Ingress and HPA;
- Prometheus and Grafana;
- Argo CD managing a second copy from Git (namespace `pantrix-gitops`).

No hosts-file changes are needed. `*.localtest.me` is public DNS that always
resolves to 127.0.0.1, and kind maps host ports 80/443 to the Ingress controller.

**Tools:** `kind`, `kubectl`, `helm`, Docker. The versions used were kind 0.33,
kubectl 1.34 and Helm 3.

**Resources:** about 4 GB of free memory for the Docker VM. Run nothing else
heavy on the same Docker daemon (see `docs/engineering/known-limitations.md`).

## 1. Cluster and add-ons

```bash
kind create cluster --name pantrix --config k8s/kind-config.yaml
# Optional but recommended: a private kubeconfig so other tools cannot switch your context.
kind get kubeconfig --name pantrix > ~/.kube/pantrix.kubeconfig
export KUBECONFIG=~/.kube/pantrix.kubeconfig

bash scripts/k8s/install-addons.sh      # ingress-nginx controller-v1.15.1 + metrics-server v0.9.0
```

## 2. Pantrix through Helm

```bash
bash scripts/k8s/deploy-local.sh
```

The script:
1. Refuses to run if `backend/`, `frontend/` or `helm/` have uncommitted changes.
2. Builds `ghcr.io/spiritsfuse/pantrix-{backend,frontend}:<HEAD sha>`.
3. Runs `kind load` for both images.
4. Applies `k8s/namespace.yaml` (restricted Pod Security).
5. Runs `helm upgrade --install … --wait`.

Verify:

```bash
kubectl get pods,svc,ingress,hpa -n pantrix
helm list -n pantrix
helm test pantrix -n pantrix --logs
bash scripts/k8s/smoke-test.sh http://pantrix.localtest.me
```

Open http://pantrix.localtest.me. The API is at http://pantrix.localtest.me/api/items.

## 3. Monitoring

```bash
bash scripts/monitoring/install-monitoring.sh          # kube-prometheus-stack 92.3.0 + dashboard + alert rules
helm upgrade pantrix helm/pantrix -n pantrix -f helm/pantrix/values-dev.yaml --reuse-values   # serviceMonitor.enabled=true in values-dev
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d; echo
bash scripts/monitoring/generate-traffic.sh http://pantrix.localtest.me 300   # populate the panels
```

- Grafana: http://grafana.localtest.me (user `admin`). Open the dashboard
  **Pantrix · API overview**.
- Prometheus: http://prometheus.localtest.me/targets?search=pantrix-backend.

## 4. Argo CD + GitOps

```bash
bash scripts/gitops/bootstrap-gitops.sh
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
kubectl get applications.argoproj.io -n argocd
```

Argo CD: http://argocd.localtest.me (user `admin`). The application `pantrix-dev`
should reach **Synced / Healthy**, and the copy is served at
http://pantrix-gitops.localtest.me.

## Watch the HPA scale

```bash
for i in $(seq 1 12); do bash scripts/monitoring/generate-traffic.sh http://pantrix.localtest.me 150 >/dev/null & done
watch -n 10 kubectl get hpa -n pantrix
```

In the recorded run (`docs/evidence/hpa-scaling.png`), backend CPU reached 397%
of target and the HPA scaled from 2 to 6 replicas.
