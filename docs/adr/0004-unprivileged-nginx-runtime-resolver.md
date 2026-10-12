# 0004 — Unprivileged Nginx that resolves the API upstream at request time

**Status:** Accepted (revised after troubleshooting drill 2, commit `1bfb95a`)

## Context

The frontend image serves static files and proxies `/api` to the backend. The
reference projects run the stock `nginx` image as root on port 80 with a fixed
`proxy_pass http://backend:8000`.

While running troubleshooting drill 2, the lab frontend pod went into
`Error`/restart. Reproducing it with
`docker run -e API_UPSTREAM=missing-backend:8000` printed:

```
[emerg] host not found in upstream "missing-backend" in /etc/nginx/conf.d/default.conf:23
```

Nginx resolves a literal `proxy_pass` host once, at start-up. If the backend
Service does not exist yet (ordering during a fresh install, a namespace being
rebuilt), the UI crash-loops even though it could serve the static pages.

## Options considered

1. **Keep the static upstream and order the deploy.** This hides the problem
   instead of fixing it.
2. **`resolver` + a variable in `proxy_pass`.** Nginx resolves per request
   (cached), so it starts without the backend and follows Service IP changes.
3. **An init container that waits for the backend.** Adds coupling and delays
   every frontend start.

## Decision

- Base image `nginxinc/nginx-unprivileged:1.29-alpine`, running as uid 101 on
  port 8080. The container drops all capabilities and uses a read-only root
  filesystem, with emptyDirs for `/tmp` and `/etc/nginx/conf.d`.
- `NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1` exposes the container's DNS server as
  `${NGINX_LOCAL_RESOLVERS}`. The template uses
  `resolver ${NGINX_LOCAL_RESOLVERS} valid=10s` and
  `proxy_pass http://$api_upstream`.
- Nginx's resolver ignores search domains, so Helm passes the fully qualified
  name `<release>-backend.<namespace>.svc.<clusterDomain>:8000`. Compose keeps
  `backend:8000`, which Docker's embedded DNS resolves directly.
- Security headers (CSP, nosniff, frame deny) are set at server level. Cache
  headers use `expires`, so `add_header` inheritance does not drop them.

## Consequences

- Verified: with no backend the UI returns 200 and `/api` returns 502 instead of
  the container exiting.
- One more value to keep right (`clusterDomain`, default `cluster.local`).

## What I would do in production

Keep this design, and add a readiness check that reports degraded (not failed)
when the API is unreachable, so dashboards show the dependency explicitly.
