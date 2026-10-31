import hashlib

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account as AccountRow
from tests.conftest import make_account


def test_create_account_returns_a_random_id_and_token(client: TestClient) -> None:
    response = client.post("/accounts", json={"role": "member"})
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"account_id", "token", "role"}
    assert body["role"] == "member"
    assert len(body["token"]) >= 43  # 256 bits, url-safe base64


def test_two_accounts_get_different_tokens(client: TestClient) -> None:
    assert make_account(client, "member").token != make_account(client, "member").token


def test_only_the_token_hash_is_stored(client: TestClient, db: Session) -> None:
    account = make_account(client, "supporter")
    row = db.scalars(select(AccountRow)).one()
    assert row.token_hash == hashlib.sha256(account.token.encode()).hexdigest()
    assert account.token not in repr(row.__dict__)


def test_account_creation_needs_a_known_role(client: TestClient) -> None:
    assert client.post("/accounts", json={"role": "admin"}).status_code == 422
    assert client.post("/accounts", json={}).status_code == 422


def test_account_creation_refuses_extra_fields(client: TestClient) -> None:
    # Nothing personal can be smuggled in: unknown fields are an error, not ignored.
    response = client.post("/accounts", json={"role": "member", "name": "Sky"})
    assert response.status_code == 422


def test_protected_routes_need_a_valid_token(client: TestClient) -> None:
    assert client.get("/links").status_code == 401
    bad = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/links", headers=bad).status_code == 401
    assert client.get("/links", headers={"Authorization": "Basic abc"}).status_code == 401


def test_a_valid_token_is_accepted(client: TestClient) -> None:
    account = make_account(client, "member")
    assert client.get("/links", headers=account.auth).status_code == 200


def test_account_creation_is_rate_limited_per_address(client: TestClient) -> None:
    statuses = [client.post("/accounts", json={"role": "member"}).status_code for _ in range(11)]
    assert statuses[:10] == [201] * 10
    assert statuses[10] == 429


def test_errors_do_not_echo_the_token(client: TestClient) -> None:
    fake = "zzz-made-up-value"
    response = client.get("/links", headers={"Authorization": f"Bearer {fake}"})
    assert fake not in response.text
