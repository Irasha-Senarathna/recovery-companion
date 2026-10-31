from fastapi.testclient import TestClient

from tests.conftest import invite_code, linked_pair, make_account


def test_member_approves_a_pending_supporter(client: TestClient) -> None:
    member, supporter, link_id = linked_pair(client)
    for account in (member, supporter):
        links = client.get("/links", headers=account.auth).json()
        assert links == [{"id": link_id, "status": "active", "created_at": links[0]["created_at"]}]


def test_links_carry_no_account_ids(client: TestClient) -> None:
    member, supporter, _ = linked_pair(client)
    text = client.get("/links", headers=supporter.auth).text
    assert member.id not in text
    assert supporter.id not in text


def test_only_the_member_can_approve(client: TestClient) -> None:
    member = make_account(client, "member")
    supporter = make_account(client, "supporter")
    code = invite_code(client, member)
    link_id = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth).json()[
        "link_id"
    ]
    assert client.post(f"/links/{link_id}/approve", headers=supporter.auth).status_code == 403
    stranger = make_account(client, "member")
    assert client.post(f"/links/{link_id}/approve", headers=stranger.auth).status_code == 404


def test_max_three_supporters(client: TestClient) -> None:
    member = make_account(client, "member")
    for _ in range(3):
        code = invite_code(client, member)
        supporter = make_account(client, "supporter")
        response = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
        assert response.status_code == 201
    # A fourth invite cannot even be made.
    assert client.post("/invites", headers=member.auth).status_code == 409


def test_member_can_revoke(client: TestClient) -> None:
    member, supporter, link_id = linked_pair(client)
    assert client.delete(f"/links/{link_id}", headers=member.auth).status_code == 204
    assert client.get("/links", headers=supporter.auth).json() == []
    assert client.get("/links", headers=member.auth).json() == []


def test_supporter_can_step_back(client: TestClient) -> None:
    member, supporter, link_id = linked_pair(client)
    assert client.delete(f"/links/{link_id}", headers=supporter.auth).status_code == 204
    assert client.get("/links", headers=member.auth).json() == []


def test_member_can_decline_a_pending_supporter(client: TestClient) -> None:
    member = make_account(client, "member")
    supporter = make_account(client, "supporter")
    code = invite_code(client, member)
    link_id = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth).json()[
        "link_id"
    ]
    assert client.delete(f"/links/{link_id}", headers=member.auth).status_code == 204
    assert client.get("/links", headers=supporter.auth).json() == []


def test_strangers_cannot_revoke(client: TestClient) -> None:
    _, _, link_id = linked_pair(client)
    for role in ("member", "supporter"):
        stranger = make_account(client, role)
        assert client.delete(f"/links/{link_id}", headers=stranger.auth).status_code == 404


def test_revoking_frees_a_place(client: TestClient) -> None:
    member = make_account(client, "member")
    link_ids = []
    for _ in range(3):
        code = invite_code(client, member)
        supporter = make_account(client, "supporter")
        response = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
        link_ids.append(response.json()["link_id"])
    client.delete(f"/links/{link_ids[0]}", headers=member.auth)
    assert client.post("/invites", headers=member.auth).status_code == 201


def test_bad_link_ids_are_not_found(client: TestClient) -> None:
    member = make_account(client, "member")
    assert client.delete("/links/not-a-uuid", headers=member.auth).status_code == 404
