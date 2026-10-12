# 0001 — FastAPI + SQLAlchemy 2 + Alembic for the API

**Status:** Accepted

## Context

Pantrix needs a REST API for donors, stock items and distributions, backed by
PostgreSQL. The course stack is Python, and the rubric asks for at least one
table managed by migrations, `/health`, and Prometheus metrics.

## Options considered

1. **FastAPI + SQLAlchemy 2 + Alembic.** Typed request validation through
   Pydantic, OpenAPI docs for free, explicit migrations.
2. **Django + Django REST Framework.** Batteries included, but brings its own
   ORM, admin and settings model, which is a lot of surface for three resources.
3. **Flask + Marshmallow.** Lightweight, but validation, docs and async support
   all need extra libraries.

## Decision

FastAPI with SQLAlchemy 2 declarative models (`backend/app/models.py`), Pydantic
schemas (`backend/app/schemas.py`) and Alembic owning the schema
(`backend/alembic/versions/0001_initial_schema.py`). The application never calls
`create_all`: Alembic is the only thing allowed to change tables, so Compose,
Kubernetes and the tests all build the same schema.

Domain rules live in the routers and `services.py`:
- a distribution decrements stock inside the same transaction and returns 409
  if the request exceeds stock or the item is expired;
- `status` (`ok`, `expiring`, `expired`, `out_of_stock`) is computed, not stored.

Observability is built in: `prometheus-fastapi-instrumentator` exposes
`/metrics`, two business counters are added (`pantrix_stock_events_total`,
`pantrix_units_distributed_total`), and access logs are JSON.

## Consequences

- Swagger UI at `/docs` doubles as the API demo.
- Schema changes need a migration file; forgetting one is caught by the tests
  because they build the database through Alembic (ADR 0002).
- The API is synchronous (plain `def` endpoints). That is fine at this scale and
  keeps SQLAlchemy usage simple.

## What I would do in production

Add pagination cursors, authentication (OIDC) and per-organisation tenancy, and
run `alembic check` in CI to catch models that drifted from the migrations.
