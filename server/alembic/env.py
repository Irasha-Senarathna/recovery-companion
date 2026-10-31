from alembic import context

from app.db import create_db_engine, database_url
from app.models import Base

config = context.config
# Tests pass a URL in the config; the server uses its own settings.
url = config.get_main_option("sqlalchemy.url") or database_url()

engine = create_db_engine(url)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
