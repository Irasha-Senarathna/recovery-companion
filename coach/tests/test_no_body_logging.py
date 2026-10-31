"""Privacy (TH11): the coach never writes message text to a log, on any path."""

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import FakeModel

SECRET = "zebra-ocean-1234"  # noqa: S105 (a marker, not a password)


def everything_logged(caplog: pytest.LogCaptureFixture, capsys: pytest.CaptureFixture[str]) -> str:
    out, err = capsys.readouterr()
    return "\n".join([caplog.text, out, err])


@pytest.mark.parametrize(
    "message",
    [
        f"I feel lonely {SECRET}",  # model reply
        f"I want to end my life {SECRET}",  # crisis
        f"how much should I take {SECRET}",  # refusal
    ],
)
def test_message_text_is_never_logged(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
    message: str,
) -> None:
    caplog.set_level(logging.DEBUG)
    response = client.post(
        "/coach",
        json={"lang": "en", "message": message, "history": [{"role": "user", "text": SECRET}]},
    )
    assert response.status_code == 200
    logged = everything_logged(caplog, capsys)
    assert "POST /coach 200" in logged  # method, path and status are logged...
    assert SECRET not in logged  # ...the text never is


def test_model_reply_is_never_logged(
    model: FakeModel,
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    caplog.set_level(logging.DEBUG)
    model.reply = f"Unsafe dose advice {SECRET}"
    client.post("/coach", json={"lang": "en", "message": "hello"})
    assert SECRET not in everything_logged(caplog, capsys)


def test_errors_are_not_logged_with_text(
    model: FakeModel,
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    caplog.set_level(logging.DEBUG)
    model.fail = True
    client.post("/coach", json={"lang": "en", "message": f"hello {SECRET}"})
    client.post("/coach", json={"lang": "en", "message": f"{SECRET}" * 100})
    assert SECRET not in everything_logged(caplog, capsys)


def test_container_runs_without_access_log() -> None:
    from pathlib import Path

    dockerfile = (Path(__file__).parents[1] / "Dockerfile").read_text()
    assert "--no-access-log" in dockerfile


def test_unexpected_errors_are_answered_without_text(
    model: FakeModel,
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    caplog.set_level(logging.DEBUG)

    async def broken(_: object) -> str:
        raise RuntimeError(f"bug while handling {SECRET}")

    model.chat = broken  # type: ignore[method-assign,assignment]
    response = client.post("/coach", json={"lang": "en", "message": f"hello {SECRET}"})
    assert response.status_code == 500
    assert response.json() == {"detail": "server"}
    logged = everything_logged(caplog, capsys)
    assert "RuntimeError" in logged
    assert SECRET not in logged


def test_real_ollama_client_errors_do_not_log_text(
    caplog: pytest.LogCaptureFixture, capsys: pytest.CaptureFixture[str]
) -> None:
    import asyncio

    import httpx

    from app.ollama_client import ModelUnavailable, OllamaClient

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": f"failed on {SECRET}"})

    caplog.set_level(logging.DEBUG)
    ollama = OllamaClient("http://ollama", "m", 5, transport=httpx.MockTransport(handler))
    with pytest.raises(ModelUnavailable) as error:
        asyncio.run(ollama.chat([{"role": "user", "content": SECRET}]))
    assert SECRET not in str(error.value)
    assert SECRET not in everything_logged(caplog, capsys)


def test_odd_ollama_answers_are_unavailable_not_crashes() -> None:
    import asyncio

    import httpx

    from app.ollama_client import ModelUnavailable, OllamaClient

    for body in ({"message": "not a dict"}, [1, 2], {"message": {"content": 3}}):
        ollama = OllamaClient(
            "http://ollama",
            "m",
            5,
            transport=httpx.MockTransport(lambda _, b=body: httpx.Response(200, json=b)),
        )
        with pytest.raises(ModelUnavailable):
            asyncio.run(ollama.chat([{"role": "user", "content": "hi"}]))
