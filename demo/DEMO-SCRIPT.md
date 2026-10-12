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
- Slide 11: "This Terraform has not been applied to a real AWS account. I had no credentials, so I exercised it against the Moto emulator, and I say so on the slide."
- Slide 16: "Two things are pending external access: the first GitHub Actions run, and a real AWS apply."

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

## 5. CI/CD and GHCR (about 1:30) - recorded on the second computer

On screen (second computer only, once the repository is on GitHub):

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

On the first computer this segment is replaced by `docs/presentation/cicd-flow.png`
and `actionlint .github/workflows/*.yml` (no problems).

## 6. Terraform and AWS (about 1:30)

On screen: terminal and `terraform/main.tf`.

```bash
cd terraform && terraform fmt -check && terraform validate && cd ..
terraform -chdir=terraform plan          # real AWS: stops at InvalidClientTokenId
```

Then show the emulator evidence: `docs/evidence/terraform-plan-emulator.png`
(Plan: 62 to add) and `docs/evidence/terraform-emulator-apply-destroy.png`
(54 created, 54 destroyed).

Narration: "The VPC has two public and two private subnets in ap-south-1 with one NAT
gateway; EKS 1.35 runs one managed node group in the private subnets. I did not have
AWS credentials, so this was never applied to a real account and I have no AWS Console
screenshots. I proved the plan and the dependency order against the Moto emulator
instead. A real apply, Console proof and destroy are pending."

If real AWS access and cost approval become available, record instead: `terraform
apply`, AWS Console VPC, subnets, EKS cluster and node group pages in ap-south-1,
`kubectl get nodes`, then `terraform destroy` to completion.

## 7. Kubernetes, Helm, Ingress and Argo CD (about 2:00)

On screen: terminal, then browser.

```bash
kubectl get nodes
kubectl get pods,svc,ingress,hpa -n pantrix
helm list -n pantrix
helm test pantrix -n pantrix
curl -s http://pantrix.localtest.me/api/items/stats
```

Browser: `http://pantrix.localtest.me` (the app through the Ingress).

Argo CD: `http://argocd.localtest.me`, application **pantrix-dev**: Synced and Healthy,
tree view, then **History and rollback**. Show the GitOps flow live:

```bash
bash scripts/gitops/promote.sh   # commits the image SHA the Helm release runs to gitops/environments/dev/values.yaml, publishes it, waits for Argo CD
```

Narration: "Helm installs two replicas of each tier, the Ingress routes slash to the UI
and slash api to FastAPI, and the HPA scales the backend from two to six pods under
load. Argo CD reconciles the cluster to what Git says."

## 8. Prometheus and Grafana (about 1:00)

On screen: browser.

- `http://prometheus.localtest.me/targets?search=pantrix-backend`: every backend pod **UP**.
- `curl -s http://localhost:8000/metrics | head` in the terminal.
- `http://grafana.localtest.me`, dashboard **Pantrix · API overview**, last 30 minutes,
  with the traffic generator running: request rate, 5xx ratio, p95 latency, stock events.

## 9. Troubleshooting and conclusion (about 1:30)

On screen: terminal.

```bash
bash scripts/troubleshooting/run-drill.sh 2   # broken Service selector: no endpoints, then fixed
bash scripts/troubleshooting/run-drill.sh 5   # bad release, still serving, helm rollback
bash scripts/troubleshooting/run-drill.sh cleanup
```

Close on slide 16. Narration: "Every claim in this video has real output in
docs/evidence. Thank you."

---

## GitHub capture checklist (second computer)

Record or screenshot each item from the real repository after the push. Save
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
