# Pantrix demo video script

Presenter: Dhruv Sharma ([@Spiritsfuse](https://github.com/spiritsfuse)) · target length 13 to 15 minutes.

The order is: slides first, then the live walkthrough. Each
segment lists the target duration, what is on screen and the narration. Commands are
the real ones from this repository; run them in a terminal whose prompt shows
`dhruv-sharma@pantrix`.

Before recording:

```bash
docker compose up --build --wait                  # app on :3000, API on :8000
export KUBECONFIG=~/.kube/pantrix.kubeconfig      # kind cluster "pantrix"
kubectl get pods -A                               # everything Running
bash scripts/monitoring/generate-traffic.sh http://pantrix.localtest.me 600 &   # fills Grafana
```

Grafana password: `kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d`.
Argo CD password: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`.
Never show either password on screen.

---

## 1. PPT presentation (about 4:30)

On screen: `demo/presentation.pptx` in slideshow mode, slides 1 to 16. The speaker
notes in the deck are the narration; read them at a calm pace (about 15 to 20 seconds
per slide, longer on slides 5, 9, 10 and 11).

Key lines to land:

- Slide 1: "Pantrix tracks donated stock and its expiry so food goes out before it spoils."
- Slide 10: "Trivy failed my backend image with four fixable HIGH CVEs. I fixed the cause, removing pip from the runtime image, instead of ignoring them."
- Slide 11: "I applied this Terraform to a real AWS account, captured the Console and kubectl proof, and destroyed it again."
- Slide 16: "Everything in the middle column is verified with real output, including the GitHub Actions run and the AWS apply and destroy."

## 2. Working application and CRUD (about 1:45)

On screen: browser at `http://localhost:3000`.

1. Shelf view: point at the KPI strip and the headline ("1 item has expired ...").
2. Click **Expired** filter, then **All** again.
3. **Log donation**: "Sunflower oil 1L", Canned, Northgate Wholesale Foods, 24 litres, expiry in 5 days, shelf C1-07, **Add to shelf**. Show the toast and the new card marked "Use soon".
4. Edit it (pencil): quantity 20, **Save changes**.
5. **Hand out** 6 to "Girls' Hostel Outreach". Then try to hand out 500 and show the 409 message in the form.
6. Delete it (trash, then **Remove**).
7. Open **Donors** and **Hand-outs** tabs briefly. Resize the window narrow to show the mobile layout.
8. Open `http://localhost:8000/docs` (Swagger) and expand `GET /api/items`.

Narration: "Every button calls the FastAPI backend through Nginx and the data lives in
PostgreSQL. Business rules are enforced by the API, and the UI shows its messages."

## 3. Codebase overview (about 1:15)

On screen: the editor with the folder tree, then a few files.

- Tree: `backend/`, `frontend/`, `helm/pantrix/`, `k8s/`, `terraform/`, `gitops/`, `monitoring/`, `troubleshooting/`, `scripts/`, `.github/workflows/`, `docs/`, `demo/`.
- `backend/app/routers/distributions.py`: the row lock and the 409 rules.
- `backend/app/main.py`: `/health`, `/ready` (checks the database) and the Prometheus instrumentator.
- `backend/alembic/versions/0001_initial_schema.py`: the migration.
- `helm/pantrix/templates/backend.yaml`: init container for migrations, probes, security context.

Narration: "Design decisions: liveness never touches the database, readiness does;
migrations run in an init container with an advisory lock; every pod is non-root
with a read-only root filesystem."

## 4. Tests and Docker (about 1:30)

On screen: terminal.

```bash
cd backend && source .venv/Scripts/activate && pytest -v && cd ..
cd frontend && npm test && cd ..
docker compose ps
docker compose exec backend id
docker compose exec frontend id
docker image ls | grep -E "pantrix-(backend|frontend)"
```

Narration: "31 backend tests on a throw-away database, 10 frontend tests. The images are
multi-stage and run as uid 10001 and uid 101."

## 5. CI/CD and GHCR (about 1:30)

On screen, from the real repository:

1. Make a small, real change (for example a README wording fix outside `docs/`, or a
   code comment), commit it and `git push`.
2. GitHub **Actions** tab: the `ci-cd` run starting, then the job graph:
   backend-test, frontend-test, secret-scan, iac-scan, build-scan-push (backend,
   frontend), k8s-smoke, all green.
3. Open `build-scan-push (backend)`: expand the **Trivy image scan (gate)** step log and
   the **Push image tagged with the commit SHA** step.
4. GitHub **Packages**: `pantrix-backend` and `pantrix-frontend` with a tag equal to the
   full commit SHA of the run.
5. The `promote` workflow run that followed, and the commit it made to
   `gitops/environments/dev/values.yaml`.

Narration: "Tests run first and stop the pipeline on failure. Only then are the images
built, scanned by Trivy, and pushed to GHCR tagged with the commit SHA."

The recorded video shows the CI diagram (`docs/presentation/cicd-flow.png`), then the real run summary,
the pytest log, the Trivy and push logs, the GHCR packages and the promotion, taken from run #6.

## 6. Terraform and AWS (about 1:30)

On screen: terminal and `terraform/main.tf`.

```bash
cd terraform && terraform fmt -check && terraform validate && cd ..
terraform -chdir=terraform plan          # real AWS, ap-south-1: 62 to add
```

Then show: `docs/evidence/terraform-plan-aws.png`, the first apply that failed on the Free-plan node type
(`terraform-apply-aws-attempt1.png`), the second apply (`terraform-apply-aws.png`), the AWS Console pages
(`aws-vpc.png`, `aws-subnets.png`, `aws-eks-cluster.png`, `aws-eks-node-group.png`), `kubectl get nodes`
(`eks-nodes-aws.png`) and finally `terraform-destroy-aws.png` (62 destroyed, nothing left).

Narration: "The VPC has two public and two private subnets in ap-south-1 with one NAT gateway; EKS 1.35 runs one
managed node group in the private subnets. I planned and applied it against a real account. The first apply
stopped at the node group because the account is on the Free plan and rejects t3.medium; with an eligible type
it created two ready nodes. Then I destroyed everything and checked that nothing was left."

---

## GitHub capture checklist

Each item below was captured from the real repository. Save
screenshots under `docs/evidence/` with these names and update
`docs/evidence/EVIDENCE-MANIFEST.md`.

| # | Capture | File name |
|---|---------|-----------|
| 1 | Repository home page showing the code and README | `github-repository.png` |
| 2 | Commit history page with at least 10 commits by Dhruv Sharma | `github-commit-history.png` |
| 3 | A `git push` in the terminal, then the new `ci-cd` run appearing in Actions (video) | video segment 5 |
| 4 | The finished `ci-cd` run with every job green (job graph) | `github-actions-run.png` |
| 5 | `backend-test` log showing `pytest -v` with all tests passed | `github-actions-pytest.png` |
| 6 | `build-scan-push (backend)` and `(frontend)` Trivy gate step logs | `github-trivy-backend.png`, `github-trivy-frontend.png` |
| 7 | The push step showing `ghcr.io/<owner>/pantrix-*:<full sha>` | `github-actions-ghcr-push.png` |
| 8 | GHCR package pages for `pantrix-backend` and `pantrix-frontend` with the SHA tag | `ghcr-backend-package.png`, `ghcr-frontend-package.png` |
| 9 | `k8s-smoke` job log ending in "smoke test passed" | `github-actions-k8s-smoke.png` |
| 10 | The `promote` run and its commit to `gitops/environments/dev/values.yaml` | `github-promote-run.png` |
| 11 | Run artifacts list (test reports, Trivy reports, SBOMs) | `github-actions-artifacts.png` |

Do not stage or simulate any of these. If a job fails, fix the cause, push again, and
capture the green run.
