# Testing

## Backend — pytest (`backend/tests/`, config `backend/pytest.ini`)

**31 tests, 96% line coverage** (`docs/evidence/pytest-results.png`,
`pytest-coverage.png`). They run against a SQLite database created by
`alembic upgrade head`, never against Compose or Kubernetes PostgreSQL (ADR 0002).

| File | Tests | Covers |
|------|-------|--------|
| `test_items.py` | 16 (5 parametrised validation cases) | list empty; create → 201 with computed `status`/`days_to_expiry`; 422 for negative quantity, unknown category, blank name, bad unit, bad date; 422 for unknown donor; get by id; 404 with message; partial PUT; PUT null required field → 422; PUT missing → 404; DELETE → 204 then 404; ordering by soonest expiry, category, status and search filters; `/stats` aggregates |
| `test_donors_and_distributions.py` | 9 | donor item counts and `donor_name` join; duplicate donor → 409; invalid email → 422; donor update/delete keeps items (`donor_id` NULL); distribution decrements stock and appears in history and stats; exceeding stock → 409 with stock unchanged; expired stock → 409; missing item → 404; quantity 0 → 422 |
| `test_system.py` | 5 | `/health`; `/ready` OK; `/ready` → 503 when the DB session raises; `/metrics` is Prometheus text and contains `http_requests_total` for `/api/items`; `/` |
| `test_seed.py` | 1 | demo seed fills an empty DB once and is idempotent |

Endpoints covered: `/api/items` (all verbs), `/api/items/stats`,
`/api/donors` (all verbs), `/api/distributions`, `/health`, `/ready`,
`/metrics`.

`pytest.ini` turns DeprecationWarnings raised from `app.*` into errors. CI
enforces `--cov-fail-under=85`.

## Frontend — Vitest + Testing Library (`frontend/src/**/*.test.*`)

**10 tests.**

| File | Tests | Covers |
|------|-------|--------|
| `src/lib/meta.test.js` | 6 | expiry text for null, past, today, tomorrow and future dates; the freshness bar clamps to 0..1 |
| `src/App.test.jsx` | 4 | KPIs and item cards render from mocked API responses; the error banner appears when `fetch` rejects; logging a donation sends the expected POST body and shows a toast; FastAPI 422 validation errors appear inside the form |

## Static checks in the same gates

- **Backend:** Ruff (rules E, F, I, B, UP, S, SIM) plus `ruff format --check`,
  Bandit, pip-audit.
- **Frontend:** ESLint (react-hooks), Prettier check, npm audit.

## System-level checks (not unit tests)

- `scripts/k8s/smoke-test.sh`: UI, API read, API create and delete through the
  Ingress. It runs locally and in the CI `k8s-smoke` job.
- `helm test pantrix`: a pod calls `/ready` and `/api/items` inside the cluster.
- The browser CRUD flow driven by `scripts/evidence/capture-browser.mjs`:
  create, edit, hand out, over-ask → 409 shown in the form, delete.

## Run

```bash
cd backend && pytest -v
cd frontend && npm test
```
