# 0002 — Tests run against a throw-away SQLite DB built by the real migrations

**Status:** Accepted

## Context

Tests must use a test database or mocks, never the real
database. Tests must also run in CI without extra services and on a Windows
laptop.

## Options considered

1. **SQLite file per test session, created by `alembic upgrade head`.** No
   service needed, and it exercises the real migration.
2. **PostgreSQL service container in CI.** Closest to production, but local runs
   then need Docker, and the suite gets slower.
3. **Mock the session.** Fast, but proves nothing about the queries.

## Decision

`backend/tests/conftest.py` sets `DATABASE_URL` to a SQLite file in a fresh
temporary directory *before* the app is imported, asserts the engine really is
SQLite ("tests must never touch a real database") and runs Alembic's
`upgrade head`. Tables are emptied after every test.

Postgres-only behaviour is written to degrade safely on SQLite:
- `SELECT ... FOR UPDATE` on distributions is a no-op there;
- the migration advisory lock only runs when the dialect is `postgresql`.

## Consequences

- 31 backend tests run in under a second (`docs/evidence/pytest-results.png`)
  with 96% line coverage.
- Postgres-specific behaviour (row locks, advisory locks) is not covered by unit
  tests. It is exercised by the Compose and Kubernetes runs instead.

## What I would do in production

Add a CI job that runs the same suite against a `postgres:17` service container,
plus a concurrency test for two simultaneous hand-outs of the same item.
