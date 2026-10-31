"""Behind an HTTPS proxy, per-address limits must see each client, not the proxy."""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.config import settings
from app.main import create_app
from app.ratelimit import client_address

PROXY = "172.30.0.10"
SPOOFED = {"X-Forwarded-For": "203.0.113.7"}


def _client(monkeypatch: pytest.MonkeyPatch, trusted: str, peer: str) -> TestClient:
    monkeypatch.setattr(settings, "trusted_proxies", trusted)
    app = create_app(run_purge_loop=False)

    @app.get("/whoami")
    def whoami(request: Request) -> dict[str, str]:
        return {"address": client_address(request)}

    return TestClient(app, client=(peer, 40000))


def test_forwarded_address_used_from_a_trusted_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client(monkeypatch, trusted=PROXY, peer=PROXY)
    assert client.get("/whoami", headers=SPOOFED).json() == {"address": "203.0.113.7"}


def test_trusted_proxies_accept_a_network(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client(monkeypatch, trusted="172.30.0.0/24", peer=PROXY)
    assert client.get("/whoami", headers=SPOOFED).json() == {"address": "203.0.113.7"}


def test_forwarded_header_ignored_from_anyone_else(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client(monkeypatch, trusted=PROXY, peer="198.51.100.4")
    assert client.get("/whoami", headers=SPOOFED).json() == {"address": "198.51.100.4"}


def test_no_proxy_trusted_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client(monkeypatch, trusted="", peer="127.0.0.1")
    assert client.get("/whoami", headers=SPOOFED).json() == {"address": "127.0.0.1"}
