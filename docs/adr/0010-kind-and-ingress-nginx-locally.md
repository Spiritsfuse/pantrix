# 0010 — kind + ingress-nginx for the local cluster

**Status:** Accepted

## Context

The live demo needs a Kubernetes cluster with an Ingress controller and
metrics-server (for the HPA). Real AWS could not be used from this computer: the
credentials present were invalid. The demo has to be reproducible on one laptop
with Docker Desktop (8 GB for the Docker VM).

## Options considered

1. **kind.** Kubernetes in a Docker container, fast to create and destroy, and
   the same tool CI uses (`helm/kind-action`).
2. **minikube.** Also installed, but a second VM layer on Windows.
3. **Docker Desktop Kubernetes.** Shared with other projects on this machine.

For the Ingress controller:
- **ingress-nginx.** Matches the instructor's `ingressClassName: nginx`.
- **Traefik.**
- **Gateway API implementation.**

## Decision

- **Cluster.** A single-node kind cluster from `k8s/kind-config.yaml`. Host ports
  80 and 443 map to the node, and the node is labelled `ingress-ready=true`.
- **Add-ons.** `scripts/k8s/install-addons.sh` installs ingress-nginx
  `controller-v1.15.1` (kind provider manifest) and metrics-server `v0.9.0`, the
  latter with `--kubelet-insecure-tls`, which kind needs. The script then waits
  for the admission webhook to have endpoints.
- **Hostnames.** Hosts use `*.localtest.me`, a public DNS name that always
  resolves to 127.0.0.1, so no hosts-file edits are needed:
  - `pantrix.localtest.me`
  - `pantrix-gitops.localtest.me`
  - `grafana.localtest.me`
  - `prometheus.localtest.me`
  - `argocd.localtest.me`

**Important caveat:** the `kubernetes/ingress-nginx` repository is archived. The
project was retired in March 2026 and v1.15.1 is the last controller release.
It is fine for a local demo but should not be adopted for new production work.

## Consequences

- One `kind create cluster` brings the whole platform up on a laptop. The
  Ingress, HPA, ServiceMonitor and Argo CD are all demonstrated on it.
- Single node: no real scheduling, zone spread or node-failure behaviour.
- During this project the Docker VM ran out of memory while another unrelated
  kind cluster ran on the same machine; pods restarted until it was stopped. Keep
  the machine dedicated during the demo.

## What I would do in production

On EKS: the AWS Load Balancer Controller for Ingress/ALB, or a Gateway API
implementation (Envoy Gateway, Cilium, or the AWS Gateway API controller).
metrics-server is installed as an EKS add-on by `terraform/main.tf`.
