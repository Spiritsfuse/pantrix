def test_health_is_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_checks_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ok"}


def test_ready_reports_unavailable_database(client, monkeypatch):
    from sqlalchemy.exc import OperationalError

    import app.main as main

    class BrokenSession:
        def __enter__(self):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(main, "SessionLocal", BrokenSession)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not ready"


def test_metrics_exposes_prometheus_format(client):
    client.get("/api/items")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    body = response.text
    assert "http_requests_total" in body
    assert 'handler="/api/items"' in body


def test_root_describes_service(client):
    assert client.get("/").json()["service"] == "Pantrix API"
