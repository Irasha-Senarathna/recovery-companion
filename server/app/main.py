from fastapi import FastAPI

from app.config import settings

app = FastAPI(
    title="Recovery Companion support-circle API",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
