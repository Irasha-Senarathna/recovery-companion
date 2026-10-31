FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN useradd --create-home appuser
USER appuser
EXPOSE 8000
# Migrations first, then the API. No access log: request paths and addresses are not kept.
# Proxy headers are handled by the app (SERVER_TRUSTED_PROXIES), not uvicorn.
CMD ["sh", "-c", "/srv/.venv/bin/alembic upgrade head && exec /srv/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --no-proxy-headers"]
