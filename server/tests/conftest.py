from collections.abc import Iterator
from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import create_db_engine, get_session_factory
from app.main import create_app
from app.models import Base
from app.push import PushMessage, get_push_sender
from app.time import get_clock

START = 1_800_000_000  # a fixed "now" in epoch seconds


class FakeClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> int:
        return self.now

    def advance(self, seconds: int) -> None:
        self.now += seconds


@dataclass
class FakePush:
    sent: list[PushMessage] = field(default_factory=list)

    def send(self, messages: list[PushMessage]) -> list[str]:
        self.sent.extend(messages)
        return []


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = create_db_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    with sessionmaker(engine)() as session:
        yield session


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def push() -> FakePush:
    return FakePush()


@pytest.fixture
def client(engine: Engine, clock: FakeClock, push: FakePush) -> TestClient:
    app = create_app(run_purge_loop=False)
    factory = sessionmaker(engine)
    app.dependency_overrides[get_session_factory] = lambda: factory
    app.dependency_overrides[get_clock] = lambda: clock
    app.dependency_overrides[get_push_sender] = lambda: push
    return TestClient(app)


@dataclass
class Account:
    id: str
    token: str

    @property
    def auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


def make_account(client: TestClient, role: str) -> Account:
    response = client.post("/accounts", json={"role": role})
    assert response.status_code == 201, response.text
    body = response.json()
    return Account(id=body["account_id"], token=body["token"])


def invite_code(client: TestClient, member: Account) -> str:
    response = client.post("/invites", headers=member.auth)
    assert response.status_code == 201, response.text
    code: str = response.json()["code"]
    return code


def linked_pair(client: TestClient) -> tuple[Account, Account, str]:
    """A member and a supporter with an active (approved) link."""
    member = make_account(client, "member")
    supporter = make_account(client, "supporter")
    code = invite_code(client, member)
    redeemed = client.post("/invites/redeem", json={"code": code}, headers=supporter.auth)
    assert redeemed.status_code == 201, redeemed.text
    link_id: str = redeemed.json()["link_id"]
    approved = client.post(f"/links/{link_id}/approve", headers=member.auth)
    assert approved.status_code == 200, approved.text
    return member, supporter, link_id
