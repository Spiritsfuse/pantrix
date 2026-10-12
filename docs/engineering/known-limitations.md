# Known limitations

Stated plainly so nobody has to guess what was and was not done.

## External systems

| Item | State |
|------|-------|
| Real AWS VPC + EKS | **Verified, then destroyed.** A real plan, apply, Console proof and destroy ran in ap-south-1. The stack is not left running (cost). Free-plan accounts need a free-tier-eligible node type. |
| Application on EKS | Not deployed. The chart runs on a local kind cluster; EKS was provisioned for infrastructure evidence only. |
| Argo CD pointing at GitHub | Rehearsed against an in-cluster `git daemon`. The GitHub repository is public and `promote.yml` writes to it. Switch `repoURL` ([gitops.md](gitops.md)) when a cluster should track GitHub. |

## Simplifications in the demo platform

- **The ingress-nginx project is retired.** The `kubernetes/ingress-nginx`
  repository was archived in March 2026; v1.15.1 is the last release. It is used
  only for the local kind demo. Use the AWS Load Balancer Controller or a
  Gateway API implementation on EKS.
- **Single-node kind cluster.** There is no multi-node scheduling, zone spread
  or node-failure testing. HPA scaling and PDBs work, but all pods share one
  node.
- **In-cluster PostgreSQL** is a single StatefulSet pod with a local-path PVC:
  - no backups, replication or point-in-time recovery;
  - when the pod restarts, the API returns 503 until it is ready.
  Production should use RDS or CloudNativePG (ADR 0008).
- **NetworkPolicy enforcement** depends on the CNI. kind's default CNI
  (kindnet) does not enforce NetworkPolicies, so the policy is declared but was
  not proven to block traffic locally. EKS needs VPC CNI network policy support
  enabled, or Calico or Cilium.
- **No log aggregation.** JSON logs go to stdout only; Loki/Alloy is not
  deployed.
- **Alertmanager is disabled** in the demo. Alert rules evaluate but are not
  routed.
- **The GitOps copy (`pantrix-gitops`) runs one replica per tier**, so it fits
  next to the Helm release on one laptop. The Helm release keeps the required 2+2.
- **GHCR packages are private by default.** A real cluster needs them public or
  an `imagePullSecret`.
- **No authentication** on the Pantrix UI/API. The demo data is fictional and
  carries no personal data.
- **HTTPS** is not configured locally. `values-prod.yaml` shows TLS with
  cert-manager.

## Environment issues met during the build

- **Port-forward git push.** A `git push` through `kubectl port-forward` hung on
  Windows, and raw binary over `kubectl exec` stdin was once truncated. The
  rehearsal Git server is therefore fed a checksummed base64 git bundle
  (`scripts/gitops/push-to-local-git.sh`).
- **Shared Docker host.** A second, unrelated kind cluster on the same Docker VM
  exhausted memory (load average above 100, swap full). Pods restarted, and one
  Helm upgrade failed on the ingress admission webhook. Run the demo on an
  otherwise idle Docker host.
- **Grafana indexer.** Grafana's search indexer spun on the ~25 bundled
  dashboards. They are disabled, and Grafana is capped at 1 CPU (ADR 0012).
- **Terraform emulator limits.** Moto lacks EKS add-on and access-entry APIs,
  so the emulator apply stops at 54/62 resources by design. It is not a
  substitute for a real AWS run.
- **Backend image CVEs.** The backend image still lists unfixed Debian
  base-image CVEs (HIGH 44 without a fix at the time of scanning). The Trivy gate
  only fails on fixable ones (ADR 0007).
