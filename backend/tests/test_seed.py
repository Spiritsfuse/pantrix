from app.database import SessionLocal
from app.seed import DONORS, ITEMS, seed_if_empty


def test_seed_populates_empty_database_once(client):
    with SessionLocal() as db:
        assert seed_if_empty(db) is True
        assert seed_if_empty(db) is False

    assert len(client.get("/api/items").json()) == len(ITEMS)
    assert len(client.get("/api/donors").json()) == len(DONORS)
    stats = client.get("/api/items/stats").json()
    assert stats["expired"] >= 1
    assert stats["out_of_stock"] >= 1
