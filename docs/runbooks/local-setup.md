# Local setup

## Prerequisites

| Tool | Version used | Needed for |
|------|-------------|-----------|
| Docker Desktop / Engine with Compose v2 | 29.5 | everything below |
| Python | 3.12 | running the API or tests without Docker |
| Node.js | 22 | running the UI or its tests without Docker |
| Git | any recent | — |

## Option A — Docker Compose (recommended)

```bash
cp .env.example .env            # optional: override the default credentials
docker compose up --build --wait
```

What starts:

| Service | URL | Notes |
|---------|-----|-------|
| frontend | http://localhost:3000 | Nginx (uid 101) serving the React build, proxying `/api` |
| backend | http://localhost:8000/docs | FastAPI (uid 10001); migrates on start, seeds demo data |
| postgres | internal only | `postgres:17-alpine`, data in volume `pantrix_pantrix-db` |

Checks:

```bash
docker compose ps                          # all three "healthy"
curl -s localhost:8000/health              # {"status":"ok"}
curl -s localhost:8000/ready               # {"status":"ready","database":"ok"}
curl -s localhost:3000/api/items/stats     # same API through Nginx
docker compose exec backend id             # uid=10001(pantrix)
```

Stop with `docker compose down`, which keeps the data. Add `-v` to also delete the
database volume.

## Option B — run the parts directly

Backend, against the Compose Postgres or any PostgreSQL:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv/Scripts/activate
pip install -r requirements-dev.txt
export DATABASE_URL='postgresql+psycopg://pantrix:pantrix@localhost:5432/pantrix'
alembic upgrade head
SEED_DEMO_DATA=true uvicorn app.main:app --reload --port 8000
```

The Compose file does not publish Postgres on the host. Either run a local
PostgreSQL, or add `ports: ["5432:5432"]` to the `postgres` service while you
develop.

Frontend, with Vite proxying `/api` to `localhost:8000`:

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

## Tests and quality gates (same commands as CI)

```bash
cd backend && pytest -v --cov=app --cov-fail-under=85
ruff check . && ruff format --check . && bandit -r app -ll && pip-audit -r requirements.txt
cd ../frontend && npm run lint && npm run format:check && npm test && npm run build
```

The backend tests create their own SQLite database through Alembic and refuse to
run against anything else.
