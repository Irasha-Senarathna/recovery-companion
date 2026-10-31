from fastapi.testclient import TestClient

from tests.conftest import make_account


def test_errors_are_short_codes_the_app_translates(client: TestClient) -> None:
    member = make_account(client, "member")
    assert client.post("/signals", headers=member.auth).json() == {"detail": "no_supporters"}
    assert client.get("/links").json() == {"detail": "unauthorized"}
    assert client.get("/signals", headers=member.auth).json() == {"detail": "wrong_role"}


def test_no_browser_access_unless_configured(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "https://example.org"})
    assert "access-control-allow-origin" not in response.headers
