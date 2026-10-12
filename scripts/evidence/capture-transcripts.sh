#!/usr/bin/env bash
# Re-run the commands behind each piece of terminal evidence and save their real
# output to docs/evidence/transcripts/<name>.txt (ANSI colours kept).
# render-terminal.mjs then turns those transcripts into PNGs.
#   scripts/evidence/capture-transcripts.sh [section ...]   # default: all
# Sections: tests quality frontend compose api database nonroot persistence git
#           security terraform k8s hpa monitoring gitops ci
set -uo pipefail
cd "$(dirname "$0")/../.."
REPO_ROOT="$(pwd)"
export REPO_ROOT
source scripts/lib/term.sh

OUT=docs/evidence/transcripts
mkdir -p "$OUT"
API=http://localhost:8000
INGRESS=http://pantrix.localtest.me

capture() { # capture <name> <function>
  echo ">> $1"
  # tr: Git Bash's /dev/stderr tee occasionally injects NUL bytes on Windows.
  "$2" 2>&1 | tr -d '\000' > "$OUT/$1.txt"
}

# ---------------------------------------------------------------- application
t_pytest() {
  cd backend
  run source .venv/Scripts/activate 2>/dev/null || run source .venv/bin/activate
  run pytest -v
  run pytest -q --cov=app --cov-report=term
  cd ..
}

t_quality() {
  cd backend
  run source .venv/Scripts/activate 2>/dev/null || run source .venv/bin/activate
  run ruff check .
  run ruff format --check .
  run bandit -q -r app -ll
  run 'echo "bandit exit code: $?"'
  run pip-audit -r requirements.txt
  cd ..
}

t_frontend() {
  cd frontend
  run npm run lint
  run npm run format:check
  run npm test
  run npm audit --omit=dev --audit-level=high
  run npm run build
  cd ..
}

t_compose_up() {
  run docker compose down -v
  run docker compose up --build --wait
  run docker compose ps
  run "docker compose logs backend | head -12"
}

