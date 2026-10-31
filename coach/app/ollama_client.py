"""Talks to Ollama on this laptop. Ollama keeps no chat history for API calls."""

from typing import Literal, Protocol, TypedDict

import httpx

from app.config import settings


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


class ModelUnavailable(Exception):
    """Ollama could not be reached or gave no usable answer."""


class ChatModel(Protocol):
    async def chat(self, messages: list[ChatMessage]) -> str: ...


class OllamaClient:
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.url = base_url.rstrip("/") + "/api/chat"
        self.model = model
        self.timeout = timeout
        self.transport = transport

    async def chat(self, messages: list[ChatMessage]) -> str:
        body = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.4, "num_predict": 300},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                response = await client.post(self.url, json=body)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as error:
            # Only the error type: Ollama's error text could echo the message.
            raise ModelUnavailable(type(error).__name__) from None
        message = data.get("message") if isinstance(data, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str):
            raise ModelUnavailable("no content")
        return content.strip()


def default_model() -> OllamaClient:
    return OllamaClient(settings.ollama_url, settings.model, settings.timeout_seconds)
