import json
from pathlib import Path

import httpx

from app.push import PUSH_TEXT, ExpoPushSender, PushMessage

APP_LOCALES = Path(__file__).resolve().parents[2] / "app" / "src" / "i18n" / "locales"


def test_push_text_matches_the_apps_reviewed_notification_text() -> None:
    # The app's notification text has a banned-terms test in all 3 languages;
    # the server must send exactly that text, never its own wording.
    for lang, text in PUSH_TEXT.items():
        notifications = json.loads((APP_LOCALES / f"{lang}.json").read_text())["notifications"]
        assert text == {"title": notifications["circleTitle"], "body": notifications["circleBody"]}


def test_expo_sender_posts_only_token_and_fixed_text() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.extend(json.loads(request.content))
        return httpx.Response(200, json={"data": [{"status": "ok", "id": "x"}]})

    sender = ExpoPushSender(httpx.Client(transport=httpx.MockTransport(handler)))
    message = PushMessage(to="ExponentPushToken[a]", title="T", body="B")
    assert sender.send([message]) == []
    assert seen == [
        {"to": "ExponentPushToken[a]", "title": "T", "body": "B", "channelId": "circle"}
    ]


def test_expo_sender_reports_unregistered_tokens() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        ticket = {"status": "error", "details": {"error": "DeviceNotRegistered"}}
        return httpx.Response(200, json={"data": [ticket]})

    sender = ExpoPushSender(httpx.Client(transport=httpx.MockTransport(handler)))
    gone = sender.send([PushMessage(to="ExponentPushToken[a]", title="T", body="B")])
    assert gone == ["ExponentPushToken[a]"]


def test_expo_sender_survives_network_errors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline")

    sender = ExpoPushSender(httpx.Client(transport=httpx.MockTransport(handler)))
    assert sender.send([PushMessage(to="ExponentPushToken[a]", title="T", body="B")]) == []
