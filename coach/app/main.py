"""Stateless coach API. No database, no files, no message text in any log:
only method, path, status and latency are logged.
"""

import logging
import threading
import time
from collections import deque
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.ollama_client import ChatModel, ModelUnavailable, default_model
from app.pipeline import respond
from app.schemas import CoachRequest, CoachResult

log = logging.getLogger("coach")
if not log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s coach %(message)s"))
    log.addHandler(_handler)
    log.setLevel(logging.INFO)

PER_MINUTE = 30
# A full request (500-char message + 6 turns of 500) is well under this.
MAX_BODY = 16_384
SWEEP_EVERY = 100


class RateLimit:
    """Sliding one-minute window per client address, in memory only."""

    def __init__(self, limit: int, window: float = 60.0) -> None:
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._calls = 0

    def _sweep(self, now: float) -> None:
        """Forgets addresses with no hits in the window, even if they never come back."""
        for key in [k for k, hits in self._hits.items() if hits[-1] <= now - self.window]:
            del self._hits[key]

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            self._calls += 1
            if self._calls % SWEEP_EVERY == 0:
                self._sweep(now)
            hits = self._hits.pop(key, deque())
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            allowed = len(hits) < self.limit
            if allowed:
                hits.append(now)
            if hits:
                self._hits[key] = hits  # keys with no recent hits are forgotten
            return allowed


def create_app(*, model: ChatModel | None = None) -> FastAPI:
    app = FastAPI(title="Recovery Companion coach", docs_url=None, redoc_url=None, openapi_url=None)
    chat_model = model or default_model()
    limit = RateLimit(PER_MINUTE)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["POST"],
            allow_headers=["Content-Type"],
        )

    @app.middleware("http")
    async def log_without_bodies(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        try:
            response = await guarded(request, call_next)
        except Exception as error:  # noqa: BLE001
            # Only the error type: exception messages can hold the request text.
            log.error("%s %s error %s", request.method, request.url.path, type(error).__name__)
            response = JSONResponse({"detail": "server"}, status_code=500)
        ms = (time.perf_counter() - start) * 1000
        log.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, ms)
        return response

    async def guarded(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Size cap and rate limit, both before the body is read or parsed."""
        if request.method == "POST":
            length = request.headers.get("content-length", "")
            if not length.isdigit():
                return JSONResponse({"detail": "invalid"}, status_code=411)
            if int(length) > MAX_BODY:
                return JSONResponse({"detail": "too_large"}, status_code=413)
            if not limit.allow(request.client.host if request.client else "unknown"):
                return JSONResponse({"detail": "too_many_tries"}, status_code=429)
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, __: RequestValidationError) -> JSONResponse:
        # FastAPI's default answer echoes the input back; this one never does.
        return JSONResponse({"detail": "invalid"}, status_code=422)

    def get_model() -> ChatModel:
        return chat_model

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/coach", response_model=CoachResult)
    async def coach(
        body: CoachRequest,
        model: Annotated[ChatModel, Depends(get_model)],
    ) -> CoachResult | JSONResponse:
        try:
            return await respond(body, model)
        except ModelUnavailable:
            return JSONResponse({"detail": "unavailable"}, status_code=503)

    return app


app = create_app()
