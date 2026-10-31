from collections.abc import Iterator
from functools import cache
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import URL, Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


def database_url() -> str | URL:
    if settings.database_url:
        return settings.database_url
    return URL.create(
        "postgresql+psycopg",
        username=settings.db_user or None,
        password=settings.db_password or None,
        host=settings.db_host,
        database=settings.db_name,
    )


def create_db_engine(url: str | URL) -> Engine:
    if isinstance(url, URL):
        return create_engine(url, hide_parameters=True)
    if url.startswith("sqlite"):
        # Tests: one shared in-memory database, with foreign keys enforced like Postgres.
        engine = create_engine(
            url,
            hide_parameters=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(connection: Any, _record: Any) -> None:
            connection.execute("PRAGMA foreign_keys = ON")

        return engine
    # psycopg 3 driver; the URL in .env uses the plain postgresql:// scheme.
    # hide_parameters: IDs and hashes never appear in error logs.
    return create_engine(
        url.replace("postgresql://", "postgresql+psycopg://", 1), hide_parameters=True
    )


@cache
def session_factory() -> sessionmaker[Session]:
    return sessionmaker(create_db_engine(database_url()))


def get_session_factory() -> sessionmaker[Session]:
    """FastAPI dependency; tests swap in an in-memory database."""
    return session_factory()


def get_session(
    factory: Annotated[sessionmaker[Session], Depends(get_session_factory)],
) -> Iterator[Session]:
    with factory() as session:
        yield session
