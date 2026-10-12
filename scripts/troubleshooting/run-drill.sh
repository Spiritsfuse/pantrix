#!/usr/bin/env bash
# Run one troubleshooting drill end to end: break it, diagnose it, fix it, verify.
#   scripts/troubleshooting/run-drill.sh 1|2|3|4|5|all
# Drills 1-4 use the isolated namespace pantrix-lab. Drill 5 performs a bad Helm
# release on the real "pantrix" release and rolls it back (no downtime expected,
# because the Deployment strategy is maxUnavailable: 0).
set -uo pipefail
cd "$(dirname "$0")/../.."
source scripts/lib/term.sh

NS=pantrix-lab
TAG="${PANTRIX_TAG:-$(helm get values pantrix -n pantrix -a -o json | grep -o '"tag":"[0-9a-f]\{40\}"' | head -1 | cut -d'"' -f4)}"
BACKEND_IMAGE="ghcr.io/spiritsfuse/pantrix-backend:${TAG}"
FRONTEND_IMAGE="ghcr.io/spiritsfuse/pantrix-frontend:${TAG}"

# Apply a drill manifest with the backend image pinned to the deployed Git SHA.
apply_with_image() {
  sed "s#PANTRIX_BACKEND_IMAGE#${BACKEND_IMAGE}#g" "$1" | kubectl apply -f -
}

setup() {
  kubectl apply -f troubleshooting/00-lab-namespace.yaml >/dev/null
  kubectl -n "$NS" rollout status deploy/lab-postgres --timeout=120s >/dev/null
}

drill1() {
  note "Drill 1 - broken image: a Deployment references a tag that was never published"
  run kubectl apply -f troubleshooting/01-broken-image.yaml
  sleep 20
  run kubectl get pods -n "$NS" -l app=shelf-ui
  run "kubectl describe pod -n $NS -l app=shelf-ui | grep -A12 '^Events:'"
  note "Diagnosis: ErrImagePull/ImagePullBackOff - the tag v9.9.9-typo does not exist. Fix: deploy the real Git-SHA tag."
  run kubectl set image deployment/shelf-ui -n "$NS" frontend="$FRONTEND_IMAGE"
  run kubectl rollout status deployment/shelf-ui -n "$NS" --timeout=120s
  run kubectl get pods -n "$NS" -l app=shelf-ui
}

drill2() {
  note "Drill 2 - broken Service: selector matches no pods"
  kubectl -n "$NS" get deploy shelf-ui >/dev/null 2>&1 || { kubectl apply -f troubleshooting/01-broken-image.yaml >/dev/null; kubectl set image deployment/shelf-ui -n "$NS" frontend="$FRONTEND_IMAGE" >/dev/null; kubectl rollout status deployment/shelf-ui -n "$NS" --timeout=120s >/dev/null; }
  run kubectl apply -f troubleshooting/02-broken-service.yaml
  run kubectl get svc,endpoints -n "$NS" shelf-ui
  run "kubectl run probe -n $NS --rm -i --restart=Never --image=$BACKEND_IMAGE --overrides='{\"spec\":{\"securityContext\":{\"runAsNonRoot\":true,\"runAsUser\":10001,\"seccompProfile\":{\"type\":\"RuntimeDefault\"}},\"containers\":[{\"name\":\"probe\",\"image\":\"$BACKEND_IMAGE\",\"command\":[\"python\",\"-c\",\"import urllib.request as u; print(u.urlopen(\\\"http://shelf-ui/healthz\\\", timeout=3).read())\"],\"securityContext\":{\"allowPrivilegeEscalation\":false,\"capabilities\":{\"drop\":[\"ALL\"]}}}]}}' 2>&1 | tail -2"
  run kubectl get pods -n "$NS" --show-labels -l app=shelf-ui
  note "Diagnosis: no endpoints - the Service selects app=shelf-frontend but pods carry app=shelf-ui. Fix: correct the selector."
  run "kubectl patch svc shelf-ui -n $NS --type=merge -p '{\"spec\":{\"selector\":{\"app\":\"shelf-ui\"}}}'"
  run kubectl get endpoints -n "$NS" shelf-ui
}

