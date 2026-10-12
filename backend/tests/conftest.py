"""Test fixtures.

Tests run against a throw-away SQLite database created by the real Alembic
migrations, never against the Compose/Kubernetes PostgreSQL instance.
"""

import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

_TEST_DB = Path(tempfile.mkdtemp(prefix="pantrix-tests-")) / "pantrix_test.db"
# Must be set before anything imports app.config / app.database.
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    assert engine.url.get_backend_name() == "sqlite", "tests must never touch a real database"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with SessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_item(client):
    def _make(**overrides):
        payload = {
            "name": "Basmati rice 5kg",
            "category": "grains",
            "quantity": 10,
            "unit": "packs",
            "expiry_date": (date.today() + timedelta(days=90)).isoformat(),
            "location": "A1-01",
        }
        payload.update(overrides)
        response = client.post("/api/items", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def make_donor(client):
    def _make(**overrides):
        payload = {"name": "Greenrow Organic Farm", "donor_type": "farm", "city": "Jaipur"}
        payload.update(overrides)
        response = client.post("/api/donors", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