t_api() {
  run curl -s "$API/health"
  run curl -s "$API/ready"
  run "curl -s $API/api/items | head -c 420; echo"
  run "curl -s -X POST $API/api/items -H 'Content-Type: application/json' -d '{\"name\":\"Rajma (kidney beans)\",\"category\":\"grains\",\"quantity\":25,\"unit\":\"kg\",\"expiry_date\":\"2027-03-01\",\"location\":\"A2-04\"}'; echo"
  local id
  id=$(curl -s "$API/api/items?q=Rajma" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  run "curl -s $API/api/items/$id; echo"
  run "curl -s -X PUT $API/api/items/$id -H 'Content-Type: application/json' -d '{\"quantity\":18,\"location\":\"A2-05\"}'; echo"
  run "curl -s -X POST $API/api/distributions -H 'Content-Type: application/json' -d '{\"item_id\":$id,\"quantity\":5,\"recipient\":\"Evening Meal Program\"}'; echo"
  run "curl -s -o /dev/null -w 'DELETE -> HTTP %{http_code}\n' -X DELETE $API/api/items/$id"
  run "curl -s -w '  HTTP %{http_code}\n' $API/api/items/$id"
  run "curl -s -w '  HTTP %{http_code}\n' -X POST $API/api/items -H 'Content-Type: application/json' -d '{\"name\":\"x\",\"category\":\"tools\",\"quantity\":-1}' | cut -c1-260"
  run "curl -s $API/api/items/stats; echo"
}

t_database() {
  run docker compose exec backend alembic current
  run docker compose exec backend alembic history --verbose
  run "docker compose exec postgres psql -U pantrix -d pantrix -c '\\dt'"
  run "docker compose exec postgres psql -U pantrix -d pantrix -c 'SELECT id, name, category, quantity, unit, expiry_date, location FROM stock_items ORDER BY expiry_date NULLS LAST LIMIT 10;'"
}

t_nonroot() {
  run "docker image inspect --format '{{.RepoTags}} User={{.Config.User}}' pantrix-backend:local pantrix-frontend:local"
  run docker compose exec backend id
  run docker compose exec frontend id
  run "docker compose exec backend sh -c 'grep -E \"^(Name|Uid|Gid):\" /proc/1/status'"
  run "docker compose exec frontend sh -c 'grep -E \"^(Name|Uid|Gid):\" /proc/1/status'"
  run "docker image ls --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}' | grep -E 'REPOSITORY|pantrix-(backend|frontend):local'"
}

t_persistence() {
  run "curl -s -X POST $API/api/donors -H 'Content-Type: application/json' -d '{\"name\":\"Persistence Check Dairy\",\"donor_type\":\"business\",\"city\":\"Pilani\"}'; echo"
  run docker compose down
  run docker volume ls --filter name=pantrix
  run docker compose up --wait
  run "curl -s $API/api/donors | grep -o '\"name\":\"Persistence Check Dairy\"[^}]*'"
}

# ------------------------------------------------------------------------ git
t_git() {
  run git log --oneline
  run "git rev-list --count HEAD"
  run git branch --show-current
  run "git remote -v; echo \"(remotes configured: \$(git remote | wc -l))\""
  run git status --short --branch
  run "git check-ignore -v .env NEXT_MACHINE_AGENT_PROMPT.md backend/.venv frontend/node_modules terraform/.terraform terraform/terraform.tfstate"
}

# ------------------------------------------------------------------- security
t_security() {
  local sha
  sha=$(git rev-parse HEAD)
  run trivy --version
  for c in backend frontend; do
    run "docker build -q -t ghcr.io/spiritsfuse/pantrix-$c:$sha $c"
    run trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "ghcr.io/spiritsfuse/pantrix-$c:$sha"
    run 'echo "exit code: $?"'
  done
}

t_trivy_backend() {
  local sha
  sha=$(git rev-parse HEAD)
  run "docker build -q -t ghcr.io/spiritsfuse/pantrix-backend:$sha backend"
  run trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "ghcr.io/spiritsfuse/pantrix-backend:$sha"
  run 'echo "gate exit code: $?"'
  run "trivy image --quiet --format json ghcr.io/spiritsfuse/pantrix-backend:$sha | python -c \"import json,sys,collections; d=json.load(sys.stdin); c=collections.Counter(v['Severity'] for r in d['Results'] for v in (r.get('Vulnerabilities') or [])); f=collections.Counter(v['Severity'] for r in d['Results'] for v in (r.get('Vulnerabilities') or []) if v.get('FixedVersion')); print('all severities:', dict(c)); print('with a fix available:', dict(f))\""
}

t_trivy_frontend() {
  local sha
  sha=$(git rev-parse HEAD)
  run "docker build -q -t ghcr.io/spiritsfuse/pantrix-frontend:$sha frontend"
  run trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "ghcr.io/spiritsfuse/pantrix-frontend:$sha"
  run 'echo "gate exit code: $?"'
  run "trivy image --quiet --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL ghcr.io/spiritsfuse/pantrix-frontend:$sha | grep -E 'Total|Legend' | head -4"
}

t_trivy_config() {
  run trivy config --quiet --severity HIGH,CRITICAL --skip-dirs terraform/.terraform --skip-dirs troubleshooting --exit-code 1 .
  run 'echo "exit code: $?"'
  run "grep -v '^#' .trivyignore | grep ."
}

t_gitleaks() {
  run gitleaks version
  run gitleaks git --redact --verbose .
  run 'echo "exit code: $?"'
}

t_sbom() {
  mkdir -p security/sbom
  local sha
  sha=$(git rev-parse HEAD)
  run "trivy image --quiet --format cyclonedx --output security/sbom/pantrix-backend.cdx.json ghcr.io/spiritsfuse/pantrix-backend:$sha"
  run "trivy image --quiet --format cyclonedx --output security/sbom/pantrix-frontend.cdx.json ghcr.io/spiritsfuse/pantrix-frontend:$sha"
  run "python -c \"import json; [print(f, len(json.load(open(f))['components']), 'components') for f in ('security/sbom/pantrix-backend.cdx.json','security/sbom/pantrix-frontend.cdx.json')]\""
}

# ------------------------------------------------------------------ terraform
t_terraform() {
  cd terraform
  run terraform version
  run terraform fmt -check -recursive
  run 'echo "fmt exit code: $?"'
  run terraform init -input=false
  run terraform validate
  cd ..
}

t_terraform_plan() {
  cd terraform
  run aws sts get-caller-identity
  run terraform plan -input=false
  cd ..
}

# ----------------------------------------------------------------- kubernetes
t_k8s() {
  run kubectl config current-context
  run kubectl get nodes -o wide
  run kubectl apply -f k8s/namespace.yaml
  run helm list -n pantrix
  run kubectl get pods -n pantrix -o wide
  run kubectl get svc -n pantrix
  run kubectl get ingress -n pantrix
  run kubectl get hpa -n pantrix
  run kubectl get deploy,statefulset,pvc,networkpolicy,pdb -n pantrix
}

t_helm() {
  run helm lint helm/pantrix -f helm/pantrix/values-dev.yaml --strict
  run "helm template pantrix helm/pantrix -f helm/pantrix/values-dev.yaml -n pantrix | grep -E '^kind:' | sort | uniq -c"
  run helm list -n pantrix
  run helm history pantrix -n pantrix --max 6
  run helm test pantrix -n pantrix --logs
}

t_ingress() {
  run kubectl describe ingress pantrix -n pantrix
  run "curl -s -o /dev/null -w 'GET  $INGRESS/            -> %{http_code} (frontend)\n' $INGRESS/"
  run "curl -s -w '  <- GET $INGRESS/api/items/stats (backend)\n' $INGRESS/api/items/stats"
  run bash scripts/k8s/smoke-test.sh "$INGRESS"
}

t_hpa() {
  run kubectl get hpa -n pantrix
  note "Generate load: 12 parallel traffic generators for 150 s"
  for _ in $(seq 1 12); do bash scripts/monitoring/generate-traffic.sh "$INGRESS" 150 >/dev/null 2>&1 & done
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 18
    run kubectl get hpa pantrix-backend -n pantrix --no-headers
  done
  wait
  run "kubectl describe hpa pantrix-backend -n pantrix | sed -n '/^Events:/,\$p'"
  run kubectl get pods -n pantrix -l app.kubernetes.io/component=backend
}

# ----------------------------------------------------------------- monitoring
t_metrics() {
  run "for i in 1 2 3; do curl -s -o /dev/null $API/api/items; curl -s -o /dev/null $API/api/items/stats; done; curl -s -o /dev/null $API/api/items/999"
  run "curl -s $API/metrics | grep -E '^# (HELP|TYPE) http_requests_total|^http_requests_total' | head -10"
  run "curl -s $API/metrics | grep -E '^http_request_duration_seconds_(bucket\{handler=\"/api/items\".*le=\"0\.(05|1|5)\"|count|sum)' | head -6"
  run "curl -s $API/metrics | grep -E '^pantrix_[a-z_]+(total|\{)' | head -6"
}

t_monitoring() {
  run kubectl get pods -n monitoring
  run kubectl get servicemonitor -n pantrix
  run kubectl get prometheusrule -n pantrix
  run "curl -s 'http://prometheus.localtest.me/api/v1/query?query=up%7Bjob%3D%22pantrix-backend%22%7D' | python -m json.tool | head -40"
  run "curl -s 'http://prometheus.localtest.me/api/v1/query?query=sum%20by%20(status)%20(rate(http_requests_total%7Bjob%3D%22pantrix-backend%22%7D%5B5m%5D))' | python -m json.tool | grep -E '\"status\"|\"value\"' -A1 | head -30"
}

# --------------------------------------------------------------------- gitops
t_gitops() {
  run kubectl get applications.argoproj.io -n argocd
  run "kubectl get applications.argoproj.io pantrix-dev -n argocd -o jsonpath='{\"repo: \"}{.spec.source.repoURL}{\"\\npath: \"}{.spec.source.path}{\"\\nrevision: \"}{.status.sync.revision}{\"\\nsync: \"}{.status.sync.status}{\"\\nhealth: \"}{.status.health.status}{\"\\n\"}'"
  run "git log --oneline -- gitops/environments/dev/values.yaml"
  run "grep -E 'registry|tag' gitops/environments/dev/values.yaml"
  run kubectl get pods -n pantrix-gitops
  run "kubectl get deploy -n pantrix-gitops -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image"
  run git remote -v
}

# ------------------------------------------------------------------------- ci
t_ci() {
  run actionlint -version
  run actionlint .github/workflows/ci-cd.yml .github/workflows/promote.yml
  run 'echo "actionlint exit code: $?"'
  run "grep -nE '^  [a-z-]+:$|needs:|trivy-action|exit-code|severity|ignore-unfixed|github.sha|GITHUB_SHA' .github/workflows/ci-cd.yml | head -40"
}

sections=("$@")
[ ${#sections[@]} -eq 0 ] && sections=(tests quality frontend compose api database nonroot persistence git security terraform k8s hpa monitoring gitops ci)
for s in "${sections[@]}"; do
  case "$s" in
    tests) capture pytest-results t_pytest ;;
    quality) capture backend-quality t_quality ;;
    frontend) capture frontend-checks t_frontend ;;
    compose) capture docker-compose-up t_compose_up ;;
    api) capture api-crud-curl t_api ;;
    database) capture database-migrations t_database ;;
    nonroot) capture docker-nonroot-users t_nonroot ;;
    persistence) capture docker-persistence t_persistence ;;
    git) capture git-history t_git ;;
    security) capture trivy-backend t_trivy_backend; capture trivy-frontend t_trivy_frontend
              capture trivy-config t_trivy_config; capture gitleaks t_gitleaks; capture sbom t_sbom ;;
    terraform) capture terraform-init-validate t_terraform; capture terraform-plan-attempt t_terraform_plan ;;
    k8s) capture kubernetes-resources t_k8s; capture helm-release t_helm; capture ingress-routing t_ingress ;;
    hpa) capture hpa-scaling t_hpa ;;
    monitoring) capture metrics-endpoint t_metrics; capture prometheus-scrape t_monitoring ;;
    gitops) capture argocd-gitops t_gitops ;;
    ci) capture ci-workflow-lint t_ci ;;
    *) echo "unknown section $s" >&2 ;;
  esac
done