drill3() {
  note "Drill 3 - readiness failure: the API is alive but its database credentials are wrong"
  run apply_with_image troubleshooting/03-readiness-failure.yaml
  sleep 25
  run kubectl get pods -n "$NS" -l app=lab-api
  run kubectl get endpoints -n "$NS" lab-api
  run "kubectl exec -n $NS deploy/lab-api -- python -c \"import urllib.request as u
for p in ('/health','/ready'):
    try: r=u.urlopen('http://127.0.0.1:8000'+p); print(p, r.status, r.read().decode())
    except Exception as e: print(p, e.code, e.read().decode())\""
  run "kubectl logs -n $NS deploy/lab-api --tail=40 | grep -m2 -i 'password authentication failed\\|database error' || kubectl logs -n $NS deploy/lab-api --tail=5"
  note "Diagnosis: liveness passes (process up) but readiness fails (DB auth) so the pod gets no traffic. Fix: use the correct Secret."
  run "kubectl set env deployment/lab-api -n $NS --from=secret/lab-db --keys=DATABASE_URL"
  run kubectl rollout status deployment/lab-api -n "$NS" --timeout=120s
  run kubectl get pods,endpoints -n "$NS" -l app=lab-api
}

drill4() {
  note "Drill 4 - migration failure: the Alembic init container cannot resolve the database host"
  run apply_with_image troubleshooting/04-migration-failure.yaml
  sleep 40
  run kubectl get pods -n "$NS" -l app=lab-migrate
  run "kubectl logs -n $NS deploy/lab-migrate -c migrate --tail=40 | grep -m3 -iE 'OperationalError|could not translate|failed to resolve|Name or service not known'"
  note "Diagnosis: Init:Error - the init container cannot resolve lab-postgresql; the Service is lab-postgres. Fix: correct the URL."
  run "kubectl set env deployment/lab-migrate -n $NS -c migrate --from=secret/lab-db --keys=DATABASE_URL"
  run kubectl rollout status deployment/lab-migrate -n "$NS" --timeout=180s
  run kubectl get pods -n "$NS" -l app=lab-migrate
  run "kubectl logs -n $NS deploy/lab-migrate -c migrate --tail=3"
}

drill5() {
  note "Drill 5 - bad release and rollback on the real Helm release (zero-downtime check)"
  run helm history pantrix -n pantrix --max 3
  run "helm upgrade pantrix helm/pantrix -n pantrix -f helm/pantrix/values-dev.yaml --reuse-values --set image.tag=0000000-does-not-exist --wait --timeout 60s 2>&1 | tail -3"
  run kubectl get pods -n pantrix
  run "for i in 1 2 3; do curl -s -o /dev/null -w 'GET /api/items/stats -> %{http_code}\\n' http://pantrix.localtest.me/api/items/stats; sleep 1; done"
  note "Old pods keep serving (maxUnavailable: 0), new pods are ImagePullBackOff. Roll back to the last good revision."
  local good
  good=$(helm history pantrix -n pantrix -o json | grep -o '"revision":[0-9]*,"updated":"[^"]*","status":"superseded"' | tail -1 | grep -o '"revision":[0-9]*' | cut -d: -f2)
  run helm rollback pantrix "$good" -n pantrix --wait --timeout 3m
  run helm history pantrix -n pantrix --max 4
  run kubectl get pods -n pantrix
}

cleanup() {
  note "Clean up the lab namespace"
  run kubectl delete namespace "$NS" --wait=false
}

case "${1:-all}" in
  1) setup; drill1 ;;
  2) setup; drill2 ;;
  3) setup; drill3 ;;
  4) setup; drill4 ;;
  5) drill5 ;;
  cleanup) cleanup ;;
  all) setup; drill1; drill2; drill3; drill4; drill5; cleanup ;;
  *) echo "usage: $0 1|2|3|4|5|all|cleanup"; exit 2 ;;
esac
