"""Privacy: the server may only hold the columns listed in docs/privacy.md.

Adding a column (a name, a note, a location...) fails this test on purpose.
Change docs/privacy.md and this list together, after a privacy review.
"""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.models import Base

ALLOWED: dict[str, set[str]] = {
    "account": {"id", "token_hash", "role", "created_at"},
    "invite": {"code_hash", "member_id", "expires_at"},
    "link": {"id", "member_id", "supporter_id", "status", "created_at"},
    "signal": {"id", "member_id", "created_at"},
    "push_token": {"account_id", "token", "lang"},
}

SERVER_DIR = Path(__file__).resolve().parents[1]


def test_models_match_the_allow_list() -> None:
    actual = {name: set(table.columns.keys()) for name, table in Base.metadata.tables.items()}
    assert actual == ALLOWED


def test_migrations_create_exactly_the_models(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    config = Config(str(SERVER_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    engine = create_engine(url)
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names()) - {"alembic_version"}
        assert tables == set(ALLOWED)
        diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    engine.dispose()
    assert diff == []
