from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, Invite, Link, PushToken, Signal
from tests.conftest import invite_code, linked_pair, make_account


def count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_deleting_a_member_removes_everything_about_them(client: TestClient, db: Session) -> None:
    member, supporter, _ = linked_pair(client)
    client.put(
        "/account/push-token",
        json={"token": "ExponentPushToken[abc]", "lang": "en"},
        headers=supporter.auth,
    )
    client.post("/signals", headers=member.auth)
    invite_code(client, member)

    assert client.delete("/account", headers=member.auth).status_code == 204

    assert count(db, Signal) == 0
    assert count(db, Link) == 0
    assert count(db, Invite) == 0
    assert count(db, Account) == 1  # only the supporter is left
    assert client.get("/links", headers=supporter.auth).json() == []


def test_deleting_a_supporter_removes_their_links_and_push_token(
    client: TestClient, db: Session
) -> None:
    member, supporter, _ = linked_pair(client)
    client.put(
        "/account/push-token",
        json={"token": "ExponentPushToken[abc]", "lang": "en"},
        headers=supporter.auth,
    )
    assert client.delete("/account", headers=supporter.auth).status_code == 204
    assert count(db, PushToken) == 0
    assert count(db, Link) == 0
    assert client.get("/links", headers=member.auth).json() == []


def test_the_old_token_stops_working(client: TestClient) -> None:
    account = make_account(client, "member")
    client.delete("/account", headers=account.auth)
    assert client.get("/links", headers=account.auth).status_code == 401
    # Deleting twice (e.g. a retried, queued delete) is not an error the app must handle.
    assert client.delete("/account", headers=account.auth).status_code == 401
