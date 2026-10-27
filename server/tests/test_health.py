from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_reveals_no_config() -> None:
    body = client.get("/health").text.lower()
    for secret_hint in ("postgres", "password", "database_url"):
        assert secret_hint not in body


def test_unknown_routes_are_404() -> None:
    assert client.get("/users").status_code == 404
