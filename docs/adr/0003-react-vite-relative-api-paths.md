# 0003 — React + Vite frontend that only calls relative `/api` paths

**Status:** Accepted

## Context

The same frontend build must work in four places:
- the Vite dev server;
- Docker Compose (Nginx on :3000);
- Kubernetes behind an Ingress;
- the Argo CD-managed copy on another hostname.

Baking an API URL into the bundle would need a rebuild per environment.

## Options considered

1. **Relative paths (`/api/...`).** Whatever serves the page also routes `/api`.
2. **Build-time `VITE_API_URL`.** One image per environment, and CORS everywhere.
3. **Runtime `config.js` injected by Nginx.** Flexible, but adds moving parts.

## Decision

`frontend/src/lib/api.js` only uses relative paths. Routing is done by whatever
is in front:
- Vite's dev proxy in development (`vite.config.js`);
- Nginx `location /api/` in Compose;
- the Ingress rule `/api` → backend Service in Kubernetes.

The browser never learns an internal hostname.

## Consequences

- One image, promoted unchanged from Compose to Kubernetes to GitOps.
- No CORS round-trips in deployed environments (same origin). CORS is still
  configured for local development.
- The UI is distinct from the reference projects on purpose:
  - a warm "pantry ledger" palette;
  - a top tab bar instead of a sidebar;
  - expiry-aware cards and slide-in drawers.
- Loading, empty, error and success states are explicit components, and 10
  Vitest tests cover rendering, API failure, create, and validation errors.

## What I would do in production

Add route-level code splitting, an error-reporting hook (Sentry or OpenTelemetry
web) and end-to-end tests in CI with Playwright.
