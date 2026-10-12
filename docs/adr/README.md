# Architecture decision records

Each record states the problem, the options I weighed, what I chose and what it costs.
Status values: **Accepted** (in use), **Superseded** (replaced by a later record).

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-fastapi-sqlalchemy-alembic.md) | FastAPI + SQLAlchemy 2 + Alembic for the API | Accepted |
| [0002](0002-sqlite-migrated-test-database.md) | Tests run against a throw-away SQLite DB built by the real migrations | Accepted |
| [0003](0003-react-vite-relative-api-paths.md) | React + Vite frontend that only calls relative `/api` paths | Accepted |
| [0004](0004-unprivileged-nginx-runtime-resolver.md) | Unprivileged Nginx that resolves the API upstream at request time | Accepted |
| [0005](0005-non-root-images-no-pip.md) | Non-root images, and no pip in the backend runtime image | Accepted |
| [0006](0006-commit-sha-tags-ghcr-provenance.md) | Images tagged with the Git commit SHA, pushed to GHCR with provenance | Accepted |
| [0007](0007-trivy-gate-policy.md) | Trivy gate: fail on fixable HIGH/CRITICAL, never ignore image CVEs | Accepted |
| [0008](0008-helm-chart-in-cluster-postgres.md) | One Helm chart, in-cluster PostgreSQL for the demo, RDS for production | Accepted |
| [0009](0009-migrations-init-container-advisory-lock.md) | Migrations in an init container, serialised by a Postgres advisory lock | Accepted |
| [0010](0010-kind-and-ingress-nginx-locally.md) | kind + ingress-nginx for the local cluster | Accepted |
| [0011](0011-argocd-gitops-with-local-git-rehearsal.md) | Argo CD GitOps, rehearsed against an in-cluster Git daemon | Accepted |
| [0012](0012-trimmed-kube-prometheus-stack.md) | Trimmed kube-prometheus-stack with a Pantrix dashboard | Accepted |
| [0013](0013-terraform-vpc-eks-modules.md) | Terraform community VPC/EKS modules, private API endpoint, single NAT | Accepted |
| [0014](0014-moto-emulator-for-terraform-without-credentials.md) | Exercise Terraform against the Moto emulator when no AWS account is available | Accepted |
