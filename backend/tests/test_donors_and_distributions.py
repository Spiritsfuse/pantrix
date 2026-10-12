from datetime import date, timedelta


def test_create_and_list_donors_with_item_counts(client, make_donor, make_item):
    farm = make_donor()
    make_item(name="Tomatoes", category="produce", donor_id=farm["id"])
    make_item(name="Bananas", category="produce", donor_id=farm["id"])

    donors = client.get("/api/donors").json()
    assert len(donors) == 1
    assert donors[0]["item_count"] == 2

    item = client.get("/api/items", params={"q": "Tomatoes"}).json()[0]
    assert item["donor_name"] == "Greenrow Organic Farm"


def test_duplicate_donor_name_returns_409(client, make_donor):
    make_donor()
    response = client.post("/api/donors", json={"name": "Greenrow Organic Farm"})
    assert response.status_code == 409


def test_donor_rejects_invalid_email(client):
    response = client.post("/api/donors", json={"name": "Daily Crust", "contact_email": "nope"})
    assert response.status_code == 422


def test_update_and_delete_donor_keeps_items(client, make_donor, make_item):
    donor = make_donor()
    item = make_item(donor_id=donor["id"])

    updated = client.put(f"/api/donors/{donor['id']}", json={"city": "Pilani"})
    assert updated.status_code == 200
    assert updated.json()["city"] == "Pilani"

    assert client.delete(f"/api/donors/{donor['id']}").status_code == 204
    assert client.get(f"/api/donors/{donor['id']}").status_code == 404
    orphan = client.get(f"/api/items/{item['id']}").json()
    assert orphan["donor_id"] is None


def test_distribution_decrements_stock(client, make_item):
    item = make_item(quantity=10)
    response = client.post(
        "/api/distributions",
        json={"item_id": item["id"], "quantity": 4, "recipient": "Shelter Home Ward 4"},
    )
    assert response.status_code == 201
    assert response.json()["item_name"] == item["name"]
    assert client.get(f"/api/items/{item['id']}").json()["quantity"] == 6

    history = client.get("/api/distributions").json()
    assert [d["recipient"] for d in history] == ["Shelter Home Ward 4"]
    assert client.get("/api/items/stats").json()["distributed_units_30d"] == 4


def test_distribution_cannot_exceed_stock(client, make_item):
    item = make_item(quantity=3)
    response = client.post(
        "/api/distributions", json={"item_id": item["id"], "quantity": 5, "recipient": "Camp"}
    )
    assert response.status_code == 409
    assert "Only 3" in response.json()["detail"]
    assert client.get(f"/api/items/{item['id']}").json()["quantity"] == 3


def test_expired_stock_cannot_be_distributed(client, make_item):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    item = make_item(quantity=5, expiry_date=yesterday)
    response = client.post(
        "/api/distributions", json={"item_id": item["id"], "quantity": 1, "recipient": "Camp"}
    )
    assert response.status_code == 409


def test_distribution_for_missing_item_returns_404(client):
    response = client.post("/api/distributions", json={"item_id": 77, "quantity": 1, "recipient": "Camp"})
    assert response.status_code == 404


def test_distribution_validates_quantity(client, make_item):
    item = make_item()
    response = client.post(
        "/api/distributions", json={"item_id": item["id"], "quantity": 0, "recipient": "Camp"}
    )
    assert response.status_code == 422
