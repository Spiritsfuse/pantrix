from datetime import date, timedelta

import pytest


def _in_days(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def test_list_items_starts_empty(client):
    response = client.get("/api/items")
    assert response.status_code == 200
    assert response.json() == []


def test_create_item_returns_201_and_computed_status(client):
    response = client.post(
        "/api/items",
        json={
            "name": "  Toned milk 1L ",
            "category": "dairy",
            "quantity": 12,
            "unit": "litres",
            "expiry_date": _in_days(3),
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == "Toned milk 1L"
    assert body["status"] == "expiring"
    assert body["days_to_expiry"] == 3


@pytest.mark.parametrize(
    "bad_field",
    [
        {"quantity": -5},
        {"category": "electronics"},
        {"name": " "},
        {"unit": "tonnes"},
        {"expiry_date": "not-a-date"},
    ],
)
def test_create_item_rejects_invalid_payload(client, bad_field):
    payload = {"name": "Chickpeas", "category": "canned", "quantity": 4}
    payload.update(bad_field)
    response = client.post("/api/items", json=payload)
    assert response.status_code == 422


def test_create_item_rejects_unknown_donor(client):
    response = client.post(
        "/api/items", json={"name": "Soap", "category": "hygiene", "quantity": 3, "donor_id": 999}
    )
    assert response.status_code == 422
    assert "Donor 999" in response.json()["detail"]


def test_get_item_by_id(client, make_item):
    created = make_item()
    response = client.get(f"/api/items/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Basmati rice 5kg"


def test_get_missing_item_returns_404(client):
    response = client.get("/api/items/4242")
    assert response.status_code == 404
    assert response.json() == {"detail": "Stock item 4242 not found"}


def test_update_item_changes_only_sent_fields(client, make_item):
    created = make_item(quantity=10)
    response = client.put(f"/api/items/{created['id']}", json={"quantity": 0, "location": "B2-07"})
    assert response.status_code == 200
    body = response.json()
    assert body["quantity"] == 0
    assert body["location"] == "B2-07"
    assert body["name"] == created["name"]
    assert body["status"] == "out_of_stock"


def test_update_item_rejects_null_required_field(client, make_item):
    created = make_item()
    response = client.put(f"/api/items/{created['id']}", json={"name": None})
    assert response.status_code == 422


def test_update_missing_item_returns_404(client):
    assert client.put("/api/items/999", json={"quantity": 1}).status_code == 404


def test_delete_item_then_it_is_gone(client, make_item):
    created = make_item()
    assert client.delete(f"/api/items/{created['id']}").status_code == 204
    assert client.get(f"/api/items/{created['id']}").status_code == 404
    assert client.delete(f"/api/items/{created['id']}").status_code == 404


def test_list_orders_by_soonest_expiry_and_filters(client, make_item):
    make_item(name="Rice", expiry_date=_in_days(200))
    make_item(name="Spinach", category="produce", expiry_date=_in_days(1))
    make_item(name="Soap", category="hygiene", expiry_date=None)
    make_item(name="Old paneer", category="dairy", expiry_date=_in_days(-2))

    names = [i["name"] for i in client.get("/api/items").json()]
    assert names == ["Old paneer", "Spinach", "Rice", "Soap"]

    produce = client.get("/api/items", params={"category": "produce"}).json()
    assert [i["name"] for i in produce] == ["Spinach"]

    expired = client.get("/api/items", params={"status": "expired"}).json()
    assert [i["name"] for i in expired] == ["Old paneer"]

    search = client.get("/api/items", params={"q": "ric"}).json()
    assert [i["name"] for i in search] == ["Rice"]


def test_stats_summarise_stock(client, make_item):
    make_item(name="Rice", quantity=10)
    make_item(name="Milk", category="dairy", quantity=4, expiry_date=_in_days(2))
    make_item(name="Bread", category="bakery", quantity=6, expiry_date=_in_days(-1))
    make_item(name="Beans", category="canned", quantity=0)

    stats = client.get("/api/items/stats").json()
    assert stats["total_items"] == 4
    assert stats["total_units"] == 20
    assert stats["expiring_soon"] == 1
    assert stats["expired"] == 1
    assert stats["out_of_stock"] == 1
    assert stats["by_category"] == {"bakery": 6, "canned": 0, "dairy": 4, "grains": 10}
