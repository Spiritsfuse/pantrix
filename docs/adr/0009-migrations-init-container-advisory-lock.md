# 0009 — Migrations in an init container, serialised by a Postgres advisory lock

**Status:** Accepted

## Context

Schema migrations must be applied before the API serves traffic. In Kubernetes
there are at least two backend replicas, and the HPA can add more, all starting
at the same time.

## Options considered

1. **Helm `pre-install`/`pre-upgrade` Job.** On a first install the database
   StatefulSet does not exist yet when the hook runs, so the hook deadlocks.
   Argo CD maps hooks differently.
2. **Migrate inside the app process at start-up.** Mixes concerns and needs the
   app user to hold DDL rights on every start.
3. **Init container per pod + advisory lock.** Each pod migrates before it
   starts. A lock makes concurrent pods take turns, and Alembic is a no-op once
   the schema is at head.

## Decision

- **Backend Deployment:** it has an init container `migrate` that runs
  `alembic upgrade head` with the same image and the same Secret. The main
  container sets `RUN_MIGRATIONS=false`.
- **Advisory lock:** `backend/alembic/env.py` takes
  `pg_advisory_lock(7041772)` before migrating and releases it afterwards, on
  PostgreSQL only.
- **Docker Compose:** the image entrypoint (`docker-entrypoint.sh`) migrates and
  then `exec`s uvicorn, because Compose has a single replica.

## Consequences

- Verified in Compose logs and on kind: `Running upgrade -> 0001_initial_schema`.
  Later pods log nothing to do.
- A broken migration or unreachable database shows up as `Init:Error` /
  `Init:CrashLoopBackOff`, and the API container never starts. Troubleshooting
  drill 4 rehearses exactly this.
- Migrations must stay backward compatible with the previous release, because
  old pods keep serving during a rolling update.

## What I would do in production

Run migrations as a dedicated, versioned Job (or an Argo CD PreSync hook against
an external database), with an expand/contract migration policy.
