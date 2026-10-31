import hashlib
import re

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Invite
from tests.conftest import FakeClock, invite_code, make_account


def redeem(client: TestClient, code: str, token_headers: dict[str, str]) -> int:
    response = client.post("/invites/redeem", json={"code": code}, headers=token_headers)
    status: int = response.status_code
    return status


def test_invite_code_is_10_character_base32(client: TestClient) -> None:
    member = make_account(client, "member")
    response = client.post("/invites", headers=member.auth)
    assert response.status_code == 201
    body = response.json()
    assert re.fullmatch(r"[A-Z2-7]{10}", body["code"])
    assert body["expires_at"] > 0


def test_only_the_code_hash_is_stored(client: TestClient, db: Session) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    row = db.scalars(select(Invite)).one()
    assert row.code_hash == hashlib.sha256(code.encode()).hexdigest()
    assert code not in repr(row.__dict__)


def test_only_members_create_invites(client: TestClient) -> None:
    supporter = make_account(client, "supporter")
    assert client.post("/invites", headers=supporter.auth).status_code == 403


def test_a_new_invite_replaces_the_old_one(client: TestClient) -> None:
    member = make_account(client, "member")
    old = invite_code(client, member)
    new = invite_code(client, member)
    supporter = make_account(client, "supporter")
    assert redeem(client, old, supporter.auth) == 404
    assert redeem(client, new, supporter.auth) == 201


def test_redeeming_creates_a_pending_link(client: TestClient) -> None:
    member = make_account(client, "member")
    supporter = make_account(client, "supporter")
    code = invite_code(client, member)
    response = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    links = client.get("/links", headers=member.auth).json()
    assert [link["status"] for link in links] == ["pending"]


def test_codes_are_forgiving_about_case_spaces_and_dashes(client: TestClient) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    typed = f" {code[:5].lower()}-{code[5:]} "
    assert redeem(client, typed, make_account(client, "supporter").auth) == 201


def test_codes_are_single_use(client: TestClient) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    assert redeem(client, code, make_account(client, "supporter").auth) == 201
    assert redeem(client, code, make_account(client, "supporter").auth) == 404


def test_codes_expire_after_24_hours(client: TestClient, clock: FakeClock) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    clock.advance(24 * 3600 + 1)
    assert redeem(client, code, make_account(client, "supporter").auth) == 404


def test_expired_and_unknown_codes_look_the_same(client: TestClient, clock: FakeClock) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    clock.advance(24 * 3600 + 1)
    supporter = make_account(client, "supporter")
    expired = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
    unknown = client.post("/invites/redeem", json={"code": "AAAAAAAAAA"}, headers=supporter.auth)
    assert expired.status_code == unknown.status_code == 404
    assert expired.json() == unknown.json()


def test_only_supporters_redeem(client: TestClient) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    other_member = make_account(client, "member")
    assert redeem(client, code, other_member.auth) == 403


def test_malformed_codes_are_refused(client: TestClient) -> None:
    supporter = make_account(client, "supporter")
    for bad in ["", "SHORT", "A" * 40, "ABCDEFGH1!"]:
        assert redeem(client, bad, supporter.auth) == 422


def test_guessing_is_rate_limited(client: TestClient) -> None:
    member = make_account(client, "member")
    code = invite_code(client, member)
    supporter = make_account(client, "supporter")
    statuses = [redeem(client, "A" * 10, supporter.auth) for _ in range(6)]
    assert statuses[:5] == [404] * 5
    assert statuses[5] == 429
    # Once limited, even the right code is refused for a while.
    assert redeem(client, code, supporter.auth) == 429


def test_guess_limit_resets_after_an_hour(client: TestClient, clock: FakeClock) -> None:
    supporter = make_account(client, "supporter")
    for _ in range(6):
        redeem(client, "A" * 10, supporter.auth)
    clock.advance(3601)
    assert redeem(client, "A" * 10, supporter.auth) == 404


def test_guessing_from_many_accounts_is_limited_per_address(client: TestClient) -> None:
    statuses: list[int] = []
    for _ in range(5):
        supporter = make_account(client, "supporter")
        statuses += [redeem(client, "B" * 10, supporter.auth) for _ in range(5)]
    assert statuses[:20] == [404] * 20
    assert 429 in statuses[20:]


def test_a_supporter_cannot_link_to_the_same_member_twice(client: TestClient) -> None:
    member = make_account(client, "member")
    supporter = make_account(client, "supporter")
    assert redeem(client, invite_code(client, member), supporter.auth) == 201
    assert redeem(client, invite_code(client, member), supporter.auth) == 409


def test_a_right_code_does_not_use_up_a_guess(client: TestClient) -> None:
    supporter = make_account(client, "supporter")
    for _ in range(4):
        redeem(client, "A" * 10, supporter.auth)
    member = make_account(client, "member")
    assert redeem(client, invite_code(client, member), supporter.auth) == 201
    # Still one wrong guess left before the limit.
    assert redeem(client, "A" * 10, supporter.auth) == 404
    assert redeem(client, "A" * 10, supporter.auth) == 429
