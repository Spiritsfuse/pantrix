# Runbooks

Step-by-step procedures. Commands are written for Bash (Linux, macOS, or Git Bash
on Windows) and run from the repository root unless a step says otherwise.

| Runbook | Use it when |
|---------|-------------|
| [local-setup.md](local-setup.md) | Running Pantrix on a laptop with Docker Compose or directly |
| [deploy-local-kubernetes.md](deploy-local-kubernetes.md) | Building the kind cluster with Ingress, HPA, monitoring and Argo CD |
| [gitops-promotion.md](gitops-promotion.md) | Moving the dev environment to a new image SHA |
| [release-rollback.md](release-rollback.md) | A Helm release went bad and must be undone |
| [backend-down.md](backend-down.md) | The `PantrixBackendDown` alert fired, or `/api` returns 5xx |
| [aws-provision-and-teardown.md](aws-provision-and-teardown.md) | Creating and destroying the real VPC + EKS stack |
| [cleanup.md](cleanup.md) | Removing everything from a laptop |

Failure drills with real transcripts are in [`troubleshooting/`](../../troubleshooting/README.md).
