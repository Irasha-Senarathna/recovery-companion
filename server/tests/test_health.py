import pytest
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


def test_database_url_escapes_special_characters(monkeypatch: pytest.MonkeyPatch) -> None:
    from sqlalchemy import URL

    from app import db
    from app.config import settings

    for name, value in {
        "database_url": "",
        "db_user": "recovery",
        "db_password": "p@ss:w/rd#1",
        "db_host": "db",
        "db_name": "rc",
    }.items():
        monkeypatch.setattr(settings, name, value)
    url = db.database_url()
    assert isinstance(url, URL)
    assert (url.host, url.password, url.database) == ("db", "p@ss:w/rd#1", "rc")
