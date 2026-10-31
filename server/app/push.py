"""Neutral push to supporters through the Expo push service.

The text is fixed and comes from the app's reviewed i18n files (checked by
tests/test_push.py). No member ID, nickname or health word is ever sent.
"""

from dataclasses import dataclass
from functools import cache
from typing import Protocol

import httpx

from app.config import settings

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHANNEL_ID = "circle"

# Same text as notifications.circleTitle / circleBody in app/src/i18n/locales.
PUSH_TEXT: dict[str, dict[str, str]] = {
    "en": {
        "title": "A friend",
        "body": "A friend asked you to check in today.",
    },
    "si": {
        "title": "මිතුරෙක්",
        "body": "අද තමාව සොයා බලන්න කියා මිතුරෙක් ඔබෙන් ඉල්ලුවා.",
    },
    "ta": {
        "title": "ஒரு நண்பர்",
        "body": "இன்று தம்மை விசாரிக்குமாறு ஒரு நண்பர் உங்களிடம் கேட்டுள்ளார்.",
    },
}


@dataclass(frozen=True)
class PushMessage:
    to: str
    title: str
    body: str


class PushSender(Protocol):
    def send(self, messages: list[PushMessage]) -> list[str]:
        """Sends the messages; returns tokens the push service says are gone."""
        ...


class ExpoPushSender:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def send(self, messages: list[PushMessage]) -> list[str]:
        if not messages:
            return []
        payload = [
            {"to": m.to, "title": m.title, "body": m.body, "channelId": CHANNEL_ID}
            for m in messages
        ]
        try:
            response = self._client.post(EXPO_PUSH_URL, json=payload, timeout=10)
            tickets = response.json().get("data", [])
        except (httpx.HTTPError, ValueError, AttributeError):
            # Nothing is logged: the supporter will still see the request in the app.
            return []
        return [
            message.to
            for message, ticket in zip(messages, tickets, strict=False)
            if isinstance(ticket, dict)
            and ticket.get("details", {}).get("error") == "DeviceNotRegistered"
        ]


class DisabledPushSender:
    """Push off (the default until FCM is set up): supporters see requests in the app."""

    def send(self, messages: list[PushMessage]) -> list[str]:
        return []


@cache
def _shared_client() -> httpx.Client:
    """One pooled client for the process, not a new (leaked) one per request."""
    return httpx.Client()


def get_push_sender() -> PushSender:
    if settings.push_enabled:
        return ExpoPushSender(_shared_client())
    return DisabledPushSender()
