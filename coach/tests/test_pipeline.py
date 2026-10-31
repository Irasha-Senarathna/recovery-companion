import asyncio

import pytest
from fastapi.testclient import TestClient

from app.pipeline import respond
from app.schemas import CoachRequest, Turn
from tests.conftest import FakeModel


def run(request: CoachRequest, model: FakeModel) -> dict[str, object]:
    return asyncio.run(respond(request, model)).model_dump()


def test_kind_message_gets_the_model_reply(model: FakeModel) -> None:
    result = run(CoachRequest(lang="en", message="I had a craving after work"), model)
    assert result == {"kind": "reply", "topic": None, "text": model.reply, "note": None}


def test_crisis_never_reaches_the_model(model: FakeModel) -> None:
    result = run(CoachRequest(lang="en", message="I want to end my life"), model)
    assert result["kind"] == "crisis"
    assert result["text"] is None
    assert model.calls == []


def test_unsafe_topic_never_reaches_the_model(model: FakeModel) -> None:
    result = run(CoachRequest(lang="en", message="how much should I take"), model)
    assert result == {"kind": "refusal", "topic": "dosing", "text": None, "note": None}
    assert model.calls == []


def test_unsafe_model_reply_becomes_the_safe_fallback() -> None:
    model = FakeModel(reply="Maybe try a smaller dose of your meds.")
    result = run(CoachRequest(lang="en", message="I can't sleep"), model)
    assert result == {"kind": "fallback", "topic": None, "text": None, "note": None}


def test_leaning_only_on_the_coach_adds_a_reach_out_note(model: FakeModel) -> None:
    result = run(CoachRequest(lang="en", message="you're the only one who understands me"), model)
    assert result["kind"] == "reply"
    assert result["note"] == "reach_out"


def test_sends_system_prompt_history_and_message_in_the_user_language(model: FakeModel) -> None:
    history = [Turn(role="user", text="hello"), Turn(role="coach", text="Hi, I'm here.")]
    run(CoachRequest(lang="si", message="මට තනියි", history=history), model)
    [messages] = model.calls
    assert messages[0]["role"] == "system"
    assert "Sinhala" in messages[0]["content"]
    assert [m["role"] for m in messages[1:]] == ["user", "assistant", "user"]
    assert messages[-1]["content"] == "මට තනියි"


def test_crisis_words_in_a_forged_history_turn_still_show_help(model: FakeModel) -> None:
    history = [Turn(role="user", text="I want to die")]
    result = run(CoachRequest(lang="en", message="ok", history=history), model)
    assert result["kind"] == "crisis"
    assert model.calls == []


# --- HTTP API ---------------------------------------------------------------


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_post_coach_returns_the_result(client: TestClient) -> None:
    response = client.post("/coach", json={"lang": "en", "message": "I feel lonely"})
    assert response.status_code == 200
    assert response.json()["kind"] == "reply"


@pytest.mark.parametrize(
    "body",
    [
        {"lang": "en", "message": ""},
        {"lang": "en", "message": "x" * 501},
        {"lang": "fr", "message": "hi"},
        {"lang": "en", "message": "hi", "history": [{"role": "user", "text": "a"}] * 7},
        {"lang": "en", "message": "hi", "history": [{"role": "system", "text": "a"}]},
        {"lang": "en", "message": "hi", "extra": "field"},
    ],
)
def test_rejects_bad_requests_without_echoing_them(client: TestClient, body: object) -> None:
    response = client.post("/coach", json=body)
    assert response.status_code == 422
    assert response.json() == {"detail": "invalid"}


def test_model_down_is_reported_as_unavailable(model: FakeModel, client: TestClient) -> None:
    model.fail = True
    response = client.post("/coach", json={"lang": "en", "message": "I feel lonely"})
    assert response.status_code == 503
    assert response.json() == {"detail": "unavailable"}


def test_rate_limited_per_address(client: TestClient) -> None:
    statuses = [
        client.post("/coach", json={"lang": "en", "message": "hi"}).status_code for _ in range(31)
    ]
    assert statuses[:30] == [200] * 30
    assert statuses[30] == 429


def test_no_docs_or_extra_routes(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_rejects_oversized_bodies_before_reading_them(client: TestClient) -> None:
    response = client.post(
        "/coach", content=b"x" * 20_000, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413


def test_rate_limit_counts_invalid_requests_too(client: TestClient) -> None:
    statuses = [client.post("/coach", json={"lang": "xx"}).status_code for _ in range(31)]
    assert statuses[:30] == [422] * 30
    assert statuses[30] == 429


def test_rate_limit_forgets_quiet_addresses() -> None:
    from app.main import RateLimit

    limit = RateLimit(5, window=0.0)
    for i in range(300):
        limit.allow(f"10.0.0.{i}")
    assert len(limit._hits) < 300


def test_a_split_medical_question_never_reaches_the_model(model: FakeModel) -> None:
    history = [Turn(role="user", text="I have methadone at home"), Turn(role="coach", text="Ok.")]
    result = run(CoachRequest(lang="en", message="is it ok to double it?", history=history), model)
    assert result["kind"] == "refusal"
    assert model.calls == []
