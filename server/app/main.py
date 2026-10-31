import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import session_factory
from app.purge import purge
from app.ratelimit import Limits
from app.routes import accounts, invites, links, signals
from app.time import system_clock

PURGE_EVERY = 3600


def purge_now() -> None:
    with session_factory()() as db:
        purge(db, system_clock())


async def purge_loop() -> None:
    """Old signals and expired invites are deleted every hour."""
    while True:
        with contextlib.suppress(Exception):  # no details logged; try again next hour
            await asyncio.to_thread(purge_now)
        await asyncio.sleep(PURGE_EVERY)


def create_app(*, run_purge_loop: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(purge_loop()) if run_purge_loop else None
        yield
        if task:
            task.cancel()

    app = FastAPI(
        title="Recovery Companion support-circle API",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
        lifespan=lifespan,
    )
    app.state.limits = Limits()
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for module in (accounts, invites, links, signals):
        app.include_router(module.router)
    return app


app = create_app()
