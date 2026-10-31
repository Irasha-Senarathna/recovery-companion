# Build from the repo root (docker-compose sets the context) so the shared
# crisis word list in content/ is copied in.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
WORKDIR /srv
COPY coach/pyproject.toml coach/uv.lock ./
RUN uv sync --frozen --no-dev
COPY coach/app ./app
COPY content/crisis_terms.json ./content/crisis_terms.json
RUN useradd --create-home appuser
USER appuser
EXPOSE 8001
# No access log and no database: message text is never written anywhere.
CMD ["/srv/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]
