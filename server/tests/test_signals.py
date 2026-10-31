from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Signal
from app.purge import purge
from tests.conftest import FakeClock, FakePush, invite_code, linked_pair, make_account

DAY = 24 * 3600


def set_push(client: TestClient, supporter_auth: dict[str, str], lang: str = "en") -> None:
    response = client.put(
        "/account/push-token",
        json={"token": "ExponentPushToken[abc123]", "lang": lang},
        headers=supporter_auth,
    )
    assert response.status_code == 204, response.text


def test_member_sends_a_signal_with_no_body(client: TestClient) -> None:
    member, _, _ = linked_pair(client)
    response = client.post("/signals", headers=member.auth)
    assert response.status_code == 201
    assert response.json()["remaining_today"] == 2


def test_signals_refuse_any_content(client: TestClient) -> None:
    member, _, _ = linked_pair(client)
    response = client.post("/signals", json={"message": "I had a bad night"}, headers=member.auth)
    assert response.status_code == 422


def test_supporter_sees_the_signal_by_link_only(client: TestClient) -> None:
    member, supporter, link_id = linked_pair(client)
    client.post("/signals", headers=member.auth)
    signals = client.get("/signals", headers=supporter.auth).json()
    assert len(signals) == 1
    assert set(signals[0]) == {"link_id", "created_at"}
    assert signals[0]["link_id"] == link_id


def test_three_signals_a_day(client: TestClient, clock: FakeClock) -> None:
    member, _, _ = linked_pair(client)
    statuses = [client.post("/signals", headers=member.auth).status_code for _ in range(4)]
    assert statuses == [201, 201, 201, 429]
    clock.advance(DAY + 1)
    assert client.post("/signals", headers=member.auth).status_code == 201


def test_a_signal_needs_an_approved_supporter(client: TestClient) -> None:
    member = make_account(client, "member")
    assert client.post("/signals", headers=member.auth).status_code == 409
    supporter = make_account(client, "supporter")
    code = invite_code(client, member)
    client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
    # Pending is not enough: the member has not approved this supporter yet.
    assert client.post("/signals", headers=member.auth).status_code == 409


def test_only_members_send(client: TestClient) -> None:
    _, supporter, _ = linked_pair(client)
    assert client.post("/signals", headers=supporter.auth).status_code == 403


def test_pending_supporters_see_no_signals(client: TestClient) -> None:
    member, _, _ = linked_pair(client)
    pending = make_account(client, "supporter")
    client.post("/invites/redeem", json={"code": invite_code(client, member)}, headers=pending.auth)
    client.post("/signals", headers=member.auth)
    assert client.get("/signals", headers=pending.auth).json() == []


def test_revoked_supporters_see_no_signals(client: TestClient) -> None:
    member, supporter, link_id = linked_pair(client)
    client.post("/signals", headers=member.auth)
    client.delete(f"/links/{link_id}", headers=member.auth)
    assert client.get("/signals", headers=supporter.auth).json() == []


def test_neutral_push_in_the_supporters_language(client: TestClient, push: FakePush) -> None:
    member, supporter, _ = linked_pair(client)
    set_push(client, supporter.auth, lang="en")
    client.post("/signals", headers=member.auth)
    assert len(push.sent) == 1
    message = push.sent[0]
    assert message.to == "ExponentPushToken[abc123]"
    assert message.body == "A friend asked you to check in today."
    assert member.id not in repr(message)


def test_push_goes_only_to_active_supporters(client: TestClient, push: FakePush) -> None:
    member, supporter, link_id = linked_pair(client)
    set_push(client, supporter.auth)
    client.delete(f"/links/{link_id}", headers=supporter.auth)
    other_member, other_supporter, _ = linked_pair(client)
    set_push(client, other_supporter.auth)
    client.post("/signals", headers=other_member.auth)
    assert len(push.sent) == 1


def test_push_token_can_be_removed(client: TestClient, push: FakePush) -> None:
    member, supporter, _ = linked_pair(client)
    set_push(client, supporter.auth)
    assert client.delete("/account/push-token", headers=supporter.auth).status_code == 204
    client.post("/signals", headers=member.auth)
    assert push.sent == []


def test_push_token_is_validated(client: TestClient) -> None:
    supporter = make_account(client, "supporter")
    for body in (
        {"token": "https://evil.example", "lang": "en"},
        {"token": "ExponentPushToken[abc]", "lang": "fr"},
        {"token": "ExponentPushToken[" + "a" * 300 + "]", "lang": "en"},
    ):
        response = client.put("/account/push-token", json=body, headers=supporter.auth)
        assert response.status_code == 422


def test_members_do_not_register_push_tokens(client: TestClient) -> None:
    member = make_account(client, "member")
    response = client.put(
        "/account/push-token",
        json={"token": "ExponentPushToken[abc]", "lang": "en"},
        headers=member.auth,
    )
    assert response.status_code == 403


def test_signals_older_than_7_days_are_purged(
    client: TestClient, clock: FakeClock, db: Session
) -> None:
    member, supporter, _ = linked_pair(client)
    client.post("/signals", headers=member.auth)
    clock.advance(6 * DAY)
    client.post("/signals", headers=member.auth)
    clock.advance(DAY + 1)

    purge(db, clock())

    assert db.scalar(select(func.count()).select_from(Signal)) == 1


def test_supporters_never_see_signals_older_than_7_days(
    client: TestClient, clock: FakeClock
) -> None:
    member, supporter, _ = linked_pair(client)
    client.post("/signals", headers=member.auth)
    clock.advance(7 * DAY + 1)
    assert client.get("/signals", headers=supporter.auth).json() == []


def test_purge_removes_expired_invites(client: TestClient, clock: FakeClock, db: Session) -> None:
    from app.models import Invite

    invite_code(client, make_account(client, "member"))
    clock.advance(DAY + 1)
    purge(db, clock())
    assert db.scalar(select(func.count()).select_from(Invite)) == 0


def test_requests_sent_while_pending_stay_hidden_after_approval(
    client: TestClient, clock: FakeClock
) -> None:
    member, _, _ = linked_pair(client)
    late = make_account(client, "supporter")
    redeemed = client.post(
        "/invites/redeem", json={"code": invite_code(client, member)}, headers=late.auth
    )
    client.post("/signals", headers=member.auth)
    clock.advance(60)
    client.post(f"/links/{redeemed.json()['link_id']}/approve", headers=member.auth)
    assert client.get("/signals", headers=late.auth).json() == []
