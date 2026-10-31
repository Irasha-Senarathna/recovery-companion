from collections.abc import Iterator
from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.ollama_client import ChatMessage, ModelUnavailable


@dataclass
class FakeModel:
    """Stands in for Ollama: records what it was sent and returns a fixed reply."""

    reply: str = "That sounds hard. Let's try one slow breath together."
    fail: bool = False
    calls: list[list[ChatMessage]] = field(default_factory=list)

    async def chat(self, messages: list[ChatMessage]) -> str:
        self.calls.append(messages)
        if self.fail:
            raise ModelUnavailable("connection refused")
        return self.reply


@pytest.fixture
def model() -> FakeModel:
    return FakeModel()


@pytest.fixture
def client(model: FakeModel) -> Iterator[TestClient]:
    with TestClient(create_app(model=model)) as test_client:
        yield test_client
